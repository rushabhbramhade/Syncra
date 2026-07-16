-- Add briefing_id column to briefing_history to link history entries to their briefings

ALTER TABLE briefing_history
    ADD COLUMN IF NOT EXISTS briefing_id UUID REFERENCES briefings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_briefing_history_briefing_id ON briefing_history(briefing_id);
