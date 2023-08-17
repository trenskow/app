//
// response.js
// @trenskow/app
//
// Created by Kristian Trenskow on 2021/11/07
// For license see LICENSE.
//

import caseit from '@trenskow/caseit';

import { ServerResponse } from 'http';

export default class Response extends ServerResponse {

	#headerListeners;
	#headersProxy;

	constructor(...args) {
		super(...args);
		this.#headerListeners = [];
	}

	get headers() {
		return this.#headersProxy || (this.#headersProxy = new Proxy(this, {
			get: function (target, prop) {

				if (prop === 'on') return (name, callback) => {

					name = caseit(name);

					target.#headerListeners[name] = target.#headerListeners[name] || [];
					target.#headerListeners[name].push(callback);

				};

				return target.getHeader(prop);

			},
			set: function (target, prop, value) {

				if (typeof value === 'undefined') {
					return target.removeHeader(prop);
				} else {
					target.setHeader(prop, value);
				}

				prop = caseit(prop);

				target.#headerListeners[prop]
					?.forEach((callback) => callback(value));

				return true;

			}
		}));
	}

	getHeader(name) {
		return super.getHeader(caseit(name, 'http'));
	}

	setHeader(name, value) {
		return super.setHeader(caseit(name, 'http'), value);
	}

	removeHeader(name) {
		return super.removeHeader(caseit(name, 'http'));
	}

	hasHeader(name) {
		return super.hasHeader(caseit(name, 'http'));
	}

	getHeaderNames() {
		return super.getHeaderNames().map((name) => caseit(name));
	}

	writeHead(...args) {
		super.writeHead(...args);
		this.emit('writeHead');
	}

}
