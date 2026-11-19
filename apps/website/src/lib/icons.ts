// Client-safe (no config import): used by the config's `icon` select and the Features block.
export const ICONS = ['code', 'layers', 'shield', 'history', 'image', 'plug', 'bolt', 'lock'] as const;
export type IconName = (typeof ICONS)[number];

/** 24x24 stroke paths (outline icons). */
export const ICON_PATHS: Record<IconName, string> = {
	code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
	layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5',
	shield: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z',
	history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
	image: 'M4 5h16v14H4V5zM4 16l5-5 4 4 3-3 4 4M9 9.5a1 1 0 1 0 0-.01',
	plug: 'M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0V8zM12 17v4',
	bolt: 'M13 3L5 14h6l-1 7 8-11h-6l1-7z',
	lock: 'M6 11h12v9H6v-9zM8 11V8a4 4 0 0 1 8 0v3',
};
