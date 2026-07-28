-- Correction GM3 — compatibilité avec le socle Structure existant
-- Migration idempotente : peut être exécutée après la migration 110 déjà déployée.

do $$
begin
  if to_regclass('public.recognition_partners') is null then
    raise exception 'La table public.recognition_partners est absente. Exécutez d’abord la migration 110 corrigée.';
  end if;

  if to_regclass('public.partner_organizations') is not null then
    if exists (
      select 1 from pg_constraint
      where conname = 'recognition_partners_linked_organization_id_fkey'
        and conrelid = 'public.recognition_partners'::regclass
    ) then
      alter table public.recognition_partners
        drop constraint recognition_partners_linked_organization_id_fkey;
    end if;

    -- N’ajoute la contrainte que si les liaisons existantes sont valides.
    if not exists (
      select 1
      from public.recognition_partners rp
      left join public.partner_organizations po on po.id = rp.linked_organization_id
      where rp.linked_organization_id is not null and po.id is null
    ) then
      alter table public.recognition_partners
        add constraint recognition_partners_linked_organization_id_fkey
        foreign key (linked_organization_id)
        references public.partner_organizations(id)
        on delete set null;
    end if;
  end if;
end $$;
