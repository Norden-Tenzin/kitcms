import { env } from 'cloudflare:workers';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const row = await env.DB.prepare('select 1 as ok').first();
	const list = await env.BUCKET.list({ limit: 1 });
	return { d1: row, r2Objects: list.objects.length };
};
