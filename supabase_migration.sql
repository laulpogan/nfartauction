-- Modern Art Auction Game Schema
-- Run this in your Supabase SQL editor

-- Games table: holds full public game state as JSONB
create table if not exists ma_games (
  id uuid primary key,
  code text unique not null,
  state jsonb not null default '{}',
  created_at timestamptz default now()
);

-- Players table: holds private player data (hand, money, paintings)
create table if not exists ma_players (
  id uuid primary key,
  game_id uuid not null references ma_games(id) on delete cascade,
  session_id text not null,
  display_name text not null,
  position integer not null default 0,
  money integer not null default 100000,
  hand jsonb not null default '[]',
  paintings jsonb not null default '[]',
  is_host boolean not null default false,
  created_at timestamptz default now(),
  unique(game_id, session_id)
);

-- Indexes
create index if not exists ma_games_code_idx on ma_games(code);
create index if not exists ma_players_game_idx on ma_players(game_id);
create index if not exists ma_players_session_idx on ma_players(game_id, session_id);

-- Enable Row Level Security (open for now — trust-based friends game)
alter table ma_games enable row level security;
alter table ma_players enable row level security;

-- Policies: allow all operations (no auth required)
create policy "Allow all on ma_games" on ma_games for all using (true) with check (true);
create policy "Allow all on ma_players" on ma_players for all using (true) with check (true);

-- Enable Realtime for the games table
alter publication supabase_realtime add table ma_games;
alter publication supabase_realtime add table ma_players;
