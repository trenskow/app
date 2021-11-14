//
// application.js
// @trenskow/app
// 
// Created by Kristian Trenskow on 2021/11/07
// For license see LICENSE.
// 

import http from 'http';

import ApiError from '@trenskow/api-error';
import caseit from '@trenskow/caseit';

import Request from './request.js';
import Response from './response.js';
import Endpoint from './endpoint.js';

import { isObject } from './util.js';

export default class Application {

	constructor(options = {}) {

		const {
			port = 0,
			RequestType = Request,
			ResponseType = Response,
			path = Object.assign({
				mountMatchMode: 'loosely'
			}, options.path || {}),
			server = Object.assign({
				create: http.createServer,
				options: {}
			}, options.server || {})
		} = options;

		this._port = port;

		if (typeof path.mountMatchMode !== 'string' || !['loosely', 'strict'].includes(path.mountMatchMode)) {
			throw new Error('options.path.mountMatchMode must either be `loosely` or `strict`.');
		}

		this._path = path;

		this._state = 'closed';

		this._server = server.create(
			Object.assign({
				IncomingMessage: RequestType,
				ServerResponse: ResponseType
			}, server.options), (req, res) => {
				this._onIncomingRequest(req, res);
			});

		this._rootEndpoint = new Endpoint()
			.use(() => { throw new ApiError.NotFound(); });

		this._renderer = async ({ result, response }) => {
			if (result instanceof ApiError) {
				response.end();
			} else if (typeof result === 'string') {
				response.headers.contentType = 'text/plain; charset=utf-8';
				response.end(result);
			} else if (Buffer.isBuffer(result)) {
				response.end(result);
			} else {
				response.end();
			}
		};

	}

	get port() {
		return this._port;
	}

	get server() {
		return this._server;
	}

	get state() {
		return this._state;
	}

	async open(port) {

		if (this._state !== 'closed') {
			throw new Error(`Cannot open in the ${this._state} state.`);
		}

		if (isObject(port)) {
			({ port } = port);
		}

		this._port = port || this._port;

		if (typeof this._port !== 'number') throw new Error('Port is not a number.');

		this._state = 'opening';

		await new Promise((resolve, reject) => {
			this._server.listen(this._port)
				.once('listening', () => {
					this._port = this._server.address().port;
					resolve();
				})
				.once('error', reject);
		});

		this._state = 'open';

		return this;

	}

	async close(awaitAllConnections) {

		if (isObject(awaitAllConnections)) {
			({ awaitAllConnections } = awaitAllConnections);
		}

		if (this._state !== 'open') {
			throw new Error(`Cannot close in the ${this._state} state.`);
		}

		this._state = 'closing';

		await new Promise((resolve, reject) => {
			if (awaitAllConnections) {
				this._server.once('close', resolve);
				this._server.once('error', reject);
			} else {
				resolve();
			}
			this._server.close();
		});

		this._state = 'closed';

		return this;

	}

	async _onIncomingRequest(request, response) {

		let [, path, query = ''] = request.url.match(/^(\/.*?)(?:$|\?(.*?)$)/);

		if (path.substr(-1) === '/') path = path.slice(0, -1);

		query = Object.fromEntries(query.split(/&/).map((entry) => {
			const [key, value] = entry.split(/=/).map(decodeURIComponent);
			return [caseit(key), value];
		}));

		let state = 'routing';

		request.socket.once('end', () => {
			if (['routing', 'rendering'].includes(state)) state = 'aborted';
		});

		path = {
			components: path
				.split('/')
				.map(decodeURIComponent)
				.slice(1),
			position: -1,
			async pushed(todo) {
				this.position++;
				try {
					await todo();
				} finally {
					this.position--;
				}
			},
			get isLast() {
				return this.position === this.components.length;
			},
			get component() {
				return this.components[this.position - 1];
			}
		};

		let context = {
			application: this,
			request,
			response,
			parameters: {},
			path: {
				get full() {
					return path.components;
				},
				get current() {
					return path.components.slice(0, path.position + 1);
				},
				get remaining() {
					return path.components.slice(path.position + 1);
				}
			},
			query: new Proxy(query, {
				get: (target, property) => target[caseit(property)],
				set: (target, property, value) => target[caseit(property)] = value
			}),
			render: () => {
				state = 'rendering';
			},
			abort: async (error, brutally) => {

				if (isObject(error)) {
					({ error, brutally } = error);
				}

				state = 'aborted';

				if (error) context.result = error;

				if (brutally) {
					return new Promise((resolve, reject) => {
						request.socket.once('close', resolve);
						request.socket.once('error', reject);
						request.socket.destroy();
					});
				}

			}
		};

		Object.defineProperty(context, 'state', {
			get: () => state,
			enumerable: true
		});

		try {

			await path.pushed(async () => {
				await this._rootEndpoint._route(
					path,
					context,
					async () => {
						throw new ApiError.NotFound();
					});
			});

			context.response.statusCode = (context.result?.length ? 200 : 204);

		} catch (error) {

			if (typeof error.toJSON !== 'function') {
				console.error(error.stack);
				context.result = new ApiError.InternalError({ underlying: error });
			} else {
				context.result = error;
			}

			context.response.statusCode = error.statusCode ?? 500;

		}

		if (!['routing', 'rendering'].includes(state)) return;

		state = 'rendering';

		try {
			await this._renderer(context);
		} catch (error) {
			console.error(`Error in render method "${error.message}"`);
			request.socket.destroy();
		}

		state = 'completed';

	}

	root(endpoint) {

		if (isObject(endpoint)) {
			({ endpoint } = endpoint);
		}

		if (!(endpoint instanceof Endpoint)) {
			throw new Error('Root endpoint must be of type Endpoint');
		}

		this._rootEndpoint = endpoint;

		return this;

	}

	renderer(renderer) {

		if (isObject(renderer)) {
			({ renderer } = renderer);
		}

		this._renderer = renderer;

		return this;

	}

}
