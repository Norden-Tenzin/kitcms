// Types for the virtual modules served by `build/docs.ts` (Node, build time only).
declare module 'virtual:kitcms-docs' {
	export interface DocsNavPage {
		slug: string;
		path: string;
		title: string;
		description: string;
	}
	export interface DocsNavSection {
		slug: string;
		title: string;
		pages: DocsNavPage[];
	}
	export interface DocsTocItem {
		depth: 2 | 3;
		id: string;
		text: string;
	}
	export interface DocsLink {
		path: string;
		title: string;
	}
	export interface DocsPage {
		title: string;
		description: string;
		/** Rendered at build time. Trusted: it comes from files in this repository. */
		html: string;
		toc: DocsTocItem[];
		/** Repo-relative path, for "Edit this page on GitHub". */
		file: string;
		prev?: DocsLink;
		next?: DocsLink;
	}
	export const nav: DocsNavSection[];
	export const pages: Record<string, DocsPage>;
}
declare module 'virtual:kitcms-docs-paths' {
	const paths: string[];
	export default paths;
}
