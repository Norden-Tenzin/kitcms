CREATE TABLE `_refs` (
	`fromCollection` text NOT NULL,
	`fromId` text NOT NULL,
	`path` text NOT NULL,
	`toCollection` text NOT NULL,
	`toId` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `_refs_from_idx` ON `_refs` (`fromCollection`,`fromId`);--> statement-breakpoint
CREATE INDEX `_refs_to_idx` ON `_refs` (`toCollection`,`toId`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`filename` text NOT NULL,
	`mimeType` text,
	`filesize` integer,
	`width` integer,
	`height` integer,
	`key` text NOT NULL,
	`alt` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_key_unique` ON `media` (`key`);--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`_status` text DEFAULT 'draft' NOT NULL,
	`_order` text,
	`title` text NOT NULL,
	`slug` text,
	`views` real,
	`featured` integer DEFAULT false NOT NULL,
	`template` text,
	`publishedAt` integer,
	`cover` text,
	`parent` text,
	`seo` text,
	`sections` text,
	FOREIGN KEY (`cover`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`parent`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `pages__status_idx` ON `pages` (`_status`);--> statement-breakpoint
CREATE INDEX `pages__order_idx` ON `pages` (`_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `pages_slug_unique` ON `pages` (`slug`);--> statement-breakpoint
CREATE INDEX `pages_views_idx` ON `pages` (`views`);--> statement-breakpoint
CREATE INDEX `pages_cover_idx` ON `pages` (`cover`);--> statement-breakpoint
CREATE INDEX `pages_parent_idx` ON `pages` (`parent`);--> statement-breakpoint
CREATE TABLE `pages_rels` (
	`id` text PRIMARY KEY NOT NULL,
	`parentId` text NOT NULL,
	`path` text NOT NULL,
	`position` integer NOT NULL,
	`toCollection` text NOT NULL,
	`toId` text NOT NULL,
	FOREIGN KEY (`parentId`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pages_rels_parent_idx` ON `pages_rels` (`parentId`,`path`);--> statement-breakpoint
CREATE INDEX `pages_rels_to_idx` ON `pages_rels` (`toCollection`,`toId`);--> statement-breakpoint
CREATE TABLE `pages_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`parentId` text NOT NULL,
	`snapshot` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`parentId`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pages_versions_parent_idx` ON `pages_versions` (`parentId`,`createdAt`);