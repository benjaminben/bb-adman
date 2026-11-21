ALTER TABLE `variant` ADD `agent_changed_at` text;--> statement-breakpoint
ALTER TABLE `job` ADD `layer_id` text;--> statement-breakpoint
ALTER TABLE `job` ADD `slot` text;--> statement-breakpoint
ALTER TABLE `job` ADD `paid_calls` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `job` ADD `seen_at` text;--> statement-breakpoint
CREATE INDEX `job_target` ON `job` (`campaign_id`,`variant_id`);