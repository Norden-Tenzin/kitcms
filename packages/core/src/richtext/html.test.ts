import { describe, expect, it } from 'vitest';
import type { RichTextDoc, RichTextNode } from '../config/infer';
import { toHTML, toPlainText } from './html';

const doc = (...content: RichTextNode[]): RichTextDoc => ({ type: 'doc', content });
const t = (text: string, marks?: { type: string; attrs?: Record<string, unknown> }[]): RichTextNode =>
	({ type: 'text', text, ...(marks ? { marks } : {}) });
const p = (...content: RichTextNode[]): RichTextNode => ({ type: 'paragraph', content });
const link = (href: unknown, extra: Record<string, unknown> = {}) => [{ type: 'link', attrs: { href, ...extra } }];
const html = (n: RichTextNode, o = {}) => toHTML(doc(n), o);

describe('nodes', () => {
	it('renders blocks', () => {
		expect(html(p(t('hi')))).toBe('<p>hi</p>');
		expect(html({ type: 'heading', attrs: { level: 3 }, content: [t('H')] })).toBe('<h3>H</h3>');
		expect(html({ type: 'heading', attrs: { level: 9 }, content: [t('H')] })).toBe('<h6>H</h6>');
		expect(html({ type: 'heading', attrs: { level: 0 }, content: [t('H')] })).toBe('<h1>H</h1>');
		expect(html({ type: 'heading', content: [t('H')] })).toBe('<h2>H</h2>');
		expect(html({ type: 'heading', attrs: { level: '<script>' }, content: [t('H')] })).toBe('<h2>H</h2>');
		expect(html(p(t('a'), { type: 'hardBreak' }, t('b')))).toBe('<p>a<br>b</p>');
		expect(html({ type: 'horizontalRule' })).toBe('<hr>');
		expect(html({ type: 'blockquote', content: [p(t('q'))] })).toBe('<blockquote><p>q</p></blockquote>');
	});
	it('renders lists, nested', () => {
		const li = (...c: RichTextNode[]): RichTextNode => ({ type: 'listItem', content: c });
		expect(
			html({ type: 'bulletList', content: [li(p(t('a')), { type: 'orderedList', content: [li(p(t('b')))] })] }),
		).toBe('<ul><li><p>a</p><ol><li><p>b</p></li></ol></li></ul>');
		expect(html({ type: 'orderedList', attrs: { start: 3 }, content: [li(p(t('a')))] })).toBe(
			'<ol start="3"><li><p>a</p></li></ol>',
		);
		expect(html({ type: 'orderedList', attrs: { start: '"><x' }, content: [] })).toBe('<ol></ol>');
	});
	it('renders code blocks, language only when safe', () => {
		const cb = (language: unknown) =>
			html({ type: 'codeBlock', attrs: { language }, content: [t('a < b')] });
		expect(cb('ts')).toBe('<pre><code class="language-ts">a &lt; b</code></pre>');
		expect(cb('c++')).toContain('language-c++');
		expect(cb('x" onclick="y')).toBe('<pre><code>a &lt; b</code></pre>');
		expect(cb(null)).toBe('<pre><code>a &lt; b</code></pre>');
	});
	it('unknown nodes render only their children', () => {
		expect(html({ type: 'script', attrs: { x: 1 }, content: [t('a')] })).toBe('a');
		expect(html({ type: 'image', attrs: { src: 'x' } })).toBe('');
	});
	it('tolerates garbage', () => {
		expect(toHTML(doc(null as never, 5 as never, { type: 5 } as never))).toBe('');
	});
});

describe('marks', () => {
	it('renders each mark and nests them', () => {
		expect(html(p(t('x', [{ type: 'bold' }])))).toBe('<p><strong>x</strong></p>');
		expect(html(p(t('x', [{ type: 'italic' }])))).toBe('<p><em>x</em></p>');
		expect(html(p(t('x', [{ type: 'strike' }])))).toBe('<p><s>x</s></p>');
		expect(html(p(t('x', [{ type: 'code' }])))).toBe('<p><code>x</code></p>');
		expect(html(p(t('x', [{ type: 'underline' }])))).toBe('<p><u>x</u></p>');
		expect(html(p(t('x', [{ type: 'code' }, { type: 'bold' }, ...link('/a')])))).toBe(
			'<p><a href="/a"><strong><code>x</code></strong></a></p>',
		);
	});
	it('unknown marks render the inner text', () => {
		expect(html(p(t('x', [{ type: 'sparkle' }])))).toBe('<p>x</p>');
	});
});

