-- ============================================================
-- 049 — OMNIA LIVE STUDIO STEP 4: TARIFICATION & REPLAY
-- Adds organizer proposals before Super Admin commercial approval.
-- ============================================================

alter table public.live_events
  add column if not exists proposed_replay_price_amount numeric(14,2)
    check (proposed_replay_price_amount is null or proposed_replay_price_amount >= 0),

  add column if not exists replay_availability_days integer
    check (replay_availability_days is null or replay_availability_days > 0),

  add column if not exists replay_sale_enabled boolean not null default false,

  add column if not exists organizer_refund_proposal jsonb not null default '{}'::jsonb,

  add column if not exists organizer_cancellation_proposal jsonb not null default '{}'::jsonb;

-- Helpful index for commercial review queues.
create index if not exists live_events_pricing_review_idx
  on public.live_events(status, price_amount, proposed_replay_price_amount);
