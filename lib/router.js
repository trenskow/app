//
// router.js
// @trenskow/app
//
// Created by Kristian Trenskow on 2021/11/07
// For license see LICENSE.
//

import {
	isObject,
	resolveInlineImport,
	Methods
} from './util/index.js';

export default class Router {

	constructor() {

		this._layers = [];

	}

	#_use(handlers, methods) {

		handlers = [].concat(...handlers);

		if (!handlers.length) return this;

		handlers = handlers.map(resolveInlineImport);

		if (handlers.filter((handler) => typeof handler !== 'function').length) {
			throw new Error('Handler must be a function.');
		}

		this._layers.push({
			handler: this._handleUse,
			handlers,
			methods
		});

		return this;

	}

	get use() {
		return new Methods({
			todo: (methods, ...handlers) => {
				return this.#_use(handlers, methods);
			}
		});
	}

	mixin(router) {

		if (isObject(router)) {
			({ router } = router);
		}

		router = resolveInlineImport(router);

		if (!(router instanceof this.constructor)) {
			throw new Error(`Can only mixin routers of type ${this.constructor.name}.`);
		}

		this._layers.push({
			handler: this._handleMixin,
			router: router
		});

		return this;

	}

	transform(...transforms) {

		transforms = [].concat(...transforms);

		if (!transforms.length) return this;

		transforms = transforms.map(resolveInlineImport);

		if (transforms.filter((hook) => typeof hook !== 'function').length) {
			throw new Error('Hook must be a function.');
		}

		this._layers = this._layers
			.concat(transforms.map((hook) => {
				return {
					handler: this._handleTransform,
					hook
				};
			}));

		return this;

	}

	async _route(path, context, next, idx = 0) {

		if (context.state !== 'routing') return;

		if (idx === this._layers.length) return await next();

		return this._handle(this._layers[idx], path, context, async () => {
			return await this._route(path, context, next, idx + 1);
		});

	}

	async _handleUse(layer, _, context, next) {

		const { request } = context;

		if (layer.methods.length === 0 || layer.methods.includes(request.method.toLowerCase())) {

			for (let handler of layer.handlers) {
				await handler(context);
				if (context.state !== 'routing') return;
			}

		}

		return await next();

	}

	async _handleMixin(layer, path, context, next) {
		return await layer.router._route(path, context, next);
	}

	async _handleTransform(layer, _, context, next) {
		return context.result = await layer.hook({ result: next, context });
	}

	async _handle(layer, path, context, next) {
		return await layer.handler.call(this, layer, path, context, next);
	}

}
