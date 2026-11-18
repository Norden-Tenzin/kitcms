CREATE TABLE `kitchen-sink` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`_status` text DEFAULT 'published' NOT NULL,
	`title` text,
	`slug` text,
	`status` text,
	`featured` integer DEFAULT false NOT NULL,
	`due` integer,
	`summary` text,
	`email` text,
	`count` real,
	`ratio` real,
	`website` text,
	`doneNote` text,
	`internalNote` text,
	`body` text,
	`settings` text,
	`address` text,
	`links` text,
	`notes` text,
	`score` real,
	`sections` text,
	`image` text,
	`images` text,
	`post` text,
	`tags` text,
	FOREIGN KEY (`image`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`post`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `kitchen-sink_createdAt_idx` ON `kitchen-sink` (`createdAt`);--> statement-breakpoint
CREATE INDEX `kitchen-sink__status_idx` ON `kitchen-sink` (`_status`);--> statement-breakpoint
CREATE UNIQUE INDEX `kitchen-sink_slug_unique` ON `kitchen-sink` (`slug`);--> statement-breakpoint
CREATE INDEX `kitchen-sink_image_idx` ON `kitchen-sink` (`image`);--> statement-breakpoint
CREATE INDEX `kitchen-sink_post_idx` ON `kitchen-sink` (`post`);--> statement-breakpoint
CREATE TABLE `kitchen-sink_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`parent` text NOT NULL,
	`version` text NOT NULL,
	`_status` text NOT NULL,
	`autosave` integer DEFAULT false NOT NULL,
	`latest` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`parent`) REFERENCES `kitchen-sink`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `kitchen-sink_versions_parent_idx` ON `kitchen-sink_versions` (`parent`,`createdAt`);--> statement-breakpoint
CREATE INDEX `kitchen-sink_versions_latest_idx` ON `kitchen-sink_versions` (`parent`,`latest`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`title` text,
	`visibility` text,
	`body` text
);
--> statement-breakpoint
CREATE INDEX `notes_createdAt_idx` ON `notes` (`createdAt`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`_order` text,
	`_status` text DEFAULT 'published' NOT NULL,
	`title` text,
	`slug` text,
	`design` text,
	`featured` integer DEFAULT false NOT NULL,
	`year` real,
	`services` text,
	`client` text,
	`summary` text,
	`cover` text,
	`facts` text,
	`body` text,
	`gallery` text,
	`testimonial` text,
	`meta` text,
	FOREIGN KEY (`cover`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`testimonial`) REFERENCES `testimonials`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `projects_createdAt_idx` ON `projects` (`createdAt`);--> statement-breakpoint
CREATE INDEX `projects__order_idx` ON `projects` (`_order`);--> statement-breakpoint
CREATE INDEX `projects__status_idx` ON `projects` (`_status`);--> statement-breakpoint
CREATE UNIQUE INDEX `projects_slug_unique` ON `projects` (`slug`);--> statement-breakpoint
CREATE INDEX `projects_cover_idx` ON `projects` (`cover`);--> statement-breakpoint
CREATE INDEX `projects_testimonial_idx` ON `projects` (`testimonial`);--> statement-breakpoint
CREATE TABLE `projects_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`parent` text NOT NULL,
	`version` text NOT NULL,
	`_status` text NOT NULL,
	`autosave` integer DEFAULT false NOT NULL,
	`latest` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`parent`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `projects_versions_parent_idx` ON `projects_versions` (`parent`,`createdAt`);--> statement-breakpoint
CREATE INDEX `projects_versions_latest_idx` ON `projects_versions` (`parent`,`latest`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`_order` text,
	`_status` text DEFAULT 'published' NOT NULL,
	`title` text,
	`slug` text,
	`icon` text,
	`priceFrom` text,
	`summary` text,
	`cover` text,
	`body` text,
	`deliverables` text,
	`process` text,
	`meta` text,
	FOREIGN KEY (`cover`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `services_createdAt_idx` ON `services` (`createdAt`);--> statement-breakpoint
CREATE INDEX `services__order_idx` ON `services` (`_order`);--> statement-breakpoint
CREATE INDEX `services__status_idx` ON `services` (`_status`);--> statement-breakpoint
CREATE UNIQUE INDEX `services_slug_unique` ON `services` (`slug`);--> statement-breakpoint
CREATE INDEX `services_cover_idx` ON `services` (`cover`);--> statement-breakpoint
CREATE TABLE `services_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`parent` text NOT NULL,
	`version` text NOT NULL,
	`_status` text NOT NULL,
	`autosave` integer DEFAULT false NOT NULL,
	`latest` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`parent`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `services_versions_parent_idx` ON `services_versions` (`parent`,`createdAt`);--> statement-breakpoint
CREATE INDEX `services_versions_latest_idx` ON `services_versions` (`parent`,`latest`);--> statement-breakpoint
DROP TABLE `albums`;--> statement-breakpoint
DROP TABLE `dishes`;--> statement-breakpoint
DROP TABLE `experiences`;--> statement-breakpoint
DROP TABLE `experiences_versions`;--> statement-breakpoint
DROP TABLE `faqs`;--> statement-breakpoint
DROP TABLE `rooms`;--> statement-breakpoint
DROP TABLE `rooms_versions`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_offers` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`_order` text,
	`title` text,
	`price` text,
	`summary` text,
	`includes` text,
	`validTo` integer,
	`ctaLabel` text,
	`ctaHref` text
);
--> statement-breakpoint
DROP TABLE `offers`;--> statement-breakpoint
ALTER TABLE `__new_offers` RENAME TO `offers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `offers_createdAt_idx` ON `offers` (`createdAt`);--> statement-breakpoint
CREATE INDEX `offers__order_idx` ON `offers` (`_order`);--> statement-breakpoint
ALTER TABLE `_global_site` ADD `cta` text;--> statement-breakpoint
ALTER TABLE `_global_site` DROP COLUMN `season`;--> statement-breakpoint
ALTER TABLE `_global_site` DROP COLUMN `checkIn`;--> statement-breakpoint
ALTER TABLE `_global_site` DROP COLUMN `checkOut`;--> statement-breakpoint
ALTER TABLE `_global_site` DROP COLUMN `bookingCta`;--> statement-breakpoint
ALTER TABLE `posts` ADD `design` text;--> statement-breakpoint
ALTER TABLE `posts` DROP COLUMN `pageDesign`;--> statement-breakpoint
ALTER TABLE `testimonials` ADD `role` text;--> statement-breakpoint
ALTER TABLE `testimonials` ADD `company` text;--> statement-breakpoint
ALTER TABLE `testimonials` ADD `photo` text REFERENCES media(id);--> statement-breakpoint
CREATE INDEX `testimonials_photo_idx` ON `testimonials` (`photo`);--> statement-breakpoint
ALTER TABLE `testimonials` DROP COLUMN `from`;--> statement-breakpoint
ALTER TABLE `testimonials` DROP COLUMN `rating`;--> statement-breakpoint
ALTER TABLE `testimonials` DROP COLUMN `stayedIn`;--> statement-breakpoint
ALTER TABLE `pages` DROP COLUMN `publishedAt`;--> statement-breakpoint
ALTER TABLE `pages` DROP COLUMN `featured`;