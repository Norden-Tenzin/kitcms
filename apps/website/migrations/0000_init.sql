CREATE TABLE `_global_site` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`siteName` text,
	`tagline` text,
	`githubUrl` text,
	`npmUrl` text,
	`nav` text,
	`footerColumns` text,
	`footerNote` text,
	`theme` text
);
--> statement-breakpoint
CREATE INDEX `_global_site_createdAt_idx` ON `_global_site` (`createdAt`);--> statement-breakpoint
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
CREATE INDEX `_refs_path_idx` ON `_refs` (`fromCollection`,`path`,`toId`);--> statement-breakpoint
CREATE TABLE `auth_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `auth_accounts_userId_idx` ON `auth_accounts` (`userId`);--> statement-breakpoint
CREATE TABLE `auth_rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`count` integer NOT NULL,
	`lastRequest` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_rate_limits_key_unique` ON `auth_rate_limits` (`key`);--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_sessions_token_unique` ON `auth_sessions` (`token`);--> statement-breakpoint
CREATE INDEX `auth_sessions_userId_idx` ON `auth_sessions` (`userId`);--> statement-breakpoint
CREATE TABLE `auth_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_verifications_identifier_idx` ON `auth_verifications` (`identifier`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`filename` text,
	`mimeType` text,
	`filesize` real,
	`width` real,
	`height` real,
	`key` text,
	`alt` text
);
--> statement-breakpoint
CREATE INDEX `media_createdAt_idx` ON `media` (`createdAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `media_key_unique` ON `media` (`key`);--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`_order` text,
	`_status` text DEFAULT 'published' NOT NULL,
	`title` text,
	`slug` text,
	`sections` text,
	`meta` text
);
--> statement-breakpoint
CREATE INDEX `pages_createdAt_idx` ON `pages` (`createdAt`);--> statement-breakpoint
CREATE INDEX `pages__order_idx` ON `pages` (`_order`);--> statement-breakpoint
CREATE INDEX `pages__status_idx` ON `pages` (`_status`);--> statement-breakpoint
CREATE UNIQUE INDEX `pages_slug_unique` ON `pages` (`slug`);--> statement-breakpoint
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
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`_status` text DEFAULT 'published' NOT NULL,
	`title` text,
	`slug` text,
	`publishedAt` integer,
	`kind` text,
	`version` text,
	`excerpt` text,
	`cover` text,
	`body` text,
	`meta` text,
	FOREIGN KEY (`cover`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `posts_createdAt_idx` ON `posts` (`createdAt`);--> statement-breakpoint
CREATE INDEX `posts__status_idx` ON `posts` (`_status`);--> statement-breakpoint
CREATE UNIQUE INDEX `posts_slug_unique` ON `posts` (`slug`);--> statement-breakpoint
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
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`email` text,
	`name` text,
	`role` text,
	`emailVerified` integer DEFAULT false NOT NULL,
	`image` text
);
--> statement-breakpoint
CREATE INDEX `users_createdAt_idx` ON `users` (`createdAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);