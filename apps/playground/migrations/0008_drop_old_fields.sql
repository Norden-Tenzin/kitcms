PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`_status` text DEFAULT 'published' NOT NULL,
	`title` text,
	`slug` text,
	`publishedAt` integer,
	`featured` integer DEFAULT false NOT NULL,
	`cover` text,
	`sections` text,
	FOREIGN KEY (`cover`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_pages`("id", "createdAt", "updatedAt", "_status", "title", "slug", "publishedAt", "featured", "cover", "sections") SELECT "id", "createdAt", "updatedAt", "_status", "title", "slug", "publishedAt", "featured", "cover", "sections" FROM `pages`;--> statement-breakpoint
DROP TABLE `pages`;--> statement-breakpoint
ALTER TABLE `__new_pages` RENAME TO `pages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `pages_createdAt_idx` ON `pages` (`createdAt`);--> statement-breakpoint
CREATE INDEX `pages__status_idx` ON `pages` (`_status`);--> statement-breakpoint
CREATE UNIQUE INDEX `pages_slug_unique` ON `pages` (`slug`);--> statement-breakpoint
CREATE INDEX `pages_cover_idx` ON `pages` (`cover`);