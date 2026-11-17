import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** Dedicated local D1/R2/registry state. Wiped by scripts/prepare.mjs at the start of every run. */
export const STATE = path.join(root, '.e2e-state');
export const CMS_PORT = 8801;
export const CONSUMER_PORT = 8802;
export const CMS_URL = `http://localhost:${CMS_PORT}`;
export const CONSUMER_URL = `http://localhost:${CONSUMER_PORT}`;
/** A signed-in session, saved by the `auth` project and used by the `admin` project. */
export const AUTH_FILE = path.join(STATE, 'admin.json');

export const ADMIN = { name: 'E2E Admin', email: 'admin@e2e.test', password: 'e2e-password-123' };
