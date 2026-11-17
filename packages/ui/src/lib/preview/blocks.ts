// Finds the blocks of a document's live values, in document order (also inside group/array/blocks).
import type { ClientField } from '@kitcms/core/client';

export interface BlockEntry {
	/** The live block object (`{ id, blockType, ...fields }`), taken from the form state. */
	block: Record<string, unknown> & { blockType: string };
	/** The block's label. */
	label: string;
	key: string;
}

export function collectBlocks(fields: ClientField[], values: Record<string, unknown>, path = ''): BlockEntry[] {
	const out: BlockEntry[] = [];
	for (const f of fields) {
		const v = values?.[f.name];
		const at = `${path}${f.name}`;
		if (f.type === 'group') {
			if (v && typeof v === 'object') out.push(...collectBlocks(f.fields, v as Record<string, unknown>, `${at}.`));
		} else if (f.type === 'array') {
			if (Array.isArray(v)) {
				v.forEach((row, i) => {
					if (row && typeof row === 'object') out.push(...collectBlocks(f.fields, row, `${at}.${i}.`));
				});
			}
		} else if (f.type === 'blocks' && Array.isArray(v)) {
			v.forEach((row, i) => {
				if (!row || typeof row !== 'object' || typeof row.blockType !== 'string') return;
				const def = f.blocks.find((b) => b.slug === row.blockType);
				out.push({
					block: row,
					label: def?.labels.singular ?? row.blockType,
					key: typeof row.id === 'string' && row.id ? row.id : `${at}.${i}`,
				});
				if (def) out.push(...collectBlocks(def.fields, row, `${at}.${i}.`));
			});
		}
	}
	return out;
}
