-- Bullamon Plains app -- Supabase setup
-- Run this once in your Supabase project: Dashboard -> SQL Editor -> New query -> paste all of this -> Run.

-- One table holds the entire app's data as a single JSON document, in one
-- row (id = 'main'). Every section of the app (jobs, machinery, chemicals,
-- team, etc.) lives inside that one JSON blob. `version` is a simple
-- counter the app uses to detect when two people save at almost the same
-- time, so one save can never silently overwrite another.
create table if not exists app_state (
  id text primary key,
  data jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

-- Row Level Security: this app has no real login system (staff just pick
-- their name + an optional code, checked in the browser) -- so, matching
-- that same level of trust, anyone with your app's web address can read
-- and write this table through the public API. This is the same trust
-- model the farm was already using; it is NOT the same as leaving your
-- database wide open to the internet at large, since the anon key alone
-- doesn't grant access to anything else. If you want real per-person
-- logins and stricter access later, that's a follow-up upgrade (Supabase
-- Auth), not something this schema forecloses.
alter table app_state enable row level security;

create policy "anyone can read app_state"
  on app_state for select
  using (true);

create policy "anyone can insert app_state"
  on app_state for insert
  with check (true);

create policy "anyone can update app_state"
  on app_state for update
  using (true)
  with check (true);

-- Realtime: lets every open browser tab see changes the moment anyone else
-- saves, with no page reload. Run this once too (safe to re-run).
alter publication supabase_realtime add table app_state;
