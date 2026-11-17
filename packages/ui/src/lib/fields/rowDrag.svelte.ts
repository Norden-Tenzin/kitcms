// Native HTML5 drag-and-drop state for reordering rows (no library). Keyboard users use the
// move up/down buttons on each row.
export class RowDrag {
	from = $state<number | null>(null);
	over = $state<number | null>(null);
	moveRow: (from: number, to: number) => void;

	constructor(move: (from: number, to: number) => void) {
		this.moveRow = move;
	}

	start = (i: number, e: DragEvent, card?: Element | null) => {
		this.from = i;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', String(i));
			const el = card ?? (e.currentTarget as HTMLElement | null)?.closest('[data-row-id]');
			if (el) e.dataTransfer.setDragImage(el, 16, 16);
		}
	};

	end = () => {
		this.from = null;
		this.over = null;
	};

	dragover = (i: number, e: DragEvent) => {
		if (this.from === null) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		this.over = i;
	};

	drop = (i: number, e: DragEvent) => {
		if (this.from === null) return;
		e.preventDefault();
		const from = this.from;
		this.end();
		if (from !== i) this.moveRow(from, i);
	};
}
