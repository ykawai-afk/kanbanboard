-- ボードテーブル
create table boards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  owner_id uuid references auth.users not null,
  created_at timestamptz default now()
);

-- カラムテーブル
create table columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references boards(id) on delete cascade not null,
  title text not null,
  position float not null default 0,
  created_at timestamptz default now()
);

-- カードテーブル
create table cards (
  id uuid primary key default gen_random_uuid(),
  column_id uuid references columns(id) on delete cascade not null,
  title text not null,
  position float not null default 0,
  created_at timestamptz default now()
);

-- RLS有効化
alter table boards enable row level security;
alter table columns enable row level security;
alter table cards enable row level security;

-- 認証済みユーザーは全操作可能（最小構成）
create policy "boards_all" on boards for all to authenticated using (true) with check (true);
create policy "columns_all" on columns for all to authenticated using (true) with check (true);
create policy "cards_all" on cards for all to authenticated using (true) with check (true);

-- Realtimeを有効化
alter publication supabase_realtime add table boards;
alter publication supabase_realtime add table columns;
alter publication supabase_realtime add table cards;
