//
// application.js
// @trenskow/app
//
// Created by Kristian Trenskow on 2021/11/07
// For license see LICENSE.
//

import caseit from '@trenskow/caseit';
import { duration } from '@trenskow/units';

export default class Cookies {

	#_cookies = {
		current: {},
		requested: {},
	};

	#_request;
	#_response;
	#_path;
	#_casing;
	#_proxy;

	constructor({ request, response, path }, casing = this.#_casing) {

		if (!request || !response) {
			throw new Error('Cookies must be initialized with a request and response.');
		}

		this.#_request = request;
		this.#_response = response;
		this.#_path = path;
		this.#_casing = casing;

		(this.#_request.headers?.cookie || '').split(/; ?/)
			.filter(cookie => cookie)
			.forEach(cookie => {

				const [name, value] = cookie.split('=')
					.map(part => decodeURIComponent(part.trim()));

				this.#_cookies.requested[caseit(name)] = (this.#_cookies.current[caseit(name)] = { value }).value;

			});

	}

	get _proxy() {
		return this.#_proxy || (this.#_proxy = new Proxy(this, {
			get: (target, prop) => {

				prop = caseit(prop);

				if (Object.hasOwn(target, prop) || Object.hasOwn(Object.getPrototypeOf(target), prop)) {
					return target[prop];
				}

				return target.#_cookies.current[prop]?.value;

			},
			set: (target, prop, value) => {

				prop = caseit(prop);

				if (typeof value === 'undefined') {
					delete target.#_cookies.current[prop];
				} else if (typeof value === 'undefined' || typeof value === 'string') {
					this.#_proxy[prop] = { value };
				} else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {

					let {
						value: cookieValue,
						expires,
						path = 'current',
						domain = 'current',
						secure = true,
						httpOnly = false
					} = value;

					if (typeof cookieValue === 'undefined') {
						this.#_proxy[prop] = undefined;
						return true;
					} else if (typeof cookieValue !== 'string') {
						throw new TypeError('Cookie values must be a string.');
					}

					if (path === 'current') {
						path = `${this.#_path.current.join('/')}/`;
					} else if (path === 'root') {
						path = '/';
					}

					if (domain === 'current') {
						domain = target.#_request.host;
					} else if (domain === 'root') {
						domain = target.#_request.host.split('.').slice(-2).join('.');
					}

					if (typeof expires !== 'undefined' && !(['number', 'string'].includes(typeof expires) || expires instanceof Date)) {
						throw new TypeError('Expires must be a number, string or Date.');
					}

					target.#_cookies.current[prop] = {
						value: cookieValue,
						expires,
						path,
						domain,
						secure,
						httpOnly
					};

				} else {
					throw new TypeError('Cookie values must be a strings, object or undefined.');
				}

				return true;

			},
			deleteProperty: (_, prop) => {
				this.#_proxy[prop] = undefined;
				return true;
			},
		}));
	}

	#_format(name, { value, expires, path, domain, secure, httpOnly }) {

		const parts = [`${encodeURIComponent(caseit(name, this.#_casing))}=${encodeURIComponent(value || '')}`];

		if (!value) {
			parts.push('Max-Age=0');
		} else if (expires) {
			if (typeof expires === 'number' || typeof expires === 'string') {
				parts.push(`Max-Age=${duration.s(expires)}`);
			} else if (expires instanceof Date) {
				parts.push(`Expires=${expires.toUTCString()}`);
			}
		}

		if (path) {
			parts.push(`Path=${path}`);
		}

		if (domain) {
			parts.push(`Domain=${domain}`);
		}

		if (secure) {
			parts.push('Secure');
		}

		if (httpOnly) {
			parts.push('HttpOnly');
		}

		return parts.join('; ');

	}

	_render() {

		const deletedCookies = Object.keys(this.#_cookies.requested)
			.filter(name => !Object.hasOwn(this.#_cookies.current, name))
			.map(name => this.#_format(name, { value: undefined }));

		const allCookies = Object.entries(this.#_cookies.current)
			.map(([name, cookie]) => this.#_format(name, cookie))
			.concat(deletedCookies);

		if (allCookies.length === 0) {
			return;
		}

		this.#_response.headers.setCookie = allCookies;

	}

};
