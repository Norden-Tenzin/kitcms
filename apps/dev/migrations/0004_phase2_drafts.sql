CREATE TABLE `_global_site_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`parent` text NOT NULL,
	`version` text NOT NULL,
	`_status` text NOT NULL,
	`autosave` integer DEFAULT false NOT NULL,
	`latest` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`parent`) REFERENCES `_global_site`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `_global_site_versions_parent_idx` ON `_global_site_versions` (`parent`,`createdAt`);--> statement-breakpoint
CREATE INDEX `_global_site_versions_latest_idx` ON `_global_site_versions` (`parent`,`latest`);--> statement-breakpoint
CREATE TABLE `pages_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`parent` text NOT NULL,
	`version` text NOT NULL,
	`_status` text NOT NULL,
	`autosave` integer DEFAULT false NOT NULL,
	`latest` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`parent`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pages_versions_parent_idx` ON `pages_versions` (`parent`,`createdAt`);--> statement-breakpoint
CREATE INDEX `pages_versions_latest_idx` ON `pages_versions` (`parent`,`latest`);--> statement-breakpoint
ALTER TABLE `_global_site` ADD `_status` text DEFAULT 'published' NOT NULL;--> statement-breakpoint
CREATE INDEX `_global_site__status_idx` ON `_global_site` (`_status`);--> statement-breakpoint
ALTER TABLE `pages` ADD `_status` text DEFAULT 'published' NOT NULL;--> statement-breakpoint
CREATE INDEX `pages__status_idx` ON `pages` (`_status`);--> statement-breakpoint
ALTER TABLE `pages` DROP COLUMN `status`;