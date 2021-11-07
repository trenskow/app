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

	constructor(...args) {
		super(...args);
		this.__headers = {};
	}

	get headers() {
		return new Proxy(this, {
			get: function(target, prop) {
				return target.getHeader(prop);
			},
			set: function(target, prop, value) {
				if (typeof value === 'undefined') {
					return target.removeHeader(prop);
				} else {
					target.setHeader(prop, value);
				}
				return value;
			}
		});
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

}
