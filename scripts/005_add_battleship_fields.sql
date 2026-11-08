-- Add fields for Battleship game
-- board_x: Player X's ship positions and hits received
-- board_o: Player O's ship positions and hits received  
-- ships_x: Player X's ship placements (JSON)
-- ships_o: Player O's ship placements (JSON)
-- shots_x: Player X's shots taken on opponent
-- shots_o: Player O's shots taken on opponent

ALTER TABLE games ADD COLUMN IF NOT EXISTS board_x TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE games ADD COLUMN IF NOT EXISTS board_o TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE games ADD COLUMN IF NOT EXISTS ships_x JSONB DEFAULT '[]'::JSONB;
ALTER TABLE games ADD COLUMN IF NOT EXISTS ships_o JSONB DEFAULT '[]'::JSONB;
ALTER TABLE games ADD COLUMN IF NOT EXISTS shots_x TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE games ADD COLUMN IF NOT EXISTS shots_o TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE games ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'placing';
