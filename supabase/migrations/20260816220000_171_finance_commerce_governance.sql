begin;

-- Finance & Commerce governance V1
alter table public.users add column if not exists referral_code text;
create unique index if not exists users_referral_code_uidx on public.users(referral_code) where referral_code is not null;

create or replace function public.oga_generate_public_code(p_prefix text, p_len integer default 8)
returns text language plpgsql volatile as $$
declare v_code text; v_prefix text := upper(regexp_replace(coalesce(p_prefix,'OGA'),'[^A-Z0-9]','','g')); begin
  loop
    v_code := left(v_prefix,12) || '-' || upper(substr(encode(gen_random_bytes(12),'hex'),1,greatest(6,least(20,p_len))));
    exit when not exists(select 1 from public.users where referral_code=v_code)
      and not exists(select 1 from public.coupons where code=v_code)
      and not exists(select 1 from public.commerce_plans where code=v_code)
      and not exists(select 1 from public.commerce_promotions where code=v_code);
  end loop;
  return v_code;
end $$;

update public.users set referral_code=public.oga_generate_public_code('OGA',8) where referral_code is null;

create table if not exists public.referral_program_config(
  id boolean primary key default true check(id),
  enabled boolean not null default false,
  trigger_mode text not null default 'any' check(trigger_mode in ('any','all')),
  triggers text[] not null default array['account_verified']::text[],
  reward_referrer_xof integer not null default 0 check(reward_referrer_xof>=0),
  reward_referred_xof integer not null default 0 check(reward_referred_xof>=0),
  purchase_threshold_xof integer not null default 0 check(purchase_threshold_xof>=0),
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.referral_program_config add column if not exists purchase_threshold_xof integer not null default 0 check(purchase_threshold_xof>=0);

insert into public.referral_program_config(id,enabled,reward_referrer_xof,reward_referred_xof)
select true,
  coalesce((select value::text in ('true','"true"') from public.site_settings where key='referral_enabled'),false),
  coalesce((select nullif(regexp_replace(value::text,'[^0-9]','','g'),'')::integer from public.site_settings where key='referral_reward_referrer_xof'),0),
  coalesce((select nullif(regexp_replace(value::text,'[^0-9]','','g'),'')::integer from public.site_settings where key='referral_reward_referred_xof'),0)
on conflict(id) do nothing;

alter table public.referrals add column if not exists qualified_triggers text[] not null default '{}';
alter table public.referrals add column if not exists reward_reason text;
alter table public.referrals add column if not exists reward_snapshot jsonb not null default '{}'::jsonb;

create table if not exists public.referral_event_log(
  id uuid primary key default gen_random_uuid(),
  referred_user_id uuid not null references public.users(id) on delete cascade,
  event_type text not null,
  event_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists referral_event_user_idx on public.referral_event_log(referred_user_id,created_at desc);

create or replace function public.oga_referral_record_event(
  p_referred_user_id uuid, p_event_type text, p_event_key text, p_metadata jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  cfg public.referral_program_config%rowtype; ref public.referrals%rowtype; triggers text[]; qualifies boolean;
  w1 uuid; w2 uuid; event_id uuid; v_purchase_total numeric := 0;
begin
  select * into cfg from public.referral_program_config where id=true;
  if not found or not cfg.enabled then return jsonb_build_object('handled',false,'reason','disabled'); end if;
  if not (p_event_type = any(cfg.triggers)) then return jsonb_build_object('handled',false,'reason','trigger_not_configured'); end if;
  if p_event_type='purchase_amount_reached' then
    if coalesce(cfg.purchase_threshold_xof,0)<=0 then return jsonb_build_object('handled',false,'reason','threshold_not_configured'); end if;
    select
      coalesce((select sum(final_price_xof) from public.orders where user_id=p_referred_user_id and payment_status='completed'),0)
      + coalesce((select sum(final_amount_xof) from public.commerce_orders where buyer_user_id=p_referred_user_id and payment_status='completed'),0)
      + coalesce((select sum(amount) from public.live_orders where user_id=p_referred_user_id and payment_status='paid' and currency='XOF'),0)
      + coalesce((select sum(amount_xof) from public.coaching_payment_orders where user_id=p_referred_user_id and payment_status='paid'),0)
    into v_purchase_total;
    if v_purchase_total < cfg.purchase_threshold_xof then
      return jsonb_build_object('handled',false,'reason','threshold_not_reached','purchase_total_xof',v_purchase_total,'threshold_xof',cfg.purchase_threshold_xof);
    end if;
    p_metadata := coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object('purchase_total_xof',v_purchase_total,'threshold_xof',cfg.purchase_threshold_xof);
  end if;
  insert into public.referral_event_log(referred_user_id,event_type,event_key,metadata)
  values(p_referred_user_id,p_event_type,p_event_key,coalesce(p_metadata,'{}'::jsonb))
  on conflict(event_key) do nothing returning id into event_id;
  if event_id is null then return jsonb_build_object('handled',true,'duplicate',true); end if;

  select * into ref from public.referrals where referred_id=p_referred_user_id and status in ('pending','qualified') limit 1 for update;
  if not found then return jsonb_build_object('handled',false,'reason','no_pending_referral'); end if;

  triggers := array(select distinct unnest(coalesce(ref.qualified_triggers,'{}'::text[]) || array[p_event_type]));
  qualifies := case when cfg.trigger_mode='all'
    then not exists(select 1 from unnest(cfg.triggers) x where not (x=any(triggers)))
    else exists(select 1 from unnest(cfg.triggers) x where x=any(triggers)) end;

  update public.referrals set qualified_triggers=triggers, status=case when qualifies then 'rewarded' else 'pending' end,
    reward_referrer_xof=case when qualifies then cfg.reward_referrer_xof else reward_referrer_xof end,
    reward_referred_xof=case when qualifies then cfg.reward_referred_xof else reward_referred_xof end,
    rewarded_at=case when qualifies then now() else rewarded_at end,
    reward_reason=case when qualifies then array_to_string(triggers,', ') else reward_reason end,
    reward_snapshot=case when qualifies then jsonb_build_object('trigger_mode',cfg.trigger_mode,'configured_triggers',cfg.triggers,'qualified_triggers',triggers,'event',p_event_type) else reward_snapshot end
  where id=ref.id;

  if qualifies then
    insert into public.wallets(user_id,balance_xof,total_earned_xof) values(ref.referrer_id,cfg.reward_referrer_xof,cfg.reward_referrer_xof)
    on conflict(user_id) do update set balance_xof=public.wallets.balance_xof+excluded.balance_xof,total_earned_xof=public.wallets.total_earned_xof+excluded.total_earned_xof,updated_at=now()
    returning id into w1;
    if cfg.reward_referrer_xof>0 then
      insert into public.wallet_transactions(wallet_id,type,amount_xof,description) values(w1,'credit_referral',cfg.reward_referrer_xof,'Parrainage — '||p_event_type);
    end if;

    insert into public.wallets(user_id,balance_xof,total_earned_xof) values(ref.referred_id,cfg.reward_referred_xof,cfg.reward_referred_xof)
    on conflict(user_id) do update set balance_xof=public.wallets.balance_xof+excluded.balance_xof,total_earned_xof=public.wallets.total_earned_xof+excluded.total_earned_xof,updated_at=now()
    returning id into w2;
    if cfg.reward_referred_xof>0 then
      insert into public.wallet_transactions(wallet_id,type,amount_xof,description) values(w2,'credit_referral',cfg.reward_referred_xof,'Bonus filleul — '||p_event_type);
    end if;
  end if;
  return jsonb_build_object('handled',true,'rewarded',qualifies,'qualified_triggers',triggers);
end $$;

create table if not exists public.finance_payout_policy(
 id boolean primary key default true check(id),
 minimum_xof integer not null default 0 check(minimum_xof>=0),
 processing_min integer not null default 0 check(processing_min>=0),
 processing_max integer not null default 0 check(processing_max>=processing_min),
 processing_unit text not null default 'business_hours' check(processing_unit in ('hours','business_hours','days','business_days')),
 cooldown_value integer not null default 0 check(cooldown_value>=0),
 cooldown_unit text not null default 'days' check(cooldown_unit in ('hours','days')),
 mobile_money_enabled boolean not null default true,
 bank_transfer_enabled boolean not null default true,
 swift_enabled boolean not null default false,
 updated_by uuid references public.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
insert into public.finance_payout_policy(id,minimum_xof)
select true, coalesce((select nullif(regexp_replace(value::text,'[^0-9]','','g'),'')::integer from public.site_settings where key='payout_minimum_xof'),0)
on conflict(id) do nothing;

alter table public.coupons add column if not exists name text;
alter table public.coupons add column if not exists distribution_mode text not null default 'private' check(distribution_mode in ('private','public','newsletter','targeted_email'));
alter table public.coupons add column if not exists starts_at timestamptz;
alter table public.coupons add column if not exists message text;
alter table public.coupons add column if not exists generated_code boolean not null default false;

alter table public.commerce_promotions add column if not exists distribution_mode text not null default 'private' check(distribution_mode in ('private','public','newsletter'));
alter table public.commerce_promotions add column if not exists message text;

alter table public.live_discount_codes add column if not exists name text;
alter table public.live_discount_codes add column if not exists distribution_mode text not null default 'private' check(distribution_mode in ('private','public','newsletter'));
alter table public.live_discount_codes add column if not exists message text;

create table if not exists public.coupon_recipient_assignments(
 id uuid primary key default gen_random_uuid(),
 coupon_id uuid not null references public.coupons(id) on delete cascade,
 recipient_email text not null,
 user_id uuid references public.users(id) on delete set null,
 status text not null default 'assigned' check(status in ('assigned','sent','redeemed','revoked')),
 sent_at timestamptz,
 redeemed_at timestamptz,
 created_by uuid references public.users(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(coupon_id,recipient_email)
);
create index if not exists coupon_recipient_email_idx on public.coupon_recipient_assignments(lower(recipient_email),status);

alter table public.referral_program_config enable row level security;
alter table public.referral_event_log enable row level security;
alter table public.finance_payout_policy enable row level security;
alter table public.coupon_recipient_assignments enable row level security;

create or replace function public.oga_assign_referral_code()
returns trigger language plpgsql as $$
begin
  if new.referral_code is null or btrim(new.referral_code)='' then
    new.referral_code := public.oga_generate_public_code('OGA',8);
  end if;
  return new;
end $$;
drop trigger if exists users_assign_referral_code on public.users;
create trigger users_assign_referral_code before insert on public.users for each row execute function public.oga_assign_referral_code();

revoke all on function public.oga_generate_public_code(text,integer) from public, anon, authenticated;
grant execute on function public.oga_generate_public_code(text,integer) to service_role;
revoke all on function public.oga_referral_record_event(uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.oga_referral_record_event(uuid,text,text,jsonb) to service_role;
revoke all on function public.oga_assign_referral_code() from public, anon, authenticated;
grant execute on function public.oga_assign_referral_code() to service_role;

create or replace function public.finance_create_payout_request(
  p_user_id uuid,
  p_amount_xof integer,
  p_channel text,
  p_mm_operator text default null,
  p_mm_phone text default null,
  p_bank_name text default null,
  p_account_holder text default null,
  p_bank_code text default null,
  p_branch_code text default null,
  p_account_number text default null,
  p_rib_key text default null,
  p_iban text default null,
  p_swift text default null
) returns uuid
language plpgsql security definer set search_path=public as $$
declare
  v_wallet public.wallets%rowtype;
  v_policy public.finance_payout_policy%rowtype;
  v_last timestamptz;
  v_id uuid;
begin
  select * into v_policy from public.finance_payout_policy where id=true;
  if v_policy.id is null then raise exception 'PAYOUT_POLICY_NOT_CONFIGURED'; end if;
  if p_amount_xof < v_policy.minimum_xof then raise exception 'PAYOUT_AMOUNT_TOO_LOW'; end if;
  if p_channel='mobile_money' and not v_policy.mobile_money_enabled then raise exception 'PAYOUT_CHANNEL_DISABLED'; end if;
  if p_channel='bank_transfer' and not v_policy.bank_transfer_enabled then raise exception 'PAYOUT_CHANNEL_DISABLED'; end if;
  if p_channel='swift' and not v_policy.swift_enabled then raise exception 'PAYOUT_CHANNEL_DISABLED'; end if;

  if v_policy.cooldown_value>0 then
    select max(requested_at) into v_last from public.payout_requests where user_id=p_user_id and status in ('pending','approved','paid');
    if v_last is not null and now() < v_last + case when v_policy.cooldown_unit='hours'
      then make_interval(hours=>v_policy.cooldown_value) else make_interval(days=>v_policy.cooldown_value) end
    then raise exception 'PAYOUT_COOLDOWN_ACTIVE'; end if;
  end if;

  select * into v_wallet from public.wallets where user_id=p_user_id for update;
  if v_wallet.id is null then raise exception 'WALLET_NOT_FOUND'; end if;
  if p_amount_xof <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if (coalesce(v_wallet.balance_xof,0)-coalesce(v_wallet.reserved_xof,0)) < p_amount_xof then raise exception 'INSUFFICIENT_AVAILABLE_BALANCE'; end if;

  update public.wallets set reserved_xof=coalesce(reserved_xof,0)+p_amount_xof,updated_at=now() where id=v_wallet.id;
  insert into public.payout_requests(wallet_id,user_id,amount_xof,channel,mm_operator,mm_phone,bank_name,account_holder,bank_code,branch_code,account_number,rib_key,iban,swift,status,requested_at)
  values(v_wallet.id,p_user_id,p_amount_xof,p_channel,p_mm_operator,p_mm_phone,p_bank_name,p_account_holder,p_bank_code,p_branch_code,p_account_number,p_rib_key,p_iban,p_swift,'pending',now())
  returning id into v_id;
  return v_id;
end $$;

-- Le règlement des formations ne doit plus contenir une règle de parrainage cachée.
CREATE OR REPLACE FUNCTION public.payment_settle_course_order(
  p_order_id uuid,
  p_provider_transaction_id text,
  p_provider_reference text DEFAULT NULL,
  p_provider_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_course record;
  v_license record;
  v_enrollment_id uuid;
  v_usage_id uuid;
  v_coupon_usage_id uuid;
  v_effect_id uuid;
  v_final integer := 0;
  v_platform_percent numeric := 0;
  v_professor_percent numeric := 0;
  v_fixed_fee integer := 0;
  v_platform_share integer := 0;
  v_professor_share integer := 0;
  v_ai_tokens integer := 0;
  v_was_completed boolean := false;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  v_was_completed := v_order.payment_status = 'completed';
  v_final := COALESCE(v_order.final_price_xof, 0);

  SELECT * INTO v_course
  FROM public.courses
  WHERE id = v_order.course_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COURSE_NOT_FOUND';
  END IF;

  UPDATE public.orders
  SET payment_status = 'completed',
      fedapay_transaction_id = COALESCE(NULLIF(p_provider_transaction_id, ''), fedapay_transaction_id),
      gateway_reference = COALESCE(NULLIF(p_provider_reference, ''), gateway_reference),
      paid_at = COALESCE(paid_at, now())
  WHERE id = v_order.id;

  INSERT INTO public.user_enrollments(user_id, course_id, enrolled_at)
  VALUES (v_order.user_id, v_order.course_id, now())
  ON CONFLICT (user_id, course_id) DO NOTHING
  RETURNING id INTO v_enrollment_id;

  IF v_enrollment_id IS NOT NULL THEN
    UPDATE public.courses
    SET total_students = COALESCE(total_students, 0) + 1
    WHERE id = v_order.course_id;
  END IF;

  IF v_order.license_id IS NOT NULL THEN
    SELECT * INTO v_license
    FROM public.group_licenses
    WHERE id = v_order.license_id
    FOR UPDATE;

    IF NOT FOUND OR NOT COALESCE(v_license.is_active, false) OR
       (v_license.expires_at IS NOT NULL AND v_license.expires_at < now()) THEN
      RAISE EXCEPTION 'LICENSE_INVALID';
    END IF;

    INSERT INTO public.license_usages(license_id, user_id, used_at)
    VALUES (v_order.license_id, v_order.user_id, now())
    ON CONFLICT (license_id, user_id) DO NOTHING
    RETURNING id INTO v_usage_id;

    IF v_usage_id IS NOT NULL THEN
      IF COALESCE(v_license.used_seats, 0) >= COALESCE(v_license.max_seats, 0) THEN
        RAISE EXCEPTION 'LICENSE_FULL';
      END IF;
      UPDATE public.group_licenses
      SET used_seats = COALESCE(used_seats, 0) + 1
      WHERE id = v_order.license_id;
    END IF;
  END IF;

  IF COALESCE(to_jsonb(v_course)->>'creator_type', 'professeur') = 'professeur' THEN
    SELECT rule.platform_percent, rule.fixed_fee_xof
    INTO v_platform_percent, v_fixed_fee
    FROM public.commerce_commission_rules rule
    WHERE rule.module_key IN ('courses', 'global')
      AND rule.status = 'active'
      AND rule.valid_from <= now()
      AND (rule.valid_until IS NULL OR rule.valid_until >= now())
      AND (rule.creator_user_id IS NULL OR rule.creator_user_id = v_course.creator_id)
      AND (rule.offer_type IS NULL OR rule.offer_type = 'course_sale')
      AND v_final >= COALESCE(rule.minimum_amount_xof, 0)
    ORDER BY CASE WHEN rule.module_key = 'courses' THEN 0 ELSE 1 END,
             rule.priority ASC
    LIMIT 1;

    IF v_platform_percent IS NULL THEN
      IF COALESCE(v_course.cpd_accredited, false) AND COALESCE(v_course.is_assisted, false) THEN
        v_professor_percent := public.oga_setting_numeric('commission_cpd_assiste_prof', 60);
      ELSIF COALESCE(v_course.cpd_accredited, false) THEN
        v_professor_percent := public.oga_setting_numeric('commission_avec_cpd_prof', 65);
      ELSIF COALESCE(v_course.is_assisted, false) THEN
        v_professor_percent := public.oga_setting_numeric('commission_assiste_prof', 55);
      ELSE
        v_professor_percent := public.oga_setting_numeric('commission_sans_cpd_prof', 70);
      END IF;
      v_platform_percent := 100 - v_professor_percent;
      v_fixed_fee := 0;
    END IF;

    v_platform_share := LEAST(v_final, ROUND(v_final * v_platform_percent / 100.0)::integer + COALESCE(v_fixed_fee, 0));
    v_professor_share := GREATEST(0, v_final - v_platform_share);
    v_professor_percent := CASE WHEN v_final > 0 THEN ROUND(v_professor_share * 100.0 / v_final) ELSE 0 END;
    v_platform_percent := CASE WHEN v_final > 0 THEN 100 - v_professor_percent ELSE 0 END;

    UPDATE public.orders
    SET professor_share_xof = v_professor_share,
        platform_share_xof = v_platform_share,
        professor_percent = v_professor_percent::integer,
        platform_percent = v_platform_percent::integer
    WHERE id = v_order.id;

    IF v_course.creator_id IS NOT NULL AND v_professor_share > 0 THEN
      PERFORM public.oga_credit_wallet_once(
        v_course.creator_id,
        v_professor_share,
        'credit_sale',
        'Vente — commande ' || v_order.order_number,
        v_order.id::text,
        v_order.id,
        'course-sale:' || v_order.id::text
      );
    END IF;
  END IF;

  IF v_order.coupon_id IS NOT NULL THEN
    INSERT INTO public.coupon_usages(coupon_id, user_id, order_id, discount_applied_xof, used_at)
    VALUES (v_order.coupon_id, v_order.user_id, v_order.id, COALESCE(v_order.discount_xof, 0), now())
    ON CONFLICT (coupon_id, user_id) DO NOTHING
    RETURNING id INTO v_coupon_usage_id;

    IF v_coupon_usage_id IS NOT NULL THEN
      UPDATE public.coupons
      SET used_count = COALESCE(used_count, 0) + 1
      WHERE id = v_order.coupon_id;
    END IF;
  END IF;

  -- Le parrainage est désormais gouverné exclusivement par oga_referral_record_event.

  v_ai_tokens := public.oga_setting_numeric('ai_token_per_purchase', 1)::integer;
  IF v_ai_tokens > 0 THEN
    INSERT INTO public.payment_order_effects(order_id, effect_key, metadata)
    VALUES (v_order.id, 'ai_tokens', jsonb_build_object('tokens', v_ai_tokens))
    ON CONFLICT (order_id, effect_key) DO NOTHING
    RETURNING id INTO v_effect_id;

    IF v_effect_id IS NOT NULL THEN
      UPDATE public.users
      SET ai_tokens = COALESCE(ai_tokens, 0) + v_ai_tokens
      WHERE id = v_order.user_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'already_completed', v_was_completed,
    'enrollment_created', v_enrollment_id IS NOT NULL,
    'professor_user_id', v_course.creator_id,
    'professor_share_xof', v_professor_share,
    'platform_share_xof', v_platform_share
  );
END;
$$;

revoke all on function public.finance_create_payout_request(uuid,integer,text,text,text,text,text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.finance_create_payout_request(uuid,integer,text,text,text,text,text,text,text,text,text,text,text) to service_role;

commit;
