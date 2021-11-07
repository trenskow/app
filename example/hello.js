// hello.js
// @trenskow/app
// 
// Created by Kristian Trenskow on 2021/11/07
// For license see LICENSE.
// 

import caseit from '@trenskow/caseit';

export default async ({ endpoint }) => {

	endpoint
		.parameter({
			name: 'name',
			endpoint: import('./name.js'),
			transform: (name) => `Hello, ${caseit(name, 'title')}!`});

};
