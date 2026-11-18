// Tiny rich-text builders for the seed: paragraphs, headings, lists (Tiptap JSON).
type Node = { type: string; attrs?: Record<string, unknown>; content?: Node[]; text?: string };
const text = (t: string): Node[] => [{ type: 'text', text: t }];

export const p = (t: string): Node => ({ type: 'paragraph', content: text(t) });
export const h2 = (t: string): Node => ({ type: 'heading', attrs: { level: 2 }, content: text(t) });
export const h3 = (t: string): Node => ({ type: 'heading', attrs: { level: 3 }, content: text(t) });
export const ul = (...items: string[]): Node => ({
	type: 'bulletList',
	content: items.map((i) => ({ type: 'listItem', content: [p(i)] })),
});
export const ol = (...items: string[]): Node => ({
	type: 'orderedList',
	content: items.map((i) => ({ type: 'listItem', content: [p(i)] })),
});
export const quote = (t: string): Node => ({ type: 'blockquote', content: [p(t)] });

/** `rt(p('...'), h2('...'))`, or plain strings which become paragraphs. */
export const rt = (...nodes: (Node | string)[]) => ({
	type: 'doc' as const,
	content: nodes.map((n) => (typeof n === 'string' ? p(n) : n)),
});
