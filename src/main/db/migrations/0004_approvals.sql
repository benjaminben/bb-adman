CREATE TABLE `approval_link` (
	`campaign_id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`state` text NOT NULL,
	`created_at` text NOT NULL,
	`published_at` text,
	`checked_at` text,
	`ended_at` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "approval_link_state" CHECK("approval_link"."state" IN ('live','ended'))
);
--> statement-breakpoint
CREATE TABLE `approval_signoff` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`version` integer NOT NULL,
	`email` text NOT NULL,
	`signed_at` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `approval_link`(`campaign_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `approval_signoff_campaign` ON `approval_signoff` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `approval_variant` (
	`campaign_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`published_rev` integer NOT NULL,
	`expires_at` text NOT NULL,
	PRIMARY KEY(`campaign_id`, `variant_id`),
	FOREIGN KEY (`campaign_id`) REFERENCES `approval_link`(`campaign_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variant_id`) REFERENCES `variant`(`id`) ON UPDATE no action ON DELETE cascade
);
