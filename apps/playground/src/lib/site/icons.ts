// Client-safe (no config import): the names for the config's `icon` selects, and the outline path for
// each (24x24 viewBox, stroke icons). `Icon.svelte` draws them. UI glyphs (menu, close, arrow) live here too.
export const ICONS = ['pen', 'layout', 'code', 'camera', 'compass', 'chat', 'clock', 'star'] as const;
export type IconName = (typeof ICONS)[number];
export type UiIconName = IconName | 'menu' | 'close' | 'arrow' | 'arrow-up-right' | 'plus' | 'minus';

export const ICON_PATHS: Record<UiIconName, string> = {
	pen: 'M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19l-4 1zM14 7l3 3',
	layout: 'M4 5h16v14H4zM4 10h16M10 10v9',
	code: 'M8 8l-5 4 5 4M16 8l5 4-5 4M14 5l-4 14',
	camera: 'M4 8h3l1.5-2h7L17 8h3v11H4zM12 17a3.5 3.5 0 100-7 3.5 3.5 0 000 7z',
	compass: 'M12 21a9 9 0 100-18 9 9 0 000 18zM15.5 8.5l-2 5-5 2 2-5z',
	chat: 'M4 5h16v11H9l-5 4z',
	clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
	star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
	menu: 'M4 7h16M4 12h16M4 17h16',
	close: 'M6 6l12 12M18 6L6 18',
	arrow: 'M4 12h15M13 6l6 6-6 6',
	'arrow-up-right': 'M7 17L17 7M8 7h9v9',
	plus: 'M12 5v14M5 12h14',
	minus: 'M5 12h14',
};
