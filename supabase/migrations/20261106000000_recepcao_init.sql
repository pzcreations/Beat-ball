-- =============================================================================
-- Recepção — esquema inicial
-- -----------------------------------------------------------------------------
-- Princípios:
--   * Toda regra de acesso é imposta AQUI (RLS + grants + triggers), e não só
--     na interface. Mesmo que alguém manipule o frontend ou chame a API do
--     Supabase diretamente, o banco recusa o que o perfil não pode fazer.
--   * O papel (role) de um usuário nunca vem de dados que ele mesmo controla.
--   * Campos de responsabilidade (quem/quando) são preenchidos por triggers,
--     nunca pelo cliente.
--   * Toda alteração de dados pessoais e de permissões gera registro em
--     audit_log, gravado por triggers SECURITY DEFINER (o cliente não escreve
--     diretamente nessa tabela).
-- =============================================================================

-- Extensões (no Supabase ficam no schema "extensions")
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('recepcao', 'gestor');

-- Função imutável para remover acentos (necessária em coluna gerada/índice).
create or replace function public.f_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1)
$$;

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------

-- Perfil de cada usuário do sistema (1:1 com auth.users).
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  email            text not null,
  full_name        text not null
                   check (char_length(full_name) between 2 and 120
                          and full_name !~ '[[:cntrl:]]'),
  role             public.app_role not null default 'recepcao',
  -- Permissão concedida pelo gestor para a recepção consultar TODOS os
  -- cadastros (sem ela, a recepção vê apenas os cadastros que ela mesma fez).
  can_view_records boolean not null default false,
  -- Usuários novos nascem inativos; só ficam ativos quando provisionados
  -- pelo gestor (via app_metadata, que só o servidor pode definir).
  active           boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.profiles is 'Usuários do sistema, papel e permissões.';
comment on column public.profiles.can_view_records is
  'Se verdadeiro, um usuário da recepção pode consultar todos os cadastros.';

-- Pessoas cadastradas pela recepção. LGPD: somente nome e número.
create table public.pessoas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null
              check (char_length(nome) between 3 and 120
                     and nome = btrim(nome)
                     and nome !~ '[[:cntrl:]]'),
  numero      text not null check (numero ~ '^[0-9]{3,20}$'),
  -- Nome normalizado (minúsculo e sem acentos) para busca.
  nome_busca  text generated always as (lower(public.f_unaccent(nome))) stored,
  created_at  timestamptz not null default now(),
  -- RESTRICT: quem fez cadastros não pode ser apagado, apenas desativado.
  created_by  uuid not null references public.profiles (id) on delete restrict,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id) on delete set null
);

comment on table public.pessoas is 'Pessoas registradas na recepção.';

create index pessoas_created_at_idx on public.pessoas (created_at desc);
create index pessoas_created_by_idx on public.pessoas (created_by, created_at desc);
create index pessoas_numero_idx     on public.pessoas (numero text_pattern_ops);
create index pessoas_nome_busca_trgm_idx
  on public.pessoas using gin (nome_busca extensions.gin_trgm_ops);

-- Histórico de alterações e ações administrativas (somente leitura para o
-- gestor; escrito apenas por triggers e funções SECURITY DEFINER).
create table public.audit_log (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  actor_id     uuid references public.profiles (id) on delete set null,
  action       text not null check (action in (
                 'pessoa.criada', 'pessoa.editada', 'pessoa.excluida',
                 'usuario.criado', 'usuario.editado', 'usuario.senha_redefinida',
                 'sessao.login', 'sessao.logout',
                 'dados.exportados')),
  entity       text not null check (entity in ('pessoa', 'usuario', 'sessao', 'exportacao')),
  entity_id    text,
  details      jsonb not null default '{}'::jsonb
);

comment on table public.audit_log is 'Trilha de auditoria. Não editável pelos clientes.';

create index audit_log_occurred_at_idx on public.audit_log (occurred_at desc);
create index audit_log_actor_idx       on public.audit_log (actor_id, occurred_at desc);
create index audit_log_entity_idx      on public.audit_log (entity, occurred_at desc);

-- -----------------------------------------------------------------------------
-- Funções auxiliares de autorização (SECURITY DEFINER para evitar recursão de
-- RLS em profiles; retornam apenas booleanos sobre o PRÓPRIO usuário).
-- -----------------------------------------------------------------------------
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.active
  );
