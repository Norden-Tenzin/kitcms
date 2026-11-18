CREATE TABLE `redirects` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`from` text,
	`to` text,
	`type` text,
	`enabled` integer DEFAULT true NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE INDEX `redirects_createdAt_idx` ON `redirects` (`createdAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `redirects_from_unique` ON `redirects` (`from`);--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`form` text,
	`name` text,
	`email` text,
	`data` text,
	`page` text,
	`status` text,
	`notified` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `submissions_createdAt_idx` ON `submissions` (`createdAt`);