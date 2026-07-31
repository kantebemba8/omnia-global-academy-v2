BEGIN;

-- Le programme de parrainage est désactivé par défaut. Le Super-admin garde
-- le contrôle de son activation et des deux montants depuis l'espace Fintech.
INSERT INTO public.site_settings(key, value, updated_at)
VALUES
  ('referral_enabled', 'false', now()),
  ('referral_reward_referrer_xof', '0', now()),
  ('referral_reward_referred_xof', '0', now())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();

-- Les invitations encore en attente sont neutralisées afin qu'aucun gain ne
-- soit attribué pendant la période de désactivation initiale.
UPDATE public.referrals
SET status = 'disabled',
    reward_referrer_xof = 0,
    reward_referred_xof = 0,
    rewarded_at = NULL
WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.oga_disable_pending_referrals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_enabled boolean;
BEGIN
  IF NEW.key <> 'referral_enabled' THEN
    RETURN NEW;
  END IF;

  v_enabled := lower(trim(both '"' from NEW.value::text)) IN ('true', '1', 'yes', 'on');

  IF NOT v_enabled THEN
    UPDATE public.referrals
    SET status = 'disabled',
        reward_referrer_xof = 0,
        reward_referred_xof = 0,
        rewarded_at = NULL
    WHERE status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_disable_pending_referrals ON public.site_settings;
CREATE TRIGGER trg_disable_pending_referrals
AFTER INSERT OR UPDATE OF value ON public.site_settings
FOR EACH ROW
EXECUTE FUNCTION public.oga_disable_pending_referrals();

REVOKE ALL ON FUNCTION public.oga_disable_pending_referrals() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.oga_disable_pending_referrals() TO service_role;

COMMIT;
