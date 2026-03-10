-- ============================================================
-- PointCast — Full Database Schema
-- Run this in Supabase SQL Editor to set up everything.
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── PROFILES ──────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  points integer default 1000 not null,
  is_admin boolean default false not null,
  is_banned boolean default false not null,
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

-- Everyone can read profiles
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

-- Users can update their own profile (for points adjustments done via client)
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Admins can update any profile
create policy "Admins can update any profile"
  on public.profiles for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Allow insert for the trigger (runs as service role, but also for safety)
create policy "Service can insert profiles"
  on public.profiles for insert with check (true);


-- ─── AUTO-CREATE PROFILE ON SIGNUP ────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, points, is_admin, is_banned)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || left(new.id::text, 8)),
    1000,
    false,
    false
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ─── MARKETS ──────────────────────────────────────────────
create table public.markets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text default 'Other' not null,
  status text default 'open' not null check (status in ('open', 'closed', 'resolved', 'voided')),
  outcome text,
  options jsonb not null default '["Yes", "No"]'::jsonb,
  created_by uuid references public.profiles(id),
  closes_at timestamptz,
  created_at timestamptz default now() not null,
  resolved_at timestamptz
);

alter table public.markets enable row level security;

-- Everyone can read markets
create policy "Markets are viewable by everyone"
  on public.markets for select using (true);

-- Only admins can insert markets
create policy "Admins can insert markets"
  on public.markets for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Only admins can update markets
create policy "Admins can update markets"
  on public.markets for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Only admins can delete markets
create policy "Admins can delete markets"
  on public.markets for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );


-- ─── BETS ─────────────────────────────────────────────────
create table public.bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  market_id uuid not null references public.markets(id) on delete cascade,
  option text not null,
  amount integer not null check (amount > 0),
  odds_at_placement float,
  status text default 'active' not null check (status in ('active', 'won', 'lost', 'refunded', 'removed')),
  payout integer,
  placed_at timestamptz default now() not null
);

alter table public.bets enable row level security;

-- Users can read all bets (needed for odds calculation + market bet tables)
create policy "Bets are viewable by everyone"
  on public.bets for select using (true);

-- Users can insert their own bets
create policy "Users can insert own bets"
  on public.bets for insert with check (auth.uid() = user_id);

-- Admins can update any bet (for resolution / removal)
create policy "Admins can update bets"
  on public.bets for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Users can read their own bets (redundant with above but explicit)
create policy "Users can read own bets"
  on public.bets for select using (auth.uid() = user_id);


-- ─── TRANSACTIONS ─────────────────────────────────────────
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  type text not null check (type in ('bet_placed', 'payout', 'refund', 'admin_adjustment')),
  amount integer not null,
  reference_id uuid,
  created_at timestamptz default now() not null
);

alter table public.transactions enable row level security;

-- Users can read their own transactions
create policy "Users can read own transactions"
  on public.transactions for select using (auth.uid() = user_id);

-- Admins can read all transactions
create policy "Admins can read all transactions"
  on public.transactions for select using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Users can insert their own transactions (for bet_placed)
create policy "Users can insert own transactions"
  on public.transactions for insert with check (auth.uid() = user_id);

-- Admins can insert any transaction (for payouts, refunds, adjustments)
create policy "Admins can insert any transaction"
  on public.transactions for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );


-- ─── INDEXES ──────────────────────────────────────────────
create index idx_bets_market_id on public.bets(market_id);
create index idx_bets_user_id on public.bets(user_id);
create index idx_bets_status on public.bets(status);
create index idx_markets_status on public.markets(status);
create index idx_markets_category on public.markets(category);
create index idx_transactions_user_id on public.transactions(user_id);


-- ─── ENABLE REALTIME ──────────────────────────────────────
alter publication supabase_realtime add table public.bets;
alter publication supabase_realtime add table public.markets;
