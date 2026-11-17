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
	`title` text,
	`slug` text,
	`status` text,
	`publishedAt` integer,
	`featured` integer DEFAULT false NOT NULL,
	`cover` text,
	`sections` text,
	`seo` text,
	`parent` text,
	`related` text,
	`gallery` text,
	`views` real,
	`contactEmail` text,
	`extra` text,
	FOREIGN KEY (`cover`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`parent`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `pages_createdAt_idx` ON `pages` (`createdAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `pages_slug_unique` ON `pages` (`slug`);--> statement-breakpoint
CREATE INDEX `pages_cover_idx` ON `pages` (`cover`);--> statement-breakpoint
CREATE INDEX `pages_parent_idx` ON `pages` (`parent`);--> statement-breakpoint
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