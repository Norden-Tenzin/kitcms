CREATE TABLE `bench` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`slug` text,
	`sections` text
);
--> statement-breakpoint
CREATE INDEX `bench_createdAt_idx` ON `bench` (`createdAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `bench_slug_unique` ON `bench` (`slug`);