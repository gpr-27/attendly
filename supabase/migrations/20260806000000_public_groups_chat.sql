-- Public searchable groups + membership + group chat (Attendly v1)
--
-- Follows the existing Attendly cloud pattern (see src/lib/supabase/clerk-identity.ts):
-- Clerk is the only identity provider. Next.js API routes resolve `clerk_user_id`
-- from `auth()` and talk to Supabase with the service-role key only. RLS is enabled
-- with NO anon/authenticated policies, so the public Data API cannot read or write
-- these tables directly — only the server-side service-role client can, and every
-- server query still filters by the Clerk-derived clerk_user_id / membership.
--
-- Scope (v1): public group directory + join/leave + text-only group chat.
-- No DMs, no attendance data, no file uploads/reactions.

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- groups
-- ---------------------------------------------------------------------------
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  institution text,
  created_by text not null,
  is_public boolean not null default true,
  member_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint groups_name_length check (char_length(name) between 2 and 80),
  constraint groups_description_length check (char_length(description) <= 500),
  constraint groups_member_count_nonneg check (member_count >= 0)
);

comment on table public.groups is
  'Public, searchable study groups. created_by is a Clerk user id (never a Supabase auth id).';

-- Trigram index powers ILIKE '%q%' search on name; btree covers listing/sorting.
create index if not exists groups_name_trgm_idx
  on public.groups using gin (name gin_trgm_ops);
create index if not exists groups_is_public_created_at_idx
  on public.groups (is_public, created_at desc);

-- ---------------------------------------------------------------------------
-- group_members
-- ---------------------------------------------------------------------------
create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  clerk_user_id text not null,
  role text not null default 'member' check (role in ('member', 'admin')),
  joined_at timestamptz not null default now(),
  primary key (group_id, clerk_user_id)
);

comment on table public.group_members is
  'Membership + role for each Clerk user in a group. Unique per (group_id, clerk_user_id).';

create index if not exists group_members_clerk_user_idx
  on public.group_members (clerk_user_id);

-- ---------------------------------------------------------------------------
-- group_messages
-- ---------------------------------------------------------------------------
create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  clerk_user_id text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint group_messages_body_length check (char_length(body) between 1 and 2000)
);

comment on table public.group_messages is
  'Group chat only — never carries personal attendance data.';

create index if not exists group_messages_group_created_idx
  on public.group_messages (group_id, created_at);

-- ---------------------------------------------------------------------------
-- Keep groups.member_count in sync with group_members (insert/delete only —
-- role changes never touch the count).
-- ---------------------------------------------------------------------------
create or replace function public.groups_sync_member_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.groups
      set member_count = member_count + 1, updated_at = now()
      where id = new.group_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.groups
      set member_count = greatest(member_count - 1, 0), updated_at = now()
      where id = old.group_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists group_members_count_trigger on public.group_members;
create trigger group_members_count_trigger
  after insert or delete on public.group_members
  for each row execute function public.groups_sync_member_count();

-- ---------------------------------------------------------------------------
-- RLS — enabled with no policies. Only the service-role key (used exclusively
-- server-side in src/app/api/groups/**) can read/write. Defense in depth: API
-- routes still scope every query by the Clerk-derived identity/membership.
-- ---------------------------------------------------------------------------
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;
