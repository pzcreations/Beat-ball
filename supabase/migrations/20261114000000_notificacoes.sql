-- =============================================================================
-- Recepção — Fase 3: notificações no celular (Web Push)
-- -----------------------------------------------------------------------------
--  * push_assinaturas: aparelhos de cada gestor que aceitaram notificações.
--  * notificacao_prefs: o que cada gestor deseja receber.
--  * sistema_config: endereço do site, segredo do agendador e chaves VAPID.
--    Acessível SOMENTE pelo servidor (service role) — nunca pelos usuários.
--  * Agendador (pg_cron + pg_net): a cada hora chama o site, que decide o
--    que enviar conforme o horário de São Paulo (7h resumo, 9h atrasos,
--    19h lembretes da véspera).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Configuração do sistema (somente servidor)
-- -----------------------------------------------------------------------------
create table public.sistema_config (
  id            boolean primary key default true check (id),
  site_url      text check (site_url is null or site_url ~ '^https://[a-zA-Z0-9.-]+(:[0-9]+)?$'),
  cron_secret   text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  vapid_public  text,
  vapid_private text,
  vapid_subject text,
  updated_at    timestamptz not null default now()
);
insert into public.sistema_config default values;

-- Controle para não enviar o mesmo aviso agendado duas vezes no mesmo dia.
create table public.notificacoes_enviadas (
  tipo       text not null check (tipo in ('resumo_diario', 'alerta_atraso', 'lembrete_visita')),
  dia        date not null,
  enviado_em timestamptz not null default now(),
  primary key (tipo, dia)
);

-- -----------------------------------------------------------------------------
-- Assinaturas e preferências
-- -----------------------------------------------------------------------------
create table public.push_assinaturas (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  endpoint        text not null unique
                  check (char_length(endpoint) between 20 and 1000 and endpoint like 'https://%'),
  p256dh          text not null check (char_length(p256dh) between 20 and 200),
  auth            text not null check (char_length(auth) between 10 and 100),
  user_agent      text check (user_agent is null or char_length(user_agent) <= 300),
  created_at      timestamptz not null default now(),
  last_success_at timestamptz
);
create index push_assinaturas_user_idx on public.push_assinaturas (user_id);

create table public.notificacao_prefs (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  novo_cadastro   boolean not null default true,
  resumo_diario   boolean not null default true,
  lembrete_visita boolean not null default true,
  alerta_atraso   boolean not null default true,
  updated_at      timestamptz not null default now()
);

create or replace function public.notificacao_prefs_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.user_id := auth.uid();       -- cada um só grava as próprias preferências
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger notificacao_prefs_guard
  before insert or update on public.notificacao_prefs
  for each row execute function public.notificacao_prefs_guard();

-- -----------------------------------------------------------------------------
-- Funções usadas pelo agendador (somente service role)
-- -----------------------------------------------------------------------------
create or replace function public.contar_atrasados(p_tz text default 'America/Sao_Paulo')
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer
  from public.atendimentos a
  join public.etapas e on e.id = a.etapa_id
  where (e.prazo_horas is not null and a.etapa_desde < now() - make_interval(hours => e.prazo_horas))
     or (e.papel = 'visita_agendada' and exists (
           select 1 from public.visitas v
           where v.pessoa_id = a.pessoa_id and v.situacao = 'agendada'
             and (v.agendada_para at time zone p_tz)::date < (now() at time zone p_tz)::date))
$$;

-- Marca um envio agendado; retorna falso se já foi feito hoje.
create or replace function public.marcar_envio(p_tipo text, p_dia date)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notificacoes_enviadas (tipo, dia) values (p_tipo, p_dia);
  return true;
exception when unique_violation then
  return false;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS e privilégios
-- -----------------------------------------------------------------------------
alter table public.sistema_config        enable row level security;
alter table public.notificacoes_enviadas enable row level security;
alter table public.push_assinaturas      enable row level security;
alter table public.notificacao_prefs     enable row level security;
alter table public.sistema_config        force row level security;
alter table public.notificacoes_enviadas force row level security;
alter table public.push_assinaturas      force row level security;
alter table public.notificacao_prefs     force row level security;

-- sistema_config e notificacoes_enviadas: nenhuma política = nenhum acesso
-- para anon/authenticated (apenas service role, que ignora o RLS).

create policy "push: ver e remover os próprios aparelhos" on public.push_assinaturas
  for select to authenticated using (user_id = (select auth.uid()));
create policy "push: remover os próprios aparelhos" on public.push_assinaturas
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "prefs: ver as próprias" on public.notificacao_prefs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "prefs: gestor cria as próprias" on public.notificacao_prefs
  for insert to authenticated with check (user_id = (select auth.uid()) and (select public.is_gestor()));
create policy "prefs: gestor altera as próprias" on public.notificacao_prefs
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select public.is_gestor()));

revoke all on public.sistema_config, public.notificacoes_enviadas, public.push_assinaturas, public.notificacao_prefs
  from anon, authenticated, public;

grant select, delete on public.push_assinaturas to authenticated;
grant select on public.notificacao_prefs to authenticated;
grant insert (novo_cadastro, resumo_diario, lembrete_visita, alerta_atraso) on public.notificacao_prefs to authenticated;
grant update (novo_cadastro, resumo_diario, lembrete_visita, alerta_atraso) on public.notificacao_prefs to authenticated;

grant all on public.sistema_config, public.notificacoes_enviadas, public.push_assinaturas, public.notificacao_prefs
  to service_role;

revoke execute on function public.contar_atrasados(text) from public, anon, authenticated;
revoke execute on function public.marcar_envio(text, date) from public, anon, authenticated;
revoke execute on function public.notificacao_prefs_guard() from public, anon, authenticated;
grant execute on function public.contar_atrasados(text) to service_role;
grant execute on function public.marcar_envio(text, date) to service_role;

-- -----------------------------------------------------------------------------
-- Agendador: a cada hora, avisa o site (que decide o que enviar).
-- Só é criado onde pg_cron e pg_net existem (Supabase). Enquanto o endereço
-- do site não for registrado (o sistema faz isso quando um gestor ativa as
-- notificações), a chamada não acontece.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
    create extension if not exists pg_cron with schema pg_catalog;

    perform cron.unschedule(jobid) from cron.job where jobname = 'recepcao-notificacoes';
    perform cron.schedule(
      'recepcao-notificacoes',
      '0 * * * *',
      $job$
        select net.http_post(
          url := c.site_url || '/api/cron/notificacoes',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || c.cron_secret),
          body := '{}'::jsonb,
          timeout_milliseconds := 25000)
        from public.sistema_config c
        where c.site_url is not null;
      $job$
    );
  else
    raise notice 'pg_cron/pg_net indisponíveis: agendador de notificações não criado.';
  end if;
end $$;
