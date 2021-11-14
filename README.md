# @trenskow/app
A small HTTP router.

## Introduction

This is a package for creating HTTP applications.

It is inspired by [express](https://npmjs.org/package/express) – but uses modern JavaScript features and has a lot less features (on purpose) and has special emphasis on modularization of endpoints.

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
			* [`open`](#open)
				+ [Parameters](#parameters-1)
			* [`close`](#close)
				+ [Parameters](#parameters-2)
			* [`root`](#root)
				+ [Parameters](#parameters-3)
			* [`renderer`](#renderer)
				+ [Parameters](#parameters-4)
				+ [Default](#default)
		- [Properties](#properties)
			* [`port`](#port)
			* [`server`](#server)
			* [`state`](#state)
				+ [Possible values](#possible-values)
	+ [`Endpoint`](#endpoint-1)
		- [Constructor](#constructor-1)
		- [Instance methods](#instance-methods-1)
			* [`get`, `post`, `put`, `delete`, etc..](#get-post-put-delete-etc)
				+ [Parameters](#parameters-5)
				+ [Example](#example-2)
				+ [Catch all](#catch-all)
			* [`mount`](#mount)
				+ [Parameters](#parameters-6)
				+ [Example](#example-3)
			* [`parameter`](#parameter)
				+ [Parameters](#parameters-7)
				+ [Example](#example-4)
			* [`middleware`](#middleware)
				+ [Parameters](#parameters-8)
				+ [Example](#example-5)
			* [`.mixin`](#mixin)
				+ [Parameters](#parameters-9)
				+ [Example](#example-6)
	+ [`Router`](#router-1)
		- [Constructor](#constructor-2)
		- [Instance methods](#instance-methods-2)
			* [`.use`](#use)
				+ [Parameters](#parameters-10)
				+ [Example](#example-7)
			* [`.mixin`](#mixin-1)
				+ [Parameters](#parameters-11)
				+ [Example](#example-8)
	+ [`Request`](#request)
		- [Constructor](#constructor-3)
		- [Properties](#properties-1)
			* [`headers`](#headers)
	+ [`Response`](#response)
		- [Constructor](#constructor-4)
		- [Instance methods](#instance-methods-3)
			* [`getHeader`](#getheader)
				+ [Parameters](#parameters-12)
			* [`setHeader`](#setheader)
				+ [Parameters](#parameters-13)
			* [`removeHeader`](#removeheader)
				+ [Parameters](#parameters-14)
			* [`hasHeader`](#hasheader)
				+ [Parameters](#parameters-15)
			* [`getHeaderNames`](#getheadernames)
		- [Properties](#properties-2)
			* [`headers`](#headers-1)
	+ [License](#license)

## Usage

### Example

Below is an example and the result of an application that uses the package.

> This example complicates a route that could be vastly simplified. It just does this to show some the package features.

#### Code

````javascript
/* index.js */

import { Application, Endpoint } from '@trenskow/app';

const app = new Application({ port: 8080 });

(async () => {
    
    return (await app
        .root(
            new Endpoint()
                .mount('iam', await import('./iam.js')))
        .renderer(async ({ result, response }) => {
            response.headers.contentType = 'text/plain';
            response.end(result);
        })
        .start())
    	.port;
    
})().then((port) => console.info(`Application is running on port ${app.port}`))
    .catch(console.error);
````

````javascript
/* iam.js */

import { Endpoint } from '@trenskow/app';

export default new Endpoint()
	.parameter({
        name: 'name',
        endpoint: await import('./name.js')
	});
````

````javascript
/* greeter.js */

import { Router } from '@trenskow/app';

export default new Router()
	.use(async (context) => {
		context.greeter = (name) => `Hello, ${name}!`;
	})
````

````javascript
/* name.js */

import { Endpoint } from '@trenskow/app';

export default new Endpoint()
    .middleware(await import('./greeter.js'))
    .get(async ({ parameters: { name }, greeter }) => greeter(name));
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

One key difference between express and this package is, that routes cannot define their own paths. Paths are defined by the parent endpoints "mounting" the child endpoint.

##### `Router`

The `Router` type is a basic router, which is only used when dealing with middleware ([see below](#middleware)). It only supports one method, which is the `.use(...)` method.

##### `Endpoint`

`Endpoint` is the most used router, and it is also the one that is mostly similar to express' router. This is where you can define handlers for the HTTP methods – [`.get(...)`, `.put(...)`, `.delete(...)`, etc.](#get-post-put-delete-etc)

Unlike express, and as stated above, you cannot specify the path from a `.get(...)` method – you can only specify the handler, as the path is determined by the parent endpoint.

Endpoints has the [`mount`](#mount) method, which "mounts" a router to the specified subpath. 

There is a variant of the `mount` method called [`parameter`](#parameter) which is used to mount an endpoint with a dynamic path – whereas the path is treated like an input parameter (like express' `.param` method). Parameters also supports a transform function, which is able to transform the parameter into something else (eg. a user identifier into a user object).

Lastly there is the [`.middleware`](#middleware) method, which is used to attach middleware. Middleware is defined as a router, which is of the type [`Router`](#router-2) and therefore cannot act as an endpoint. You can regard them like transforms or service providers for the request.

> `Endpoint` extends `Router`.

#### Asynchronous everywhere!

All handlers and routers support async functions (and non-async). No need to call next, and when a method handler has a result available it just returns it – and if an error occur, you just throw an error. The provided [`renderer`](#renderer) is responsible for writing the returned value to the response.

#### The `context` object

Where express gives you the `(req, res, next)` parameters for each handler, this application instead just provides a single parameter, the "`context` object", which contains all the information needed to process the request.

Middleware can also use the context to provide data and services, which is then available for subsequent endpoints, routers and handlers.

When a request is incoming, the `context`object looks like this.

| Name             | Description                                                  |            Type             |
| ---------------- | ------------------------------------------------------------ | :-------------------------: |
| `application`    | The application instance that has received the request.      | [Application](#Application) |
| `request`        | The request object from the HTTP server.                     |     [Request](#Request)     |
| `response`       | The response object from the HTTP server.                    |    [Response](#Response)    |
| `parameters`     | An empty object that will contain the parameters picked up when processing the parameters (if any) of the requested path. |           Object            |
| `path`           | An object that has properties representing different paths.  |           Object            |
| `path.full`      | An array of strings that joined represent the path components of the fully requested path. |       Array of String       |
| `path.current`   | An array of strings that joined represents the path currently being processed. |       Array of String       |
| `path.remaining` | An array of strings that joined represents the path that is above the currently processed path. |                             |
| `query`          | An object holding the URL query parameters as an object ([keys has been converted to camel case](#query-parameters)). |           Object            |
| `state`          | A string indicating the current state of the request – possible values are `'routing'`, `'rendering'`, `'completed'` or `'aborted'`. |           String            |
| `abort`          | A function that aborts the request. It takes the parameters `(error, brutally)`, where `error` is the error that needs to be handled by the [renderer](#renderer) – and `brutally` which indicates if the connection should also be closed. |        AsyncFunction        |
| `render`         | A function that tells the application to stop processing the request and jump directly to the [renderer](#renderer). |          Function           |
| `result`         | Whatever has been returned by the method handlers (should be written in the [`renderer`](#renderer)). |             Any             |

##### Example

Below is an example on how the context is used (also see the example in the beginning of this document).

````javascript
.get(context) => { /* Use all the available information. */ }
.get({ parameters }) => /* Use JavaScript object destructuring to get only the information you need. /*
````

#### Casing

JavaScript is a camel cased language. HTTP is a mixture of different case types. Therefore this package converts all non-camel case identifiers to camel case for use when coding.

> Converting between case type is performed by [@trenskow/caseit](https://npmjs.com/package/@trenskow/caseit).

##### HTTP headers

Case is automatically converted in both directions, so if you do `context.response.headers.contentType = 'application/json'` it will automatically be converted to `Content-Type: application/json` when the response is sent.

The same goes for request headers like `Accept-Language: en` that is accessible through `context.request.headers.acceptLanguage`. 

##### Query parameters

Request with `?my-parameter=value` is accessible through `context.query.myParameter` .

##### Mount paths

When [mount match mode](#constructor) is set to `'loosely'` (default) a request the subpath `my-route` or `my_route` will match an endpoint mounted at `myRoute`.

#### Endpoints, routers and handlers

This package distinguishes between endpoints, routers and handler.

##### Endpoints

Endpoints takes care of a path component. As example the `/this/is/my/path/` path is handled by a specific endpoint. It only handles one explicit path, so as in the previous example, it does not handle `/this/is/my/` – nor does it handle `/this/is/my/path/endpoint/`.

Endpoints can have a couple of things mounted / attached to it – those are.

* Other endpoints
	* using the [`.mount`](#mount) method of [`Endpoint`](#endpoint-2).

* Parameters
	* which is also a mounted endpoint – but where the path is dynamic and assigned to the `context.parameters` object.
	* using the [`.parameter`](#parameter) method of [`Endpoint`](#endpoint-2)

* Handlers
	* using the [`.use`](#use) method of [`Router`](#router-2) or [`Endpoint`](#endpoint-2) 

* Middleware
	* sets a [`Router`](#routers-2) router to that the request will be passed through.
	* using the [`.middleware`](#middleware) method of  [`Endpoint`](#endpoint-2) 

* Methods
  * using the [`.get`, `.post`, `.put`, `.delete`, etc.](#get-post-put-delete-etc) method of [`Endpoint`](#endpoint-2)
  * When a method returns the request ends and the returned value is send to the client as a response (through the [`Application#renderer`](#renderer))


###### When using endpoints

Whenever a function (such as [`.mount`](#mount) or [`.parameter`](#parameters) or [`.root`](#root)) takes an endpoint as a parameter, it can be provided in any of the following ways.

* An instance of [`Endpoint`](#endpoint-2).
* A function that takes an object as parameters and configures the endpoint.
	* `({ endpoint }) => { endpoint.whatever()... }`
* An object that has a `default` property that is set to one of the above.

##### Routers

A router is the same as above, except it only supports [`.use`](#use).

###### When using routers

As above, whenever a function takes a router as a parameter, it can be provided in any of the following ways.

* An instance of [`Router`](#router-2).
* A function that takes an object as parameters and configures the router.
	* `({ router }) => { router.whatever()... }` 
* An object that has a `default` property that is set to one of the above.

##### Handlers

Handlers are functions that handles a request. Handlers are functions that takes the context object as it's parameter.

###### When using handlers

Whenever a function takes a handler as a parameter, it can be provided in any of the following ways.

* A function that takes a context object as it's parameter.
	* `(context) => { /* do whatever */ }`
* An object that has a `default` property that is set to the above.

## API Reference

### `Application`

The `Application` class holds an application and is responsible for handling and bootstrapping request from the server. It does not provide any routing on it's own, instead it has a [`root`](#root) method, which is used to set the root router.

> If no root route has been set, all requests will be responded with `404 Not Found`.

#### Constructor

The `Application` class takes and "options" object as it's parameter.

##### Parameters

| Name                     | Description                                                                                                                                       |           Type            | Required |        Default value         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | :-----------------------: | :------: | :--------------------------: |
| options                  | An object holding the configuration options.                                                                                                      |          Object           |          |              {}              |
| `options.port`           | The port at which to listen for incoming connections.                                                                                             |          Number           |          | `0` (automatically assigned) |
| `options.RequestType`    | An object that inherits from the [`Request`](#request-2) class (an `http.IncomingMessage` subclass) that is used as the request object in routes. |           class           |          |    [`Request`](#Request)     |
| `options.ResponseType`   | An object that inherits from the [`Response`](#response-2) class (`http.ServerResponse` subclass) that is used as the response object in routes.  |           class           |          |   [`Response`](#Response)    |
| `path`                   | An object that represents path related options.                                                                                                   |          Object           |          |             `{}`             |
| `path.mountMatchMode`    | Indicates [how to match requests to mounted paths](#mount-paths).                                                                                 | `'loosely'` or `'strict'` |          |         `'loosely'`          |
| `options.server`         | An object that represents how to instantiate the HTTP server.                                                                                     |          Object           |          |             `{}`             |
| `options.server.create`  | A function that is able to create a server.                                                                                                       |         Function          |          |     `http.createServer`      |
| `options.server.options` | An object to be passed as options when creating a server.                                                                                         |          Object           |          |             `{}`             |

#### Instance methods

##### `open`

This method opens (starts) the server. The server will accept connections using the port provided in the constructor.

> Will throw an error if the [state](#state) of the application is anything other than `'closed'`.

> Returns a `Promise` that resolves to the application.

###### Parameters

| Name   | Description                                                                         |  Type  | Required |                      Default value                       |
| ------ | ----------------------------------------------------------------------------------- | :----: | :------: | :------------------------------------------------------: |
| `port` | If no port was provided in the [constructor](#constructor) it can be provided here. | Number |          | Value set in constructor or `0` (automatically assigned) |

> Parameters can be passed both as `stop(port)` or `stop({ port })`.

##### `close`

This method closes (stops) the server.

> Will throw an error if the [state](#state) of the application is anything other than `'open'`.

> Returns a `Promise` that resolves to the application.

###### Parameters

| Name                  | Description                                                    | Type  | Required | Default value |
| --------------------- | -------------------------------------------------------------- | :---: | :------: | :-----------: |
| `awaitAllConnections` | Indicates not to return until all connections has been closed. | Bool  |          |    `false`    |

> Parameters can be passed both as `stop(awaitAllConnections)` or `stop({ awaitAllConnections })`.

##### `root`

This method sets the root endpoint of the server.

The provided endpoint is the one that will handle all requests to `/`. It is where you set the "main entry" for your application.

> If no root endpoint is provided the server will respond to all requests with `404 Not Found`.

> Returns the application.

###### Parameters

| Name       | Description                                        |          Type           |      Required      | Default value |
| ---------- | -------------------------------------------------- | :---------------------: | :----------------: | :-----------: |
| `endpoint` | The endpoint that will handle all requests to `/`. | [Endpoint](#endpoint-2) | :white_check_mark: |               |

##### `renderer`

Sets the renderer function (async/non-async).

This method is responsible to turn whatever the routes have returned and write it to the response.

JSON encoding of values would be something to put in here.

> Returns the application.

###### Parameters

| Name       | Description                                                 |           Type            |      Required      |     Default value     |
| ---------- | ----------------------------------------------------------- | :-----------------------: | :----------------: | :-------------------: |
| `renderer` | A function that takes the context object as it's parameter. | Function or AsyncFunction | :white_check_mark: | [See below](#default) |

###### Default

The default renderer will just write whatever is returned from the routes to the response. If it's a string it will set `Content-Type: text/plain`, if it's a buffer it will just write the buffer – otherwise it will just end the response.

#### Properties

##### `port`

Returns the port at which the server is currently listening.

##### `server`

Returns the underlying `HTTP` server instance.

##### `state`

Returns a string that represents the current state of the application.

###### Possible values

| Value     | Description                                                   |
| --------- | ------------------------------------------------------------- |
| `closed`  | The server is not listening for incoming connections.         |
| `closing` | The server is closing and waiting for clients to disconnect.  |
| `open`    | The server is running and listening for incoming connections. |
| `opening` | The server is currently in the process of opening.            |

### `Endpoint`

> extends [`Router`](#router-2)

An endpoint is what resembles the express.js router the most. It is the one where you define parameters and HTTP method handlers like `GET`, `POST`, `PUT`, `DELETE`, etc.

> If an endpoint is requested with a HTTP method not implemented (and other HTTP methods has been implemented) it will respond with `405 Method Not Allowed` – otherwise if no methods has been implemented it will respond with `404 Not Found`.

#### Constructor

The constructor takes no parameters.

#### Instance methods

##### `get`, `post`, `put`, `delete`, etc..

This method takes care of handing a specified HTTP method.

Supported HTTP methods are the same as those returned by [`http.METHODS`](https://nodejs.org/dist/latest/docs/api/http.html#httpmethods).

No more routes will be processed, when one of these handlers return. The returned value is send to the [renderer](#renderer).

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

###### Catch all

There is also a catch-all variant, which makes the handler handle the path and subsequent subpaths.

Below is an example.

````javascript
import { Endpoint } from '@trenskow/app';

export default new Endpoint()
	.get.catchAll(async () => 'Hello, World!');
````

##### `mount`

The method mounts another endpoint to a specific subpath.

> Returns the endpoint.

###### Parameters

| Name       | Description                                    |               Type                |      Required      | Default value |
| ---------- | ---------------------------------------------- | :-------------------------------: | :----------------: | :-----------: |
| `path`     | The subpath the endpoint should be mounted to. | String ([see also](#mount-paths)) | :white_check_mark: |               |
| `endpoint` | The endpoint to mount.                         |     [`Endpoint`](#endpoint-2)     | :white_check_mark: |               |

> Parameters can also be provided as `{ path, endpoint }`.

###### Example

Below is an example on how to use the method.

````javascript
import { Endpoint } from '@trenskow/app';

default export new Endpoint()

    .mount('subpath', { endpoint }) => {
        /* configure endpoint at `./subpath/` */
    })

    /* Below is an example of a shortcut method. */

    .mounts.subpath(({ endpoint }) => {
        /* configure endpoint at `./subpath/`. */
    });
````

##### `parameter`

This method mounts another endpoint, but uses the path as a dynamic value which is assigned to the `context.parameter` object.

> Returns the endpoint.

###### Parameters

| Name        | Description                                                  |           Type            |      Required      | Default value |
| ----------- | ------------------------------------------------------------ | :-----------------------: | :----------------: | :-----------: |
| `name`      | The key that is used when assigning to `context.parameters`. |          String           | :white_check_mark: |               |
| `endpoint`  | The endpoint to mount.                                       | [`Endpoint`](#endpoint-2) | :white_check_mark: |               |
| `transform` | A (async) function that can transform the value. It's first an only parameter is an object with `{ name /* name of parameter */, context }`. If you're parameter is called `user` , the transform function will be called with an object `{ user, context }`. | Function or AsyncFunction |                    |               |

> Parameters can also be provided as `{ name, endpoint, transform }`.

###### Example

Below is an example on how to use the method.

````javascript
import { Endpoint } from '@trenskow/app';

export default new Endpoint()

    .parameter('name',
        new Endpoint()
            .get(({ name }) => name))

    /* Below is an example of a shortcut method (also demonstrates transforms). */

    .parameters.user({
        transform: async ({ user }) => await getMyUserFromId(user),
        endpoint: new Endpoint()
	    	.get(({ parameters: { user } }) => `Hello ${user.name}!` })
    });
````

##### `middleware`

This method instals a piece of middleware. Middleware would typically be routes, that do not handle an endpoint, but works as a transform or service provider. Body parsers and rate limiters would typically be installed as middleware.

> Returns the endpoint.

###### Parameters

| Name     | Description                              |        Type         |      Required      | Default value |
| -------- | ---------------------------------------- | :-----------------: | :----------------: | :-----------: |
| `router` | The router that contains the middleware. | [Router](#router-2) | :white_check_mark: |               |

###### Example

Below is an example on how to implement a JSON body parser in a middleware router.

````javascript
/* my-endpoint.js */

import { Endpoint } from '@trenskow/app';

export default = new Endpoint()
    .middleware(await import('./body-json-parser.js'))
    .post(({ body }) => JSON.stringify(body)); /* echo body to response */
````

````javascript
/* body-json-parser.js */

import { Router, Error as AppError } from '@trenskow/app';

export default = new Router()
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
````

##### `.mixin`

This method mixes in another endpoint into this.

> Returns the endpoint.

###### Parameters

| Name       | Description                            |           Type            |      Required      | Default value |
| ---------- | -------------------------------------- | :-----------------------: | :----------------: | :-----------: |
| `endpoint` | The endpoint to be mixed in into this. | [`Endpoint`](#endpoint-2) | :white_check_mark: |               |

###### Example

Below is an example on how to use mixin.

````javascript
/* endpoint-1.js */

import { Endpoint } from '@trenskow/app';

export default new Endpoint()
	.get(() => 'Hello, world!')
	.mixin(await import('./endpoint-2.js'));
````

````javascript
/* endpoint-2.js */

export default new Endpoint()
	.post(async () => 'Hello, world from POST!');
````

### `Router`

#### Constructor

The constructor takes no parameters.

#### Instance methods

##### `.use`

This method is like the [HTTP method handlers](#get-post-put-delete-etc) of [`Endpoint`](#endpoint-2), except it discards the return value and continues to process the request.

Typically used by middleware.

> Returns the router.

###### Parameters

| Name      | Description                  |                           Type                           |      Required      | Default value |
| --------- | ---------------------------- | :------------------------------------------------------: | :----------------: | :-----------: |
| `handler` | A (or an array of) handlers. | Function, AsyncFunction or Array ([see also](#handlers)) | :white_check_mark: |               |

###### Example

> See example [above](#example-6).

##### `.mixin`

This method mixes in another router into this.

> Returns the router.

###### Parameters

| Name     | Description                          |        Type         |      Required      | Default value |
| -------- | ------------------------------------ | :-----------------: | :----------------: | :-----------: |
| `router` | The router to be mixed in into this. | [Router](#router-2) | :white_check_mark: |               |

###### Example

Below is an example on how to use mixin.

````javascript
/* router-1.js */

import { Router } from '@trenskow/app';

export default new Router()
	.mixin(import('./router-2.js'));
````

````javascript
/* router-2.js */

import { Router } from '@trenskow/app';

export default new Router()
	.use(async () => {
        /* Your handler here */
	});
````

### `Request`

This class represents the request. Each individual request has its own instance assigned to `context.request`, where it accessible from endpoint, routers and handlers.

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

