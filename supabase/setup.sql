-- =====================================================================
-- Palestra: database per il salvataggio online, le foto e le notifiche.
--
-- Come si usa: su supabase.com apri il progetto, poi SQL Editor, New query,
-- incolla TUTTO questo file e premi Run. Si può rieseguire quando vuoi: non cancella i dati.
-- La tabella "stato" della versione precedente (se c'è) non viene toccata: l'app la legge una volta
-- per recuperare i vecchi dati.
-- =====================================================================

-- Estensioni: pg_cron (lavori programmati) e pg_net (chiamate HTTP dal database).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Ora attuale in millisecondi (come Date.now() del telefono).
create or replace function public.ora_ms() returns bigint
language sql stable set search_path = '' as $$ select (extract(epoch from clock_timestamp()) * 1000)::bigint $$;

-- =====================================================================
-- 1. Dati dell'app: un record per ogni allenamento, pasto, peso, giorno, impostazioni…
--    Vince la modifica più recente (colonna "updated", scritta dal telefono).
--    "server_ts" dice quando il record è arrivato qui: serve ai telefoni per scaricare solo le novità.
-- =====================================================================

create table if not exists public.records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (char_length(kind) between 1 and 40),
  id text not null check (char_length(id) between 1 and 200),
  data jsonb,
  updated bigint not null,
  deleted boolean not null default false,
  server_ts bigint not null default public.ora_ms(),
  primary key (user_id, kind, id)
);
create index if not exists records_novita on public.records (user_id, server_ts, kind, id);

alter table public.records enable row level security;
drop policy if exists "records: leggo i miei" on public.records;
create policy "records: leggo i miei" on public.records for select to authenticated using (user_id = (select auth.uid()));
-- le scritture passano solo da sync_push (sotto), che controlla chi vince

-- Invio dal telefono: tiene la versione più recente di ogni record.
-- Restituisce i record che il server aveva già più nuovi (il telefono li applica: così tutti convergono).
create or replace function public.sync_push(p_righe jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  r jsonb;
  accettati int := 0;
  rifiutati jsonb := '[]'::jsonb;
  srv record;
begin
  if uid is null then raise exception 'Accesso richiesto' using errcode = '42501'; end if;
  if jsonb_typeof(p_righe) is distinct from 'array' then raise exception 'Formato non valido'; end if;
  if jsonb_array_length(p_righe) > 500 then raise exception 'Troppi record in una volta'; end if;

  for r in select value from jsonb_array_elements(p_righe) loop
    if coalesce(r->>'kind', '') = '' or coalesce(r->>'id', '') = '' or (r->>'updated') is null then continue; end if;
    if pg_column_size(r->'data') > 512 * 1024 then raise exception 'Record troppo grande: %/%', r->>'kind', r->>'id'; end if;

    insert into public.records as t (user_id, kind, id, data, updated, deleted, server_ts)
    values (
      uid, r->>'kind', r->>'id',
      case when coalesce((r->>'deleted')::boolean, false) then null else r->'data' end,
      (r->>'updated')::bigint,
      coalesce((r->>'deleted')::boolean, false),
      public.ora_ms()
    )
    on conflict (user_id, kind, id) do update
      set data = excluded.data, updated = excluded.updated, deleted = excluded.deleted, server_ts = excluded.server_ts
      where t.updated < excluded.updated;

    if found then
      accettati := accettati + 1;
    else
      select t.kind, t.id, t.data, t.updated, t.deleted, t.server_ts into srv
        from public.records t where t.user_id = uid and t.kind = r->>'kind' and t.id = r->>'id';
      rifiutati := rifiutati || jsonb_build_object('kind', srv.kind, 'id', srv.id, 'data', srv.data,
        'updated', srv.updated, 'deleted', srv.deleted, 'server_ts', srv.server_ts);
    end if;
  end loop;
  return jsonb_build_object('accettati', accettati, 'rifiutati', rifiutati, 'ora', public.ora_ms());
end $$;

-- Novità dal server, in ordine, a pagine: (server_ts, kind, id) è il segnalibro.
create or replace function public.sync_pull(p_ts bigint default 0, p_kind text default '', p_id text default '', p_limite int default 500)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  righe jsonb;
  n int;
begin
  if uid is null then raise exception 'Accesso richiesto' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('kind', s.kind, 'id', s.id, 'data', s.data, 'updated', s.updated,
           'deleted', s.deleted, 'server_ts', s.server_ts) order by s.server_ts, s.kind, s.id), '[]'::jsonb), count(*)
    into righe, n
    from (
      select t.kind, t.id, t.data, t.updated, t.deleted, t.server_ts
      from public.records t
      where t.user_id = uid and (t.server_ts, t.kind, t.id) > (coalesce(p_ts, 0), coalesce(p_kind, ''), coalesce(p_id, ''))
      order by t.server_ts, t.kind, t.id
      limit least(greatest(coalesce(p_limite, 500), 1), 1000)
    ) s;
  return jsonb_build_object('righe', righe, 'altri', n >= least(greatest(coalesce(p_limite, 500), 1), 1000), 'ora', public.ora_ms());
