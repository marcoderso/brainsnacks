-- Add game_type column to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS game_type TEXT DEFAULT 'tictactoe';
