-- Add round_starter column to track who started the current/last round
ALTER TABLE games ADD COLUMN IF NOT EXISTS round_starter TEXT DEFAULT 'X';
