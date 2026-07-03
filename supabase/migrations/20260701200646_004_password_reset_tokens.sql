/*
# Module 2 — Table password_reset_tokens

## Description
Stockage des tokens de réinitialisation de mot de passe générés après
vérification OTP successful (purpose: reset_password).

## Nouvelle table

### password_reset_tokens
- id (uuid, pk)
- user_id (uuid, FK → users, CASCADE)
- reset_token (varchar 255, unique) — UUID généré côté serveur
- expires_at (timestamptz) — TTL 15 minutes
- used (boolean, default false)
- created_at (timestamptz)

## Sécurité
- RLS activé
- Aucune politique frontend — accès service role uniquement via edge functions
*/

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reset_token  VARCHAR(255) UNIQUE NOT NULL,
  expires_at   TIMESTAMP WITH TIME ZONE NOT NULL,
  used         BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reset_token ON password_reset_tokens(reset_token);
CREATE INDEX IF NOT EXISTS idx_reset_token_user ON password_reset_tokens(user_id);

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
-- Accessible uniquement via service role (edge functions)
