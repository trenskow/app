//
// index.js
// @trenskow/app
//
// Created by Kristian Trenskow on 2021/11/08
// For license see LICENSE.
//

import supertest from 'supertest';
import { Endpoint, Router } from '../lib/index.js';

import Application from '../lib/index.js';

process.on('unhandledRejection', (error) => {
	console.error(error.stack);
	process.exit (1);
});

let app;
let request;

describe('Application', () => {

	describe('[loose path match mode]', () => {
		before(async () => {

			app = new Application();

			const port = (await app
				.open())
				.port;

			request = supertest(`http://localhost:${port}`);

		});

		it ('should respond with 404 for when no routes has been configured.', async () => {
			await request
				.get('/')
				.expect(404);
		});

		it ('should respond with 404 when a route is configured, but no methods has been defined,', async () => {
			app.root(new Endpoint());
			await request
				.get('/')
				.expect(404);
		});

		it ('should respond with 405 when a route is configured, but request method is not specified,', async () => {
			app.root(
				new Endpoint()
					.post(() => {})
					.put(() => {})
					.delete(() => {})
			);
			await request
				.get('/')
				.expect('Allow', 'POST, PUT, DELETE')
				.expect(405);
		});

		it ('should respond with 200 and `Hello, World!` when a GET method is configured.', async () => {

			app.root(
				new Endpoint()
					.get(() => 'Hello, World!')
			);

			await request
				.get('/')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'Hello, World!');

		});

		it ('should respond with 200 when HEAD method is configured and HEAD method is requested', async () => {

			app.root(
				new Endpoint()
					.get(() => 'Hello, World!')
					.head(({ response }) => {
						response.statusCode = 204;
						return 'Hello, World!';
					})
			);

			await request
				.head('/')
				.expect(204, undefined);

		});

		it ('should respond with 200 and no content when a GET method is configured (but no HEAD method) and HEAD is requested.', async () => {

			app.root(
				new Endpoint()
					.get(() => 'Hello, World!')
			);

			await request
				.head('/')
				.expect(200, undefined);

		});

		it ('should ignore multiple GET method handlers and respond with 200 and `Hello, World!`.', async () => {

			app.root(
				new Endpoint()
					.get(() => 'Ignore this!')
					.post(() => 'Not used')
					.get(
						() => 'Hello, World!',
						() => { /* Ignore this */ })
			);

			await request
				.get('/')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'Hello, World!');

		});

		it ('should ignore GET method handler when path has been rewritten and respond with 200 and `Hello, World!`.', async () => {

			app.root(
				new Endpoint()
					.use(({ path }) => {
						if (path.remaining[0] === 'ignore') {
							path.remaining = ['hello'];
						}
					})
					.mounts.ignore(
						new Endpoint()
							.get(() => 'Ignore this!'))
					.mounts.hello(
						new Endpoint()
							.get(() => 'Hello!')
					)
			);

			await request
				.get('/ignore')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'Hello!');

		});

		it ('should respond with 404 when a mount is configured but another is requested.', async () => {

			app.root(
				new Endpoint()
					.mounts.helloWorld(
						new Endpoint()
							.get(async () => 'Hello!'))
			);

			await request
				.get('/world')
				.expect(404);

		});

		it ('should respond with 404 when a mount is configured but a deeper path is requested.', async () => {

			app.root(
				new Endpoint()
					.mounts.helloWorld(
						new Endpoint()
							.get(async () => 'Hello!')
					));

			await request
				.get('/hello-world/i')
				.expect(404);

			await request
				.get('/')
				.expect(404);

		});

		it ('should respond with 405 when a wrong method is requested on a mount.', async () => {

			await request
				.put('/helloWorld')
				.expect(405);

		});

		it ('should respond with 200 and `Hello!` when GET method is requested on configured mount.', async () => {

			await request
				.get('/helloWorld')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'Hello!');

		});

		it ('should respond with 200 and `Hello!` when path case does not match.', async () => {

			await request
				.get('/hello-world')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'Hello!');

		});

		it ('should respond with parameter value.', async () => {

			app.root(
				new Endpoint()
					.parameter({
						name: 'value',
						endpoint: new Endpoint()
							.get(({ parameters: { value }}) => value)
					})
			);

			await request
				.get('/the-actual-value/')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'the-actual-value');

		});

		it ('should respond with parameter value (transformed).', async () => {

			app.root(
				new Endpoint()
					.parameter({
						name: 'target',
						transform: ({ target }) => `Hello, ${target}!`,
						endpoint: new Endpoint()
							.get(({ parameters: { target }}) => target)
					})
			);

			await request
				.get('/World/')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'Hello, World!');

		});

		it ('should respond with a something generated in a transform.', async () => {

			app.root(
				new Endpoint()
					.middleware(
						new Router()
							.use(({ parameters }) => parameters.value = 'my-value'))
					.get(({ parameters: { value }}) => value)
			);

			await request
				.get('/')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'my-value');

		});

		it ('should respond with a value when using PUT on a catch-all method.', async () => {

			app.root(
				new Endpoint()
					.all(() => 'Hello, World!')
			);

			await request
				.put('/')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'Hello, World!');

		});

		it ('should respond with a query value.', async () => {

			app.root(
				new Endpoint()
					.get(({ query: { myValue } }) => myValue)
			);

			await request
				.get('/?my-value=this-is-my-value')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'this-is-my-value');

		});

		it ('should respond with a parameter value in a nested route.', async () => {

			app.root(
				new Endpoint()
					.mounts.first(
						new Endpoint()
							.parameter('value',
								new Endpoint()
									.mount('third',
										new Endpoint()
											.get(({ parameters: { value } }) => value))
							)
					)
			);

			await request
				.get('/first/second/third')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'second');

		});

		it ('should respond with `Hello, World!` when using catch-all method.', async () => {

			app.root(
				new Endpoint()
					.get.catchAll(() => 'Hello, World!')
			);

			await request
				.get('/some/nested/path')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'Hello, World!');

		});

		it ('should respond with `Hello, World!` when there is a space in path.', async () => {

			app.root(
				new Endpoint()
					.mount(
						'helloWorld',
						new Endpoint()
							.get(() => 'Hello, World!')
					)
			);

			await request
				.get('/hello world')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'Hello, World!');

		});

		it ('should respond with `Hello, World!` from a mixin router.', async () => {

			app.root(
				new Endpoint()
					.use((context) => context.parts = [])
					.middleware(
						new Router()
							.use(({ parts }) => parts.push('Hello'))
							.mixin(
								new Router()
									.use(({ parts }) => parts.push('World!'))
							)
					)
					.get(({ parts }) => parts.join(', '))
			);

			await request
				.get('/')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'Hello, World!');

		});

		it ('should respond with `Hello, World!` from a mixin endpoint.', async () => {

			app.root(
				new Endpoint()
					.mixin(
						new Endpoint()
							.get(() => 'Hello, World!')
					)
			);

			await request
				.get('/')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'Hello, World!');

		});

		it ('should come back with value transformed in a transform.', async () => {

			app.root(
				new Endpoint()
					.transform(async ({ result }) => {
						return (await result()) + ', World!';
					})
					.get(() => 'Hello')
			);

			await request
				.get('/')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'Hello, World!');

		});

		after(async () => {
			await app.close({ awaitAllConnections: true });
		});

	});

	describe('[strict path match mode]', () => {

		before(async () => {

			app = new Application({ path: { matchMode: 'strict' } });

			const port = (await app
				.root(
					new Endpoint()
						.mounts.helloWorld(
							new Endpoint()
								.get(() => 'Hello!')
						))
				.open())
				.port;

			request = supertest(`http://localhost:${port}`);

		});

		it ('should come back with 200 and `Hello!` when patch matches in case.', async () => {

			await request
				.get('/helloWorld')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'Hello!');

		});

		it ('should come back with 404 when patch does not match in case (1).', async () => {

			await request
				.get('/helloworld')
				.expect(404);

		});

		it ('should come back with 404 when patch does not match in case (2).', async () => {

			await request
				.get('/hello-world')
				.expect(404);

		});

		after(async () => {
			await app.close({ awaitAllConnections: true });
		});

	});

});
