-- Omnia Credentials — isolation stricte des prévisualisations Super Admin
-- et stockage public contrôlé des images de modèles de badges.
-- Réexécutable sans supprimer les fichiers de badges existants.

-- Un compte Super Admin ne doit jamais conserver le rôle apprenant. Les
-- prévisualisations utilisent uniquement la session Super Admin existante.
delete from public.user_roles learner_role
where learner_role.role = 'apprenant'
  and exists (
    select 1
    from public.user_roles admin_role
    where admin_role.user_id = learner_role.user_id
      and admin_role.role = 'super_admin'
  );

-- Nettoyage des CLR et Skills Passports créés par les anciennes
-- prévisualisations avec le compte Super Admin. Les tables dépendantes sont
-- supprimées par leurs clés étrangères ON DELETE CASCADE.
delete from public.skills_passports passport
where exists (
  select 1 from public.user_roles admin_role
  where admin_role.user_id = passport.user_id
    and admin_role.role = 'super_admin'
);

delete from public.clr_records record
where exists (
  select 1 from public.user_roles admin_role
  where admin_role.user_id = record.user_id
    and admin_role.role = 'super_admin'
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'credential-assets',
  'credential-assets',
  true,
  5242880,
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Les écritures passent exclusivement par l'Edge Function credentials avec
-- la service role. Les clients n'obtiennent aucune permission d'écriture.
drop policy if exists "credential_assets_public_read" on storage.objects;
create policy "credential_assets_public_read"
on storage.objects for select
to public
using (bucket_id = 'credential-assets');
