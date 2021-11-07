// name.js
// @trenskow/app
// 
// Created by Kristian Trenskow on 2021/11/07
// For license see LICENSE.
// 

export default ({endpoint }) => {

	endpoint

		.middleware(async ({ router }) => {
			router
				.use(({ parameters, query: { greeting }  }) => {
					parameters.greeting = `${parameters.name} ${greeting || 'Nice to meet you.'}`;
				});
		})

		.get(
			async (context) => {
				context.render();
				return context.parameters.greeting;
			},
			() => { throw new Error('Should never be called!'); });

};
