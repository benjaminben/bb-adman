PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_job` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`campaign_id` text,
	`variant_id` text,
	`layer_id` text,
	`slot` text,
	`provider` text,
	`model` text,
	`request` text NOT NULL,
	`remote_job_id` text,
	`result` text,
	`error_kind` text,
	`error_detail` text,
	`progress` real,
	`paid_calls` integer DEFAULT 0 NOT NULL,
	`seen_at` text,
	`started_by` text DEFAULT 'user' NOT NULL,
	`error_reason` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "job_kind" CHECK("__new_job"."kind" IN ('brief_extraction','image_generation','generative_fill','layout_proposal','copy_options','translation','video_generation','export','publish','cutout')),
	CONSTRAINT "job_status" CHECK("__new_job"."status" IN ('queued','running','succeeded','failed','cancelled')),
	CONSTRAINT "job_error_kind" CHECK("__new_job"."error_kind" IN ('bad_key','quota','refused','timeout','offline','other')),
	CONSTRAINT "job_started_by" CHECK("__new_job"."started_by" IN ('user','agent'))
);
--> statement-breakpoint
INSERT INTO `__new_job`("id", "kind", "status", "campaign_id", "variant_id", "layer_id", "slot", "provider", "model", "request", "remote_job_id", "result", "error_kind", "error_detail", "progress", "paid_calls", "seen_at", "started_by", "error_reason", "created_at", "updated_at") SELECT "id", "kind", "status", "campaign_id", "variant_id", "layer_id", "slot", "provider", "model", "request", "remote_job_id", "result", "error_kind", "error_detail", "progress", "paid_calls", "seen_at", "started_by", "error_reason", "created_at", "updated_at" FROM `job`;--> statement-breakpoint
DROP TABLE `job`;--> statement-breakpoint
ALTER TABLE `__new_job` RENAME TO `job`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `job_status` ON `job` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `job_target` ON `job` (`campaign_id`,`variant_id`);