// Docs sections, in sidebar order. A section appears in the nav only when it has pages.
// Read by the build-time docs plugin (`build/docs.ts`); keep it free of imports.
export const sections = [
	{ slug: 'getting-started', title: 'Getting started' },
	{ slug: 'configuration', title: 'Configuration' },
	{ slug: 'access', title: 'Access control & hooks' },
	{ slug: 'auth', title: 'Auth & users' },
	{ slug: 'media', title: 'Media' },
	{ slug: 'content', title: 'Using content' },
	{ slug: 'plugins', title: 'Plugins' },
	{ slug: 'deploy', title: 'Deploy & operate' },
	{ slug: 'reference', title: 'Reference' },
] as const;
