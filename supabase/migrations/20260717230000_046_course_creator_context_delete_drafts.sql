-- Séparation stricte des formations Professeur / Structure / Super Admin
alter table public.courses add column if not exists creator_context text;
alter table public.courses add column if not exists structure_id uuid;

update public.courses
set creator_context = 'professeur'
where creator_context is null;

alter table public.courses alter column creator_context set default 'professeur';
alter table public.courses alter column creator_context set not null;

do $$ begin
  alter table public.courses add constraint courses_creator_context_check
    check (creator_context in ('professeur','structure','super_admin'));
exception when duplicate_object then null; end $$;

create index if not exists idx_courses_creator_context on public.courses(creator_id, creator_context, updated_at desc);
create index if not exists idx_courses_structure_id on public.courses(structure_id) where structure_id is not null;
