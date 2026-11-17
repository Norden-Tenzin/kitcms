CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`name` text,
	`slug` text,
	`photo` text,
	`price` real,
	`tenant` text,
	FOREIGN KEY (`photo`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`tenant`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `rooms_createdAt_idx` ON `rooms` (`createdAt`);--> statement-breakpoint
CREATE INDEX `rooms_photo_idx` ON `rooms` (`photo`);--> statement-breakpoint
CREATE INDEX `rooms_tenant_idx` ON `rooms` (`tenant`);--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_by_tenant_slug_unique` ON `rooms` (`tenant`,`slug`);--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`name` text,
	`slug` text,
	`domain` text
);
--> statement-breakpoint
CREATE INDEX `vendors_createdAt_idx` ON `vendors` (`createdAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `vendors_slug_unique` ON `vendors` (`slug`);--> statement-breakpoint
ALTER TABLE `pages` ADD `meta` text;--> statement-breakpoint
ALTER TABLE `users` ADD `tenants` text;