// SanitizedConfig → TableSpec[]. The mapping is documented in ./spec.ts. Pure, Workers-safe.
import type { SanitizedConfig, SanitizedField } from '../config/sanitized';
import { ORDER_FIELD, STATUS_FIELD, VERSIONS_SUFFIX } from '../config/sanitized';
import { AUTH_TABLES, REFS_TABLE, type ColumnSpec, type IndexSpec, type TableSpec } from './spec';

const text = (name: string, extra: Partial<ColumnSpec> = {}): ColumnSpec => ({ name, kind: 'text', ...extra });
const ts = (name: string, extra: Partial<ColumnSpec> = {}): ColumnSpec => ({ name, kind: 'timestamp', ...extra });
const idx = (name: string, columns: string[], unique = false): IndexSpec => ({ name, columns, unique });

function fieldColumn(slug: string, field: SanitizedField, indexes: IndexSpec[]): ColumnSpec {
	const { name } = field;
	switch (field.type) {
		case 'text':
		case 'textarea':
		case 'email':
		case 'slug':
		case 'select':
		case 'number':
		case 'checkbox':
		case 'date': {
			const kind = field.type === 'number' ? 'real' : field.type === 'checkbox' ? 'boolean' : field.type === 'date' ? 'timestamp' : 'text';
			const col: ColumnSpec = { name, kind };
			if (field.type === 'checkbox') {
				col.notNull = true;
				col.default = typeof field.defaultValue === 'boolean' ? field.defaultValue : false;
			}
			if ('unique' in field && field.unique) indexes.push(idx(`${slug}_${name}_unique`, [name], true));
			else if ('index' in field && field.index) indexes.push(idx(`${slug}_${name}_idx`, [name]));
			return col;
		}
		case 'relationship':
		case 'upload':
			if (field.hasMany) return { name, kind: 'json' };
			indexes.push(idx(`${slug}_${name}_idx`, [name]));
			return text(name, { references: { table: field.relationTo, column: 'id', onDelete: 'set null' } });
		case 'group':
		case 'array':
		case 'blocks':
		case 'json':
		case 'richText':
			return { name, kind: 'json' };
	}
}

export function toTableSpecs(config: SanitizedConfig): TableSpec[] {
	const tables: TableSpec[] = [];

	const versionTables: TableSpec[] = [];
	for (const collection of [...config.collections, ...config.globals]) {
		const slug = collection.slug;
		const columns: ColumnSpec[] = [
			text('id', { primaryKey: true, notNull: true }),
			ts('createdAt', { notNull: true }),
			ts('updatedAt', { notNull: true }),
		];
		const indexes: IndexSpec[] = [idx(`${slug}_createdAt_idx`, ['createdAt'])];
		const drafts = collection.versions !== false && collection.versions.drafts !== false;
		if (collection.orderable) {
			columns.push(text(ORDER_FIELD));
			indexes.push(idx(`${slug}_${ORDER_FIELD}_idx`, [ORDER_FIELD]));
		}
		if (drafts) {
			// Default 'published': turning drafts on for an existing collection keeps its docs public.
			columns.push(text(STATUS_FIELD, { notNull: true, default: 'published' }));
			indexes.push(idx(`${slug}_${STATUS_FIELD}_idx`, [STATUS_FIELD]));
		}
		for (const field of collection.fields) columns.push(fieldColumn(slug, field, indexes));
		// Extra indexes (Decision 30): `${slug}_by_${fields}_unique|_idx`.
		for (const ix of collection.indexes ?? []) {
			indexes.push(idx(`${slug}_by_${ix.fields.join('_')}_${ix.unique ? 'unique' : 'idx'}`, ix.fields, ix.unique));
		}
		tables.push({ name: slug, columns, indexes });

		if (collection.versions !== false) {
			const vt = slug + VERSIONS_SUFFIX;
			const vcols: ColumnSpec[] = [
				text('id', { primaryKey: true, notNull: true }),
				text('parent', { notNull: true, references: { table: slug, column: 'id', onDelete: 'cascade' } }),
				{ name: 'version', kind: 'json', notNull: true },
			];
			if (drafts) vcols.push(text(STATUS_FIELD, { notNull: true }));
			vcols.push(
				{ name: 'autosave', kind: 'boolean', notNull: true, default: false },
				{ name: 'latest', kind: 'boolean', notNull: true, default: false },
				ts('createdAt', { notNull: true }),
				ts('updatedAt', { notNull: true }),
			);
			versionTables.push({
				name: vt,
				columns: vcols,
				indexes: [idx(`${vt}_parent_idx`, ['parent', 'createdAt']), idx(`${vt}_latest_idx`, ['parent', 'latest'])],
			});
		}
	}
	tables.push(...versionTables);

	tables.push({
		name: REFS_TABLE,
		columns: ['fromCollection', 'fromId', 'path', 'toCollection', 'toId'].map((n) => text(n, { notNull: true })),
		indexes: [
			idx('_refs_from_idx', ['fromCollection', 'fromId']),
			idx('_refs_to_idx', ['toCollection', 'toId']),
			idx('_refs_path_idx', ['fromCollection', 'path', 'toId']),
		],
	});

	const userId = text('userId', {
		notNull: true,
		references: { table: config.authCollection, column: 'id', onDelete: 'cascade' },
	});
	const id = () => text('id', { primaryKey: true, notNull: true });
	const created = () => [ts('createdAt', { notNull: true }), ts('updatedAt', { notNull: true })];

	tables.push(
		{
			name: AUTH_TABLES.session,
			columns: [
				id(),
				ts('expiresAt', { notNull: true }),
				text('token', { notNull: true }),
				...created(),
				text('ipAddress'),
				text('userAgent'),
				{ ...userId },
			],
			indexes: [idx('auth_sessions_token_unique', ['token'], true), idx('auth_sessions_userId_idx', ['userId'])],
		},
		{
			name: AUTH_TABLES.account,
			columns: [
				id(),
				text('accountId', { notNull: true }),
				text('providerId', { notNull: true }),
				{ ...userId },
				text('accessToken'),
				text('refreshToken'),
				text('idToken'),
				ts('accessTokenExpiresAt'),
				ts('refreshTokenExpiresAt'),
				text('scope'),
				text('password'),
				...created(),
			],
			indexes: [idx('auth_accounts_userId_idx', ['userId'])],
		},
		{
			name: AUTH_TABLES.verification,
			columns: [
				id(),
				text('identifier', { notNull: true }),
				text('value', { notNull: true }),
				ts('expiresAt', { notNull: true }),
				...created(),
			],
			indexes: [idx('auth_verifications_identifier_idx', ['identifier'])],
		},
		{
			name: AUTH_TABLES.rateLimit,
			columns: [
				id(),
				text('key', { notNull: true }),
				{ name: 'count', kind: 'integer', notNull: true },
				{ name: 'lastRequest', kind: 'integer', notNull: true },
			],
			indexes: [idx('auth_rate_limits_key_unique', ['key'], true)],
		},
	);

	return tables;
}
