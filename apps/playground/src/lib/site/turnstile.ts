// Cloudflare Turnstile for the enquiry forms. The site key below is Cloudflare's always-pass TEST key:
// replace it (and the `TURNSTILE_SECRET` Worker secret) in production.
//
// The plugin fails closed (no secret = submissions rejected) and the widget loads a script from
// challenges.cloudflare.com, so an offline or sandboxed run (the e2e suite) builds with
// `VITE_TURNSTILE=off`, which leaves Turnstile out entirely. Never set that for a real deployment.
// `import.meta.env` is replaced by Vite at build time and is undefined under the Node CLI.
const off = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_TURNSTILE === 'off';

export const TURNSTILE_SITE_KEY: string | undefined = off ? undefined : '1x00000000000000000000AA';
