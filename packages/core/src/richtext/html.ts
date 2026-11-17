// Rich text (Tiptap/ProseMirror JSON) -> HTML and plain text. Pure TypeScript, no dependencies,
// Workers-safe. This runs on public pages, so it must stay tiny and must never emit unescaped
// content: every text and attribute value is escaped, and link URLs are checked against an
// allow-list of schemes.
import type { RichTextDoc, RichTextNode } from '../config/infer';

type Mark = NonNullable<RichTextNode['marks']>[number];

export interface ToHTMLOptions {
	/**
	 * Custom node renderers, keyed by node type. They override the built-ins and receive the
	 * node and its already-rendered children. Their output is TRUSTED and inserted as-is: escape
	 * anything you take from `node.attrs` yourself.
	 */
	nodes?: Record<string, (node: RichTextNode, children: string) => string>;
	/**
	 * Custom mark renderers, keyed by mark type, overriding the built-ins. They receive the mark
	 * and the already-rendered inner HTML. Output is TRUSTED, as for `nodes`.
	 */
	marks?: Record<string, (mark: Mark, inner: string) => string>;
	/** Extra `rel` tokens for every link (merged with `noopener noreferrer` for `_blank`). */
	linkRel?: string;
}

const ESC: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;',
};
export function escapeHTML(s: string): string {
	return s.replace(/[&<>"']/g, (c) => ESC[c]!);
}

/**
 * Returns the URL if it is safe to put in an `href`, otherwise null. Allowed: http(s), mailto,
 * tel, `/`-relative (not protocol-relative `//`), `#fragment`, and scheme-less relative paths.
 */
export function safeHref(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	// Browsers strip tabs/newlines inside URLs and ignore leading C0 controls/space, so
	// `java\tscript:` is `javascript:`. Judge the URL the way a browser would see it.
	// eslint-disable-next-line no-control-regex
	const url = raw.replace(/^[\u0000- ]+|[\u0000- ]+$/g, '').replace(/[\t\n\r]/g, '');
	if (url === '') return null;
	// eslint-disable-next-line no-control-regex
	if (/[\u0000-\u001f\u007f]/.test(url)) return null;
	if (url.startsWith('//') || url.startsWith('\\\\') || url.startsWith('/\\')) return null;
	if (url.startsWith('/') || url.startsWith('#')) return url;
	const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(url);
	if (scheme) {
		return ['http', 'https', 'mailto', 'tel'].includes(scheme[1]!.toLowerCase()) ? url : null;
	}
	// No scheme: a relative path. A colon before any `/ ? #` would still be a scheme-like thing
	// (e.g. `foo bar:baz`), so refuse it.
	const head = url.split(/[/?#]/, 1)[0]!;
	return head.includes(':') ? null : url;
}

const TAGS: Record<string, string> = { bold: 'strong', italic: 'em', strike: 's', code: 'code', underline: 'u' };
const MARK_ORDER = ['link', 'bold', 'italic', 'strike', 'underline', 'code'];

function renderMark(mark: Mark, inner: string, options: ToHTMLOptions): string {
	const custom = options.marks?.[mark.type];
	if (custom) return custom(mark, inner);
	if (mark.type === 'link') {
		const href = safeHref(mark.attrs?.href);
		if (href === null) return inner;
		let out = ` href="${escapeHTML(href)}"`;
		const blank = mark.attrs?.target === '_blank';
		const rel = [...(blank ? ['noopener', 'noreferrer'] : []), ...(options.linkRel ?? '').split(/\s+/)]
			.filter((t, i, a) => /^[a-zA-Z0-9_-]+$/.test(t) && a.indexOf(t) === i)
			.join(' ');
		if (blank) out += ' target="_blank"';
		if (rel) out += ` rel="${escapeHTML(rel)}"`;
		return `<a${out}>${inner}</a>`;
	}
	const tag = TAGS[mark.type];
	return tag ? `<${tag}>${inner}</${tag}>` : inner;
}

function renderText(node: RichTextNode, options: ToHTMLOptions): string {
	let out = escapeHTML(node.text ?? '');
	const marks = [...(node.marks ?? [])].filter((m) => m && typeof m.type === 'string');
	// Stable nesting: link outermost, then bold/italic/..., code innermost.
	const rank = (m: Mark) => {
		const i = MARK_ORDER.indexOf(m.type);
		return i === -1 ? MARK_ORDER.length : i;
	};
	marks.sort((a, b) => rank(b) - rank(a));
	for (const m of marks) out = renderMark(m, out, options);
	return out;
}

function intAttr(v: unknown, min: number, max: number, fallback: number): number {
	const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
	return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function renderNode(node: RichTextNode, options: ToHTMLOptions): string {
	if (node === null || typeof node !== 'object' || typeof node.type !== 'string') return '';
	if (node.type === 'text') return renderText(node, options);
	const children = Array.isArray(node.content)
		? node.content.map((c) => renderNode(c, options)).join('')
		: '';
	const custom = options.nodes?.[node.type];
	if (custom) return custom(node, children);
	switch (node.type) {
		case 'doc':
			return children;
		case 'paragraph':
			return `<p>${children}</p>`;
		case 'heading': {
			const level = intAttr(node.attrs?.level, 1, 6, 2);
			return `<h${level}>${children}</h${level}>`;
		}
		case 'hardBreak':
			return '<br>';
		case 'horizontalRule':
			return '<hr>';
		case 'bulletList':
			return `<ul>${children}</ul>`;
		case 'orderedList': {
			const start = intAttr(node.attrs?.start, -1_000_000, 1_000_000, 1);
			return start === 1 ? `<ol>${children}</ol>` : `<ol start="${start}">${children}</ol>`;
		}
		case 'listItem':
			return `<li>${children}</li>`;
		case 'blockquote':
			return `<blockquote>${children}</blockquote>`;
		case 'codeBlock': {
			const lang = node.attrs?.language;
			const cls =
				typeof lang === 'string' && /^[a-zA-Z0-9_+-]+$/.test(lang)
					? ` class="language-${lang}"`
					: '';
			return `<pre><code${cls}>${children}</code></pre>`;
		}
		default:
			// Unknown node: render only its children.
			return children;
	}
}

/** Renders a rich text document to HTML. `null`/`undefined`/empty documents give `''`. */
export function toHTML(doc: RichTextDoc | null | undefined, options: ToHTMLOptions = {}): string {
	if (!doc || typeof doc !== 'object' || !Array.isArray(doc.content)) return '';
	return doc.content.map((n) => renderNode(n, options)).join('');
}

const BLOCKS = new Set([
	'paragraph', 'heading', 'blockquote', 'codeBlock', 'bulletList', 'orderedList', 'listItem', 'horizontalRule',
]);

function plain(node: RichTextNode): string {
	if (node === null || typeof node !== 'object') return '';
	if (node.type === 'text') return node.text ?? '';
	if (node.type === 'hardBreak') return '\n';
	const kids = Array.isArray(node.content) ? node.content : [];
	if (kids.some((k) => k && BLOCKS.has(k.type))) {
		return kids.map(plain).filter((s) => s !== '').join('\n\n');
	}
	return kids.map(plain).join('');
}

/** Plain text of a document: blocks separated by a blank line, `hardBreak` as `\n`. */
export function toPlainText(doc: RichTextDoc | null | undefined): string {
	if (!doc || typeof doc !== 'object' || !Array.isArray(doc.content)) return '';
	return doc.content.map(plain).filter((s) => s !== '').join('\n\n');
}
