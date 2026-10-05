CREATE TABLE `page_views` (
	`id` int AUTO_INCREMENT NOT NULL,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	`date` date NOT NULL,
	`visitor_hash` varchar(64) NOT NULL,
	`referrer` varchar(512),
	`device` varchar(30),
	`browser` varchar(30),
	`os` varchar(30),
	`country` varchar(100),
	`region` varchar(100),
	CONSTRAINT `page_views_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `page_views_date_idx` ON `page_views` (`date`);--> statement-breakpoint
CREATE INDEX `page_views_visitor_date_idx` ON `page_views` (`visitor_hash`,`date`);