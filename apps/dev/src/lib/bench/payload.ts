// Benchmarks: deterministic, realistic `sections` (blocks) payloads.
// Pure and runtime-agnostic: imported by the Worker bench route AND the Node parse script.

const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Deterministic 26-char ULID-shaped id (so seeding is idempotent). */
export function benchId(prefix: string, i: number): string {
	const s = `${prefix}${i.toString(32)}`.toUpperCase();
	const clean = [...s].map((c) => (B32.includes(c) ? c : '0')).join('');
	return clean.padStart(26, '0').slice(-26);
}

/** Number of distinct media rows a payload with `blocks` blocks references. */
export function mediaCount(blocks: number): number {
	return Math.min(blocks, 12);
}

export function benchMediaIds(blocks: number): string[] {
	return Array.from({ length: mediaCount(blocks) }, (_, i) => benchId('M', blocks * 100 + i));
}

const LOREM =
	'Perched above the valley, the lodge pairs hand-built timber interiors with long views of the snow line. ' +
	'Mornings begin with a slow breakfast of local honey, barley bread and butter tea, while afternoons are ' +
	'kept open for walking, reading or simply watching the weather move across the ridge. ';

const AMENITIES = [
	'Heated floors',
	'Private balcony',
	'Mountain-view bath',
	'Wood-fired sauna',
	'Guided sunrise hikes',
	'Farm-to-table dining',
];

function para(i: number, len: number): string {
	return (LOREM.repeat(3).slice(i % 40) + LOREM).slice(0, len).trim();
}

export type BenchBlock = { id: string; blockType: string } & Record<string, unknown>;

/** `blocks` blocks cycling through 5 block types, ~0.5-1 KB each. */
export function makeSections(blocks: number, mediaIds: string[]): BenchBlock[] {
	const img = (i: number) => mediaIds[i % mediaIds.length]!;
	return Array.from({ length: blocks }, (_, i): BenchBlock => {
		const id = benchId('B', blocks * 1000 + i);
		switch (i % 5) {
			case 0:
				return {
					id,
					blockType: 'hero',
					heading: `Welcome to the highlands, section ${i}`,
					subheading: para(i, 120),
					image: img(i),
					cta: { label: 'Book your stay', href: '/stay', variant: 'primary' },
				};
			case 1:
				return {
					id,
					blockType: 'richText',
					heading: `Our story ${i}`,
					body: [
						{ type: 'paragraph', children: [{ text: para(i, 320) }] },
						{ type: 'paragraph', children: [{ text: para(i + 7, 280), bold: true }] },
					],
				};
			case 2:
				return {
					id,
					blockType: 'amenities',
					heading: 'Everything you need',
					items: AMENITIES.map((label, k) => ({
						id: benchId('A', i * 10 + k),
						label,
						icon: `i-${k}`,
					})),
				};
			case 3:
				return {
					id,
					blockType: 'gallery',
					heading: 'Gallery',
					images: [0, 1, 2, 3].map((k) => ({ image: img(i + k), caption: para(i + k, 60) })),
				};
			default:
				return {
					id,
					blockType: 'split',
					heading: `Rooms and suites ${i}`,
					text: para(i, 400),
					image: img(i),
					reverse: i % 2 === 0,
					links: [
						{ label: 'View rooms', href: '/rooms' },
						{ label: 'Rates', href: '/rates' },
					],
				};
		}
	});
}
