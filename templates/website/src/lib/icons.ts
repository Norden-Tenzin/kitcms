// Client-safe (no config import): used by the config's `icon` select and the Features block.
export const ICONS = ['star', 'heart', 'shield', 'clock', 'pin', 'chat'] as const;
export type IconName = (typeof ICONS)[number];

/** 24x24 stroke paths (outline icons). */
export const ICON_PATHS: Record<IconName, string> = {
	star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z',
	heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
	shield: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z',
	clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
	pin: 'M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
	chat: 'M4 5h16v11H9l-5 4V5z',
};
