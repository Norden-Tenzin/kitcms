import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default ts.config(
	{
		ignores: ['**/dist/**', '**/.svelte-kit/**', '**/.wrangler/**', '**/node_modules/**', '.claude/worktrees/**'],
	},
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.node, ...globals.browser },
		},
		rules: {
			// `declare global { namespace App { ... } }` is how SvelteKit types are augmented.
			'@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
		},
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: {
			parserOptions: { parser: ts.parser },
		},
	},
);
