//
// request.js
// @trenskow/app
// 
// Created by Kristian Trenskow on 2021/11/07
// For license see LICENSE.
// 

import { IncomingMessage } from 'http';

import caseit from '@trenskow/caseit';

export default class Request extends IncomingMessage {

	constructor(...args) {

		super(...args);

		this.headers = new Proxy(this.headers, {
			get: (target, property) => {
				return target[caseit(property)];
			},
			set: (target, property, value) => {
				return target[caseit(property)] = value;
			}
		});

	}

	get origin() {
		return (this.headers.xForwardedFor || this.socket.remoteAddress || '').split(/, ?/);
	}

}
