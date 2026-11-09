-- =============================================================================
-- Recepção — Fase 1: igrejas e acompanhamento pastoral (funil de etapas)
-- -----------------------------------------------------------------------------
--  * igrejas: de qual igreja veio o cadastro (editável pelo gestor).
--  * etapas: funil editável pelo gestor, com tipos fixos que garantem a lógica
--    (inicial, intermediária, concluída, encerrada).
--  * atendimentos: etapa atual de cada pessoa (1:1 com pessoas). A recepção
--    vê apenas a etapa das pessoas que ELA cadastrou.
--  * movimentacoes / contatos: histórico (linha do tempo) — só gestores.
--  * Toda escrita no funil passa por funções que validam papel e transição.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Igrejas
-- -----------------------------------------------------------------------------
create table public.igrejas (
  id         smallint generated always as identity primary key,
  nome       text not null unique
             check (char_length(nome) between 3 and 120 and nome = btrim(nome) and nome !~ '[[:cntrl:]]'),
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.igrejas (nome) values
  ('Igreja Adventista do Planalto'),
  ('Igreja Adventista Central'),
  ('Igreja Adventista Esperança'),
  ('Igreja Adventista Martinho Prado');

alter table public.pessoas
  add column igreja_id smallint references public.igrejas (id) on delete restrict;

-- Obrigatória para todo cadastro novo/alterado (registros antigos preservados).
alter table public.pessoas
  add constraint pessoas_igreja_obrigatoria check (igreja_id is not null) not valid;

create index pessoas_igreja_idx      on public.pessoas (igreja_id, created_at desc);
create index pessoas_numero_nome_idx on public.pessoas (numero, nome_busca);

-- -----------------------------------------------------------------------------
-- Etapas do funil
-- -----------------------------------------------------------------------------
create type public.etapa_tipo as enum ('inicial', 'intermediaria', 'concluida', 'encerrada');

create table public.etapas (
  id          smallint generated always as identity primary key,
  nome        text not null
              check (char_length(nome) between 2 and 60 and nome = btrim(nome) and nome !~ '[[:cntrl:]]'),
  cor         text not null
              check (cor in ('amarelo', 'laranja', 'azul_claro', 'azul', 'marinho', 'lilas', 'verde_agua', 'verde', 'cinza')),
  tipo        public.etapa_tipo not null default 'intermediaria',
  ordem       smallint not null default 100,
  -- Tempo máximo na etapa antes de ficar "atrasado" (nulo = sem prazo).
  prazo_horas integer check (prazo_horas is null or prazo_horas between 1 and 8760),
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Apenas uma etapa de cada tipo especial.
create unique index etapas_tipo_especial_unico on public.etapas (tipo) where tipo <> 'intermediaria';

insert into public.etapas (nome, cor, tipo, ordem, prazo_horas) values
  ('Aguardando contato',       'amarelo',    'inicial',       0,    24),
  ('Aguardando agendamento',   'azul_claro', 'intermediaria', 10,   72),
  ('Visita agendada',          'azul',       'intermediaria', 20,   null),
  ('Visita realizada',         'verde_agua', 'intermediaria', 30,   null),
  ('Acompanhamento concluído', 'verde',      'concluida',     1000, null),
  ('Encerrado',                'cinza',      'encerrada',     2000, null);

-- -----------------------------------------------------------------------------
-- Atendimento (estado atual), movimentações e contatos
-- -----------------------------------------------------------------------------
create table public.atendimentos (
  pessoa_id          uuid primary key references public.pessoas (id) on delete cascade,
  etapa_id           smallint not null references public.etapas (id) on delete restrict,
  etapa_desde        timestamptz not null default now(),
  tentativas_contato integer not null default 0 check (tentativas_contato >= 0),
  updated_at         timestamptz not null default now(),
  updated_by         uuid references public.profiles (id) on delete set null
);
create index atendimentos_etapa_idx on public.atendimentos (etapa_id, etapa_desde);

create table public.movimentacoes (
  id            bigint generated always as identity primary key,
  pessoa_id     uuid not null references public.pessoas (id) on delete cascade,
  de_etapa_id   smallint references public.etapas (id) on delete restrict,
  para_etapa_id smallint not null references public.etapas (id) on delete restrict,
  origem        text not null check (origem in ('cadastro', 'recadastro', 'gestor', 'contato')),
  motivo        text check (motivo is null or motivo in ('sem_resposta', 'nao_deseja', 'mudou_se', 'outro')),
  observacao    text check (observacao is null or char_length(observacao) <= 500),
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id) on delete set null
);
create index movimentacoes_pessoa_idx on public.movimentacoes (pessoa_id, created_at desc);

create table public.contatos (
  id         bigint generated always as identity primary key,
  pessoa_id  uuid not null references public.pessoas (id) on delete cascade,
  canal      text not null check (canal in ('whatsapp', 'ligacao', 'presencial')),
  resultado  text not null check (resultado in ('conversou', 'nao_atendeu', 'nao_deseja')),
  observacao text check (observacao is null or char_length(observacao) <= 500),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null
);
create index contatos_pessoa_idx on public.contatos (pessoa_id, created_at desc);

-- Configurações gerais (linha única).
create table public.configuracoes (
  id                boolean primary key default true check (id),
  mensagem_whatsapp text not null check (char_length(mensagem_whatsapp) between 10 and 1000),
  updated_at        timestamptz not null default now(),
  updated_by        uuid references public.profiles (id) on delete set null
);

insert into public.configuracoes (mensagem_whatsapp) values (
  'Olá, {primeiro_nome}! Graça e paz. Aqui é {gestor}, da {igreja}. Recebemos seu cadastro e ficamos muito felizes com sua visita. Nosso pastor gostaria de ir até sua casa para conhecer você e sua família e fazer uma oração. Qual o melhor dia e horário para você?'
);

-- -----------------------------------------------------------------------------
-- Auditoria: novos tipos de evento
-- -----------------------------------------------------------------------------
alter table public.audit_log drop constraint audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check check (action in (
  'pessoa.criada', 'pessoa.editada', 'pessoa.excluida',
  'pessoa.etapa_alterada', 'pessoa.contato_registrado', 'pessoa.recadastrada',
  'usuario.criado', 'usuario.editado', 'usuario.senha_redefinida',
  'sessao.login', 'sessao.logout',
  'dados.exportados',
  'config.alterada'));

alter table public.audit_log drop constraint audit_log_entity_check;
alter table public.audit_log add constraint audit_log_entity_check
  check (entity in ('pessoa', 'usuario', 'sessao', 'exportacao', 'configuracao'));

-- -----------------------------------------------------------------------------
-- Funções internas (não executáveis pelos clientes)
-- -----------------------------------------------------------------------------
create or replace function public.etapa_inicial_id()
returns smallint language sql stable security definer set search_path = '' as $$
  select id from public.etapas where tipo = 'inicial'
$$;

-- Posição da etapa no funil (inicial → intermediárias por ordem → concluída).
-- Encerrada fica fora da sequência.
create or replace function public.etapa_posicao(p_etapa smallint)
returns integer language sql stable security definer set search_path = '' as $$
  select x.pos::integer from (
    select e.id,
           row_number() over (
             order by case e.tipo when 'inicial' then 0 when 'intermediaria' then 1 else 2 end, e.ordem, e.id
           ) as pos
    from public.etapas e
    where e.tipo <> 'encerrada' and (e.ativo or e.id = p_etapa)
  ) x where x.id = p_etapa
$$;

create or replace function public.etapa_na_posicao(p_pos integer)
returns smallint language sql stable security definer set search_path = '' as $$
  select x.id from (
    select e.id,
           row_number() over (
             order by case e.tipo when 'inicial' then 0 when 'intermediaria' then 1 else 2 end, e.ordem, e.id
           ) as pos
    from public.etapas e
    where e.tipo <> 'encerrada' and e.ativo
  ) x where x.pos = p_pos
$$;

-- Aplica a mudança de etapa (sem validar permissão — chamada só por funções
-- que já validaram) e registra histórico + auditoria.
create or replace function public.aplicar_movimentacao(
  p_pessoa uuid, p_de smallint, p_para smallint, p_origem text, p_motivo text, p_obs text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.movimentacoes (pessoa_id, de_etapa_id, para_etapa_id, origem, motivo, observacao, created_by)
  values (p_pessoa, p_de, p_para, p_origem, p_motivo, nullif(btrim(p_obs), ''), auth.uid());

  if p_de is distinct from p_para then
    update public.atendimentos
       set etapa_id = p_para, etapa_desde = now(), tentativas_contato = 0,
           updated_at = now(), updated_by = auth.uid()
     where pessoa_id = p_pessoa;

    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'pessoa.etapa_alterada', 'pessoa', p_pessoa::text,
            jsonb_build_object(
              'nome',  (select nome from public.pessoas where id = p_pessoa),
              'de',    (select nome from public.etapas where id = p_de),
              'para',  (select nome from public.etapas where id = p_para),
              'motivo', p_motivo,
              'origem', p_origem));
  end if;
end;
$$;

-- Cria o atendimento quando uma pessoa é cadastrada.
create or replace function public.pessoas_criar_atendimento()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_inicial smallint := public.etapa_inicial_id();
begin
  insert into public.atendimentos (pessoa_id, etapa_id, etapa_desde, updated_by)
  values (new.id, v_inicial, new.created_at, auth.uid());
  insert into public.movimentacoes (pessoa_id, de_etapa_id, para_etapa_id, origem, created_at, created_by)
  values (new.id, null, v_inicial, 'cadastro', new.created_at, auth.uid());
  return new;
end;
$$;

create trigger pessoas_criar_atendimento
  after insert on public.pessoas
  for each row execute function public.pessoas_criar_atendimento();

-- Atendimentos para pessoas cadastradas antes desta migração.
insert into public.atendimentos (pessoa_id, etapa_id, etapa_desde)
select p.id, public.etapa_inicial_id(), p.created_at from public.pessoas p
on conflict do nothing;
insert into public.movimentacoes (pessoa_id, de_etapa_id, para_etapa_id, origem, created_at, created_by)
select p.id, null, public.etapa_inicial_id(), 'cadastro', p.created_at, p.created_by from public.pessoas p;

-- Auditoria de edição de pessoa passa a incluir a igreja.
create or replace function public.pessoas_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_igreja_old text;
  v_igreja_new text;
begin
  if tg_op = 'INSERT' then
    select nome into v_igreja_new from public.igrejas where id = new.igreja_id;
    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'pessoa.criada', 'pessoa', new.id::text,
            jsonb_build_object('depois', jsonb_build_object('nome', new.nome, 'numero', new.numero, 'igreja', v_igreja_new)));
    return new;
  elsif tg_op = 'UPDATE' then
    if (new.nome, new.numero, new.igreja_id) is distinct from (old.nome, old.numero, old.igreja_id) then
      select nome into v_igreja_old from public.igrejas where id = old.igreja_id;
      select nome into v_igreja_new from public.igrejas where id = new.igreja_id;
      insert into public.audit_log (actor_id, action, entity, entity_id, details)
      values (auth.uid(), 'pessoa.editada', 'pessoa', new.id::text,
              jsonb_build_object(
                'antes',  jsonb_build_object('nome', old.nome, 'numero', old.numero, 'igreja', v_igreja_old),
                'depois', jsonb_build_object('nome', new.nome, 'numero', new.numero, 'igreja', v_igreja_new)));
    end if;
    return new;
  else
    select nome into v_igreja_old from public.igrejas where id = old.igreja_id;
    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'pessoa.excluida', 'pessoa', old.id::text,
            jsonb_build_object('antes', jsonb_build_object('nome', old.nome, 'numero', old.numero, 'igreja', v_igreja_old)));
    return old;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Proteções das tabelas de configuração
