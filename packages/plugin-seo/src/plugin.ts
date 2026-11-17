import type { CollectionDef, Config, FieldDef, GlobalDef, KitcmsPlugin } from '@kitcms/core';
import { fields } from '@kitcms/core';

export interface SeoOptions {
	/** Collection slugs to add the meta group to. */
	collections?: string[];
	/** Global slugs to add the meta group to. */
	globals?: string[];
	/** Upload collection for `meta.image`. Omit for no image field. */
	uploadsCollection?: string;
	/** Name of the group field. Default `'meta'`. */
	fieldName?: string;
	/** Recommended title length, shown as a hint only. Default 60. */
	titleMaxLength?: number;
	/** Recommended description length, shown as a hint only. Default 160. */
	descriptionMaxLength?: number;
}

const fail = (msg: string): never => {
	throw new Error(`seo: ${msg}`);
};

/** Adds an SEO `meta` group (title, description, image, noIndex) to the listed collections and globals. */
export function seo(options: SeoOptions = {}): KitcmsPlugin {
	const fieldName = options.fieldName ?? 'meta';
	const titleLen = options.titleMaxLength ?? 60;
	const descLen = options.descriptionMaxLength ?? 160;

	return {
		name: 'seo',
		config(config: Config): Config {
			const collections = (config.collections ?? []) as readonly CollectionDef[];
			const globals = (config.globals ?? []) as readonly GlobalDef[];

			if (options.uploadsCollection !== undefined) {
				const up = collections.find((c) => c.slug === options.uploadsCollection);
				if (!up) fail(`uploadsCollection "${options.uploadsCollection}" does not exist.`);
				else if (!up.upload) fail(`uploadsCollection "${options.uploadsCollection}" is not an upload collection.`);
			}

			const group = (): FieldDef =>
				fields.group({
					admin: { position: 'sidebar', description: 'Search engine and social sharing.' },
					fields: {
						title: fields.text({
							admin: { description: `Recommended: up to ${titleLen} characters. Falls back to the page title.` },
						}),
						description: fields.textarea({
							admin: { description: `Recommended: up to ${descLen} characters.` },
						}),
						...(options.uploadsCollection !== undefined
							? {
									image: fields.upload({
										relationTo: options.uploadsCollection,
										admin: { description: 'Shown when the page is shared. 1200x630 works best.' },
									}),
								}
							: {}),
						noIndex: fields.checkbox({
							defaultValue: false,
							admin: { description: 'Ask search engines not to list this page.' },
						}),
					},
				}) as FieldDef;

			const apply = <T extends { slug: string; fields: Record<string, FieldDef> }>(
				items: readonly T[],
				slugs: string[] | undefined,
				kind: string,
			): readonly T[] => {
				if (!slugs?.length) return items;
				for (const s of slugs) if (!items.some((i) => i.slug === s)) fail(`${kind} "${s}" does not exist.`);
				return items.map((item) => {
					if (!slugs.includes(item.slug)) return item;
					if (fieldName in item.fields) fail(`${kind} "${item.slug}" already has a field named "${fieldName}".`);
					return { ...item, fields: { ...item.fields, [fieldName]: group() } };
				});
			};

			return {
				...config,
				...(config.collections || options.collections?.length
					? { collections: apply(collections, options.collections, 'collection') as CollectionDef[] }
					: {}),
				...(config.globals || options.globals?.length
					? { globals: apply(globals, options.globals, 'global') as GlobalDef[] }
					: {}),
			};
		},
	};
}
