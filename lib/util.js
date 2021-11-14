//
// is-object.js
// @trenskow/app
// 
// Created by Kristian Trenskow on 2021/11/07
// For license see LICENSE.
// 

import caseit from '@trenskow/caseit';

const isObject = (value) => value?.constructor === Object;

const matchPath = (path1, path2, { application }) => {
	if (application._path.mountMatchMode === 'strict') return path1 === path2;
	return caseit(path1) === caseit(path2);
};

export {
	isObject,
	matchPath,
};
