-- Add fields for Billiard (8-ball)
-- billiard_state: ball positions, player groups (solids/stripes), ball in hand, break flag, last message
-- last_shot: the most recent shot (seq, shooter, direction, power, starting positions)
--            so the opponent can replay the shot animation locally

ALTER TABLE games ADD COLUMN IF NOT EXISTS billiard_state JSONB;
ALTER TABLE games ADD COLUMN IF NOT EXISTS last_shot JSONB;