-- -----------------------------------------------------------------------------
create or replace function public.etapas_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and new.tipo <> 'intermediaria' then
      raise exception 'Somente etapas intermediárias podem ser criadas.' using errcode = 'P0001';
    end if;
    new.nome := regexp_replace(btrim(new.nome), '\s+', ' ', 'g');
    return new;
  elsif tg_op = 'UPDATE' then
    new.id := old.id;
    new.tipo := old.tipo;            -- o tipo nunca muda
    new.created_at := old.created_at;
    new.nome := regexp_replace(btrim(new.nome), '\s+', ' ', 'g');
    if not new.ativo and old.ativo then
      if old.tipo <> 'intermediaria' then
        raise exception 'Esta etapa é essencial ao funil e não pode ser desativada.' using errcode = 'P0001';
      end if;
      if exists (select 1 from public.atendimentos where etapa_id = old.id) then
        raise exception 'Há pessoas nesta etapa. Mova-as antes de desativá-la.' using errcode = 'P0001';
      end if;
    end if;
    new.updated_at := now();
    return new;
  else
    if old.tipo <> 'intermediaria' then
      raise exception 'Esta etapa é essencial ao funil e não pode ser excluída.' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.movimentacoes where de_etapa_id = old.id or para_etapa_id = old.id)
       or exists (select 1 from public.atendimentos where etapa_id = old.id) then
      raise exception 'Esta etapa já foi usada. Desative-a em vez de excluir.' using errcode = 'P0001';
    end if;
    return old;
  end if;
