//
// index.js
// @trenskow/app
// 
// Created by Kristian Trenskow on 2021/11/07
// For license see LICENSE.
// 

import Router from './router.js';
import Endpoint from './endpoint.js';
import Application from './application.js';
import Request from './request.js';
import Response from './response.js';
import ApiError from '@trenskow/api-error';

import { isObject, matchPath, resolveInlineImport } from './util.js';

export default Application;

Application.plugin = (plugin) => {
	plugin({ Router, Endpoint, Application, Request, Response, Error: ApiError, util: {
		isObject,
		matchPath,
		resolveInlineImport
	} });
};

export { Router, Endpoint, Application, Request, Response, ApiError as Error };
