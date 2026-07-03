/*
# Module 2 — Système d'authentification personnalisé

## Description
Crée l'ensemble des tables nécessaires au système d'authentification
personnalisé d'Omnia Global Academy, basé sur OTP SMS (Africa's Talking)
et tokens de session custom.

## Nouvelles tables

### 1. users
Table centrale des utilisateurs. Stocke email, numéro de téléphone (unique),
hash du mot de passe, nom complet, date de naissance, pays, avatar,
consentements de communication (email/SMS/push/newsletter) et statut du compte.

### 2. user_roles
Gestion des rôles cumulatifs : un utilisateur peut avoir plusieurs rôles
(apprenant, professeur, etablissement_directeur, etablissement_enseignant,
moderateur, super_admin). Contrainte UNIQUE(user_id, role) évite les doublons.

### 3. professeur_profiles
Profil étendu pour les utilisateurs ayant le rôle "professeur".
Bio, domaine d'expertise, URL CV/diplôme (Cloudflare R2) et workflow KYC
(en_attente → valide | rejete).

### 4. etablissement_profiles
Profil étendu pour les établissements scolaires.
Nom, numéro d'agrément ministériel, directeur, logo/signature (Cloudflare R2)
et workflow KYC.

### 5. otp_codes
Codes OTP à 6 chiffres, à usage unique, avec TTL (expires_at), purpose
(inscription | connexion | reset_password) et traçabilité IP.

### 6. user_sessions
Sessions custom avec token unique (VARCHAR 255), IP, user-agent
et date d'expiration. Utilisées par les edge functions via service role.

### 7. sms_rate_limits
Enregistrement horodaté de chaque SMS envoyé par numéro/IP.
Permet aux edge functions de calculer le débit (ex. max 3/heure).

## Sécurité (RLS)
- RLS activé sur les 7 tables
- users : SELECT sur son propre profil (id = auth.uid())
- user_roles : SELECT sur ses propres rôles
- professeur_profiles : SELECT + UPDATE sur son propre profil
- etablissement_profiles : SELECT + UPDATE sur son propre profil
- otp_codes : INSERT public (anon + authenticated) pour l'inscription
- user_sessions : SELECT/INSERT/UPDATE/DELETE sur ses propres sessions
- sms_rate_limits : aucune politique frontend — accès service role uniquement

## Note architecturale
Ce module utilise une authentification entièrement custom via edge functions
(service role, qui contourne le RLS). Les politiques RLS avec auth.uid()
s'appliquent comme couche de sécurité défensive pour les rares cas
d'accès direct via client Supabase authentifié.
*/

-- ══════════════════════════════════════════════════════════════════
-- 1. TABLE USERS
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            VARCHAR(255) UNIQUE NOT NULL,
  phone_number     VARCHAR(50)  UNIQUE NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  full_name        VARCHAR(255) NOT NULL,
  birth_date       DATE         NOT NULL,
  country_code     VARCHAR(10)  NOT NULL DEFAULT 'ML',
  avatar_url       TEXT,
  email_status     VARCHAR(20)  DEFAULT 'valide',

  allow_email      BOOLEAN DEFAULT TRUE,
  allow_sms        BOOLEAN DEFAULT TRUE,
  allow_push       BOOLEAN DEFAULT FALSE,
  subscribe_newsletter BOOLEAN DEFAULT FALSE,

  status                  VARCHAR(30) DEFAULT 'actif',
  force_password_change   BOOLEAN DEFAULT FALSE,
  last_login_at           TIMESTAMP WITH TIME ZONE,
  created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_read" ON users;
CREATE POLICY "users_own_read" ON users FOR SELECT
  TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "users_own_update" ON users;
CREATE POLICY "users_own_update" ON users FOR UPDATE
  TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ══════════════════════════════════════════════════════════════════
-- 2. TABLE USER_ROLES
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        VARCHAR(30) NOT NULL,
  granted_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  granted_by  UUID REFERENCES users(id),
  UNIQUE(user_id, role)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_own_read" ON user_roles;
CREATE POLICY "user_roles_own_read" ON user_roles FOR SELECT
  TO authenticated USING (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════════
-- 3. TABLE PROFESSEUR_PROFILES
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS professeur_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bio                   TEXT,
  expertise_domain      VARCHAR(255),
  cv_diploma_url        TEXT,
  kyc_status            VARCHAR(30) DEFAULT 'en_attente',
  kyc_validated_by      UUID REFERENCES users(id),
  kyc_validated_at      TIMESTAMP WITH TIME ZONE,
  kyc_rejection_reason  TEXT,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE professeur_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prof_profiles_own_read" ON professeur_profiles;
CREATE POLICY "prof_profiles_own_read" ON professeur_profiles FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "prof_profiles_own_update" ON professeur_profiles;
CREATE POLICY "prof_profiles_own_update" ON professeur_profiles FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════════
-- 4. TABLE ETABLISSEMENT_PROFILES
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS etablissement_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_name           VARCHAR(255) NOT NULL,
  registration_number   VARCHAR(100),
  director_name         VARCHAR(255) NOT NULL,
  logo_url              TEXT,
  signature_url         TEXT,
  kyc_status            VARCHAR(30) DEFAULT 'en_attente',
  kyc_validated_by      UUID REFERENCES users(id),
  kyc_validated_at      TIMESTAMP WITH TIME ZONE,
  kyc_rejection_reason  TEXT,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE etablissement_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "etab_profiles_own_read" ON etablissement_profiles;
CREATE POLICY "etab_profiles_own_read" ON etablissement_profiles FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "etab_profiles_own_update" ON etablissement_profiles;
CREATE POLICY "etab_profiles_own_update" ON etablissement_profiles FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════════
-- 5. TABLE OTP_CODES
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS otp_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number  VARCHAR(50) NOT NULL,
  code          VARCHAR(6)  NOT NULL,
  purpose       VARCHAR(30) NOT NULL,
  expires_at    TIMESTAMP WITH TIME ZONE NOT NULL,
  used          BOOLEAN DEFAULT FALSE,
  ip_address    VARCHAR(50),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_phone   ON otp_codes(phone_number);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at);

ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "otp_public_insert" ON otp_codes;
CREATE POLICY "otp_public_insert" ON otp_codes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════
-- 6. TABLE USER_SESSIONS
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token  VARCHAR(255) UNIQUE NOT NULL,
  ip_address     VARCHAR(50),
  user_agent     TEXT,
  expires_at     TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user  ON user_sessions(user_id);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sessions_own_select" ON user_sessions;
CREATE POLICY "sessions_own_select" ON user_sessions FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "sessions_own_insert" ON user_sessions;
CREATE POLICY "sessions_own_insert" ON user_sessions FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "sessions_own_update" ON user_sessions;
CREATE POLICY "sessions_own_update" ON user_sessions FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "sessions_own_delete" ON user_sessions;
CREATE POLICY "sessions_own_delete" ON user_sessions FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════════
-- 7. TABLE SMS_RATE_LIMITS
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sms_rate_limits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number  VARCHAR(50) NOT NULL,
  ip_address    VARCHAR(50),
  sent_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_phone ON sms_rate_limits(phone_number, sent_at);

ALTER TABLE sms_rate_limits ENABLE ROW LEVEL SECURITY;
-- Aucune politique frontend : accessible uniquement via service role (edge functions)
