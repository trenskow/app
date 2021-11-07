//
// index.js
// @trenskow/app
// 
// Created by Kristian Trenskow on 2021/11/07
// For license see LICENSE.
// 

import { Application } from '../index.js';

const app = new Application({ port: 3000 });

app
	.root(async ({ endpoint }) => {
		endpoint
			.mount('hello', import('./hello.js'));
	})
	.start()
	.then(() => {
		console.info('server is running.');
	})
	.catch((error) => {
		console.error(error.stack);
	});
