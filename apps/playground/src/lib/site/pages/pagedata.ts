// Small helpers shared by the dining and contact designs (client-safe).
import type { BlockOf, Dish, PageBlock } from '../types';

/** The first block of this type on a page, if any. */
export function pick<S extends PageBlock['blockType']>(blocks: PageBlock[], type: S): BlockOf<S> | undefined {
	return blocks.find((b) => b.blockType === type) as BlockOf<S> | undefined;
}

export const COURSES = ['breakfast', 'lunch', 'dinner', 'drinks'] as const;
export type Course = (typeof COURSES)[number];

/** A line under each course heading: what the course means at the house. */
export const COURSE_NOTE: Record<Course, string> = {
	breakfast: 'Included in every stay, from seven.',
	lunch: 'Simple, from noon. A packed one on request.',
	dinner: 'On request. Tell us by noon.',
	drinks: 'All day, and the tea is refilled.',
};

/** Dishes grouped by course, empty courses dropped. */
export function byCourse(dishes: Dish[]): { course: Course; dishes: Dish[] }[] {
	return COURSES.map((course) => ({ course, dishes: dishes.filter((d) => d.course === course) })).filter((g) => g.dishes.length);
}
