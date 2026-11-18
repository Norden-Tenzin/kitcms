// Outgoing email (Decision 35, plan §17.3). Like `DbAdapter`/`StorageAdapter`: an internal adapter
// interface with one implementation, the Workers `send_email` binding (Cloudflare Email Service).
// Runtime-agnostic: no Node APIs.
import type { EmailMessageInput, EmailSender } from '../config/plugin';
import type { SanitizedConfig } from '../config/sanitized';
import { KitcmsError, ValidationError } from '../errors';

/** @internal The adapter behind `EmailSender`. */
export interface EmailAdapter {
	send(message: OutgoingEmail): Promise<{ messageId: string | null }>;
}

/** A validated message, with the sender filled in from the config. */
export interface OutgoingEmail {
	from: { address: string; name?: string };
	to: string[];
	subject: string;
	text: string;
	html?: string;
	replyTo?: string;
}

/** Thrown by `send()` when `config.email` or the `send_email` binding is missing. */
export class EmailNotConfiguredError extends KitcmsError {
	constructor(reason: string) {
		super('CONFIG', 500, `Email is not configured: ${reason}`);
		this.name = 'EmailNotConfiguredError';
	}
}

const ADDRESS = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;
export const MAX_RECIPIENTS = 50;
const MAX_SUBJECT = 998;
const MAX_BODY = 1024 * 1024;

const isAddress = (v: unknown): v is string =>
	typeof v === 'string' && v.length <= 254 && ADDRESS.test(v);

/** Validates a message (no header injection: no CR/LF in addresses or subject). Throws `ValidationError`. */
export function toOutgoing(
	config: NonNullable<SanitizedConfig['email']>,
	message: EmailMessageInput,
): OutgoingEmail {
	const errors: { path: string; message: string }[] = [];
	const to = Array.isArray(message.to) ? message.to : [message.to];
	if (to.length === 0 || to.length > MAX_RECIPIENTS)
		errors.push({ path: 'to', message: `1 to ${MAX_RECIPIENTS} recipients.` });
	else if (!to.every(isAddress))
		errors.push({ path: 'to', message: 'Every recipient must be an email address.' });
	if (
		typeof message.subject !== 'string' ||
		!message.subject.trim() ||
		message.subject.length > MAX_SUBJECT ||
		/[\r\n]/.test(message.subject)
	) {
		errors.push({ path: 'subject', message: 'A one-line subject is required.' });
	}
	if (typeof message.text !== 'string' || message.text.length > MAX_BODY)
		errors.push({ path: 'text', message: 'A text body is required.' });
	if (
		message.html !== undefined &&
		(typeof message.html !== 'string' || message.html.length > MAX_BODY)
	) {
		errors.push({ path: 'html', message: 'Must be a string.' });
	}
	const replyTo = message.replyTo ?? config.replyTo;
	if (replyTo !== undefined && !isAddress(replyTo))
		errors.push({ path: 'replyTo', message: 'Must be an email address.' });
	if (errors.length) throw new ValidationError(errors);
	const out: OutgoingEmail = {
		from: config.from,
		to: [...to],
		subject: message.subject.trim(),
		text: message.text,
	};
	if (message.html !== undefined) out.html = message.html;
	if (replyTo !== undefined) out.replyTo = replyTo;
	return out;
}

/** The `send_email` binding's builder form. */
interface SendEmailBinding {
	send(message: {
		from: string | { email: string; name: string };
		to: string | string[];
		subject: string;
		text?: string;
		html?: string;
		replyTo?: string;
	}): Promise<{ messageId?: string } | undefined>;
}

export function createCloudflareEmail(binding: SendEmailBinding): EmailAdapter {
	return {
		async send(m) {
			const result = await binding.send({
				from: m.from.name ? { email: m.from.address, name: m.from.name } : m.from.address,
				to: m.to.length === 1 ? m.to[0]! : m.to,
				subject: m.subject,
				text: m.text,
				...(m.html !== undefined ? { html: m.html } : {}),
				...(m.replyTo !== undefined ? { replyTo: m.replyTo } : {}),
			});
			return { messageId: typeof result?.messageId === 'string' ? result.messageId : null };
		},
	};
}

/** Dev: logs the message instead of sending it. */
export function createConsoleEmail(log: (...args: unknown[]) => void = console.info): EmailAdapter {
	return {
		async send(m) {
			log(
				`[kitcms email] (dev, not sent)\nFrom: ${m.from.name ? `${m.from.name} <${m.from.address}>` : m.from.address}\nTo: ${m.to.join(', ')}` +
					`${m.replyTo ? `\nReply-To: ${m.replyTo}` : ''}\nSubject: ${m.subject}\n\n${m.text}`,
			);
			return { messageId: null };
		},
	};
}

/**
 * The `EmailSender` for a request. Dev → console. No `config.email` or no binding → disabled
 * (`send` throws `EmailNotConfiguredError`).
 */
export function emailFor(
	config: SanitizedConfig,
	env: Record<string, unknown>,
	dev: boolean,
): EmailSender {
	const settings = config.email;
	const binding = env[config.bindings.email] as SendEmailBinding | undefined;
	let adapter: EmailAdapter | null = null;
	let reason = '';
	if (!settings) reason = 'set `email: { from }` in the kitcms config.';
	else if (dev) adapter = createConsoleEmail();
	else if (!binding || typeof binding.send !== 'function') {
		reason = `the "${config.bindings.email}" send_email binding is missing in wrangler.jsonc.`;
	} else adapter = createCloudflareEmail(binding);
	return {
		enabled: adapter !== null,
		async send(message) {
			if (!adapter || !settings) throw new EmailNotConfiguredError(reason);
			return adapter.send(toOutgoing(settings, message));
		},
	};
}
