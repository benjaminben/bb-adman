CREATE TABLE `asset` (
	`id` text PRIMARY KEY NOT NULL,
	`library` text NOT NULL,
	`kind` text NOT NULL,
	`origin` text NOT NULL,
	`storage` text NOT NULL,
	`subject_id` text,
	`display_name` text NOT NULL,
	`abs_path` text NOT NULL,
	`rel_path` text NOT NULL,
	`mime` text NOT NULL,
	`byte_size` integer NOT NULL,
	`mtime_ms` integer NOT NULL,
	`content_hash` text NOT NULL,
	`width` integer,
	`height` integer,
	`duration_ms` integer,
	`font_family` text,
	`font_publish_allowed` integer DEFAULT 0 NOT NULL,
	`gen_run_id` text,
	`gen_provider` text,
	`gen_model` text,
	`gen_prompt` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subject`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "asset_library" CHECK("asset"."library" IN ('reference','asset')),
	CONSTRAINT "asset_kind" CHECK("asset"."kind" IN ('image','video','font','text')),
	CONSTRAINT "asset_origin" CHECK("asset"."origin" IN ('imported','generated')),
	CONSTRAINT "asset_storage" CHECK("asset"."storage" IN ('linked','managed'))
);
--> statement-breakpoint
CREATE INDEX `asset_subject` ON `asset` (`subject_id`);--> statement-breakpoint
CREATE INDEX `asset_content_hash` ON `asset` (`content_hash`);--> statement-breakpoint
CREATE INDEX `asset_library_kind` ON `asset` (`library`,`kind`);--> statement-breakpoint
CREATE TABLE `campaign` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`region` text NOT NULL,
	`audience` text NOT NULL,
	`message` text NOT NULL,
	`offer` text,
	`call_to_action` text,
	`tone` text,
	`primary_language` text NOT NULL,
	`languages` text NOT NULL,
	`sizes` text NOT NULL,
	`template_id` text NOT NULL,
	`brief` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "campaign_created_by" CHECK("campaign"."created_by" IN ('user','agent'))
);
--> statement-breakpoint
CREATE TABLE `campaign_subject` (
	`campaign_id` text NOT NULL,
	`subject_id` text NOT NULL,
	PRIMARY KEY(`campaign_id`, `subject_id`),
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subject`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `direction` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`name` text NOT NULL,
	`master_variant_id` text NOT NULL,
	`sort` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `project_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rule_set` (
	`campaign_id` text PRIMARY KEY NOT NULL,
	`required_asset_ids` text DEFAULT '[]' NOT NULL,
	`palette` text DEFAULT '[]' NOT NULL,
	`required_words` text DEFAULT '{}' NOT NULL,
	`prohibited_words` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `subject` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `background_clip` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`start_ms` integer NOT NULL,
	`in_ms` integer NOT NULL,
	`out_ms` integer NOT NULL,
	`placement` text,
	FOREIGN KEY (`variant_id`) REFERENCES `variant`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `clip_variant` ON `background_clip` (`variant_id`,`start_ms`);--> statement-breakpoint
CREATE TABLE `layer` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`key` text NOT NULL,
	`type` text NOT NULL,
	`slot` text,
	`name` text NOT NULL,
	`z` integer NOT NULL,
	`visible` integer DEFAULT 1 NOT NULL,
	`locked` integer DEFAULT 0 NOT NULL,
	`linked` integer DEFAULT 0 NOT NULL,
	`overrides` text DEFAULT '[]' NOT NULL,
	`copy` text,
	`style` text NOT NULL,
	`geometry` text NOT NULL,
	`source` text,
	`timing` text NOT NULL,
	`animation` text NOT NULL,
	`revs` text NOT NULL,
	`synced_revs` text NOT NULL,
	`translation_status` text,
	`translation_source` text,
	`overflow` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `variant`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "layer_type" CHECK("layer"."type" IN ('background','image','text')),
	CONSTRAINT "layer_translation_status" CHECK("layer"."translation_status" IN ('missing','proposed','approved')),
	CONSTRAINT "layer_translation_source" CHECK("layer"."translation_source" IN ('ai','agent','user','brief'))
);
--> statement-breakpoint
CREATE INDEX `layer_variant` ON `layer` (`variant_id`,`z`);--> statement-breakpoint
CREATE UNIQUE INDEX `layer_variant_key` ON `layer` (`variant_id`,`key`);--> statement-breakpoint
CREATE TABLE `variant` (
	`id` text PRIMARY KEY NOT NULL,
	`direction_id` text NOT NULL,
	`title` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`size_label` text NOT NULL,
	`language` text NOT NULL,
	`format` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`duration_overridden` integer DEFAULT 0 NOT NULL,
	`rev` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`direction_id`) REFERENCES `direction`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "variant_format" CHECK("variant"."format" IN ('image','video')),
	CONSTRAINT "variant_created_by" CHECK("variant"."created_by" IN ('user','agent'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `variant_grid` ON `variant` (`direction_id`,`size_label`,`language`,`format`);--> statement-breakpoint
CREATE TABLE `variant_subject` (
	`variant_id` text NOT NULL,
	`subject_id` text NOT NULL,
	PRIMARY KEY(`variant_id`, `subject_id`),
	FOREIGN KEY (`variant_id`) REFERENCES `variant`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subject`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `job` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`campaign_id` text,
	`variant_id` text,
	`provider` text,
	`model` text,
	`request` text NOT NULL,
	`remote_job_id` text,
	`result` text,
	`error_kind` text,
	`error_detail` text,
	`progress` real,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "job_kind" CHECK("job"."kind" IN ('brief_extraction','image_generation','generative_fill','layout_proposal','copy_options','translation','video_generation','export','publish')),
	CONSTRAINT "job_status" CHECK("job"."status" IN ('queued','running','succeeded','failed','cancelled')),
	CONSTRAINT "job_error_kind" CHECK("job"."error_kind" IN ('bad_key','quota','refused','timeout','offline','other'))
);
--> statement-breakpoint
CREATE INDEX `job_status` ON `job` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `report` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`created_at` text NOT NULL,
	`output_dir` text NOT NULL,
	`body` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `variant_check` (
	`variant_id` text PRIMARY KEY NOT NULL,
	`checked_rev` integer NOT NULL,
	`ran_at` text NOT NULL,
	`ran_by` text NOT NULL,
	`results` text NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `variant`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "variant_check_ran_by" CHECK("variant_check"."ran_by" IN ('user','agent','export'))
);
