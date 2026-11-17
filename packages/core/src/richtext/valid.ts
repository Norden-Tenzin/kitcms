// Bounded structural check for rich text documents, shared by browser and server validation.
// Bounds: nesting depth <= 50, total nodes (including marks) <= 100_000. ProseMirror documents
// from real editors stay far below both; the bounds exist to stop hostile payloads.
export const RICHTEXT_MAX_DEPTH = 50;
export const RICHTEXT_MAX_NODES = 100_000;

export function isRichTextDoc(value: unknown): boolean {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const doc = value as Record<string, unknown>;
	if (doc.type !== 'doc') return false;
	if (doc.content === undefined) return true;
	if (!Array.isArray(doc.content)) return false;
	let count = 0;
	// Iterative, so a deep payload can't overflow the stack before the depth bound trips.
	const stack: [unknown, number][] = doc.content.map((n) => [n, 1]);
	while (stack.length) {
		const [node, depth] = stack.pop()!;
		if (++count > RICHTEXT_MAX_NODES || depth > RICHTEXT_MAX_DEPTH) return false;
		if (typeof node !== 'object' || node === null || Array.isArray(node)) return false;
		const n = node as Record<string, unknown>;
		if (typeof n.type !== 'string') return false;
		if (n.text !== undefined && typeof n.text !== 'string') return false;
		if (n.attrs !== undefined && (typeof n.attrs !== 'object' || n.attrs === null || Array.isArray(n.attrs))) return false;
		if (n.marks !== undefined) {
			if (!Array.isArray(n.marks)) return false;
			for (const m of n.marks) {
				if (++count > RICHTEXT_MAX_NODES) return false;
				if (typeof m !== 'object' || m === null || typeof (m as { type?: unknown }).type !== 'string') return false;
			}
		}
		if (n.content !== undefined) {
			if (!Array.isArray(n.content)) return false;
			for (const c of n.content) stack.push([c, depth + 1]);
		}
	}
	return true;
}
