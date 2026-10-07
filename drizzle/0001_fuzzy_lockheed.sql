CREATE TABLE `spaces` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text DEFAULT 'folder' NOT NULL,
	`color` text DEFAULT '#48786c' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `spaces_user_status_idx` ON `spaces` (`user_id`,`status`);--> statement-breakpoint
INSERT INTO spaces (id,user_id,name,description)
SELECT 'imported-' || id, id, 'Imported Reminders', 'Your existing reminders, preserved together. Move them to your own Spaces when ready.' FROM users;
--> statement-breakpoint
DROP INDEX `categories_user_slug_idx`;--> statement-breakpoint
ALTER TABLE `categories` ADD `space_id` text REFERENCES spaces(id);--> statement-breakpoint
CREATE UNIQUE INDEX `categories_space_slug_idx` ON `categories` (`space_id`,`slug`);--> statement-breakpoint
ALTER TABLE `reminders` ADD `space_id` text REFERENCES spaces(id);--> statement-breakpoint
CREATE INDEX `reminders_space_date_idx` ON `reminders` (`space_id`,`important_date`);
--> statement-breakpoint
UPDATE categories SET space_id = 'imported-' || user_id;
--> statement-breakpoint
UPDATE reminders SET space_id = 'imported-' || user_id;
--> statement-breakpoint
CREATE TRIGGER categories_space_required_insert BEFORE INSERT ON categories
WHEN NEW.space_id IS NULL OR NOT EXISTS (SELECT 1 FROM spaces WHERE id=NEW.space_id AND user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT, 'A valid owned Minder Space is required'); END;
--> statement-breakpoint
CREATE TRIGGER categories_space_required_update BEFORE UPDATE ON categories
WHEN NEW.space_id IS NULL OR NOT EXISTS (SELECT 1 FROM spaces WHERE id=NEW.space_id AND user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT, 'A valid owned Minder Space is required'); END;
--> statement-breakpoint
CREATE TRIGGER reminders_space_required_insert BEFORE INSERT ON reminders
WHEN NEW.space_id IS NULL OR NOT EXISTS (SELECT 1 FROM spaces WHERE id=NEW.space_id AND user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT, 'A valid owned Minder Space is required'); END;
--> statement-breakpoint
CREATE TRIGGER reminders_space_required_update BEFORE UPDATE ON reminders
WHEN NEW.space_id IS NULL OR NOT EXISTS (SELECT 1 FROM spaces WHERE id=NEW.space_id AND user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT, 'A valid owned Minder Space is required'); END;
--> statement-breakpoint
CREATE TRIGGER reminders_category_space_insert BEFORE INSERT ON reminders
WHEN NEW.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM categories WHERE id=NEW.category_id AND space_id=NEW.space_id AND user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT, 'Category must belong to the reminder Space'); END;
--> statement-breakpoint
CREATE TRIGGER reminders_category_space_update BEFORE UPDATE OF category_id,space_id ON reminders
WHEN NEW.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM categories WHERE id=NEW.category_id AND space_id=NEW.space_id AND user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT, 'Category must belong to the reminder Space'); END;
