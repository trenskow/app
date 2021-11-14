//
// is-object.js
// @trenskow/app
// 
// Created by Kristian Trenskow on 2021/11/07
// For license see LICENSE.
// 

import caseit from '@trenskow/caseit';

import Router from './router.js';

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

const resolveInlineImport = (creator) => {
	if (creator?.default) return creator.default;
	return creator;
};

const resolveRouter = (creator, type = Router) => {

	creator = resolveInlineImport(creator, type);

	if (creator?.constructor === type) return creator;

	let router = new type();

	router = creator(Object.fromEntries([[ type.name.toLowerCase(), router ]])) || router;

	return router;

};

const matchPath = (path1, path2, { application }) => {
	if (application._path.mountMatchMode === 'strict') return path1 === path2;
	return caseit(path1) === caseit(path2);
};

export {
	isObject,
	resolveRouter,
	resolveInlineImport,
	matchPath,
};
