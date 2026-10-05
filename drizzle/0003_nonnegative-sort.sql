UPDATE `categories` SET `sort_order` = 0 WHERE `sort_order` < 0;--> statement-breakpoint
UPDATE `sites` SET `sort_order` = 0 WHERE `sort_order` < 0;--> statement-breakpoint
ALTER TABLE `categories` MODIFY COLUMN `sort_order` int unsigned NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `sites` MODIFY COLUMN `sort_order` int unsigned NOT NULL DEFAULT 0;
