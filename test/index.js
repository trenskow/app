//
// index.js
// @trenskow/app
// 
// Created by Kristian Trenskow on 2021/11/08
// For license see LICENSE.
// 

import supertest from 'supertest';

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

		it ('should respond with 405 when a route is configured, but no methods has been defined,', async () => {
			app.root(() => {});
			await request
				.get('/')
				.expect(405);
		});

		it ('should respond with 200 and `Hello, World!` when a GET method is configured.', async () => {

			app.root(({ endpoint }) => endpoint.get(() => 'Hello, World!'));

			await request
				.get('/')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'Hello, World!');

		});

		it ('should respond with 404 when a mount is configured but another is requested.', async () => {

			app.root(({ endpoint }) => {
				endpoint.mounts.helloWorld(({ endpoint }) => {
					endpoint.get(async () => 'Hello!');
				});
			});

			await request
				.get('/world')
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

			app.root(({ endpoint }) => {
				endpoint.parameter({
					name: 'value',
					endpoint: ({ endpoint }) => {
						endpoint.get(({ parameters: { value }}) => value);
					}
				});
			});

			await request
				.get('/the-actual-value/')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'the-actual-value');

		});

		it ('should respond with parameter value (transformed).', async () => {

			app.root(({ endpoint }) => {
				endpoint
					.parameter({
						name: 'value',
						endpoint: ({ endpoint }) => {
							endpoint.get(({ parameters: { value }}) => value);
						},
						transform: (value) => `${value}-2`
					});
			});

			await request
				.get('/the-actual-value/')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'the-actual-value-2');

		});

		it ('should respond with a something generated in a transform.', async () => {

			app.root(({ endpoint }) => {
				endpoint
					.middleware(({ router }) => {
						router
							.use(({ parameters }) => parameters.value = 'my-value');
					})
					.get(({ parameters: { value }}) => value);
			});

			await request
				.get('/')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'my-value');

		});

		it ('should respond with a value when using PUT on a catch-all method.', async () => {

			app.root(({ endpoint }) => {
				endpoint.all(() => 'Hello, World!');
			});

			await request
				.put('/')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'Hello, World!');

		});

		it ('should respond with a query value.', async () => {

			app.root(({ endpoint }) => {
				endpoint.get(({ query: { myValue } }) => myValue);
			});

			await request
				.get('/?my-value=this-is-my-value')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'this-is-my-value');

		});

		it ('should respond with a parameter value in a nested route.', async () => {

			app.root(({ endpoint }) => {
				endpoint
					.mounts.first(({ endpoint }) => {
						endpoint
							.parameter('value', ({ endpoint }) => {
								endpoint
									.mount('third', ({ endpoint }) => {
										endpoint
											.get(({ parameters: { value } }) => value);
									});
							});
					});
			});

			await request
				.get('/first/second/third')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'second');

		});

		it ('should respond with `Hello, World!` when using catch-all method.', async () => {

			app.root(({ endpoint }) => {
				endpoint.get.catchAll(() => 'Hello, World!');
			});

			await request
				.get('/some/nested/path')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'Hello, World!');

		});

		it ('should respond with `Hello, World!` when there is a space in path.', async () => {

			app.root(({ endpoint }) => {
				endpoint.mount('helloWorld', ({ endpoint }) => {
					endpoint.get(() => 'Hello, World!');
				});
			});

			await request
				.get('/hello world')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'Hello, World!');

		});

		it ('should respond with `Hello, World!` from a mixin router.', async () => {

			app.root(({ endpoint }) => {
				endpoint
					.use((context) => context.parts = [])
					.middleware(({ router }) => {
						router
							.use(({ parts }) => parts.push('Hello'))
							.mixin(({ router }) => {
								router
									.use(({ parts }) => parts.push('World!'));
							});
					})
					.get(({ parts }) => parts.join(', '));
			});

			await request
				.get('/')
				.expect('Content-Type', 'text/plain; charset=utf-8')
				.expect(200, 'Hello, World!');

		});

		it ('should respond with `Hello, World!` from a mixin endpoint.', async () => {

			app.root(({ endpoint }) => {
				endpoint
					.mixin(({ endpoint }) => {
						endpoint
							.get(() => 'Hello, World!');
					});
			});

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

			app = new Application({ path: { mountMatchMode: 'strict' } });

			const port = (await app
				.root(({ endpoint }) => {
					endpoint
						.mounts.helloWorld(({ endpoint }) => {
							endpoint
								.get(() => 'Hello!');
						});
				})
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
