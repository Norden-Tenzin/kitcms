// SanitizedConfig → TableSpec[]. The mapping is documented in ./spec.ts. Pure, Workers-safe.
import type { SanitizedConfig, SanitizedField } from '../config/sanitized';
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

	for (const collection of config.collections) {
		const slug = collection.slug;
		const columns: ColumnSpec[] = [
			text('id', { primaryKey: true, notNull: true }),
			ts('createdAt', { notNull: true }),
			ts('updatedAt', { notNull: true }),
		];
		const indexes: IndexSpec[] = [idx(`${slug}_createdAt_idx`, ['createdAt'])];
		for (const field of collection.fields) columns.push(fieldColumn(slug, field, indexes));
		tables.push({ name: slug, columns, indexes });
	}

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
