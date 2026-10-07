CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`reminder_id` text NOT NULL,
	`user_id` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`storage_key` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`reminder_id`) REFERENCES `reminders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attachments_reminder_idx` ON `attachments` (`reminder_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`color` text NOT NULL,
	`icon` text DEFAULT 'tag' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_user_slug_idx` ON `categories` (`user_id`,`slug`);--> statement-breakpoint
CREATE TABLE `notification_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`notification_id` text NOT NULL,
	`user_id` text NOT NULL,
	`channel` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`error` text,
	`delivered_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`notification_id`) REFERENCES `reminder_notifications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `deliveries_user_channel_idx` ON `notification_deliveries` (`user_id`,`channel`,`status`);--> statement-breakpoint
CREATE TABLE `reminder_history` (
	`id` text PRIMARY KEY NOT NULL,
	`reminder_id` text NOT NULL,
	`user_id` text NOT NULL,
	`series_id` text NOT NULL,
	`event` text NOT NULL,
	`detail` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`reminder_id`) REFERENCES `reminders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `history_series_idx` ON `reminder_history` (`series_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `reminder_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`reminder_id` text NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`offset_days` integer,
	`scheduled_for` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`title` text,
	`body` text,
	`sent_at` integer,
	`read_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`reminder_id`) REFERENCES `reminders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_user_status_idx` ON `reminder_notifications` (`user_id`,`status`,`scheduled_for`);--> statement-breakpoint
CREATE INDEX `notifications_reminder_idx` ON `reminder_notifications` (`reminder_id`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`series_id` text NOT NULL,
	`previous_reminder_id` text,
	`cycle` integer DEFAULT 1 NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`important_date` text NOT NULL,
	`category_id` text,
	`reminder_type` text DEFAULT 'custom' NOT NULL,
	`associated_with` text,
	`status` text DEFAULT 'active' NOT NULL,
	`status_before_archive` text,
	`priority` text DEFAULT 'normal' NOT NULL,
	`recurrence_unit` text,
	`recurrence_interval` integer,
	`notify_offsets` text DEFAULT '[]' NOT NULL,
	`snoozed_until` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`resolved_at` integer,
	`renewed_at` integer,
	`archived_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `reminders_user_date_idx` ON `reminders` (`user_id`,`important_date`);--> statement-breakpoint
CREATE INDEX `reminders_user_status_idx` ON `reminders` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `reminders_series_idx` ON `reminders` (`series_id`);--> statement-breakpoint
CREATE TABLE `renewals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`series_id` text NOT NULL,
	`from_reminder_id` text NOT NULL,
	`to_reminder_id` text NOT NULL,
	`kind` text DEFAULT 'renewal' NOT NULL,
	`previous_date` text NOT NULL,
	`new_date` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_reminder_id`) REFERENCES `reminders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_reminder_id`) REFERENCES `reminders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `renewals_series_idx` ON `renewals` (`series_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`default_offsets` text DEFAULT '[90,60,30,14,7,1,0]' NOT NULL,
	`notification_level` text DEFAULT 'all' NOT NULL,
	`in_app_enabled` integer DEFAULT true NOT NULL,
	`browser_enabled` integer DEFAULT false NOT NULL,
	`email_enabled` integer DEFAULT false NOT NULL,
	`push_enabled` integer DEFAULT false NOT NULL,
	`day_first` integer DEFAULT true NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);