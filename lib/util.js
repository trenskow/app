//
// is-object.js
// @trenskow/app
//
// Created by Kristian Trenskow on 2021/11/07
// For license see LICENSE.
//

import { METHODS } from 'http';

import caseit from '@trenskow/caseit';

const methods = METHODS.map((method) => method.toLowerCase());
const methodsWrite = ['post', 'put', 'patch', 'delete'];
const methodsRead = methods.filter((method) => !methodsWrite.includes(method));

const isObject = (value) => value?.constructor === Object;

const matchPath = (path1, path2, { application: { path: { matchMode }} }) => {
	if (matchMode === 'strict') return path1 === path2;
	return caseit(path1) === caseit(path2);
};

const resolveInlineImport = (value) => {
	while (value?.default) value = value.default;
	return value;
};

export {
	methods,
	methodsWrite,
	methodsRead,
	isObject,
	matchPath,
	resolveInlineImport
};
