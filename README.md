# @trenskow/app
A small HTTP router.

## Introduction

This is a package for creating HTTP applications.

It is inspired by [express](https://npmjs.org/package/express), but uses modern JavaScript features and has a lot less features (on purpose) and has special emphasis on modularization of routes.

### TOC

* [Usage](#usage)
	+ [Example](#example)
	  - [Code](#code)
	  - [Result](#result)
	+ [Designing your app](#designing-your-app)
	  - [Routers](#routers)
		* [`Router`](#router)
		* [`Endpoint`](#endpoint)
	  - [Asynchronous everywhere!](#asynchronous-everywhere)
	  - [The `context` object](#the-context-object)
		* [Example](#example-1)
	  - [Casing](#casing)
		* [HTTP headers](#http-headers)
		* [Query parameters](#query-parameters)
		* [Mount paths](#mount-paths)
	  - [Endpoints, routers and handlers](#endpoints-routers-and-handlers)
		* [Endpoints](#endpoints)
		  + [When using endpoints](#when-using-endpoints)
		* [Routers](#routers-1)
		  + [When using routers](#when-using-routers)
		* [Handlers](#handlers)
		  + [When using handlers](#when-using-handlers)
  * [API Reference](#api-reference)
	+ [`Application`](#application)
	  - [Constructor](#constructor)
		* [Parameters](#parameters)
	  - [Instance methods](#instance-methods)
		* [`start`](#start)
		  + [Parameters](#parameters-1)
		* [`stop`](#stop)
		  + [Parameters](#parameters-2)
		* [`root`](#root)
		  + [Parameters](#parameters-3)
		* [`renderer`](#renderer)
		  + [Parameters](#parameters-4)
		  + [Default](#default)
	  - [Properties](#properties)
		* [`port`](#port)
		* [`server`](#server)
	+ [`Endpoint`](#endpoint-1)
	  - [Constructor](#constructor-1)
	  - [Instance methods](#instance-methods-1)
		* [`get`, `post`, `put`, `delete`, etc..](#get-post-put-delete-etc)
		  + [Parameters](#parameters-5)
		  + [Example](#example-2)
		* [`mount`](#mount)
		  + [Parameters](#parameters-6)
		  + [Example](#example-3)
		* [`parameter`](#parameter)
		  + [Parameters](#parameters-7)
		  + [Example](#example-4)
		* [`middleware`](#middleware)
		  + [Parameters](#parameters-8)
		  + [Example](#example-5)
	+ [`Router`](#router-1)
	  - [Constructor](#constructor-2)
	  - [Instance methods](#instance-methods-2)
		* [`.use`](#use)
		  + [Parameters](#parameters-9)
		  + [Example](#example-6)
	+ [`Request`](#request)
	  - [Constructor](#constructor-3)
	  - [Properties](#properties-1)
		* [`headers`](#headers)
	+ [`Response`](#response)
	  - [Constructor](#constructor-4)
	  - [Instance methods](#instance-methods-3)
		* [`getHeader`](#getheader)
		  + [Parameters](#parameters-10)
		* [`setHeader`](#setheader)
		  + [Parameters](#parameters-11)
		* [`removeHeader`](#removeheader)
		  + [Parameters](#parameters-12)
		* [`hasHeader`](#hasheader)
		  + [Parameters](#parameters-13)
		* [`getHeaderNames`](#getheadernames)
	  - [Properties](#properties-2)
		* [`headers`](#headers-1)
	+ [License](#license)

## Usage

### Example

Below is an example and the result, which uses @trenskow/app.

> This example complicates a route that could be vastly simplified. It just does this to show some the package features.

#### Code

````javascript
/* index.js */

import { Application } from '@trenskow/app';

const app = new Application({ port: 8080 });

await app
	.root(async ({ router }) => {
		router
			.mount('iam', import('./iam.js'))
	})
	.renderer(async ({ result, response }) => {
		response.headers.contentType = 'text/plain';
		response.end(result);
	})
	.start();

console.info(`Application is running on port ${app.port}`);
````

````javascript
/* iam.js */

export default ({ router }) => {
	router
		.parameter({
			name: 'name',
			route: import('./name.js')
		});
};
````

````javascript
/* greeter.js */

export default ({ router }) => {
	router
		.use(async (context) => {
			context.greeter = (name) => `Hello, ${name}!`;
		});
};
````

````javascript
/* name.js */

export default ({ router }) => {
	router
		.middleware(import('./greeter.js'))
		.get(async ({ parameters: { name }, greeter }) => greeter(name));
};
````

#### Result

The above example will handle a request like below.

````http
GET /iam/trenskow HTTP/1.1
Host: localhost:8080
Accept: */*
````

– and will respond with below.

````http
HTTP/1.1 200 OK
Content-Type: text/plain
Connection: keep-alive
Content-Length: 16

Hello, trenskow!
````

### Designing your app

Since most people know express, it would make sense to point out some of the differences.

#### Routers

One key difference between express and @trenskow/app is, that routes cannot define their own paths. Paths are defined by the parent route "mounting" the child route.

##### `Router`

The `Router` type is a basic router, which is only used when dealing with middleware (see below). It only supports one method, which is the `.use(...)` method.

##### `Endpoint`

`Endpoint` is the most used router. It is the one that is mostly similar to express' router. This is where you can `.get(...)`, `.put(...)`, `.delete(...)`, etc.

Unlike express, and as stated above, you cannot specify path from a `.get(...)` method – you can only specify the handler, as the path is determined by the parent endpoint.

Endpoints has the `mount('path', router)` method, which "mounts" a router to the specified subpath. 

There is a variant of `mount` called `parameter('name', router, transform)` which is used to mount an endpoint which has a dynamic path, whereas the path is treated like an input parameter (like express' `.param(...)` method). Parameters also supports a transform function, which is able to transform the parameter into something else (eg. a user identifier into a user object).

Lastly there is the `.middleware(router)` method, which is used to attach middleware. Middleware is defined as a router, which is of the type `Router` and therefore cannot handle endpoint responsibilities. You can regard them like transforms or service providers for the request.

> `Endpoint` extends `Router`.

#### Asynchronous everywhere!

All handlers and routers support async functions (and non-async). No need to call next, and when a method handler has a result available, it just returns it – if an error occur, you just throw an error. The provided [`Application#renderer`](#renderer) is responsible for writing the returned value to the response.

#### The `context` object

Where express gives you a `(req, res, next)` parameter for each handler, this application instead just provides a single parameter, the `context` object, which contains all the information needed to process the request.

Middleware can also use the context to provide data and services, which is then available for subsequent routers and handlers.

When a request is incoming, the context object looks like this.

| Name          | Description                                                                                                                             |            Type             |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------: |
| `application` | The application that has received the request.                                                                                          | [Application](#Application) |
| `request`     | The request object from the HTTP server.                                                                                                |     [Request](#Request)     |
| `response`    | The response object from the HTTP server.                                                                                               |    [Response](#Response)    |
| `parameters`  | An empty object that will contain the parameters picked up when processing the request.                                                 |           Object            |
| `path`        | The original full path requested by the user.                                                                                           |           String            |
| `query`       | An object holding the URL query parameters as an object ([keys has been converted to camel case](#query-parameters)).                   |           Object            |
| `state`       | A string indicating the current state of the request – possible values are `'processing'`, `'rendering'`, `'completed'` or `'aborted'`. |           String            |
| `result`      | Whatever has been returned by the routes (can be used in renderer).                                                                     |             Any             |

##### Example

Below is an example on how the context is used (also see the example in the beginning of this document).

````javascript
.get(context) => { /* Use all the available parameters. */ }
.get({ parameters }) => /* Use JavaScript object destructuring to get only what you need. /*
````

#### Casing

JavaScript is a camel cased language. HTTP is a mixture of different case type. Therefore this package converts all non-camel case identifiers to camel case for use when coding.

> Converting between case type is performed by [@trenskow/caseit](https://npmjs.com/package/@trenskow/caseit).

##### HTTP headers

Case is automatically converted in both directions, so if you do `context.response.headers.contentType = 'application/json'` it will automatically be converted to `Content-Type: application/json` when the response is sent.

The same goes for request headers like `Accept-Language: en` that is accessible through `context.request.headers.acceptLanguage`. 

##### Query parameters

Request with `?my-parameter=value` is accessible through `context.query.myParameter` .

##### Mount paths

When [mount match mode](#constructor) is set to `'loosely'` (default) a request for `/my-route` or `/my_route` will match an endpoint mounted at `/myRoute`.

#### Endpoints, routers and handlers

This package distinguishes between endpoints, routers and handler.

##### Endpoints

Endpoints takes care of a path. As example the `/this/is/my/path/` path is handled by a specific endpoint. It only handles one path, so in the previous example, it does not handle `/this/is/my/` – nor does it handle `/this/is/my/path/endpoint/`.

Endpoints can have a couple of things mounted / attached to it – those are.

* Other endpoints (mounted)
* Parameters (which is also a mounted endpoint – but where the path is dynamic and assigned to the `context.parameters` object)
* Handlers (which is set by `.use(...)`)
* Middleware (Sets a [`Router`](#routers-2) router to let the request be passed through – middleware are provided using the `.middleware` method)
* Methods (such as `.get(...)`, `.post(...)`, `.put(...)`, etc.)
	* When a method returns the request ends and the returned value is send to the client as a response (through the [`Application#renderer`](#renderer))

###### When using endpoints

Whenever a function (such as `.mount` or `.parameter` or `.root`) takes an endpoint, it can be provided in any of the following ways.

* An instance of [`Endpoint`](#endpoint-2).
* A function that takes an object as parameters and configures the endpoint.
	* `({ endpoint, context }) => { endpoint... }`
* An object that has a `default` property that is set to one of the above.
* An unresolved promise that resolves to one of the above.

##### Routers

A router is the same as above, except it only supports `.use`.

###### When using routers

As above, whenever a function takes a router, it can be provided in any of the following ways.

* An instance of `Router`.
* A function that takes an object as parameters and configures the router.
	* `({ router, context }) => { router... }` 
* An object that has a `default` property that is set to one of the above.
* An unresolved promise that resolves to one of the above.

##### Handlers

Handlers are functions that handles a request. Handlers are functions that takes the context object as it's parameter.

###### When using handlers

Whenever a function takes a handler as a parameter, it can be provided in any of the following ways.

* A function that takes a context object as it's parameter.
	* `(context) => { /* do whatever */ }`
* An object that has a `default` property that is set to the above.
* An unresolved promise that resolved to one of the above.

## API Reference

### `Application`

The `Application` class holds an application and is responsible for handling and bootstrapping request from a server. It does not provide any routing on it's own, instead it has a `root` method, which is used to set the root router.

> If no root route has been set, all requests will be responded with `404 Not Found`.

#### Constructor

The `Application` class takes and options object as it's parameter.

##### Parameters

| Name                     | Description                                                                                                                       |           Type            | Required |        Default value         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | :-----------------------: | :------: | :--------------------------: |
| options                  | An object holding the configuration options.                                                                                      |          Object           |          |              {}              |
| `options.port`           | The port at which to listen for incoming connections.                                                                             |          Number           |          | `0` (automatically assigned) |
| `options.RequestType`    | An object that inherits from the `Request` class (`http.IncomingMessage` subclass) that is used as the request object in routes.  |           class           |          |    [`Request`](#Request)     |
| `options.ResponseType`   | An object that inherits from the `Response` class (`http.ServerResponse` subclass) that is used as the response object in routes. |           class           |          |   [`Response`](#Response)    |
| `path`                   | An object that represents path related options.                                                                                   |          Object           |          |             `{}`             |
| `path.mountMatchMode`    | Indicates how to match requests to mounted paths.                                                                                 | `'loosely'` or `'strict'` |          |         `'loosely'`          |
| `options.server`         | An object that represents how to instantiate the HTTP server.                                                                     |          Object           |          |             `{}`             |
| `options.server.create`  | A function that is able to create a server.                                                                                       |         Function          |          |     `http.createServer`      |
| `options.server.options` | An object to be passed as options when creating a server.                                                                         |          Object           |          |             `{}`             |

#### Instance methods

##### `start`

The start method starts the server. The server will accept connections using the port provided in the constructor.

> Returns a `Promise` that resolves to the application.

###### Parameters

The `start` method takes no parameters.

##### `stop`

Stops the server. 

> Returns a `Promise` that resolves to the application.

###### Parameters

| Name                  | Description                                                                | Type  | Required | Default value |
| --------------------- | -------------------------------------------------------------------------- | :---: | :------: | :-----------: |
| `awaitAllConnections` | Tells the stop method not to return until all connections has been closed. | Bool  |          |    `false`    |

> Parameters can be passed both as `stop(awaitAllConnections)` or `stop({ awaitAllConnections })`.

##### `root`

This method sets the root endpoint of the server.

The provided endpoint is the one that will handle all requests to `/`. It is where you set the "main" entry for your application.

> Returns a `Promise` that resolves to the application.

> If no root endpoint is provided the server will respond to all requests with `404 Not Found`.

###### Parameters

| Name       | Description                                        |                       Type                       |      Required      | Default value |
| ---------- | -------------------------------------------------- | :----------------------------------------------: | :----------------: | :-----------: |
| `endpoint` | The endpoint that will handle all requests to `/`. | [Endpoint](#endpoint-2) ([see also](#endpoints)) | :white_check_mark: |               |

##### `renderer`

Sets the renderer function (async/non-async).

This method is responsible to turn whatever the routes have returned into something that can be send as a response. JSON encoding of values would be something to put in here.

> Returns a `Promise` that resolves to the application.

###### Parameters

| Name       | Description                                         |           Type            |      Required      |     Default value     |
| ---------- | --------------------------------------------------- | :-----------------------: | :----------------: | :-------------------: |
| `renderer` | A function that takes the context as its parameter. | Function or AsyncFunction | :white_check_mark: | [See below](#default) |

###### Default

The default renderer will just write whatever is returned from the routes to the response. If it's a string it will set `Content-Type: text/plain`, if it's a buffer it will just write the buffer – otherwise it will just end the response.

#### Properties

##### `port`

Returns the port at which the server is currently listening.

##### `server`

Returns the underlying `HTTP` instance.

### `Endpoint`

> extends [`Router`](#router-2)

The endpoint is what resembles the express.js router the most. It is the one where you define parameters and HTTP method handlers like `GET`.

#### Constructor

The constructor takes no parameters.

#### Instance methods

##### `get`, `post`, `put`, `delete`, etc..

This method takes care of handing the specified HTTP method.

> No more routes will be processed, when one of these handlers return. The returned value is send to the [renderer](#renderer).

> Returns the endpoint.

###### Parameters

| Name       | Description                  |                           Type                           |      Required      | Default value |
| ---------- | ---------------------------- | :------------------------------------------------------: | :----------------: | :-----------: |
| `handlers` | A (or an array of) handlers. | Function, AsyncFunction or Array ([see also](#handlers)) | :white_check_mark: |               |

###### Example

Below is an example on how to use the method.

````javascript
default export ({ endpoint }) => {  
	endpoint
		.get(async (context) => 'Hello, world!');
};
````

> In the above example `'Hello, world!'` is immediately send to the [renderer](#renderer) and the request ends.

##### `mount`

The method mounts another endpoint to a specific subpath.

> Returns the endpoint.

###### Parameters

| Name       | Description                                    |                        Type                        |      Required      | Default value |
| ---------- | ---------------------------------------------- | :------------------------------------------------: | :----------------: | :-----------: |
| `path`     | The subpath the endpoint should be mounted to. |         String ([see also](#mount-paths))          | :white_check_mark: |               |
| `endpoint` | The endpoint to mount.                         | [`Endpoint`](#endpoint-2) ([see also](#endpoints)) | :white_check_mark: |               |

> Parameters can also be provided as `{ path, endpoint }`.

###### Example

Below is an example on how to use the method.

````javascript
default export ({ endpoint }) => {

	endpoint
	
		.mount('subpath', { endpoint }) => {
			/* configure endpoint at `./subpath/` */
		})
	
		/* Below is an example of a shortcut method. */
		
		.mounts.subpath(({ endpoint }) => {
		   	/* configure endpoint at `./subpath/`.
		});
	
};
````

##### `parameter`

This method mounts another endpoint, but uses the path as a dynamic value which is assigned to the `context.parameter` object.

> Returns the endpoint.

###### Parameters

| Name        | Description                                                  |                        Type                        |      Required      | Default value |
| ----------- | ------------------------------------------------------------ | :------------------------------------------------: | :----------------: | :-----------: |
| `name`      | The key that is used when assigning to `context.parameters`. |                       String                       | :white_check_mark: |               |
| `endpoint`  | The endpoint to mount.                                       | [`Endpoint`](#endpoint-2) ([see also](#endpoints)) | :white_check_mark: |               |
| `transform` | A (async) function that can transform the value.             |             Function or AsyncFunction              |                    |               |

> Parameters can also be provided as `{ name, endpoint, transform }`.

###### Example

Below is an example on how to use the method.

````javascript
export default ({ endpoint }) => {
	
	endpoint
	
		.parameter('name', ({ endpoint }) => {
			
			endpoint
				.get(({ parameters: { name } }) => name);
		
		})
	
		/* Below is an example of a shortcut method (also demonstrates transforms). */

		.parameters.user({
			transform: async (user) => await getMyUserFromId(user),
			endpoint: ({ endpoint }) => {
				endpoint
					.get(({ parameters: { user } }) => `Hello ${user.name}!` });
			}
		});
	
};
````

##### `middleware`

This method instals a piece of middleware. Middleware would typically be routes, that do not handle an endpoint, but works as a transform or service provider. Body parsers and rate limiters would typically be installed as middleware.

> Returns the endpoint.

###### Parameters

| Name     | Description                              |                     Type                     |      Required      | Default value |
| -------- | ---------------------------------------- | :------------------------------------------: | :----------------: | :-----------: |
| `router` | The router that contains the middleware. | [Router](#router-2) ([see also](#routers-2)) | :white_check_mark: |               |

###### Example

Below is an example on how to implement a JSON body parser in a middleware router.

````javascript
/* my-endpoint.js */

export default = ({ endpoint }) => {
	endpoint
		.middleware(import('./body-json-parser.js'))
		.post(({ body }) => JSON.stringify(body)); /* echo body to response */
};
````

````javascript
/* body-json-parser.js */

import { Error as AppError } from '@trenskow/app';

export default = ({ router }) => {
	
	router
		.use(async (context) => {
	   
			const { request } = context;
			const { headers } = request;
		
			const [
				contentType,
				charset = 'utf-8'
			] = headers.contentType?.match(/^application\/json(?:; ?charset=([a-z0-9-]+)(?:,|$))?/i);
		
			if (!/^application\/json$/i.test(contentType)) return;
		
			const chunks = [];
		
			try {
				for await (const chunk in request) {
					chunks.push(chunk);
				}
				context.body = JSON.parse(Buffer.concat(chunks).toString(charset));
			} catch (error) {
				throw new ApiError.BadRequest();
			}
			
		});
	
};
````

### `Router`

#### Constructor

The constructor takes no parameters.

#### Instance methods

##### `.use`

This method is like the [HTTP method handlers](#get-post-put-delete-etc) of `Endpoint`, except it discards the return value and continues to process the request.

Typically used by middleware.

> Returns the router.

###### Parameters

| Name      | Description                  |                           Type                           |      Required      | Default value |
| --------- | ---------------------------- | :------------------------------------------------------: | :----------------: | :-----------: |
| `handler` | A (or an array of) handlers. | Function, AsyncFunction or Array ([see also](#handlers)) | :white_check_mark: |               |

###### Example

> See example [above](#example-6).

### `Request`

This class represents the request. Each individual request has it's own instance assigned to `context.request`, where it accessible from endpoint, routers and handlers.

> extends `http.IncomingMessage`

#### Constructor

See [`http.IncomingMessage`](https://nodejs.org/dist/latest/docs/api/http.html#class-httpincomingmessage).

`Request` instances are constructed by the HTTP server.

#### Properties

##### `headers`

Returns an object that has the request headers as key/values, where the [keys has been converted to camel case](#casing).

### `Response`

#### Constructor

See [`http.ServerResponse`](https://nodejs.org/dist/latest/docs/api/http.html#class-httpserverresponse).

> extends `http.ServerResponse`

`Response` instances are constructed by the HTTP server.

#### Instance methods

##### `getHeader`

Returns the value of a header.

###### Parameters

| Name   | Description                                                |  Type  |      Required      | Default value |
| ------ | ---------------------------------------------------------- | :----: | :----------------: | :-----------: |
| `name` | The name of the header to return ([camel cased](#casing)). | String | :white_check_mark: |               |

##### `setHeader`

Sets the value of a header.

###### Parameters

| Name    | Description                                             |  Type  |      Required      | Default value |
| ------- | ------------------------------------------------------- | :----: | :----------------: | :-----------: |
| `name`  | The name of the header to set ([camel cased](#casing)). | String | :white_check_mark: |               |
| `value` | The value of the header.                                | String | :white_check_mark: |               |

##### `removeHeader`

Removed a header.

###### Parameters

| Name   | Description                                                |  Type  |      Required      | Default value |
| ------ | ---------------------------------------------------------- | :----: | :----------------: | :-----------: |
| `name` | The name of the header to remove ([camel cased](#casing)). | String | :white_check_mark: |               |

##### `hasHeader`

Return `true` if header has been set.

###### Parameters

| Name   | Description                                               |  Type  |      Required      | Default value |
| ------ | --------------------------------------------------------- | :----: | :----------------: | :-----------: |
| `name` | The name of the header to check ([camel cased](#casing)). | String | :white_check_mark: |               |

##### `getHeaderNames`

Returns an array of all header names set.

#### Properties

##### `headers`

Returns an object that has the response headers as key/values, where the [keys has been converted to camel case](#casing).

### License

See license in LICENSE
