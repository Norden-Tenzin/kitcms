CREATE TABLE `albums` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`_order` text,
	`title` text,
	`slug` text,
	`description` text,
	`images` text
);
--> statement-breakpoint
CREATE INDEX `albums_createdAt_idx` ON `albums` (`createdAt`);--> statement-breakpoint
CREATE INDEX `albums__order_idx` ON `albums` (`_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `albums_slug_unique` ON `albums` (`slug`);--> statement-breakpoint
CREATE TABLE `dishes` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`_order` text,
	`name` text,
	`description` text,
	`course` text,
	`ladakhi` integer DEFAULT false NOT NULL,
	`vegetarian` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `dishes_createdAt_idx` ON `dishes` (`createdAt`);--> statement-breakpoint
CREATE INDEX `dishes__order_idx` ON `dishes` (`_order`);--> statement-breakpoint
CREATE TABLE `experiences` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`_order` text,
	`_status` text DEFAULT 'published' NOT NULL,
	`title` text,
	`slug` text,
	`pageDesign` text,
	`difficulty` text,
	`duration` text,
	`season` text,
	`priceNote` text,
	`summary` text,
	`body` text,
	`cover` text,
	`gallery` text,
	`meta` text,
	FOREIGN KEY (`cover`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `experiences_createdAt_idx` ON `experiences` (`createdAt`);--> statement-breakpoint
CREATE INDEX `experiences__order_idx` ON `experiences` (`_order`);--> statement-breakpoint
CREATE INDEX `experiences__status_idx` ON `experiences` (`_status`);--> statement-breakpoint
CREATE UNIQUE INDEX `experiences_slug_unique` ON `experiences` (`slug`);--> statement-breakpoint
CREATE INDEX `experiences_cover_idx` ON `experiences` (`cover`);--> statement-breakpoint
CREATE TABLE `experiences_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`parent` text NOT NULL,
	`version` text NOT NULL,
	`_status` text NOT NULL,
	`autosave` integer DEFAULT false NOT NULL,
	`latest` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`parent`) REFERENCES `experiences`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `experiences_versions_parent_idx` ON `experiences_versions` (`parent`,`createdAt`);--> statement-breakpoint
CREATE INDEX `experiences_versions_latest_idx` ON `experiences_versions` (`parent`,`latest`);--> statement-breakpoint
CREATE TABLE `faqs` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`_order` text,
	`question` text,
	`answer` text,
	`category` text
);
--> statement-breakpoint
CREATE INDEX `faqs_createdAt_idx` ON `faqs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `faqs__order_idx` ON `faqs` (`_order`);--> statement-breakpoint
CREATE TABLE `offers` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`title` text,
	`summary` text,
	`cover` text,
	`validFrom` integer,
	`validTo` integer,
	`ctaLabel` text,
	`ctaHref` text,
	`terms` text,
	FOREIGN KEY (`cover`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `offers_createdAt_idx` ON `offers` (`createdAt`);--> statement-breakpoint
CREATE INDEX `offers_cover_idx` ON `offers` (`cover`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`_status` text DEFAULT 'published' NOT NULL,
	`title` text,
	`slug` text,
	`pageDesign` text,
	`publishedAt` integer,
	`author` text,
	`tags` text,
	`excerpt` text,
	`cover` text,
	`body` text,
	`meta` text,
	FOREIGN KEY (`author`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`cover`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `posts_createdAt_idx` ON `posts` (`createdAt`);--> statement-breakpoint
CREATE INDEX `posts__status_idx` ON `posts` (`_status`);--> statement-breakpoint
CREATE UNIQUE INDEX `posts_slug_unique` ON `posts` (`slug`);--> statement-breakpoint
CREATE INDEX `posts_author_idx` ON `posts` (`author`);--> statement-breakpoint
CREATE INDEX `posts_cover_idx` ON `posts` (`cover`);--> statement-breakpoint
CREATE TABLE `posts_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`parent` text NOT NULL,
	`version` text NOT NULL,
	`_status` text NOT NULL,
	`autosave` integer DEFAULT false NOT NULL,
	`latest` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`parent`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `posts_versions_parent_idx` ON `posts_versions` (`parent`,`createdAt`);--> statement-breakpoint
CREATE INDEX `posts_versions_latest_idx` ON `posts_versions` (`parent`,`latest`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`_order` text,
	`_status` text DEFAULT 'published' NOT NULL,
	`name` text,
	`slug` text,
	`pageDesign` text,
	`view` text,
	`featured` integer DEFAULT false NOT NULL,
	`summary` text,
	`description` text,
	`cover` text,
	`gallery` text,
	`sizeSqm` real,
	`maxGuests` real,
	`beds` text,
	`count` real,
	`priceFrom` real,
	`amenities` text,
	`meta` text,
	FOREIGN KEY (`cover`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `rooms_createdAt_idx` ON `rooms` (`createdAt`);--> statement-breakpoint
CREATE INDEX `rooms__order_idx` ON `rooms` (`_order`);--> statement-breakpoint
CREATE INDEX `rooms__status_idx` ON `rooms` (`_status`);--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_slug_unique` ON `rooms` (`slug`);--> statement-breakpoint
CREATE INDEX `rooms_cover_idx` ON `rooms` (`cover`);--> statement-breakpoint
CREATE TABLE `rooms_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`parent` text NOT NULL,
	`version` text NOT NULL,
	`_status` text NOT NULL,
	`autosave` integer DEFAULT false NOT NULL,
	`latest` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`parent`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rooms_versions_parent_idx` ON `rooms_versions` (`parent`,`createdAt`);--> statement-breakpoint
CREATE INDEX `rooms_versions_latest_idx` ON `rooms_versions` (`parent`,`latest`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`name` text,
	`slug` text
);
--> statement-breakpoint
CREATE INDEX `tags_createdAt_idx` ON `tags` (`createdAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_slug_unique` ON `tags` (`slug`);--> statement-breakpoint
CREATE TABLE `testimonials` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`_order` text,
	`quote` text,
	`name` text,
	`from` text,
	`rating` real,
	`stayedIn` text
);
--> statement-breakpoint
CREATE INDEX `testimonials_createdAt_idx` ON `testimonials` (`createdAt`);--> statement-breakpoint
CREATE INDEX `testimonials__order_idx` ON `testimonials` (`_order`);--> statement-breakpoint
ALTER TABLE `_global_site` ADD `season` text;--> statement-breakpoint
ALTER TABLE `_global_site` ADD `checkIn` text;--> statement-breakpoint
ALTER TABLE `_global_site` ADD `checkOut` text;--> statement-breakpoint
ALTER TABLE `_global_site` ADD `footerText` text;--> statement-breakpoint
ALTER TABLE `_global_site` ADD `social` text;--> statement-breakpoint
ALTER TABLE `_global_site` ADD `contact` text;--> statement-breakpoint
ALTER TABLE `_global_site` ADD `announcement` text;--> statement-breakpoint
ALTER TABLE `_global_site` ADD `bookingCta` text;--> statement-breakpoint
ALTER TABLE `_global_site` ADD `design` text;--> statement-breakpoint
ALTER TABLE `_global_site` ADD `theme` text;--> statement-breakpoint
ALTER TABLE `media` ADD `caption` text;--> statement-breakpoint
ALTER TABLE `media` ADD `credit` text;--> statement-breakpoint
ALTER TABLE `pages` ADD `design` text;--> statement-breakpoint
ALTER TABLE `pages` ADD `meta` text;--> statement-breakpoint
ALTER TABLE `team` ADD `bio` text;