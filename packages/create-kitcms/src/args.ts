export interface Args {
	dir?: string;
	template: string;
	createResources: boolean;
	yes: boolean;
	install: boolean;
	link?: string;
	help: boolean;
	/** Set when `--template` was passed explicitly. */
	templateGiven: boolean;
	unknown: string[];
}

export const TEMPLATES = ['blank'] as const;

export const USAGE = `create-kitcms: scaffold a kitcms app

Usage: pnpm create kitcms@latest [dir] [options]

Options:
  --template <name>     Template to use (blank). "website" is coming soon.
  --create-resources    Create the D1 database and R2 bucket with wrangler (needs "wrangler login")
  --yes, -y             Accept defaults, never prompt
  --no-install          Skip "pnpm install" and the local migration
  --link <repo>         Use link: dependencies on a local kitcms checkout (for testing)
  --help, -h            Show this help
`;

export function parseArgs(argv: string[]): Args {
	const args: Args = {
		template: 'blank',
		templateGiven: false,
		createResources: false,
		yes: false,
		install: true,
		help: false,
		unknown: [],
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i]!;
		const eq = a.indexOf('=');
		const [flag, inline] = a.startsWith('--') && eq > 0 ? [a.slice(0, eq), a.slice(eq + 1)] : [a, undefined];
		const value = (): string | undefined => inline ?? argv[++i];
		switch (flag) {
			case '--template': {
				const v = value();
				if (v === undefined) args.unknown.push('--template (missing value)');
				else {
					args.template = v;
					args.templateGiven = true;
				}
				break;
			}
			case '--link': {
				const v = value();
				if (v === undefined) args.unknown.push('--link (missing value)');
				else args.link = v;
				break;
			}
			case '--create-resources':
				args.createResources = true;
				break;
			case '--yes':
			case '-y':
				args.yes = true;
				break;
			case '--no-install':
				args.install = false;
				break;
			case '--help':
			case '-h':
				args.help = true;
				break;
			default:
				if (a.startsWith('-')) args.unknown.push(a);
				else if (args.dir === undefined) args.dir = a;
				else args.unknown.push(a);
		}
	}
	return args;
}
