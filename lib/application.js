//
// application.js
// @trenskow/app
//
// Created by Kristian Trenskow on 2021/11/07
// For license see LICENSE.
//

import http from 'http';
import EventEmitter from 'events';
import { Stream } from 'stream';

import ApiError from '@trenskow/api-error';
import caseit from '@trenskow/caseit';

import Request from './request.js';
import Response from './response.js';
import Endpoint from './endpoint.js';

import { isObject } from './util/index.js';

export default class Application extends EventEmitter {

	#_port;
	#_path;
	#_state;
	#_server;
	#_rootEndpoint;
	#_renderer;

	constructor(options = {}) {
		super();

		const {
			port = 0,
			RequestType = Request,
			ResponseType = Response,
			path = Object.assign({
				matchMode: 'loosely'
			}, options.path || {}),
			server = Object.assign({
				create: http.createServer,
				options: {}
			}, options.server || {})
		} = options;

		this.#_port = port;

		if (typeof path.matchMode !== 'string' || !['loosely', 'strict'].includes(path.matchMode)) {
			throw new Error('options.path.matchMode must either be `loosely` or `strict`.');
		}

		this.#_path = path;

		this.#_state = 'closed';

		this.#_server = server.create(
			Object.assign({
				IncomingMessage: RequestType,
				ServerResponse: ResponseType
			}, server.options), (req, res) => {
				this.#_onIncomingRequest(req, res);
			});

		this.#_rootEndpoint = new Endpoint()
			.use(() => { throw new ApiError.NotFound(); });

		this.#_renderer = async ({ result, request, response }) => {
			if (request.method.toLowerCase() === 'head') {
				response.end();
			} else if (result instanceof Stream) {
				result.pipe(response);
			} else if (result instanceof ApiError) {
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

	get path() {
		return new Proxy(this.#_path, {
			get: (target, property) => target[property]
		});
	}

	get port() {
		return this.#_port;
	}

	get server() {
		return this.#_server;
	}

	get state() {
		return this.#_state;
	}

