-- One shop book per signed-in person. The client sends updated_at so two
-- devices can merge offline edits; the app keeps the newer timestamp.

create table public.shop_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  shop_name text not null,
  opening_balance_paise bigint not null,
  setup_date date not null,
  updated_at timestamptz not null,
  extra jsonb
);

create table public.transactions (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  type text not null check (type in ('income', 'expense')),
  title text not null,
  amount_paise bigint not null check (amount_paise > 0),
  occurred_on date not null,
  payment text not null,
  note text not null default '',
  category text not null default 'other',
  updated_at timestamptz not null,
  deleted_at timestamptz,
  extra jsonb,
  primary key (user_id, id)
);

create index transactions_user_updated_idx on public.transactions (user_id, updated_at);

alter table public.shop_profiles enable row level security;
alter table public.transactions enable row level security;

create policy shop_profiles_own on public.shop_profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy transactions_own on public.transactions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
