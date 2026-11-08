-- Drop existing table and recreate with 6-digit code
DROP TABLE IF EXISTS games;

-- Create games table with 6-digit code
CREATE TABLE games (
  id TEXT PRIMARY KEY,
  board TEXT[] DEFAULT ARRAY['', '', '', '', '', '', '', '', ''],
  current_turn TEXT DEFAULT 'X',
  player_x TEXT,
  player_o TEXT,
  winner TEXT,
  status TEXT DEFAULT 'waiting',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable realtime for games table
ALTER PUBLICATION supabase_realtime ADD TABLE games;

-- Enable RLS
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read games (for joining)
CREATE POLICY "Anyone can view games" ON games FOR SELECT USING (true);

-- Allow anyone to insert games (for creating)
CREATE POLICY "Anyone can create games" ON games FOR INSERT WITH CHECK (true);

-- Allow anyone to update games (for gameplay)
CREATE POLICY "Anyone can update games" ON games FOR UPDATE USING (true);
