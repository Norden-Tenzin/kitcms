CREATE TABLE `legal` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`title` text,
	`slug` text,
	`body` text
);
--> statement-breakpoint
CREATE INDEX `legal_createdAt_idx` ON `legal` (`createdAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `legal_slug_unique` ON `legal` (`slug`);--> statement-breakpoint
CREATE TABLE `team` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`_order` text,
	`name` text,
	`role` text,
	`photo` text,
	FOREIGN KEY (`photo`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `team_createdAt_idx` ON `team` (`createdAt`);--> statement-breakpoint
CREATE INDEX `team__order_idx` ON `team` (`_order`);--> statement-breakpoint
CREATE INDEX `team_photo_idx` ON `team` (`photo`);