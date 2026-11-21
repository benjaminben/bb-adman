ALTER TABLE `job` ADD `started_by` text DEFAULT 'user' NOT NULL CONSTRAINT `job_started_by` CHECK (`started_by` IN ('user','agent'));--> statement-breakpoint
ALTER TABLE `job` ADD `error_reason` text;
