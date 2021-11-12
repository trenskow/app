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

import { isObject, canPotentiallyResolveRouter, resolveRouter } from './util.js';

export default class Application {

	constructor(options = {}) {

		this._port = options.port || 0;

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

		if (typeof port !== 'number') throw new Error('Path must be a number.');

		this._port = port;

		if (typeof path.mountMatchMode !== 'string' || !['loosely', 'strict'].includes(path.mountMatchMode)) {
			throw new Error('path.mountMatchMode must either be `loosely` or `strict`.');
		}

		this._path = path;

		this._server = server.create(
			Object.assign({
				IncomingMessage: RequestType,
				ServerResponse: ResponseType
			}, server.options), (req, res) => {
				this._onIncomingRequest(req, res);
			});

		this._rootEndpoint = async ({ endpoint }) => {
			endpoint.use(() => { throw new ApiError.NotFound(); });
		};

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

	async start() {
		return new Promise((resolve, reject) => {
			this._server.listen(this._port)
				.once('listening', () => {
					this._port = this._server.address().port;
					resolve(this);
				})
				.once('error', reject);
		});
	}

	async stop(awaitAllConnections) {

		if (isObject(awaitAllConnections)) {
			({ awaitAllConnections } = awaitAllConnections);
		}

		return new Promise((resolve, reject) => {
			if (awaitAllConnections) {
				this._server.once('close', () => resolve(this));
				this._server.once('error', reject);
			} else {
				resolve(this);
			}
			this._server.close();
		});

	}

	async _onIncomingRequest(request, response) {

		let [, path, query = ''] = request.url.match(/^(\/.*?)(?:$|\?(.*?)$)/);

		if (path.substr(-1) === '/') path = path.slice(0, -1);

		query = Object.fromEntries(query.split(/&/).map((entry) => {
			const [key, value] = entry.split(/=/).map(decodeURIComponent);
			return [caseit(key), value];
		}));

		let state = 'processing';

		request.socket.once('end', () => {
			if (['processing', 'rendering'].includes(state)) state = 'aborted';
		});

		let context = {
			application: this,
			request,
			response,
			parameters: {},
			path,
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

		const rootEndpoint = await resolveRouter(this._rootEndpoint, context, Endpoint);

		try {

			await rootEndpoint._route(
				path
					.split('/')
					.map(decodeURIComponent)
					.slice(1),
				context,
				async () => {
					throw new ApiError.NotFound();
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

		if (!['processing', 'rendering'].includes(state)) return;

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
			({ rootEndpoint: endpoint } = endpoint);
		}

		if (canPotentiallyResolveRouter(endpoint)) {
			this._rootEndpoint = endpoint;
		}

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
