//
// endpoint.js
// @trenskow/app
// 
// Created by Kristian Trenskow on 2021/11/08
// For license see LICENSE.
// 

import methods from 'methods';
import ApiError from '@trenskow/api-error';

import Router from './router.js';

import {
	isObject,
	resolveInlineImport,
	canPotentiallyResolveRouter,
	resolveRouter,
	matchPath } from './util.js';

export default class Endpoint extends Router {

	constructor() {
		super();

		methods.concat(['all']).forEach((method) => {

			this[method] = (...handlers) => {
				handlers = [].concat(...handlers);
				return this._on(method, handlers);
			};

			this[method].catchAll = (...handlers) => {
				handlers = [].concat(...handlers);
				return this._on(method, handlers, 'indirect');
			};

		});

	}

	_on(method, handlers, match) {

		method = method.toLowerCase();

		if (!methods.concat(['all']).includes(method)) {
			throw new Error(`Method ${method} is unknown.`);
		}

		if (!handlers.length) return this;

		match = match || 'direct';

		if (!['direct', 'indirect'].includes(match)) {
			throw new Error(`Match does not support ${match}.`);
		}

		this._layers.push({
			type: 'method',
			method,
			handlers,
			match
		});

		return this;

	}

	mount(path, endpoint) {

		if (isObject(path)) {
			({ path, endpoint } = path);
		}

		if (typeof path !== 'string') throw new Error('Path must be a string.');
		if (path.includes('/')) throw new Error('Path should not contain \'/\'.');

		if (canPotentiallyResolveRouter(endpoint, Endpoint)) {
			this._layers.push({
				type: 'mount',
				path,
				endpoint
			});
		}

		return this;

	}

	get mounts() {
		return new Proxy({}, {
			get: (_, path) => {
				return (endpoint) => {
					return this.mount(path, endpoint);
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

		if (canPotentiallyResolveRouter(endpoint, Endpoint)) {
			this._layers.push({
				type: 'parameter',
				name,
				transform,
				endpoint
			});
		}

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

	middleware(route) {

		if (isObject(route)) {
			({ route } = route);
		}

		if (canPotentiallyResolveRouter(route, Router)) {
			this._layers.push({
				type: 'middleware',
				route
			});
		}

		return this;

	}

	async _route(path, context, next, idx = 0) {

		if (idx === this._layers.length && !path.length) {

			const methods = this._layers
				.filter((layer) => layer.type === 'method')
				.map((layer) => layer.method.toUpperCase())
				.filter((value, index, array) => array.indexOf(value) === index);

			if (methods.length) {
				context.response.headers.allow = methods.join(', ');
				throw new ApiError.MethodNotAllowed();
			}

		}

		return await super._route(path, context, next, idx);

	}

	async _handle(layer, path, context, next) {

		switch (layer.type) {

			case 'mount': {

				if (path.length === 0) return await next();

				if (matchPath(path[0], layer.path, context)) {
					const endpoint = await resolveRouter(layer.endpoint, context, Endpoint);
					return await endpoint._route(path.slice(1), context, next);
				}

				return await next();

			}

			case 'method': {

				if (layer.match === 'direct' && path.length > 0) return await next();
				if (layer.method !== 'all' && layer.method !== context.request.method.toLowerCase()) return await next();

				for (let handler of layer.handlers) {
					handler = await resolveInlineImport(handler);
					context.result = await handler(context);
					if (context.state !== 'processing') break;
				}

				return context.result;

			}

			case 'parameter': {

				if (path.length === 0) return await next();

				context.parameters[layer.name] = await layer.transform?.(path[0], layer.name) || path[0];

				const endpoint = await resolveRouter(layer.endpoint, context, Endpoint);
				return await endpoint._route(path.slice(1), context, next);

			}

			case 'middleware': {

				const router = await resolveRouter(layer.route, context, Router);

				return await router._route(path, context, next);

			}

			default:
				return await super._handle(layer, path, context, next);

		}

	}

}
