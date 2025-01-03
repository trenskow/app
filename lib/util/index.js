//
// is-object.js
// @trenskow/app
//
// Created by Kristian Trenskow on 2021/11/07
// For license see LICENSE.
//

import caseit from '@trenskow/caseit';

import Methods from './methods.js';

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
	Methods,
	isObject,
	matchPath,
	resolveInlineImport
};