	#_setState(state) {
		this.#_state = state;
		this.emit(state);
	}

	async open(port) {

		if (this.state !== 'closed') {
			throw new Error(`Cannot open in the ${this.state} state.`);
		}

		if (isObject(port)) {
			({ port } = port);
		}

		this.#_port = port || this.#_port;

		if (typeof this.#_port !== 'number') throw new Error('Port is not a number.');

		this.#_setState('opening');

		await new Promise((resolve, reject) => {
			this.#_server.listen(this.#_port)
				.once('listening', () => {
					this.#_port = this.#_server.address().port;
					resolve();
				})
				.once('error', reject);
		});

		this.#_setState('open');

		this.emit('opened', this.#_port);

		return this;

	}

	async close(awaitAllConnections) {

		if (isObject(awaitAllConnections)) {
			({ awaitAllConnections } = awaitAllConnections);
		}

		if (this.state !== 'open') {
			throw new Error(`Cannot close in the ${this.state} state.`);
		}

		this.#_setState('closing');

		this.emit('closing');

		await new Promise((resolve, reject) => {
			if (awaitAllConnections) {
				this.#_server.once('close', resolve);
				this.#_server.once('error', reject);
			} else {
				resolve();
			}
			this.#_server.close();
		});

		this.#_setState('closed');

		this.emit('closed');

		return this;

	}

	async #_onIncomingRequest(request, response) {

		let [, path, query = ''] = request.url.match(/^(\/.*?)(?:$|\?(.*?)$)/);

		if (path.substr(-1) === '/') path = path.slice(0, -1);

		query = Object.fromEntries(query
			.split(/&/)
			.filter((entry) => entry)
			.map((entry) => {
				return [entry].concat(entry.split(/=/).map(decodeURIComponent));
			})
			.filter(([_, key]) => key)
			.map(([entry, key, value]) => {
				if (typeof value === 'undefined' || value === '') {
					value = entry.slice(-1) === '=' ? undefined : true;
				}
				return [caseit(key), value];
			}));

		let state = 'routing';

		path = {
			components: path
				.split('/')
				.map(decodeURIComponent)
				.slice(1),
			position: -1,
			async _walk(direction, todo) {
				this.position += direction;
				try {
					return await todo(path.component);
				} finally {
					this.position -= direction;
				}
			},
			async pushed(todo) {
				return this._walk(1, todo);
			},
			async popped(todo) {
				return this._walk(-1, todo);
			},
			get isLast() {
				return this.position === this.components.length;
			},
			get component() {
				return this.components[this.position - 1];
			}
		};

		const render = async () => {

			state = 'rendering';

			try {
				await this.#_renderer(context);
			} catch (error) {
				console.error(`Error in render method "${error.message}"`);
				request.socket.destroy();
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
					return path.components.slice(0, path.position);
				},
				get remaining() {
					return path.components.slice(path.position);
				},
				set remaining(remaining) {

					if (typeof remaining === 'string') {
						remaining = remaining
							.split('/')
							.filter((component) => component);
					}

					if (!Array.isArray(remaining)) {
						remaining = [remaining];
					}

					remaining.forEach((component) => {
						if (typeof component !== 'string') throw new Error('Path component must be a string.');
					});

					path.components = context.path.current.concat(remaining);

				}
			},
			query,
			render: () => {
				state = 'rendering';
			},
			abort: async (error, brutally) => {

				if (isObject(error)) {
					({ error, brutally } = error);
				}

				if (!['completed', 'aborted', 'ignored'].includes(state)) {
					state = 'aborted';
					if (error) context.result = error;
				}

				if (brutally) {
					return new Promise((resolve, reject) => {
						request.socket.once('close', resolve);
						request.socket.once('error', reject);
						request.socket.destroy();
					});
				}

				await render();

			},
			ignore: () => {
				if (!['completed', 'aborted', 'ignored'].includes(state)) {
					state = 'ignored';
				}
			}

		};

		Object.defineProperty(request, 'context', {
			get: () => context,
			enumerable: true
		});

		Object.defineProperty(context, 'state', {
			get: () => state,
			enumerable: true
		});

		const listeners = {
			eventEmitters: [
				[request.socket, ['end', 'error']],
				[request, ['error']],
				[response, ['close', 'error']]],
			ended: (error) => {

				listeners.remove();

				if (!['completed', 'aborted'].includes(state)) {
					context.result = new ApiError.BadRequest('Request ended prematurely.');
					state = 'aborted';
				}

				if (!error && context.result instanceof Error) {
					error = context.result;
				}

				response.emit('processed', error);

			},
			do: (what) => {
				listeners.eventEmitters.forEach(([eventEmitter, events]) => {
					events.forEach((event) => eventEmitter[what](event, listeners.ended));
				});
			},
			add: () => listeners.do('once'),
			remove: () => listeners.do('removeListener')
		};

		listeners.add();

		try {

			await path.pushed(async () => {
				await this.#_rootEndpoint._route(
					path,
					context,
					async () => {
						throw new ApiError.NotFound();
					});
			});

			if (state === 'ignored') return;

			if (context.response.statusCode === 200) {
				context.response.statusCode = typeof context.result !== 'undefined' ? 200 : 204;
			}

		} catch (error) {

			context.result = error;
			context.response.statusCode = error.statusCode ?? 500;

		}

		if (!['routing', 'rendering'].includes(state)) return response.end();

		await render();

		state = 'completed';

	}

	root(endpoint) {

		if (isObject(endpoint)) {
			({ endpoint } = endpoint);
		}

		if (!(endpoint instanceof Endpoint)) {
			throw new Error('Root endpoint must be of type Endpoint');
		}

		this.#_rootEndpoint = endpoint;

		return this;

	}

	renderer(renderer) {

		if (isObject(renderer)) {
			({ renderer } = renderer);
		}

		this.#_renderer = renderer;

		return this;

	}

}
