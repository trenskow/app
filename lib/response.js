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
					target.removeHeader(prop);
				} else {
					target.setHeader(prop, value);
				}

				return true;

			}
		}));
	}

	getHeader(name) {
		return super.getHeader(caseit(name, 'http'));
	}

	setHeader(name, value) {

		name = caseit(name);

		if (this.#headerListeners[name]?.some((callback) => callback(value) === false)) return;

		return super.setHeader(caseit(name, 'http'), value);
	}

	removeHeader(name) {

		name = caseit(name);

		if (this.#headerListeners[name]?.some((callback) => callback() === false)) return;

		return super.removeHeader(caseit(name, 'http'));

	}

	hasHeader(name) {
		return super.hasHeader(caseit(name, 'http'));
	}

	getHeaderNames() {
		return super.getHeaderNames().map((name) => caseit(name));
	}

	writeHead(statusCode, statusMessage, headers) {

		if (typeof statusMessage === 'object' && typeof headers === 'undefined') {
			headers = statusMessage;
			statusMessage = undefined;
		}

		Object.entries(headers || {})
			.forEach(([name, value]) => this.setHeader(name, value));

		super.writeHead(statusCode, statusMessage);

		this.emit('writeHead');

	}

}