end $$;

revoke all on function public.sync_push(jsonb) from public, anon;
revoke all on function public.sync_pull(bigint, text, text, int) from public, anon;
grant execute on function public.sync_push(jsonb) to authenticated;
grant execute on function public.sync_pull(bigint, text, text, int) to authenticated;

-- =====================================================================
-- 2. Foto di progresso: spazio privato "foto", ognuno vede solo la propria cartella (il suo id).
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('foto', 'foto', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false;

drop policy if exists "foto: vedo le mie" on storage.objects;
drop policy if exists "foto: carico le mie" on storage.objects;
drop policy if exists "foto: aggiorno le mie" on storage.objects;
drop policy if exists "foto: elimino le mie" on storage.objects;
create policy "foto: vedo le mie" on storage.objects for select to authenticated
  using (bucket_id = 'foto' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "foto: carico le mie" on storage.objects for insert to authenticated
  with check (bucket_id = 'foto' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "foto: aggiorno le mie" on storage.objects for update to authenticated
  using (bucket_id = 'foto' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'foto' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "foto: elimino le mie" on storage.objects for delete to authenticated
  using (bucket_id = 'foto' and (storage.foldername(name))[1] = (select auth.uid()::text));

-- =====================================================================
-- 3. Notifiche push.
--    Il telefono manda i promemoria dei prossimi 14 giorni; ogni 5 secondi il database controlla
--    se ce n'è uno da mandare e chiama la funzione "push", che lo invia all'iPhone.
-- =====================================================================

create table if not exists public.push_config (
  chiave text primary key,
  valore text not null
);
alter table public.push_config enable row level security; -- nessuna regola: la leggono solo il database e le funzioni

-- segreto condiviso tra il database e la funzione "push" (nessuno lo deve conoscere)
insert into public.push_config (chiave, valore)
values ('segreto', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (chiave) do nothing;

create table if not exists public.push_iscrizioni (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  creata timestamptz not null default now(),
  errori int not null default 0
);
alter table public.push_iscrizioni enable row level security;

create table if not exists public.notifiche (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  tag text not null,
  categoria text not null default 'promemoria',
  invio timestamptz not null,
  scade timestamptz not null,
  titolo text not null,
  testo text not null,
  url text not null default './',
  presa timestamptz,
  inviata timestamptz,
  unique (user_id, tag)
);
create index if not exists notifiche_da_inviare on public.notifiche (invio) where inviata is null;
alter table public.notifiche enable row level security;

-- Il telefono si iscrive (o aggiorna l'iscrizione) per ricevere le notifiche.
create or replace function public.push_iscrivi(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Accesso richiesto' using errcode = '42501'; end if;
  if p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000 then raise exception 'Indirizzo non valido'; end if;
  insert into public.push_iscrizioni (endpoint, user_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, errori = 0;
end $$;

create or replace function public.push_disiscrivi(p_endpoint text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_iscrizioni where endpoint = p_endpoint and user_id = auth.uid();
$$;

-- Sostituisce i promemoria non ancora inviati con quelli nuovi calcolati dal telefono.
create or replace function public.push_programma(p_lista jsonb, p_da timestamptz default now(), p_a timestamptz default now() + interval '15 days')
returns int language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  if uid is null then raise exception 'Accesso richiesto' using errcode = '42501'; end if;
  if jsonb_typeof(p_lista) is distinct from 'array' or jsonb_array_length(p_lista) > 600 then raise exception 'Lista non valida'; end if;
  delete from public.notifiche
    where user_id = uid and inviata is null and categoria not in ('recupero', 'prova');
  insert into public.notifiche (user_id, tag, categoria, invio, scade, titolo, testo, url)
  select uid, x->>'tag', coalesce(nullif(x->>'categoria', ''), 'promemoria'),
         (x->>'invio')::timestamptz, coalesce((x->>'scade')::timestamptz, (x->>'invio')::timestamptz + interval '30 minutes'),
         left(x->>'titolo', 120), left(x->>'testo', 300), coalesce(nullif(x->>'url', ''), './')
  from jsonb_array_elements(p_lista) x
  where coalesce(x->>'tag', '') <> '' and (x->>'invio')::timestamptz > now()
    and coalesce(x->>'categoria', '') not in ('recupero', 'prova')
  on conflict (user_id, tag) do nothing; -- già inviato prima: non lo rimando
  get diagnostics n = row_count;
  return n;
end $$;

-- Recupero tra le serie: una sola notifica "recupero" alla volta.
create or replace function public.push_recupero(p_notifica jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Accesso richiesto' using errcode = '42501'; end if;
  delete from public.notifiche where user_id = uid and tag = 'recupero';
  insert into public.notifiche (user_id, tag, categoria, invio, scade, titolo, testo, url)
  values (uid, 'recupero', 'recupero', (p_notifica->>'invio')::timestamptz,
          coalesce((p_notifica->>'scade')::timestamptz, (p_notifica->>'invio')::timestamptz + interval '2 minutes'),
          left(coalesce(p_notifica->>'titolo', 'Recupero finito'), 120), left(coalesce(p_notifica->>'testo', ''), 300),
          coalesce(nullif(p_notifica->>'url', ''), './#allenamento'));
end $$;

create or replace function public.push_annulla_recupero()
returns void language sql security definer set search_path = '' as $$
  delete from public.notifiche where user_id = auth.uid() and tag = 'recupero' and inviata is null;
$$;

-- Notifica di prova (arriva in pochi secondi).
create or replace function public.push_prova()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Accesso richiesto' using errcode = '42501'; end if;
  delete from public.notifiche where user_id = uid and tag = 'prova';
  insert into public.notifiche (user_id, tag, categoria, invio, scade, titolo, testo, url)
  values (uid, 'prova', 'prova', now(), now() + interval '10 minutes', 'Palestra', 'Le notifiche funzionano.', './');
end $$;

revoke all on function public.push_iscrivi(text, text, text) from public, anon;
revoke all on function public.push_disiscrivi(text) from public, anon;
revoke all on function public.push_programma(jsonb, timestamptz, timestamptz) from public, anon;
revoke all on function public.push_recupero(jsonb) from public, anon;
revoke all on function public.push_annulla_recupero() from public, anon;
revoke all on function public.push_prova() from public, anon;
grant execute on function public.push_iscrivi(text, text, text) to authenticated;
grant execute on function public.push_disiscrivi(text) to authenticated;
grant execute on function public.push_programma(jsonb, timestamptz, timestamptz) to authenticated;
grant execute on function public.push_recupero(jsonb) to authenticated;
grant execute on function public.push_annulla_recupero() to authenticated;
grant execute on function public.push_prova() to authenticated;

-- ---------- solo per la funzione "push" (chiave di servizio) ----------

-- Prende le notifiche da inviare (le segna come "prese" così due invii non le mandano due volte).
create or replace function public.push_da_inviare(p_limite int default 100)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare out jsonb;
begin
  -- scadute senza essere partite (es. funzione ferma): non le mando più
  update public.notifiche set inviata = now() where inviata is null and scade < now();
  with prese as (
    select n.id from public.notifiche n
    where n.inviata is null and n.invio <= now() and (n.presa is null or n.presa < now() - interval '2 minutes')
    order by n.invio
    limit least(greatest(p_limite, 1), 500)
    for update skip locked
  ), aggiornate as (
    update public.notifiche n set presa = now() from prese where n.id = prese.id
    returning n.id, n.user_id, n.tag, n.categoria, n.titolo, n.testo, n.url, n.scade
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'tag', a.tag, 'categoria', a.categoria, 'titolo', a.titolo, 'testo', a.testo, 'url', a.url, 'scade', a.scade,
    'iscrizioni', coalesce((select jsonb_agg(jsonb_build_object('endpoint', i.endpoint, 'p256dh', i.p256dh, 'auth', i.auth))
                            from public.push_iscrizioni i where i.user_id = a.user_id), '[]'::jsonb))), '[]'::jsonb)
    into out from aggiornate a;
  return out;
end $$;

create or replace function public.push_segna_inviate(p_ids bigint[])
returns void language sql security definer set search_path = '' as $$
  update public.notifiche set inviata = now() where id = any(p_ids);
$$;

-- Iscrizione che non funziona più (telefono cambiato, app tolta): la tolgo.
create or replace function public.push_iscrizione_errore(p_endpoint text, p_elimina boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_elimina then delete from public.push_iscrizioni where endpoint = p_endpoint;
  else update public.push_iscrizioni set errori = errori + 1 where endpoint = p_endpoint;
       delete from public.push_iscrizioni where endpoint = p_endpoint and errori >= 20;
  end if;
end $$;

create or replace function public.push_config_leggi()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(chiave, valore), '{}'::jsonb) from public.push_config;
$$;

drop function if exists public.push_config_scrivi(text, text);
create or replace function public.push_config_scrivi(p_chiave text, p_valore text, p_sovrascrivi boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_sovrascrivi then
    insert into public.push_config (chiave, valore) values (p_chiave, p_valore)
    on conflict (chiave) do update set valore = excluded.valore;
  else
    insert into public.push_config (chiave, valore) values (p_chiave, p_valore) on conflict (chiave) do nothing;
  end if;
end $$;

revoke all on function public.push_da_inviare(int) from public, anon, authenticated;
revoke all on function public.push_segna_inviate(bigint[]) from public, anon, authenticated;
revoke all on function public.push_iscrizione_errore(text, boolean) from public, anon, authenticated;
revoke all on function public.push_config_leggi() from public, anon, authenticated;
revoke all on function public.push_config_scrivi(text, text, boolean) from public, anon, authenticated;
grant execute on function public.push_da_inviare(int) to service_role;
grant execute on function public.push_segna_inviate(bigint[]) to service_role;
grant execute on function public.push_iscrizione_errore(text, boolean) to service_role;
grant execute on function public.push_config_leggi() to service_role;
grant execute on function public.push_config_scrivi(text, text, boolean) to service_role;

-- Ogni 5 secondi: se c'è una notifica da mandare, chiamo la funzione "push".
-- L'indirizzo del progetto lo scrive la funzione stessa la prima volta che l'app attiva le notifiche.
create or replace function public.push_tick()
returns void language plpgsql security definer set search_path = '' as $$
declare
  indirizzo text;
  segreto text;
begin
  if not exists (select 1 from public.notifiche where inviata is null and invio <= now()
                 and (presa is null or presa < now() - interval '2 minutes')) then
    return;
  end if;
  select valore into indirizzo from public.push_config where chiave = 'url';
  select valore into segreto from public.push_config where chiave = 'segreto';
  if indirizzo is null or segreto is null then return; end if;
  perform net.http_post(
    url := indirizzo || '/functions/v1/push',
    body := jsonb_build_object('azione', 'invia'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-palestra-segreto', segreto),
    timeout_milliseconds := 25000
  );
end $$;
revoke all on function public.push_tick() from public, anon, authenticated;

select cron.schedule('palestra-notifiche', '5 seconds', 'select public.push_tick()');
select cron.schedule('palestra-pulizia', '17 3 * * *',
  $$delete from public.notifiche where coalesce(inviata, scade) < now() - interval '3 days'$$);

-- =====================================================================
-- 4. AI: un contatore per non spendere troppo (massimo di richieste al giorno per persona).
-- =====================================================================

create table if not exists public.ai_uso (
  user_id uuid not null references auth.users (id) on delete cascade,
  giorno date not null default current_date,
  richieste int not null default 0,
  primary key (user_id, giorno)
);
alter table public.ai_uso enable row level security;

create or replace function public.ai_conta(p_utente uuid, p_massimo int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.ai_uso (user_id, giorno, richieste) values (p_utente, current_date, 1)
  on conflict (user_id, giorno) do update set richieste = public.ai_uso.richieste + 1
  returning richieste into n;
  delete from public.ai_uso where giorno < current_date - 30;
  return n <= p_massimo;
end $$;
revoke all on function public.ai_conta(uuid, int) from public, anon, authenticated;
grant execute on function public.ai_conta(uuid, int) to service_role;

-- Fatto. Ora: Edge Functions "ai" e "push" (vedi PROGRESS.md).
