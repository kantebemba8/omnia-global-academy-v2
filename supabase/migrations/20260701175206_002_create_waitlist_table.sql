CREATE TABLE waitlist (
  id SERIAL PRIMARY KEY,
  prenom VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  telephone VARCHAR(50),
  brevo_synced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Policies for waitlist (authenticated can read/write, anon can insert)
CREATE POLICY "waitlist_authenticated_read" ON waitlist FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "waitlist_public_insert" ON waitlist FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "waitlist_authenticated_update" ON waitlist FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- Create index on email for faster lookups
CREATE INDEX idx_waitlist_email ON waitlist (email);