$$;

create or replace function public.is_gestor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.active and p.role = 'gestor'
  );
$$;

create or replace function public.can_view_all_pessoas()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.active
      and (p.role = 'gestor' or p.can_view_records)
  );
$$;

-- -----------------------------------------------------------------------------
-- Triggers: pessoas
-- -----------------------------------------------------------------------------
create or replace function public.pessoas_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Normaliza espaços do nome.
  new.nome := regexp_replace(btrim(new.nome), '\s+', ' ', 'g');

  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := auth.uid();      -- nunca confia no valor do cliente
    new.updated_at := new.created_at;
    new.updated_by := null;
  else
    -- Campos de origem são imutáveis.
    new.id         := old.id;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger pessoas_before_write
  before insert or update on public.pessoas
  for each row execute function public.pessoas_before_write();

create or replace function public.pessoas_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'pessoa.criada', 'pessoa', new.id::text,
            jsonb_build_object('depois', jsonb_build_object('nome', new.nome, 'numero', new.numero)));
    return new;
  elsif tg_op = 'UPDATE' then
    if (new.nome, new.numero) is distinct from (old.nome, old.numero) then
      insert into public.audit_log (actor_id, action, entity, entity_id, details)
      values (auth.uid(), 'pessoa.editada', 'pessoa', new.id::text,
              jsonb_build_object(
                'antes',  jsonb_build_object('nome', old.nome, 'numero', old.numero),
                'depois', jsonb_build_object('nome', new.nome, 'numero', new.numero)));
    end if;
    return new;
  else
    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'pessoa.excluida', 'pessoa', old.id::text,
            jsonb_build_object('antes', jsonb_build_object('nome', old.nome, 'numero', old.numero)));
    return old;
  end if;
end;
$$;

create trigger pessoas_audit
  after insert or update or delete on public.pessoas
  for each row execute function public.pessoas_audit();

-- -----------------------------------------------------------------------------
-- Triggers: profiles
-- -----------------------------------------------------------------------------

-- Cria o perfil quando um usuário é criado no Supabase Auth.
-- Papel/ativação vêm SOMENTE de raw_app_meta_data, que apenas a service role
-- (servidor) consegue definir. user_metadata é controlado pelo próprio usuário
-- e por isso é usado apenas para o nome de exibição.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta        jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  v_name        text  := regexp_replace(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '\s+', ' ', 'g');
  v_role        public.app_role := case when v_meta ->> 'app_role' = 'gestor'
                                        then 'gestor'::public.app_role
                                        else 'recepcao'::public.app_role end;
  v_provisioned boolean := coalesce((v_meta ->> 'provisioned') = 'true', false);
  v_can_view    boolean := coalesce((v_meta ->> 'can_view_records') = 'true', false);
  v_actor       uuid;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    v_name := 'Usuário';
  end if;

  insert into public.profiles (id, email, full_name, role, can_view_records, active)
  values (new.id, coalesce(new.email, ''), v_name, v_role, v_can_view, v_provisioned);

  -- Quem provisionou (definido pelo servidor após verificar que é gestor).
  if (v_meta ->> 'provisioned_by') ~ '^[0-9a-fA-F-]{36}$' then
    select p.id into v_actor from public.profiles p
    where p.id = (v_meta ->> 'provisioned_by')::uuid;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (v_actor, 'usuario.criado', 'usuario', new.id::text,
          jsonb_build_object('nome', v_name, 'email', new.email,
                             'perfil', v_role, 'ativo', v_provisioned,
                             'pode_consultar', v_can_view));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mantém o e-mail do perfil sincronizado com o Auth.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- Proteção de campos privilegiados e do "último gestor".
