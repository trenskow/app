//
// endpoint.js
// @trenskow/app
//
// Created by Kristian Trenskow on 2021/11/08
// For license see LICENSE.
//

import ApiError from '@trenskow/api-error';

import Router from './router.js';

import { isObject, matchPath, resolveInlineImport, Methods } from './util/index.js';

export default class Endpoint extends Router {

	constructor() {
		super();

		Methods.all.forEach((method) => {

			Object.defineProperty(this, method, {
				get: () => new Methods({
					existing: [method],
					additional: ['catchAll'],
					todo: (methods, ...handlers) => {

						handlers = [].concat(...handlers);

						let match = 'direct';

						if (methods.includes('catchAll')) {
							match = 'indirect';
							methods = methods.filter((method) => method !== 'catchAll');
						}

						return this._on(methods, handlers, match);

					}
				})
			});

		});

	}

	_on(methods, handlers, match) {

		methods.forEach((method) => {
			if (!Methods.all.includes(method)) {
				throw new Error(`Method ${method} is unknown.`);
			}
		});

		match = match || 'direct';

		if (!['direct', 'indirect'].includes(match)) {
			throw new Error(`Match does not support ${match}.`);
		}

		if (!handlers.length) return this;

		handlers = handlers.map(resolveInlineImport);

		if (handlers.filter((handler) => typeof handler !== 'function').length) {
			throw new Error('Handler must be a function.');
		}

		const existing = this._layers.findIndex((layer) => {
			return (layer.handler === this._handleMethod && methods.some((method) => layer.methods.includes(method)));
		});

		if (existing !== -1) {
			throw new Error('Endpoint already has a handler.');
		}

		this._layers.push({
			handler: this._handleMethod,
			methods,
			handlers,
			match
		});

		return this;

	}

	all(...handlers) {
		return this._on(Methods.all, handlers);
	}

	mount(path, endpoint) {

		if (isObject(path)) {
			({ path, endpoint } = path);
		}

		if (typeof path !== 'string') throw new Error('Path must be a string.');
		if (path.includes('/')) throw new Error('Path should not contain \'/\'.');

		endpoint = resolveInlineImport(endpoint);

		if (!(endpoint instanceof Endpoint)) {
			throw new Error('Endpoints must be of type Endpoint');
		}

		this._layers.push({
			handler: this._handleMount,
			path,
			endpoint
		});

		return this;

	}

	get mounts() {
		return new Proxy(this, {
			get: (target, path) => {
				return (endpoint) => {
					return target.mount(path, endpoint);
				};
			}
		});
	}

	parameter(name, endpoint, transform) {

		if (isObject(name)) {
			({ name, endpoint, transform } = name);
		}

		if (typeof name !== 'string') throw new Error('Path must be a string.');
		if (name.includes('/')) throw new Error('Path should not contain \'/\'.');

		endpoint = resolveInlineImport(endpoint);

		if (typeof transform !== 'undefined' && typeof transform !== 'function') {
			throw new Error('Transforms must be a function.');
		}

		if (!(endpoint instanceof Endpoint)) {
			throw new Error('Endpoints must be of type Endpoint');
		}

		this._layers.push({
			handler: this._handleParameter,
			name,
			transform,
			endpoint
		});

		return this;

	}

	get parameters() {
		return new Proxy({}, {
			get: (_, name) => {
				return (router) => {
					if (isObject(router)) {
						return this.parameter(Object.assign(router, {
							name
						}));
					}
					return this.parameter(name, router);
				};
			}
		});
	}

	middleware(router) {

		if (isObject(router)) {
			({ router } = router);
		}

		router = resolveInlineImport(router);

		if (router?.constructor?.name !== 'Router') {
			throw new Error('Middleware routers must be of type Router.');
		}

		this._layers.push({
			handler: this._handleMiddleware,
			router
		});

		return this;

	}

	async _route(path, context, next, idx = 0) {

		if (idx === this._layers.length) {

			if (path.isLast) {

				const methods = this._layers
					.filter((layer) => layer.handler === this._handleMethod)
					.reduce((methods, layer) => methods.concat(layer.methods), [])
					.filter((value, index, array) => array.indexOf(value) === index);

				if (methods.length) {
					context.response.headers.allow = methods.map((method) => method.toUpperCase()).join(', ');
					throw new ApiError.MethodNotAllowed();
				}

			} else {
				throw new ApiError.NotFound();
			}

		}

		return await super._route(path, context, next, idx);

	}

	async _handleMount(layer, path, context, next) {

		return await path.pushed(async (component) => {

			if (!component) return path.popped(next);

			if (matchPath(component, layer.path, context)) {
				return await layer.endpoint._route(path, context, next);
			}

			return path.popped(next);

		});

	}

	async _handleMethod(layer, path, context, next) {

		let underlyingMethod = context.request.method.toLowerCase();

		if (underlyingMethod === 'head' && !this._layers.some((layer) => layer.methods.includes('head'))) {
			underlyingMethod = 'get';
		}

		if (layer.match === 'direct' && !path.isLast) return await next();
		if (!layer.methods.includes(underlyingMethod)) return await next();

		for (let handler of layer.handlers) {
			const result = await handler(context);
			if (layer.underlyingMethod === 'head') return;
			if (context.state !== 'routing') return;
			if (typeof result !== 'undefined') context.result = result;
		}

		return context.result;

	}

	async _handleParameter(layer, path, context, next) {

		return await path.pushed(async (component) => {

			if (!component) return await path.popped(next);

			context.parameters[layer.name] = component;

			if (typeof layer.transform === 'function') {
				context.parameters[layer.name] = await layer.transform(
					Object.fromEntries([
						['context', context],
						[layer.name, component]
					])
				);
			}

			return await layer.endpoint._route(path, context, next);

		});

	}

	async _handleMiddleware(layer, path, context, next) {
		return await layer.router._route(path, context, next);
	}

}
