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
				target[caseit(property)] = value;
				return true;
			}
		});

	}

	get host() {
		return this.headers.xForwardedHost || super.host || this.socket.localAddress;
	}

	get protocol() {
		return this.headers.xForwardedProto || super.protocol || (this.socket.encrypted ? 'https' : 'http');
	}

	get port() {
		return this.headers.xForwardedPort || this.socket.localPort || (super.protocol === 'https' ? 443 : 80);
	}

	get origin() {
		return (this.headers.xForwardedFor || this.socket.remoteAddress || '').split(/, ?/);
	}

}
