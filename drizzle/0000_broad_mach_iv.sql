CREATE TABLE `admins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(80) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admins_id` PRIMARY KEY(`id`),
	CONSTRAINT `admins_username_uq` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`admin_id` int,
	`action` varchar(100) NOT NULL,
	`detail` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`icon` varchar(512),
	`description` text,
	`sort_order` int NOT NULL DEFAULT 0,
	`visible` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `daily_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`site_id` int NOT NULL,
	`date` date NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	CONSTRAINT `daily_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_stats_site_date_uq` UNIQUE(`site_id`,`date`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(64) NOT NULL,
	`admin_id` int NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` varchar(100) NOT NULL,
	`value` json NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `site_tags` (
	`site_id` int NOT NULL,
	`tag_id` int NOT NULL,
	CONSTRAINT `site_tags_site_id_tag_id_pk` PRIMARY KEY(`site_id`,`tag_id`)
);
--> statement-breakpoint
CREATE TABLE `sites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`url` text NOT NULL,
	`url_hash` varchar(64) NOT NULL,
	`domain` varchar(255) NOT NULL,
	`description` text,
	`short_description` varchar(500),
	`icon` varchar(512),
	`category_id` int NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`featured` boolean NOT NULL DEFAULT false,
	`pinned` boolean NOT NULL DEFAULT false,
	`enabled` boolean NOT NULL DEFAULT true,
	`click_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sites_id` PRIMARY KEY(`id`),
	CONSTRAINT `sites_url_uq` UNIQUE(`url_hash`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	CONSTRAINT `tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `tags_name_uq` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `visits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`site_id` int NOT NULL,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	`referrer` varchar(512),
	`device` varchar(30),
	`browser` varchar(30),
	`os` varchar(30),
	`country` varchar(100),
	`region` varchar(100),
	`ip_hash` varchar(64) NOT NULL,
	`dedupe_key` varchar(64) NOT NULL,
	CONSTRAINT `visits_id` PRIMARY KEY(`id`),
	CONSTRAINT `visits_dedupe_uq` UNIQUE(`dedupe_key`)
);
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_admin_id_admins_id_fk` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `daily_stats` ADD CONSTRAINT `daily_stats_site_id_sites_id_fk` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_admin_id_admins_id_fk` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `site_tags` ADD CONSTRAINT `site_tags_site_id_sites_id_fk` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `site_tags` ADD CONSTRAINT `site_tags_tag_id_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sites` ADD CONSTRAINT `sites_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `visits` ADD CONSTRAINT `visits_site_id_sites_id_fk` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `categories_order_idx` ON `categories` (`sort_order`);--> statement-breakpoint
CREATE INDEX `daily_stats_date_idx` ON `daily_stats` (`date`);--> statement-breakpoint
CREATE INDEX `sessions_expiry_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `sites_listing_idx` ON `sites` (`enabled`,`category_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `sites_domain_idx` ON `sites` (`domain`);--> statement-breakpoint
CREATE INDEX `visits_site_time_idx` ON `visits` (`site_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `visits_time_idx` ON `visits` (`timestamp`);