ALTER TABLE pricing_tiers ADD COLUMN IF NOT EXISTS is_protected BOOLEAN DEFAULT FALSE;

UPDATE pricing_tiers SET is_protected = TRUE WHERE is_base_tier = TRUE;