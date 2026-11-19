// The `site` global's accent overrides, as inline CSS custom properties for `.site`.
// Validated again here (hex only), so a bad value can never inject CSS.
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function themeStyle(
	theme?: { accentLight?: string | null; accentDark?: string | null } | null,
): string {
	const parts: string[] = [];
	if (theme?.accentLight && HEX.test(theme.accentLight))
		parts.push(`--accent-light-o: ${theme.accentLight}`);
	if (theme?.accentDark && HEX.test(theme.accentDark))
		parts.push(`--accent-dark-o: ${theme.accentDark}`);
	return parts.join('; ');
}