create or replace function public.profiles_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.id         := old.id;
  new.created_at := old.created_at;
  new.full_name  := regexp_replace(btrim(new.full_name), '\s+', ' ', 'g');

  -- auth.uid() não nulo = requisição de um usuário final pela API.
  -- (SQL Editor / service role / triggers do Auth não têm auth.uid()).
  if auth.uid() is not null then
    if new.email is distinct from old.email then
      raise exception 'O e-mail não pode ser alterado por aqui.' using errcode = '42501';
    end if;

    if (new.role, new.can_view_records, new.active)
       is distinct from (old.role, old.can_view_records, old.active)
       and not public.is_gestor() then
      raise exception 'Permissão insuficiente.' using errcode = '42501';
    end if;
  end if;

  -- Sempre deve existir pelo menos um gestor ativo.
  if old.role = 'gestor' and old.active
     and (new.role <> 'gestor' or not new.active) then
    -- serializa verificações concorrentes
    perform pg_advisory_xact_lock(hashtext('recepcao.profiles.gestor_guard'));
    if not exists (
      select 1 from public.profiles p
      where p.role = 'gestor' and p.active and p.id <> old.id
    ) then
      raise exception 'É necessário manter ao menos um gestor ativo.' using errcode = 'P0001';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_before_update
  before update on public.profiles
  for each row execute function public.profiles_before_update();

create or replace function public.profiles_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes jsonb := '{}'::jsonb;
begin
  if new.full_name is distinct from old.full_name then
    v_changes := v_changes || jsonb_build_object('nome', jsonb_build_object('antes', old.full_name, 'depois', new.full_name));
  end if;
  if new.role is distinct from old.role then
    v_changes := v_changes || jsonb_build_object('perfil', jsonb_build_object('antes', old.role, 'depois', new.role));
  end if;
  if new.can_view_records is distinct from old.can_view_records then
    v_changes := v_changes || jsonb_build_object('pode_consultar', jsonb_build_object('antes', old.can_view_records, 'depois', new.can_view_records));
  end if;
  if new.active is distinct from old.active then
    v_changes := v_changes || jsonb_build_object('ativo', jsonb_build_object('antes', old.active, 'depois', new.active));
  end if;

  if v_changes <> '{}'::jsonb then
    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'usuario.editado', 'usuario', new.id::text,
            jsonb_build_object('alteracoes', v_changes, 'email', new.email));
  end if;
  return new;
end;
$$;

create trigger profiles_audit
  after update on public.profiles
  for each row execute function public.profiles_audit();

-- -----------------------------------------------------------------------------
-- RPCs
-- -----------------------------------------------------------------------------

-- Indicadores do painel do gestor (dados reais; acesso exclusivo do gestor).
create or replace function public.dashboard_stats(p_tz text default 'America/Sao_Paulo')
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_today date;
  v_result jsonb;
begin
  if not public.is_gestor() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz) then
    raise exception 'Fuso horário inválido.' using errcode = '22023';
  end if;

  v_today := (now() at time zone p_tz)::date;

  select jsonb_build_object(
           'total',          count(*),
           'hoje',           count(*) filter (where (p.created_at at time zone p_tz)::date = v_today),
           'ultimos_7_dias', count(*) filter (where (p.created_at at time zone p_tz)::date > v_today - 7),
           'mes',            count(*) filter (where date_trunc('month', p.created_at at time zone p_tz)
                                                    = date_trunc('month', v_today::timestamp))
         )
    into v_result
    from public.pessoas p;

  v_result := v_result || jsonb_build_object(
    'serie', (
      select coalesce(jsonb_agg(jsonb_build_object('dia', d.dia, 'total', coalesce(c.n, 0)) order by d.dia), '[]'::jsonb)
      from (select (v_today - g)::date as dia from generate_series(0, 29) g) d
      left join (
        select (p.created_at at time zone p_tz)::date as dia, count(*) as n
        from public.pessoas p
        where p.created_at >= ((v_today - 29)::timestamp at time zone p_tz)
        group by 1
      ) c on c.dia = d.dia
    ),
    'por_usuario_mes', (
      select coalesce(jsonb_agg(jsonb_build_object('nome', x.full_name, 'total', x.n) order by x.n desc, x.full_name), '[]'::jsonb)
      from (
        select pr.full_name, count(*) as n
        from public.pessoas p
        join public.profiles pr on pr.id = p.created_by
        where date_trunc('month', p.created_at at time zone p_tz) = date_trunc('month', v_today::timestamp)
        group by pr.full_name
        order by n desc, pr.full_name
        limit 5
      ) x
    )
  );

  return v_result;
end;
$$;

