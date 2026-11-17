// Config → TableSpec: the single description of the D1 schema (Decision 15).
// At runtime the Worker builds Drizzle tables from it (./drizzle.ts). At build time the CLI prints
// it as a static `drizzle/schema.ts` for drizzle-kit (./codegen.ts). Both must produce identical
// tables. Pure TS, no Node APIs.
//
// MAPPING (plan §4.3, Decisions 6, 20, 21) — the contract for `toTableSpecs`:
//
// Collection table: name = collection slug. Columns, in this order:
//   id         text, primary key, not null           (ULID; Better Auth ids for the auth collection are ULIDs too)
//   createdAt  timestamp (integer ms), not null
//   updatedAt  timestamp (integer ms), not null
//   then one column per top-level data field, in `collection.fields` order, named exactly like the field:
//     text, textarea, email, slug, select → text
//     number                              → real
//     checkbox                            → boolean (integer 0/1), NOT NULL, default = static defaultValue ?? false
//     date                                → timestamp (integer ms)
//     relationship/upload, single         → text, FK → target(id) ON DELETE SET NULL, plus an index
//     relationship/upload, hasMany        → json (Decision 20: an ordered id array, reverse-indexed by `_refs`)
//     group, array, blocks, json, richText→ json
//   User field columns are always NULLABLE (except checkbox): `required` is enforced by validation,
//   so adding a required field never breaks a migration on a non-empty table.
// System columns after updatedAt (Phase 2, plan §13), before the field columns:
//   _order     text, nullable                         — `orderable: true` only (fractional-index key)
//   _status    text, NOT NULL, default 'published'    — `versions.drafts` only ('draft' | 'published')
// Indexes on a collection table:
//   `${slug}_createdAt_idx` on (createdAt)                — the default sort
//   `${slug}_${field}_unique` UNIQUE on (field)           — `unique: true`
//   `${slug}_${field}_idx` on (field)                     — `index: true` (and not unique), and every single relationship/upload
//
//   `${slug}_by_${f1}_${f2}_unique|_idx` on (f1, f2, ...)   — `collection({ indexes })` (Decision 30)
//   `${slug}__order_idx` on (_order), `${slug}__status_idx` on (_status) — when those columns exist
//
// Global tables (§13.1): every global is a collection table named `_global_<slug>` holding one row
// (id = the global slug). Same mapping as above. Emitted after the collections.
//
// Version tables (§13.4): for every collection/global with `versions`, `${table}_versions`:
//   id text pk nn (ULID), parent text nn FK → table(id) ON DELETE CASCADE, version json nn,
//   _status text nn (drafts only), autosave boolean nn default false, latest boolean nn default false,
//   createdAt timestamp nn, updatedAt timestamp nn
//   idx: `${vt}_parent_idx` (parent, createdAt), `${vt}_latest_idx` (parent, latest)
// Emitted after every collection and global table.
//
// `_refs` (one table, every reference from every document, Decision 6/20):
//   fromCollection text not null, fromId text not null, path text not null,
//   toCollection text not null, toId text not null. No primary key (rowid).
//   Indexes: `_refs_from_idx` (fromCollection, fromId), `_refs_to_idx` (toCollection, toId),
//            `_refs_path_idx` (fromCollection, path, toId)  — `where` on hasMany fields.
//
// Better Auth tables (§4.7). The `user` model is the auth collection's table itself (its built-in
// fields email/name/role/emailVerified/image are ordinary columns). Column names are camelCase:
//   auth_sessions:      id text pk, expiresAt timestamp nn, token text nn, createdAt timestamp nn,
//                       updatedAt timestamp nn, ipAddress text, userAgent text,
//                       userId text nn FK → <auth collection>(id) ON DELETE CASCADE
//                       idx: auth_sessions_token_unique UNIQUE (token), auth_sessions_userId_idx (userId)
//   auth_accounts:      id text pk, accountId text nn, providerId text nn,
//                       userId text nn FK → <auth collection>(id) CASCADE, accessToken text,
//                       refreshToken text, idToken text, accessTokenExpiresAt timestamp,
//                       refreshTokenExpiresAt timestamp, scope text, password text,
//                       createdAt timestamp nn, updatedAt timestamp nn
//                       idx: auth_accounts_userId_idx (userId)
//   auth_verifications: id text pk, identifier text nn, value text nn, expiresAt timestamp nn,
//                       createdAt timestamp nn, updatedAt timestamp nn
//                       idx: auth_verifications_identifier_idx (identifier)
//   auth_rate_limits:   id text pk, key text nn, count integer nn, lastRequest integer nn
//                       idx: auth_rate_limits_key_unique UNIQUE (key)
//
// Table order: collections, then globals (config order), then version tables, then `_refs`, then the auth tables. FK references
// are lazy (`() => table.id`), so order doesn't matter for correctness.

export type ColumnKind = 'text' | 'real' | 'integer' | 'boolean' | 'timestamp' | 'json';

export interface ColumnSpec {
	name: string;
	kind: ColumnKind;
	notNull?: boolean;
	primaryKey?: boolean;
	default?: string | number | boolean;
	references?: { table: string; column: 'id'; onDelete: 'set null' | 'cascade' };
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

export const REFS_TABLE = '_refs';
export const AUTH_TABLES = {
	session: 'auth_sessions',
	account: 'auth_accounts',
	verification: 'auth_verifications',
	rateLimit: 'auth_rate_limits',
} as const;
