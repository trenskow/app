//
// is-object.js
// @trenskow/app
//
// Created by Kristian Trenskow on 2025/01/02
// For license see LICENSE.
//

import { METHODS } from 'http';

const methods = METHODS.map((method) => method.toLowerCase());

export default class Methods extends Function {

	static get all() {
		return methods;
	}

	constructor({ existing = [], additional = [], todo }) {
		super();

		if (!Array.isArray(existing)) {
			throw new Error('Existing must be an array.');
		}

		let methods = existing;

		return new Proxy(this, {
			get: (_ /* target */, property, receiver) => {

				if (property === 'all') {
					methods = Methods.all;
				} else if (Methods.all.concat(additional).includes(property)) {
					if (!methods.includes(property)) methods.push(property);
				} else {
					throw new Error(`Method ${property} is unknown.`);
				}

				return receiver;

			},
			apply: (_ /* target */, __ /* this */, args) => {
				return todo(methods, ...args);
			}
		});

	}

}
