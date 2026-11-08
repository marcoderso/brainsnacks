-- Matchmaking queue table
CREATE TABLE IF NOT EXISTS matchmaking_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL DEFAULT 'DGB',
  game_type TEXT NOT NULL,
  player_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, game_type, player_id)
);

-- Enable RLS
ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read, insert, delete from queue
CREATE POLICY "Anyone can read queue" ON matchmaking_queue FOR SELECT USING (true);
CREATE POLICY "Anyone can join queue" ON matchmaking_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can leave queue" ON matchmaking_queue FOR DELETE USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE matchmaking_queue;
