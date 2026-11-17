CREATE TABLE `_global_site` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`siteName` text,
	`tagline` text,
	`logo` text,
	`nav` text,
	FOREIGN KEY (`logo`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `_global_site_createdAt_idx` ON `_global_site` (`createdAt`);--> statement-breakpoint
CREATE INDEX `_global_site_logo_idx` ON `_global_site` (`logo`);