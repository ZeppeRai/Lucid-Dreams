-- Lucid Dreams · Mesa Virtual · v0.1
-- Rode no SQL Editor do Supabase (ou via `supabase db push`).

-- ───────────── Tabelas ─────────────
create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  gm_user uuid not null default auth.uid(),
  active_scene uuid,
  created_at timestamptz default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms on delete cascade,
  user_id uuid not null default auth.uid(),
  name text not null,
  role text not null default 'player' check (role in ('gm','player')),
  color text default '#A9ABF7',
  unique (room_id, user_id)
);

create table sheets (
  player_id uuid primary key references players on delete cascade,
  signo text,
  data jsonb not null default '{}'
);

create table scenes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms on delete cascade,
  name text not null,
  image_url text,
  grid int
);

create table tokens (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms on delete cascade,
  scene_id uuid not null references scenes on delete cascade,
  label text not null,
  kind text not null default 'jogador' check (kind in ('jogador','npc','pesadelo')),
  owner_user uuid,
  x real not null default 0.5 check (x between 0 and 1),
  y real not null default 0.5 check (y between 0 and 1),
  size real not null default 0.06,
  image_url text,
  hidden boolean not null default false,
  stats jsonb not null default '{}'
);

create table rolls (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms on delete cascade,
  player_id uuid references players,
  label text,
  dice int[] not null,
  auto int not null default 0,
  successes int not null,
  stumbles int not null default 0,
  difficulty int check (difficulty between 1 and 3),
  secret boolean not null default false,
  created_at timestamptz default now()
);

create index on players (user_id);
create index on rolls (room_id, created_at desc);
create index on tokens (scene_id);

-- ───────────── Funções de apoio ─────────────
create function is_member(r uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from players where room_id = r and user_id = auth.uid())
$$;

create function is_gm(r uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from rooms where id = r and gm_user = auth.uid())
$$;

create function player_room(p uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select room_id from players where id = p
$$;

-- Código de 5 letras sem as confusas (O, 0, I, 1).
create function gen_room_code() returns text
language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text;
begin
  loop
    result := '';
    for i in 1..5 loop
      result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from rooms where code = result);
  end loop;
  return result;
end $$;

-- Criar mesa: sala + jogador mestre, atomicamente.
create function create_room(p_name text, p_color text default '#A9ABF7')
returns rooms
language plpgsql security definer set search_path = public as $$
declare r rooms;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  insert into rooms (code, gm_user) values (gen_room_code(), auth.uid()) returning * into r;
  insert into players (room_id, user_id, name, role, color)
    values (r.id, auth.uid(), p_name, 'gm', p_color);
  return r;
end $$;

-- Entrar na mesa pelo código. Reentrar com o mesmo login só atualiza nome/cor.
create function join_room(p_code text, p_name text, p_color text default '#A9ABF7')
returns players
language plpgsql security definer set search_path = public as $$
declare r rooms; p players;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  select * into r from rooms where code = upper(trim(p_code));
  if not found then raise exception 'sala não encontrada'; end if;
  insert into players (room_id, user_id, name, color)
    values (r.id, auth.uid(), p_name, p_color)
  on conflict (room_id, user_id) do update set name = excluded.name, color = excluded.color
  returning * into p;
  insert into sheets (player_id) values (p.id) on conflict do nothing;
  return p;
end $$;

-- ───────────── Segurança por linha ─────────────
alter table rooms   enable row level security;
alter table players enable row level security;
alter table sheets  enable row level security;
alter table scenes  enable row level security;
alter table tokens  enable row level security;
alter table rolls   enable row level security;

-- Jogadores só entram por create_room/join_room (sem policy de insert),
-- e só nome/cor podem ser editados direto (não dá para virar mestre).
revoke update on players from anon, authenticated;
grant update (name, color) on players to authenticated;

create policy rooms_ler    on rooms for select using (is_member(id));
create policy rooms_editar on rooms for update using (gm_user = auth.uid());

create policy players_ler    on players for select using (is_member(room_id));
create policy players_editar on players for update using (user_id = auth.uid());

-- Ficha: dono e mestre. Leitura pública (signo, Lucidez) virá numa view na v0.2.
create policy sheets_ler on sheets for select
  using (is_gm(player_room(player_id))
         or exists (select 1 from players p where p.id = player_id and p.user_id = auth.uid()));
create policy sheets_editar on sheets for update
  using (is_gm(player_room(player_id))
         or exists (select 1 from players p where p.id = player_id and p.user_id = auth.uid()));

create policy scenes_ler    on scenes for select using (is_member(room_id));
create policy scenes_criar  on scenes for insert with check (is_gm(room_id));
create policy scenes_editar on scenes for update using (is_gm(room_id));
create policy scenes_apagar on scenes for delete using (is_gm(room_id));

create policy tokens_ler    on tokens for select
  using (is_member(room_id) and (not hidden or is_gm(room_id)));
create policy tokens_criar  on tokens for insert with check (is_gm(room_id));
create policy tokens_mover  on tokens for update
  using (is_gm(room_id) or owner_user = auth.uid());
create policy tokens_apagar on tokens for delete using (is_gm(room_id));

-- Não-mestre só muda x e y do próprio token.
create function tokens_limitar_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_gm(old.room_id) then
    new := row(old.id, old.room_id, old.scene_id, old.label, old.kind, old.owner_user,
               new.x, new.y, old.size, old.image_url, old.hidden, old.stats)::tokens;
  end if;
  return new;
end $$;
create trigger tokens_limitar before update on tokens
  for each row execute function tokens_limitar_update();

create policy rolls_ler on rolls for select
  using (is_member(room_id) and (not secret or is_gm(room_id)));
create policy rolls_criar on rolls for insert
  with check (
    is_member(room_id)
    and (player_id is null or exists (select 1 from players p where p.id = player_id and p.user_id = auth.uid()))
    and (not secret or is_gm(room_id))
  );

-- ───────────── Realtime ─────────────
alter publication supabase_realtime add table rolls, players, tokens, sheets, rooms;
