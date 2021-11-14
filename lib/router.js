//
// router.js
// @trenskow/app
// 
// Created by Kristian Trenskow on 2021/11/07
// For license see LICENSE.
// 

import { isObject, resolveInlineImport, resolveRouter } from './util.js';

export default class Router {

	constructor() {
		this._layers = [];
	}

	use(...handlers) {

		handlers = [].concat(...handlers);

		if (!handlers.length) return this;

		this._layers.push({
			type: 'use',
			handlers: handlers.map(resolveInlineImport)
		});

		return this;

	}

	mixin(router) {

		if (isObject(router)) {
			({ router } = router);
		}

		this._layers.push({
			type: 'mixin',
			router: resolveRouter(router, this.constructor)
		});

		return this;

	}

	async _route(path, context, next, idx = 0) {

		if (context.state !== 'processing') return;

		if (idx === this._layers.length) return await next();

		return this._handle(this._layers[idx], path, context, async () => {
			return await this._route(path, context, next, idx + 1);
		});

	}

	async _handle(layer, path, context, next) {

		switch (layer.type) {

			case 'use': {

				for (let handler of layer.handlers) {
					await handler(context);
					if (context.state !== 'processing') return;
				}

				return await next();

			}

			case 'mixin': {
				return await layer.router._route(path, context, next);
			}

		}

	}

}
