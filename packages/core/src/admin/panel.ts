// Validation of plugin panel content (Decision 33) before it reaches the browser. Browser-safe.
// Anything malformed is dropped rather than rendered; links must be `https:` or `/`-relative.
import type { PanelBlock, PanelContent, PanelTone } from '../config/plugin';

const TONES = new Set<PanelTone>(['default', 'ok', 'warning', 'muted']);
const STATUSES = new Set(['on', 'off', 'locked']);
const MAX_BLOCKS = 50;
const MAX_ITEMS = 100;

const str = (v: unknown, max = 500): string | null =>
	typeof v === 'string' ? v.slice(0, max) : null;
const tone = (v: unknown): PanelTone | undefined =>
	TONES.has(v as PanelTone) ? (v as PanelTone) : undefined;
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const obj = (v: unknown): Record<string, unknown> | null =>
	typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** `https:` URLs and `/`-relative paths (not `//host`). Everything else → `null`. */
export function safePanelHref(href: unknown): string | null {
	if (typeof href !== 'string' || href.length > 2000) return null;
	if (href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/\\')) return href;
	try {
		return new URL(href).protocol === 'https:' ? href : null;
	} catch {
		return null;
	}
}

function block(raw: unknown): PanelBlock | null {
	const b = obj(raw);
	if (!b) return null;
	switch (b.type) {
		case 'heading':
		case 'text': {
			const text = str(b.text, 2000);
			if (text === null) return null;
			if (b.type === 'heading') return { type: 'heading', text };
			const t = tone(b.tone);
			return t ? { type: 'text', text, tone: t } : { type: 'text', text };
		}
		case 'keyValue': {
			if (!Array.isArray(b.items)) return null;
			const items = b.items.slice(0, MAX_ITEMS).flatMap((i) => {
				const o = obj(i);
				const label = str(o?.label);
				const value = str(o?.value);
				if (label === null || value === null) return [];
				const t = tone(o?.tone);
				return [t ? { label, value, tone: t } : { label, value }];
			});
			return { type: 'keyValue', items };
		}
		case 'meter': {
			const label = str(b.label);
			const used = num(b.used);
			const limit = b.limit === null ? null : num(b.limit);
			if (label === null || used === null || (b.limit !== null && limit === null)) return null;
			const unit = str(b.unit, 40);
			return unit === null
				? { type: 'meter', label, used, limit }
				: { type: 'meter', label, used, limit, unit };
		}
		case 'list': {
			if (!Array.isArray(b.items)) return null;
			const items = b.items.slice(0, MAX_ITEMS).flatMap((i) => {
				const o = obj(i);
				const label = str(o?.label);
				if (label === null) return [];
				const item: { label: string; description?: string; status?: 'on' | 'off' | 'locked' } = {
					label,
				};
				const d = str(o?.description, 1000);
				if (d !== null) item.description = d;
				if (STATUSES.has(o?.status as string)) item.status = o?.status as 'on' | 'off' | 'locked';
				return [item];
			});
			return { type: 'list', items };
		}
		case 'link': {
			const label = str(b.label);
			const href = safePanelHref(b.href);
			return label !== null && href !== null ? { type: 'link', label, href } : null;
		}
		default:
			return null;
	}
}

export function sanitizePanelContent(raw: unknown): PanelContent {
	const o = obj(raw);
	const blocks = Array.isArray(o?.blocks) ? o.blocks : [];
	return { blocks: blocks.slice(0, MAX_BLOCKS).flatMap((b) => block(b) ?? []) };
}
