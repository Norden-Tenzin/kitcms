import { collection, defineConfig, fields } from '../../../../index';

export default defineConfig({
	collections: [
		collection({
			slug: 'posts',
			fields: { title: fields.text({ required: true }), published: fields.checkbox() },
		}),
	],
});
