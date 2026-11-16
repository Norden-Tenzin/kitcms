// SPIKE (Phase 0, data layer): TableSpec → Drizzle sqlite tables at runtime (in the Worker).
import {
	index,
	integer,
	real,
	sqliteTable,
	text,
	uniqueIndex,
	type AnySQLiteColumn,
	type SQLiteTableWithColumns,
} from 'drizzle-orm/sqlite-core';
import type { ColumnSpec, TableSpec } from './schema-spec.ts';

// Runtime tables are dynamic, so their column types are erased here. Phase 1 layers
// the inferred document types from defineConfig on top of the Local API instead.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTable = SQLiteTableWithColumns<any>;

export function buildTables(specs: TableSpec[]): Record<string, AnyTable> {
	const tables: Record<string, AnyTable> = {};
	// Specs are ordered so that FK targets come first.
	for (const spec of specs) {
		const cols: Record<string, ReturnType<typeof column>> = {};
		for (const c of spec.columns) cols[c.name] = column(c, tables);
		tables[spec.name] = sqliteTable(spec.name, cols, (t) =>
			spec.indexes.map((ix) => {
				const [first, ...rest] = ix.columns.map((n) => t[n]!);
				return (ix.unique ? uniqueIndex(ix.name) : index(ix.name)).on(first!, ...rest);
			}),
		);
	}
	return tables;
}

function column(c: ColumnSpec, tables: Record<string, AnyTable>) {
	let b;
	switch (c.kind) {
		case 'text':
			b = text(c.name);
			break;
		case 'json':
			b = text(c.name, { mode: 'json' });
			break;
		case 'real':
			b = real(c.name);
			break;
		case 'integer':
			b = integer(c.name);
			break;
		case 'boolean':
			b = integer(c.name, { mode: 'boolean' });
			break;
		case 'timestamp':
			b = integer(c.name, { mode: 'timestamp_ms' });
			break;
	}
	if (c.primaryKey) b = b.primaryKey();
	if (c.notNull) b = b.notNull();
	if (c.default !== undefined) b = b.default(c.default as never);
	if (c.references) {
		const target = c.references.table;
		b = b.references((): AnySQLiteColumn => tables[target]!.id, {
			onDelete: c.references.onDelete,
		});
	}
	return b;
}