end;
$$;

create trigger etapas_guard
  before insert or update or delete on public.etapas
  for each row execute function public.etapas_guard();

create or replace function public.igrejas_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.nome := regexp_replace(btrim(new.nome), '\s+', ' ', 'g');
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create trigger igrejas_guard
  before insert or update on public.igrejas
  for each row execute function public.igrejas_guard();

create or replace function public.configuracoes_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.id := true;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger configuracoes_guard
  before update on public.configuracoes
  for each row execute function public.configuracoes_guard();

-- Auditoria de alterações de configuração feitas por usuários.
create or replace function public.config_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'config.alterada', 'configuracao', tg_table_name,
          jsonb_build_object(
            'tabela', tg_table_name,
            'operacao', lower(tg_op),
            'nome', v_row ->> 'nome'));
  return coalesce(new, old);
end;
$$;

create trigger etapas_audit after insert or update or delete on public.etapas
  for each row execute function public.config_audit();
create trigger igrejas_audit after insert or update on public.igrejas
  for each row execute function public.config_audit();
create trigger configuracoes_audit after update on public.configuracoes
  for each row execute function public.config_audit();

-- -----------------------------------------------------------------------------
-- RPCs públicas (validam papel e regras)
-- -----------------------------------------------------------------------------

-- Cadastro pela recepção/gestor. Se a mesma pessoa (mesmo número E mesmo
-- nome) já existir, reabre o atendimento em vez de duplicar.
create or replace function public.cadastrar_pessoa(p_nome text, p_numero text, p_igreja_id smallint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_nome    text := regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g');
  v_numero  text := regexp_replace(coalesce(p_numero, ''), '\D', '', 'g');
  v_id      uuid;
  v_etapa   smallint;
  v_tipo    public.etapa_tipo;
  v_igreja_existente smallint;
  v_obs     text := 'Novo cadastro na recepção';
begin
  if not public.is_active_user() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.igrejas where id = p_igreja_id and ativo) then
    raise exception 'Selecione uma igreja válida.' using errcode = '22023';
  end if;

  -- Evita duplicidade em cadastros simultâneos do mesmo número.
  perform pg_advisory_xact_lock(hashtext('recepcao.cadastro.' || v_numero));

  select p.id, a.etapa_id, e.tipo, p.igreja_id
    into v_id, v_etapa, v_tipo, v_igreja_existente
    from public.pessoas p
    join public.atendimentos a on a.pessoa_id = p.id
    join public.etapas e on e.id = a.etapa_id
   where p.numero = v_numero
     and p.nome_busca = lower(public.f_unaccent(v_nome))
   order by p.created_at desc
   limit 1;

  if v_id is not null then
    if v_igreja_existente is distinct from p_igreja_id then
      v_obs := v_obs || ' (' || (select nome from public.igrejas where id = p_igreja_id) || ')';
    end if;

    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'pessoa.recadastrada', 'pessoa', v_id::text, jsonb_build_object('nome', v_nome));

    if v_tipo in ('concluida', 'encerrada') then
      perform public.aplicar_movimentacao(v_id, v_etapa, public.etapa_inicial_id(), 'recadastro', null, v_obs);
      return jsonb_build_object('id', v_id, 'situacao', 'reaberto');
    end if;

    perform public.aplicar_movimentacao(v_id, v_etapa, v_etapa, 'recadastro', null, v_obs);
    return jsonb_build_object('id', v_id, 'situacao', 'ja_em_atendimento');
  end if;

  insert into public.pessoas (nome, numero, igreja_id)
  values (v_nome, v_numero, p_igreja_id)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'situacao', 'novo');
