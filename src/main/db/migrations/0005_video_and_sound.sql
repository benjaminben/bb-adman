PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_asset` (
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
	CONSTRAINT "asset_library" CHECK("__new_asset"."library" IN ('reference','asset')),
	CONSTRAINT "asset_kind" CHECK("__new_asset"."kind" IN ('image','video','font','text','audio')),
	CONSTRAINT "asset_origin" CHECK("__new_asset"."origin" IN ('imported','generated')),
	CONSTRAINT "asset_storage" CHECK("__new_asset"."storage" IN ('linked','managed'))
);
--> statement-breakpoint
INSERT INTO `__new_asset`("id", "library", "kind", "origin", "storage", "subject_id", "display_name", "abs_path", "rel_path", "mime", "byte_size", "mtime_ms", "content_hash", "width", "height", "duration_ms", "font_family", "font_publish_allowed", "gen_run_id", "gen_provider", "gen_model", "gen_prompt", "created_at") SELECT "id", "library", "kind", "origin", "storage", "subject_id", "display_name", "abs_path", "rel_path", "mime", "byte_size", "mtime_ms", "content_hash", "width", "height", "duration_ms", "font_family", "font_publish_allowed", "gen_run_id", "gen_provider", "gen_model", "gen_prompt", "created_at" FROM `asset`;--> statement-breakpoint
DROP TABLE `asset`;--> statement-breakpoint
ALTER TABLE `__new_asset` RENAME TO `asset`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `asset_subject` ON `asset` (`subject_id`);--> statement-breakpoint
CREATE INDEX `asset_content_hash` ON `asset` (`content_hash`);--> statement-breakpoint
CREATE INDEX `asset_library_kind` ON `asset` (`library`,`kind`);--> statement-breakpoint
ALTER TABLE `background_clip` ADD `sound_on` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `variant` ADD `first_clip_made` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `variant` ADD `sound` text DEFAULT 'clips' NOT NULL CONSTRAINT `variant_sound` CHECK (`sound` IN ('clips','file','none'));--> statement-breakpoint
ALTER TABLE `variant` ADD `sound_asset_id` text REFERENCES `asset`(`id`);--> statement-breakpoint
UPDATE `variant` SET `first_clip_made` = 1 WHERE `id` IN (SELECT `variant_id` FROM `background_clip`);
