// Scroll entrance for `.reveal` elements: `<div class="reveal" use:reveal style:--i={1}>`.
// Content is visible without script (the CSS only hides under `.js`); reduced motion skips it.
import type { Action } from 'svelte/action';

export const reveal: Action<HTMLElement> = (node) => {
	if (typeof IntersectionObserver === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) {
		node.classList.add('in');
		return;
	}
	const io = new IntersectionObserver(
		(entries) => {
			for (const e of entries) {
				if (e.isIntersecting) {
					e.target.classList.add('in');
					io.unobserve(e.target);
				}
			}
		},
		{ rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
	);
	io.observe(node);
	return { destroy: () => io.disconnect() };
};