end;
$$;

-- Mudança manual de etapa (somente gestor), com regras de transição.
create or replace function public.mover_etapa(
  p_pessoa_id uuid, p_etapa_id smallint, p_motivo text default null, p_observacao text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_atual    smallint;
  v_tipo_at  public.etapa_tipo;
  v_tipo_dst public.etapa_tipo;
  v_ativo    boolean;
begin
  if not public.is_gestor() then
    raise exception 'Somente gestores podem mudar a etapa.' using errcode = '42501';
  end if;
  if p_observacao is not null and char_length(p_observacao) > 500 then
    raise exception 'Observação muito longa.' using errcode = '22023';
  end if;

  select a.etapa_id, e.tipo into v_atual, v_tipo_at
    from public.atendimentos a join public.etapas e on e.id = a.etapa_id
   where a.pessoa_id = p_pessoa_id
   for update of a;
  if v_atual is null then
    raise exception 'Atendimento não encontrado.' using errcode = 'P0001';
  end if;

  select tipo, ativo into v_tipo_dst, v_ativo from public.etapas where id = p_etapa_id;
  if v_tipo_dst is null or not v_ativo then
    raise exception 'Etapa inválida.' using errcode = '22023';
  end if;
  if p_etapa_id = v_atual then
    raise exception 'A pessoa já está nesta etapa.' using errcode = 'P0001';
  end if;

  if v_tipo_dst = 'encerrada' then
    if p_motivo is null or p_motivo not in ('sem_resposta', 'nao_deseja', 'mudou_se', 'outro') then
      raise exception 'Informe o motivo do encerramento.' using errcode = '22023';
    end if;
  elsif v_tipo_dst = 'inicial' and v_tipo_at in ('concluida', 'encerrada') then
    null; -- reabrir
  elsif v_tipo_at = 'encerrada' then
    raise exception 'Para retomar um atendimento encerrado, reabra-o.' using errcode = 'P0001';
  elsif abs(public.etapa_posicao(p_etapa_id) - public.etapa_posicao(v_atual)) <> 1 then
    raise exception 'Só é possível avançar ou voltar uma etapa por vez.' using errcode = 'P0001';
  end if;

  perform public.aplicar_movimentacao(
    p_pessoa_id, v_atual, p_etapa_id, 'gestor',
    case when v_tipo_dst = 'encerrada' then p_motivo end,
    p_observacao);
end;
$$;

-- Registro de contato (somente gestor). Avança/encerra conforme o resultado.
create or replace function public.registrar_contato(
  p_pessoa_id uuid, p_canal text, p_resultado text, p_observacao text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_atual   smallint;
  v_tipo    public.etapa_tipo;
  v_destino smallint;
begin
  if not public.is_gestor() then
    raise exception 'Somente gestores podem registrar contatos.' using errcode = '42501';
  end if;
  if p_canal not in ('whatsapp', 'ligacao', 'presencial')
     or p_resultado not in ('conversou', 'nao_atendeu', 'nao_deseja') then
    raise exception 'Dados do contato inválidos.' using errcode = '22023';
  end if;
  if p_observacao is not null and char_length(p_observacao) > 500 then
    raise exception 'Observação muito longa.' using errcode = '22023';
  end if;

  select a.etapa_id, e.tipo into v_atual, v_tipo
    from public.atendimentos a join public.etapas e on e.id = a.etapa_id
   where a.pessoa_id = p_pessoa_id
   for update of a;
  if v_atual is null then
    raise exception 'Atendimento não encontrado.' using errcode = 'P0001';
  end if;

  insert into public.contatos (pessoa_id, canal, resultado, observacao, created_by)
  values (p_pessoa_id, p_canal, p_resultado, nullif(btrim(p_observacao), ''), auth.uid());

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'pessoa.contato_registrado', 'pessoa', p_pessoa_id::text,
          jsonb_build_object('nome', (select nome from public.pessoas where id = p_pessoa_id),
                             'canal', p_canal, 'resultado', p_resultado));

  v_destino := v_atual;
  if p_resultado = 'nao_atendeu' then
    update public.atendimentos
       set tentativas_contato = tentativas_contato + 1, updated_at = now(), updated_by = auth.uid()
     where pessoa_id = p_pessoa_id;
  elsif p_resultado = 'conversou' and v_tipo = 'inicial' then
    v_destino := public.etapa_na_posicao(public.etapa_posicao(v_atual) + 1);
    if v_destino is not null then
      perform public.aplicar_movimentacao(p_pessoa_id, v_atual, v_destino, 'contato', null, p_observacao);
    else
      v_destino := v_atual;
    end if;
  elsif p_resultado = 'nao_deseja' and v_tipo <> 'encerrada' then
    select id into v_destino from public.etapas where tipo = 'encerrada';
    perform public.aplicar_movimentacao(p_pessoa_id, v_atual, v_destino, 'contato', 'nao_deseja', p_observacao);
  end if;

  return jsonb_build_object('etapa_id', v_destino);
end;
$$;

-- Resumo do funil para o painel (somente gestor).
create or replace function public.funil_resumo()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if not public.is_gestor() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', e.id, 'nome', e.nome, 'cor', e.cor, 'tipo', e.tipo, 'prazo_horas', e.prazo_horas,
             'total', coalesce(c.total, 0), 'atrasados', coalesce(c.atrasados, 0))
           order by case e.tipo when 'inicial' then 0 when 'intermediaria' then 1 when 'concluida' then 2 else 3 end,
                    e.ordem, e.id), '[]'::jsonb)
    from public.etapas e
    left join (
      select a.etapa_id,
             count(*) as total,
             count(*) filter (where et.prazo_horas is not null
                                and a.etapa_desde < now() - make_interval(hours => et.prazo_horas)) as atrasados
      from public.atendimentos a
      join public.etapas et on et.id = a.etapa_id
      group by a.etapa_id
    ) c on c.etapa_id = e.id
    where e.ativo or coalesce(c.total, 0) > 0
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.igrejas       enable row level security;
alter table public.etapas        enable row level security;
alter table public.atendimentos  enable row level security;
alter table public.movimentacoes enable row level security;
alter table public.contatos      enable row level security;
alter table public.configuracoes enable row level security;
alter table public.igrejas       force row level security;
alter table public.etapas        force row level security;
alter table public.atendimentos  force row level security;
alter table public.movimentacoes force row level security;
alter table public.contatos      force row level security;
alter table public.configuracoes force row level security;

