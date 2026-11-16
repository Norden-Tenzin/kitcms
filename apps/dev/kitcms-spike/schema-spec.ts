// SPIKE (Phase 0, data layer): config → TableSpec (plain data).
// The single source of truth for both the runtime Drizzle tables and the generated
// drizzle-kit schema file. Pure TS, no Node APIs: runs in the Worker and in the CLI.

export type SpikeField =
	| { type: 'text' | 'textarea' | 'email'; required?: boolean; unique?: boolean; index?: boolean }
	| { type: 'slug'; from?: string; required?: boolean; unique?: boolean }
	| { type: 'number'; required?: boolean; index?: boolean }
	| { type: 'checkbox'; defaultValue?: boolean }
	| { type: 'select'; options: readonly string[]; required?: boolean; index?: boolean }
	| { type: 'date'; required?: boolean; index?: boolean }
	| { type: 'relationship' | 'upload'; relationTo: string; hasMany?: boolean; required?: boolean }
	| { type: 'group' | 'array'; fields: Record<string, SpikeField> }
	| { type: 'blocks'; blocks: readonly SpikeBlock[] }
	| { type: 'json' | 'richText' };

export interface SpikeBlock {
	slug: string;
	fields: Record<string, SpikeField>;
	admin?: { preview?: unknown };
}

export interface SpikeCollection {
	slug: string;
	upload?: boolean;
	orderable?: boolean;
	versions?: { drafts?: boolean };
	fields: Record<string, SpikeField>;
}

export interface SpikeConfig {
	collections: readonly SpikeCollection[];
}

export type ColumnKind = 'text' | 'real' | 'integer' | 'boolean' | 'timestamp' | 'json';

export interface ColumnSpec {
	name: string;
	kind: ColumnKind;
	notNull?: boolean;
	primaryKey?: boolean;
	default?: string | number | boolean;
	references?: { table: string; onDelete: 'set null' | 'cascade' };
}

export interface IndexSpec {
	name: string;
	columns: string[];
	unique: boolean;
}

export interface TableSpec {
	name: string;
	columns: ColumnSpec[];
	indexes: IndexSpec[];
}

const NESTED = new Set(['group', 'array', 'blocks', 'json', 'richText']);

export function toTableSpecs(config: SpikeConfig): TableSpec[] {
	const slugs = new Set(config.collections.map((c) => c.slug));
	const tables: TableSpec[] = [];

	for (const col of config.collections) {
		const columns: ColumnSpec[] = [
			{ name: 'id', kind: 'text', primaryKey: true, notNull: true },
			{ name: 'createdAt', kind: 'timestamp', notNull: true },
			{ name: 'updatedAt', kind: 'timestamp', notNull: true },
		];
		const indexes: IndexSpec[] = [];
		let hasRels = false;

		if (col.versions?.drafts) {
			columns.push({ name: '_status', kind: 'text', notNull: true, default: 'draft' });
			indexes.push({ name: `${col.slug}__status_idx`, columns: ['_status'], unique: false });
		}
		if (col.orderable) {
			// Fractional-index key (string), so reordering touches one row.
			columns.push({ name: '_order', kind: 'text' });
			indexes.push({ name: `${col.slug}__order_idx`, columns: ['_order'], unique: false });
		}
		if (col.upload) {
			for (const [name, kind] of [
				['filename', 'text'],
				['mimeType', 'text'],
				['filesize', 'integer'],
				['width', 'integer'],
				['height', 'integer'],
				['key', 'text'],
			] as const) {
				columns.push({ name, kind, notNull: name === 'filename' || name === 'key' });
			}
			indexes.push({ name: `${col.slug}_key_unique`, columns: ['key'], unique: true });
		}

		for (const [name, field] of Object.entries(col.fields)) {
			if (NESTED.has(field.type)) {
				columns.push({ name, kind: 'json' });
				continue;
			}
			if (field.type === 'relationship' || field.type === 'upload') {
				if (!slugs.has(field.relationTo)) {
					throw new Error(`${col.slug}.${name}: unknown collection "${field.relationTo}"`);
				}
				if (field.hasMany) {
					hasRels = true;
					continue;
				}
				columns.push({
					name,
					kind: 'text',
					notNull: field.required,
					references: { table: field.relationTo, onDelete: 'set null' },
				});
				indexes.push({ name: `${col.slug}_${name}_idx`, columns: [name], unique: false });
				continue;
			}
			const kind: ColumnKind =
				field.type === 'number'
					? 'real'
					: field.type === 'checkbox'
						? 'boolean'
						: field.type === 'date'
							? 'timestamp'
							: 'text';
			const spec: ColumnSpec = { name, kind };
			if ('required' in field && field.required) spec.notNull = true;
			if (field.type === 'checkbox') {
				spec.notNull = true;
				spec.default = field.defaultValue ?? false;
			}
			columns.push(spec);
			if ('unique' in field && field.unique) {
				indexes.push({ name: `${col.slug}_${name}_unique`, columns: [name], unique: true });
			} else if ('index' in field && field.index) {
				indexes.push({ name: `${col.slug}_${name}_idx`, columns: [name], unique: false });
			}
		}

		tables.push({ name: col.slug, columns, indexes });

		if (hasRels) {
			tables.push({
				name: `${col.slug}_rels`,
				columns: [
					{ name: 'id', kind: 'text', primaryKey: true, notNull: true },
					{
						name: 'parentId',
						kind: 'text',
						notNull: true,
						references: { table: col.slug, onDelete: 'cascade' },
					},
					{ name: 'path', kind: 'text', notNull: true },
					{ name: 'position', kind: 'integer', notNull: true },
					{ name: 'toCollection', kind: 'text', notNull: true },
					{ name: 'toId', kind: 'text', notNull: true },
				],
				indexes: [
					{ name: `${col.slug}_rels_parent_idx`, columns: ['parentId', 'path'], unique: false },
					{ name: `${col.slug}_rels_to_idx`, columns: ['toCollection', 'toId'], unique: false },
				],
			});
		}

		if (col.versions) {
			tables.push({
				name: `${col.slug}_versions`,
				columns: [
					{ name: 'id', kind: 'text', primaryKey: true, notNull: true },
					{
						name: 'parentId',
						kind: 'text',
						notNull: true,
						references: { table: col.slug, onDelete: 'cascade' },
					},
					{ name: 'snapshot', kind: 'json', notNull: true },
					{ name: 'createdAt', kind: 'timestamp', notNull: true },
				],
				indexes: [
					{
						name: `${col.slug}_versions_parent_idx`,
						columns: ['parentId', 'createdAt'],
						unique: false,
					},
				],
			});
		}
	}

	tables.push({
		name: '_refs',
		columns: [
			{ name: 'fromCollection', kind: 'text', notNull: true },
			{ name: 'fromId', kind: 'text', notNull: true },
			{ name: 'path', kind: 'text', notNull: true },
			{ name: 'toCollection', kind: 'text', notNull: true },
			{ name: 'toId', kind: 'text', notNull: true },
		],
		indexes: [
			{ name: '_refs_from_idx', columns: ['fromCollection', 'fromId'], unique: false },
			{ name: '_refs_to_idx', columns: ['toCollection', 'toId'], unique: false },
		],
	});

	return tables;
}