-- Registro explícito de eventos que não passam por tabelas (login, logout,
-- exportação, redefinição de senha). Valida o tipo de evento e o perfil.
create or replace function public.registrar_evento(
  p_action    text,
  p_entity_id text  default null,
  p_details   jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  if p_details is null or pg_catalog.pg_column_size(p_details) > 4096
     or jsonb_typeof(p_details) <> 'object' then
    raise exception 'Detalhes inválidos.' using errcode = '22023';
  end if;

  if p_action in ('sessao.login', 'sessao.logout') then
    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (v_uid, p_action, 'sessao', v_uid::text, '{}'::jsonb);

  elsif p_action = 'dados.exportados' then
    if not public.is_gestor() then
      raise exception 'Acesso negado.' using errcode = '42501';
    end if;
    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (v_uid, p_action, 'exportacao', null, p_details);

  elsif p_action = 'usuario.senha_redefinida' then
    if not public.is_gestor() then
      raise exception 'Acesso negado.' using errcode = '42501';
    end if;
    if p_entity_id is null or not exists (select 1 from public.profiles where id::text = p_entity_id) then
      raise exception 'Usuário inválido.' using errcode = '22023';
    end if;
    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (v_uid, p_action, 'usuario', p_entity_id, '{}'::jsonb);

  else
    raise exception 'Evento inválido.' using errcode = '22023';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles  enable row level security;
alter table public.pessoas   enable row level security;
alter table public.audit_log enable row level security;

-- Força RLS inclusive para o dono das tabelas (exceto superusuário/bypassrls).
alter table public.profiles  force row level security;
alter table public.pessoas   force row level security;
alter table public.audit_log force row level security;

-- profiles ---------------------------------------------------------------
create policy "profiles: ver o próprio perfil ou gestor vê todos"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_gestor()));

create policy "profiles: atualizar o próprio nome ou gestor atualiza todos"
  on public.profiles for update to authenticated
  using ((id = (select auth.uid()) and (select public.is_active_user())) or (select public.is_gestor()))
  with check ((id = (select auth.uid()) and (select public.is_active_user())) or (select public.is_gestor()));
-- (Mudanças de papel/permissão/ativação por não-gestores são barradas pelo
--  trigger profiles_before_update.)

-- pessoas ----------------------------------------------------------------
create policy "pessoas: consulta conforme permissão"
  on public.pessoas for select to authenticated
  using (
    (select public.can_view_all_pessoas())
    or (created_by = (select auth.uid()) and (select public.is_active_user()))
  );

create policy "pessoas: usuários ativos cadastram em seu próprio nome"
  on public.pessoas for insert to authenticated
  with check ((select public.is_active_user()) and created_by = (select auth.uid()));

create policy "pessoas: somente gestor edita"
  on public.pessoas for update to authenticated
  using ((select public.is_gestor()))
  with check ((select public.is_gestor()));

create policy "pessoas: somente gestor exclui"
  on public.pessoas for delete to authenticated
  using ((select public.is_gestor()));

-- audit_log --------------------------------------------------------------
create policy "audit_log: somente gestor consulta"
  on public.audit_log for select to authenticated
  using ((select public.is_gestor()));
-- Sem políticas de INSERT/UPDATE/DELETE: o cliente não escreve no histórico.

-- -----------------------------------------------------------------------------
-- Privilégios (defesa em profundidade, além do RLS)
-- -----------------------------------------------------------------------------
revoke all on public.profiles, public.pessoas, public.audit_log from anon, authenticated, public;

grant select on public.profiles to authenticated;
grant update (full_name, role, can_view_records, active) on public.profiles to authenticated;

grant select, delete on public.pessoas to authenticated;
grant insert (nome, numero) on public.pessoas to authenticated;
grant update (nome, numero) on public.pessoas to authenticated;

grant select on public.audit_log to authenticated;

grant all on public.profiles, public.pessoas, public.audit_log to service_role;

-- Funções: ninguém executa por padrão; liberamos apenas o necessário.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.f_unaccent(text)                    to authenticated, service_role;
grant execute on function public.is_active_user()                    to authenticated, service_role;
grant execute on function public.is_gestor()                         to authenticated, service_role;
grant execute on function public.can_view_all_pessoas()              to authenticated, service_role;
grant execute on function public.dashboard_stats(text)               to authenticated;
grant execute on function public.registrar_evento(text, text, jsonb) to authenticated;

-- Novas funções criadas no futuro não ficam executáveis por anon automaticamente.
alter default privileges in schema public revoke execute on functions from public, anon;