create policy "igrejas: usuários ativos consultam" on public.igrejas
  for select to authenticated using ((select public.is_active_user()));
create policy "igrejas: gestor cadastra" on public.igrejas
  for insert to authenticated with check ((select public.is_gestor()));
create policy "igrejas: gestor altera" on public.igrejas
  for update to authenticated using ((select public.is_gestor())) with check ((select public.is_gestor()));

create policy "etapas: usuários ativos consultam" on public.etapas
  for select to authenticated using ((select public.is_active_user()));
create policy "etapas: gestor cria" on public.etapas
  for insert to authenticated with check ((select public.is_gestor()));
create policy "etapas: gestor altera" on public.etapas
  for update to authenticated using ((select public.is_gestor())) with check ((select public.is_gestor()));
create policy "etapas: gestor exclui" on public.etapas
  for delete to authenticated using ((select public.is_gestor()));

-- Recepção: só a etapa das pessoas que ela mesma cadastrou.
create policy "atendimentos: gestor ou quem cadastrou" on public.atendimentos
  for select to authenticated using (
    (select public.is_gestor())
    or ((select public.is_active_user()) and exists (
          select 1 from public.pessoas p
          where p.id = atendimentos.pessoa_id and p.created_by = (select auth.uid())))
  );

create policy "movimentacoes: somente gestor" on public.movimentacoes
  for select to authenticated using ((select public.is_gestor()));