describe('escaping', () => {
	it('escapes text', () => {
		expect(html(p(t(`<img src=x onerror="a('b')"> & </p>`)))).toBe(
			'<p>&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt; &amp; &lt;/p&gt;</p>',
		);
		expect(html(p(t('&#106;avascript:alert(1)')))).toBe('<p>&amp;#106;avascript:alert(1)</p>');
	});
	it('escapes attribute values', () => {
		expect(html(p(t('x', link('/a?b="c"&d=<e>'))))).toBe('<p><a href="/a?b=&quot;c&quot;&amp;d=&lt;e&gt;">x</a></p>');
	});
	it('never outputs raw attrs', () => {
		const out = html({ type: 'paragraph', attrs: { onclick: 'x', style: 'y' }, content: [t('a')] });
		expect(out).toBe('<p>a</p>');
	});
});

describe('links', () => {
	const a = (href: unknown) => html(p(t('x', link(href))));
	it('allows safe URLs', () => {
		for (const h of [
			'http://a.com', 'https://a.com/x?y=1#z', 'HTTPS://A.COM', 'mailto:a@b.c', 'tel:+123', '/path', '/', '#top',
			'relative/path', 'page.html?x=a:b', './x', '../x', '?q=1',
		]) {
			expect(a(h), h).toBe(`<p><a href="${h.replace(/&/g, '&amp;')}">x</a></p>`);
		}
	});
	it('drops dangerous URLs but keeps the text', () => {
		for (const h of [
			'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\tscript:alert(1)', 'java\nscript:alert(1)',
			' javascript:alert(1)', '\u0001javascript:alert(1)', '\u0000javascript:x', 'data:text/html,<script>1</script>',
			'DATA:text/html;base64,AAAA', 'vbscript:x', 'file:///etc/passwd', 'blob:http://a', 'ftp://a',
			'//evil.com', '///evil.com', '\\\\evil.com', '/\\evil.com', '', '   ',
			'java\u0000script:x', 'foo bar:baz', 123, null, undefined, { href: 'x' },
		]) {
			expect(a(h), String(JSON.stringify(h))).toBe('<p>x</p>');
		}
	});
	it('handles target and rel', () => {
		expect(html(p(t('x', link('/a', { target: '_blank' }))))).toBe(
			'<p><a href="/a" target="_blank" rel="noopener noreferrer">x</a></p>',
		);
		expect(html(p(t('x', link('/a', { target: '_blank' }))), { linkRel: 'nofollow ugc' })).toBe(
			'<p><a href="/a" target="_blank" rel="noopener noreferrer nofollow ugc">x</a></p>',
		);
		expect(html(p(t('x', link('/a', { target: '_self' }))))).toBe('<p><a href="/a">x</a></p>');
		expect(html(p(t('x', link('/a', { target: '_blank " onclick="x' }))))).toBe('<p><a href="/a">x</a></p>');
		expect(html(p(t('x', link('/a'))), { linkRel: 'nofollow' })).toBe('<p><a href="/a" rel="nofollow">x</a></p>');
		expect(html(p(t('x', link('/a'))), { linkRel: 'a" onclick="b' })).toBe('<p><a href="/a">x</a></p>');
	});
});

describe('custom renderers', () => {
	it('override built-ins and receive rendered children', () => {
		const out = toHTML(doc(p(t('x', [{ type: 'bold' }]))), {
			nodes: { paragraph: (_n, c) => `<div class="p">${c}</div>`, callout: (n, c) => `<aside>${c}${n.attrs?.tone}</aside>` },
			marks: { bold: (_m, inner) => `<b>${inner}</b>` },
		});
		expect(out).toBe('<div class="p"><b>x</b></div>');
		expect(toHTML(doc({ type: 'callout', attrs: { tone: 'info' }, content: [p(t('a'))] }), {
			nodes: { callout: (n, c) => `<aside>${c}${n.attrs?.tone}</aside>` },
		})).toBe('<aside><p>a</p>info</aside>');
	});
});

describe('empty input', () => {
	it('gives empty strings', () => {
		expect(toHTML(null)).toBe('');
		expect(toHTML(undefined)).toBe('');
		expect(toHTML({ type: 'doc' })).toBe('');
		expect(toHTML({ type: 'doc', content: [] })).toBe('');
		expect(toPlainText(null)).toBe('');
		expect(toPlainText({ type: 'doc' })).toBe('');
	});
});

describe('toPlainText', () => {
	it('separates blocks with blank lines and hardBreaks with newlines', () => {
		const d = doc(
			{ type: 'heading', attrs: { level: 2 }, content: [t('Title')] },
			p(t('a'), { type: 'hardBreak' }, t('b', [{ type: 'bold' }])),
			{ type: 'bulletList', content: [
				{ type: 'listItem', content: [p(t('one'))] },
				{ type: 'listItem', content: [p(t('two'))] },
			] },
			{ type: 'horizontalRule' },
			p(),
			p(t('end')),
		);
		expect(toPlainText(d)).toBe('Title\n\na\nb\n\none\n\ntwo\n\nend');
	});
});
