-- Migration to add raw_user_meta_data column to the users table
ALTER TABLE users ADD COLUMN raw_user_meta_data JSONB DEFAULT '{}'::JSONB;
