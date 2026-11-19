// A small, server-safe syntax tokenizer for the landing page's code samples (ts, js, svelte, sh,
// jsonc). The samples come from the CMS at request time, so Shiki (Node/WASM, heavy) must not run
// in the Worker. This is deliberately simple: it colours comments, strings, keywords, numbers,
// function names, property keys, types, tags and punctuation.
//
// Safety: every character of the input reaches the output only through `esc`, and the only markup
// emitted is `<span class="tok-...">` with a fixed class name. The result is safe for `{@html}`.

type Kind = 'comment' | 'string' | 'keyword' | 'number' | 'fn' | 'key' | 'type' | 'tag' | 'punct';

const esc = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const JS_KEYWORDS = new Set(
	(
		'import export from as default const let var function return if else for while do switch case break continue ' +
		'new class extends implements interface type enum async await try catch finally throw typeof instanceof in of ' +
		'void delete yield static public private protected readonly satisfies declare namespace keyof infer is'
	).split(' '),
);
const JS_LITERALS = new Set('true false null undefined this super NaN Infinity'.split(' '));
const SH_KEYWORDS = new Set('if then else elif fi for while do done case esac in function export cd'.split(' '));

type Lang = 'js' | 'sh' | 'svelte';

function langOf(lang: string | null | undefined): Lang {
	const l = (lang ?? '').toLowerCase();
	if (['sh', 'bash', 'shell', 'zsh', 'console'].includes(l)) return 'sh';
	if (['svelte', 'html', 'vue'].includes(l)) return 'svelte';
	return 'js';
}

const RE = {
	space: /\s+/y,
	lineComment: /\/\/[^\n]*/y,
	hashComment: /#[^\n]*/y,
	blockComment: /\/\*[\s\S]*?(?:\*\/|$)/y,
	htmlComment: /<!--[\s\S]*?(?:-->|$)/y,
	single: /'(?:\\.|[^'\\\n])*'?/y,
	double: /"(?:\\.|[^"\\\n])*"?/y,
	template: /`(?:\\[\s\S]|[^`\\])*`?/y,
	number: /(?:0[xX][\da-fA-F_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)n?/y,
	ident: /[A-Za-z_$][\w$]*/y,
	tag: /<\/?[A-Za-z][\w:.-]*/y,
	shVar: /\$(?:\{[^}\n]*\}|[A-Za-z_]\w*|\d)/y,
	shFlag: /--?[A-Za-z][\w-]*/y,
	punct: /[{}()[\];:,.<>=+\-*/%!&|?^~@]+/y,
};

function match(re: RegExp, src: string, i: number): string | null {
	re.lastIndex = i;
	const m = re.exec(src);
	return m ? m[0] : null;
}

function wrap(kind: Kind | null, text: string): string {
	return kind ? `<span class="tok-${kind}">${esc(text)}</span>` : esc(text);
}

/** Returns HTML (all text escaped) for `code`. Unknown languages are treated as ts. */
export function highlight(code: string | null | undefined, lang?: string | null): string {
	const src = code ?? '';
	const mode = langOf(lang);
	const out: string[] = [];
	let i = 0;
	// The last significant (non-space) text, to tell `a ? b : c` from `key: value`, and `.prop`.
	let prev = '';
	// Inside a `<tag ...>` of a svelte/html sample: bare words are attributes.
	let inTag = false;
	// At the start of a line (nothing but whitespace before): a shell command word starts here.
	let bol = true;

	const push = (kind: Kind | null, text: string, significant = true) => {
		out.push(wrap(kind, text));
		if (significant) {
			prev = text;
			bol = false;
		}
	};

	while (i < src.length) {
		let t: string | null;

		if ((t = match(RE.space, src, i))) {
			push(null, t, false);
			if (t.includes('\n')) bol = true;
			i += t.length;
			continue;
		}
		if (mode === 'svelte' && (t = match(RE.htmlComment, src, i))) {
			push('comment', t);
			i += t.length;
			continue;
		}
		if ((t = match(mode === 'sh' ? RE.hashComment : RE.lineComment, src, i))) {
			push('comment', t);
			i += t.length;
			continue;
		}
		if (mode !== 'sh' && (t = match(RE.blockComment, src, i))) {
			push('comment', t);
			i += t.length;
			continue;
		}
		if ((t = match(RE.double, src, i) ?? match(RE.single, src, i))) {
			// In JSON-like code a string followed by `:` is a key.
			let j = i + t.length;
			while (j < src.length && (src[j] === ' ' || src[j] === '\t')) j++;
			push(src[j] === ':' && mode === 'js' ? 'key' : 'string', t);
			i += t.length;
			continue;
		}
		if (mode !== 'sh' && (t = match(RE.template, src, i))) {
			push('string', t);
			i += t.length;
			continue;
		}
		if (mode === 'sh') {
			if ((t = match(RE.shVar, src, i))) {
				push('type', t);
				i += t.length;
				continue;
			}
			if (!bol && /\s/.test(src[i - 1] ?? '') && (t = match(RE.shFlag, src, i))) {
				push('number', t);
				i += t.length;
				continue;
			}
		}
		if (mode === 'svelte' && (t = match(RE.tag, src, i))) {
			inTag = true;
			push('punct', t.startsWith('</') ? '</' : '<', true);
			push('tag', t.slice(t.startsWith('</') ? 2 : 1));
			i += t.length;
			continue;
		}
		if ((t = match(RE.number, src, i)) && !/[\w$]/.test(src[i - 1] ?? '')) {
			push('number', t);
			i += t.length;
			continue;
		}
		if ((t = match(RE.ident, src, i))) {
			let j = i + t.length;
			while (j < src.length && (src[j] === ' ' || src[j] === '\t')) j++;
			const next = src[j];
			const afterDot = prev === '.' || prev === '?.';
			let kind: Kind | null = null;
			if (mode === 'sh') {
				if (SH_KEYWORDS.has(t)) kind = 'keyword';
				else if (bol || prev === '|' || prev === '&' || prev === ';') kind = 'fn';
			} else if (inTag && next === '=') {
				kind = 'key';
			} else if (inTag) {
				kind = 'key';
			} else if (!afterDot && JS_KEYWORDS.has(t)) {
				kind = 'keyword';
			} else if (!afterDot && JS_LITERALS.has(t)) {
				kind = 'number';
			} else if (next === '(' || (next === '<' && /^[a-z]/.test(t) && afterDot)) {
				kind = 'fn';
			} else if (next === ':' && src[j + 1] !== ':' && prev !== '?' && (prev === '{' || prev === ',' || prev === '(' || prev === '')) {
				kind = 'key';
			} else if (afterDot) {
				kind = 'key';
			} else if (/^[A-Z]/.test(t)) {
				kind = 'type';
			}
			push(kind, t);
			i += t.length;
			continue;
		}
		if ((t = match(RE.punct, src, i))) {
			if (inTag && t.includes('>')) inTag = false;
			// Keep `=>` and friends in one run; `prev` only needs the last char for the checks above.
			push('punct', t, false);
			bol = false;
			prev = t.endsWith('?.') ? '?.' : t.slice(-1);
			i += t.length;
			continue;
		}
		// Anything else (other symbols): one escaped character.
		const ch = src[i] ?? '';
		const cp = ch.codePointAt(0) ?? 0;
		const len = cp > 0xffff ? 2 : 1;
		push(null, src.slice(i, i + len));
		i += len;
	}
	return out.join('');
}
