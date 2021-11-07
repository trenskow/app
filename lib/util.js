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

const resolveInlineImport = async (value) => {
	if (value.then) return await resolveInlineImport(await value);
	if (value.default) return await resolveInlineImport(value.default);
	return value;
};

const resolveRouter = async (creator, context, type = Router) => {
	creator = await resolveInlineImport(creator);
	if (creator?.constructor === type) return creator;
	if (creator?.route) return await this._resolve(creator.route, context, type);
	let router = new type();
	let parameters = { context };
	parameters[type.name.toLowerCase()] = router;
	router = await creator(parameters) || router;
	return router;
};

const canPotentiallyResolveRouter = (creator, type = Router) => {
	if (!creator?.then && creator?.constructor !== type && typeof creator !== 'function') {
		throw new Error('creator must be a promise, async function or Router instance.');
	}
	return true;
};

const matchPath = (path1, path2, { application }) => {
	if (application._path.mountMatchMode === 'strict') return path1 === path2;
	return caseit(path1) === caseit(path2);
};

export {
	isObject,
	resolveInlineImport,
	resolveRouter,
	canPotentiallyResolveRouter,
	matchPath,
};