create policy "contatos: somente gestor" on public.contatos
  for select to authenticated using ((select public.is_gestor()));

create policy "configuracoes: gestor consulta" on public.configuracoes
  for select to authenticated using ((select public.is_gestor()));
create policy "configuracoes: gestor altera" on public.configuracoes
  for update to authenticated using ((select public.is_gestor())) with check ((select public.is_gestor()));

-- -----------------------------------------------------------------------------
-- Privilégios
-- -----------------------------------------------------------------------------
revoke all on public.igrejas, public.etapas, public.atendimentos, public.movimentacoes,
              public.contatos, public.configuracoes
  from anon, authenticated, public;

grant select on public.igrejas to authenticated;
grant insert (nome, ativo), update (nome, ativo) on public.igrejas to authenticated;

grant select, delete on public.etapas to authenticated;
grant insert (nome, cor, ordem, prazo_horas) on public.etapas to authenticated;
grant update (nome, cor, ordem, prazo_horas, ativo) on public.etapas to authenticated;

grant select on public.atendimentos, public.movimentacoes, public.contatos to authenticated;

grant select on public.configuracoes to authenticated;
grant update (mensagem_whatsapp) on public.configuracoes to authenticated;

grant all on public.igrejas, public.etapas, public.atendimentos, public.movimentacoes,
             public.contatos, public.configuracoes to service_role;

-- Cadastro agora só pela função (garante igreja e reabertura).
revoke insert on public.pessoas from authenticated;
grant update (nome, numero, igreja_id) on public.pessoas to authenticated;

-- Funções: revoga tudo e libera apenas as públicas.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.f_unaccent(text)                    to authenticated, service_role;
grant execute on function public.is_active_user()                    to authenticated, service_role;
grant execute on function public.is_gestor()                         to authenticated, service_role;
grant execute on function public.can_view_all_pessoas()              to authenticated, service_role;
grant execute on function public.dashboard_stats(text)               to authenticated;
grant execute on function public.registrar_evento(text, text, jsonb) to authenticated;
grant execute on function public.cadastrar_pessoa(text, text, smallint)            to authenticated;
grant execute on function public.mover_etapa(uuid, smallint, text, text)           to authenticated;
grant execute on function public.registrar_contato(uuid, text, text, text)         to authenticated;
grant execute on function public.funil_resumo()                                    to authenticated;
