//
// router.js
// @trenskow/app
// 
// Created by Kristian Trenskow on 2021/11/07
// For license see LICENSE.
// 

import { resolveInlineImport } from './util.js';

export default class Router {

	constructor() {
		this._layers = [];
	}

	use(...handlers) {

		handlers = [].concat(...handlers);

		if (!handlers.length) return this;

		this._layers.push({
			type: 'use',
			handlers
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

	async _handle(layer, _path, context, next) {

		switch (layer.type) {

			case 'use': {

				for (let handler of layer.handlers) {

					handler = (await resolveInlineImport(handler));
					await handler(context);

					if (context.state !== 'processing') return;

				}

				return await next();

			}

		}

	}

}
