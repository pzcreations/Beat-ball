-- =============================================================================
-- Recepção — Fase 2: agendamento das visitas pastorais
-- -----------------------------------------------------------------------------
--  * visitas: data/hora, endereço, quem visita (um gestor) e o resultado.
--  * etapas.papel: liga as etapas do funil às visitas, independentemente do
--    nome que o gestor der a elas (agendamento → visita agendada → realizada).
--  * Agendar move a pessoa para "Visita agendada"; registrar o resultado move
--    para "Visita realizada" (ou de volta para "Aguardando agendamento" se a
--    pessoa faltou / a visita foi cancelada).
--  * Tudo somente por gestores, via funções que validam as regras.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Papéis das etapas
-- -----------------------------------------------------------------------------
alter table public.etapas
  add column papel text check (papel is null or papel in ('agendamento', 'visita_agendada', 'visita_realizada'));
create unique index etapas_papel_unico on public.etapas (papel) where papel is not null;

update public.etapas set papel = 'agendamento'      where tipo = 'intermediaria' and nome = 'Aguardando agendamento';
update public.etapas set papel = 'visita_agendada'  where tipo = 'intermediaria' and nome = 'Visita agendada';
update public.etapas set papel = 'visita_realizada' where tipo = 'intermediaria' and nome = 'Visita realizada';

-- Se alguma etapa já tiver sido renomeada, usa a posição no funil.
do $$
declare
  v_ids smallint[];
begin
  if (select count(*) from public.etapas where papel is not null) < 3 then
    select array_agg(id order by ordem, id) into v_ids
      from public.etapas where tipo = 'intermediaria' and ativo;
    if coalesce(array_length(v_ids, 1), 0) >= 3 then
      update public.etapas set papel = null where papel is not null;
      update public.etapas set papel = 'agendamento'      where id = v_ids[1];
      update public.etapas set papel = 'visita_agendada'  where id = v_ids[2];
      update public.etapas set papel = 'visita_realizada' where id = v_ids[3];
    else
      raise exception 'Não foi possível identificar as etapas de agendamento e visita.';
    end if;
  end if;
end $$;

-- Etapas com papel passam a ser essenciais (não desativam/excluem).
create or replace function public.etapas_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and new.tipo <> 'intermediaria' then
      raise exception 'Somente etapas intermediárias podem ser criadas.' using errcode = 'P0001';
    end if;
    if auth.uid() is not null then
      new.papel := null;
    end if;
    new.nome := regexp_replace(btrim(new.nome), '\s+', ' ', 'g');
    return new;
  elsif tg_op = 'UPDATE' then
    new.id := old.id;
    new.tipo := old.tipo;
    new.created_at := old.created_at;
    if auth.uid() is not null then
      new.papel := old.papel;        -- papel não é alterável pelos usuários
    end if;
    new.nome := regexp_replace(btrim(new.nome), '\s+', ' ', 'g');
    if not new.ativo and old.ativo then
      if old.tipo <> 'intermediaria' or old.papel is not null then
        raise exception 'Esta etapa é essencial ao funil e não pode ser desativada.' using errcode = 'P0001';
      end if;
      if exists (select 1 from public.atendimentos where etapa_id = old.id) then
        raise exception 'Há pessoas nesta etapa. Mova-as antes de desativá-la.' using errcode = 'P0001';
      end if;
    end if;
    new.updated_at := now();
    return new;
  else
    if old.tipo <> 'intermediaria' or old.papel is not null then
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

create or replace function public.etapa_por_papel(p_papel text)
returns smallint language sql stable security definer set search_path = '' as $$
  select id from public.etapas where papel = p_papel
$$;

-- -----------------------------------------------------------------------------
-- Visitas
-- -----------------------------------------------------------------------------
create table public.visitas (
  id             uuid primary key default gen_random_uuid(),
  pessoa_id      uuid not null references public.pessoas (id) on delete cascade,
  agendada_para  timestamptz not null,
  endereco       text not null
                 check (char_length(endereco) between 5 and 300 and endereco !~ '[[:cntrl:]]'),
  visitante_id   uuid not null references public.profiles (id) on delete restrict,
  observacao     text check (observacao is null or char_length(observacao) <= 500),
  situacao       text not null default 'agendada'
                 check (situacao in ('agendada', 'realizada', 'faltou', 'cancelada')),
  resultado_obs  text check (resultado_obs is null or char_length(resultado_obs) <= 500),
  created_at     timestamptz not null default now(),
  created_by     uuid references public.profiles (id) on delete set null,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.profiles (id) on delete set null
);

-- No máximo uma visita pendente por pessoa.
create unique index visitas_uma_pendente on public.visitas (pessoa_id) where situacao = 'agendada';
create index visitas_agenda_idx    on public.visitas (situacao, agendada_para);
create index visitas_pessoa_idx    on public.visitas (pessoa_id, agendada_para desc);
create index visitas_visitante_idx on public.visitas (visitante_id, agendada_para);

-- Movimentações e auditoria passam a conhecer as visitas.
alter table public.movimentacoes drop constraint movimentacoes_origem_check;
alter table public.movimentacoes add constraint movimentacoes_origem_check
  check (origem in ('cadastro', 'recadastro', 'gestor', 'contato', 'visita'));

alter table public.audit_log drop constraint audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check check (action in (
  'pessoa.criada', 'pessoa.editada', 'pessoa.excluida',
  'pessoa.etapa_alterada', 'pessoa.contato_registrado', 'pessoa.recadastrada',
  'visita.agendada', 'visita.reagendada', 'visita.registrada',
  'usuario.criado', 'usuario.editado', 'usuario.senha_redefinida',
  'sessao.login', 'sessao.logout',
  'dados.exportados',
  'config.alterada'));

-- Validações comuns de agendamento.
create or replace function public.validar_agendamento(
  p_agendada_para timestamptz, p_endereco text, p_visitante_id uuid, p_observacao text
) returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_agendada_para is null
     or p_agendada_para < now() - interval '1 day'
     or p_agendada_para > now() + interval '1 year' then
    raise exception 'Escolha uma data de hoje em diante (até 1 ano).' using errcode = '22023';
  end if;
  if p_endereco is null or char_length(btrim(p_endereco)) < 5 or char_length(p_endereco) > 300 then
    raise exception 'Informe o endereço da visita.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_visitante_id and role = 'gestor' and active) then
    raise exception 'Escolha um gestor ativo para fazer a visita.' using errcode = '22023';
  end if;
  if p_observacao is not null and char_length(p_observacao) > 500 then
    raise exception 'Observação muito longa.' using errcode = '22023';
  end if;
end;
$$;

-- Agenda uma visita e move a pessoa para "Visita agendada".
create or replace function public.agendar_visita(
  p_pessoa_id uuid, p_agendada_para timestamptz, p_endereco text, p_visitante_id uuid, p_observacao text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_atual  smallint;
  v_tipo   public.etapa_tipo;
  v_destino smallint := public.etapa_por_papel('visita_agendada');
  v_id     uuid;
begin
  if not public.is_gestor() then
    raise exception 'Somente gestores podem agendar visitas.' using errcode = '42501';
  end if;
  perform public.validar_agendamento(p_agendada_para, p_endereco, p_visitante_id, p_observacao);

  select a.etapa_id, e.tipo into v_atual, v_tipo
    from public.atendimentos a join public.etapas e on e.id = a.etapa_id
   where a.pessoa_id = p_pessoa_id
   for update of a;
  if v_atual is null then
    raise exception 'Atendimento não encontrado.' using errcode = 'P0001';
  end if;
  if v_tipo in ('concluida', 'encerrada') then
    raise exception 'Reabra o atendimento antes de agendar uma visita.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.visitas where pessoa_id = p_pessoa_id and situacao = 'agendada') then
    raise exception 'Já existe uma visita agendada. Use “Reagendar”.' using errcode = 'P0001';
  end if;

  insert into public.visitas (pessoa_id, agendada_para, endereco, visitante_id, observacao, created_by, updated_by)
  values (p_pessoa_id, p_agendada_para, regexp_replace(btrim(p_endereco), '\s+', ' ', 'g'), p_visitante_id,
          nullif(btrim(p_observacao), ''), auth.uid(), auth.uid())
  returning id into v_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'visita.agendada', 'pessoa', p_pessoa_id::text,
          jsonb_build_object('nome', (select nome from public.pessoas where id = p_pessoa_id),
                             'quando', p_agendada_para,
                             'visitante', (select full_name from public.profiles where id = p_visitante_id)));

  if v_destino is not null and v_destino <> v_atual then
    perform public.aplicar_movimentacao(p_pessoa_id, v_atual, v_destino, 'visita', null, null);
  end if;
  return v_id;
end;
$$;

-- Reagenda a visita pendente (data, endereço, visitante).
create or replace function public.reagendar_visita(
  p_visita_id uuid, p_agendada_para timestamptz, p_endereco text, p_visitante_id uuid, p_observacao text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.visitas%rowtype;
begin
  if not public.is_gestor() then
    raise exception 'Somente gestores podem reagendar visitas.' using errcode = '42501';
  end if;
  perform public.validar_agendamento(p_agendada_para, p_endereco, p_visitante_id, p_observacao);

  select * into v from public.visitas where id = p_visita_id for update;
  if v.id is null then
    raise exception 'Visita não encontrada.' using errcode = 'P0001';
  end if;
  if v.situacao <> 'agendada' then
    raise exception 'Somente visitas pendentes podem ser reagendadas.' using errcode = 'P0001';
  end if;

  update public.visitas
     set agendada_para = p_agendada_para,
         endereco = regexp_replace(btrim(p_endereco), '\s+', ' ', 'g'),
         visitante_id = p_visitante_id,
         observacao = nullif(btrim(p_observacao), ''),
         updated_at = now(), updated_by = auth.uid()
   where id = p_visita_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'visita.reagendada', 'pessoa', v.pessoa_id::text,
          jsonb_build_object('nome', (select nome from public.pessoas where id = v.pessoa_id),
                             'antes', v.agendada_para, 'depois', p_agendada_para,
                             'visitante', (select full_name from public.profiles where id = p_visitante_id)));
end;
$$;

-- Registra o resultado: realizada → "Visita realizada";
-- faltou/cancelada → volta para "Aguardando agendamento".
create or replace function public.registrar_visita(
  p_visita_id uuid, p_situacao text, p_observacao text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v       public.visitas%rowtype;
  v_atual smallint;
  v_dest  smallint;
begin
  if not public.is_gestor() then
    raise exception 'Somente gestores podem registrar visitas.' using errcode = '42501';
  end if;
  if p_situacao not in ('realizada', 'faltou', 'cancelada') then
    raise exception 'Resultado da visita inválido.' using errcode = '22023';
  end if;
  if p_observacao is not null and char_length(p_observacao) > 500 then
    raise exception 'Observação muito longa.' using errcode = '22023';
  end if;

  select * into v from public.visitas where id = p_visita_id for update;
  if v.id is null then
    raise exception 'Visita não encontrada.' using errcode = 'P0001';
  end if;
  if v.situacao <> 'agendada' then
    raise exception 'Esta visita já foi registrada.' using errcode = 'P0001';
  end if;
  if p_situacao = 'realizada' and v.agendada_para > now() + interval '12 hours' then
    raise exception 'Esta visita ainda não aconteceu.' using errcode = 'P0001';
  end if;

  select etapa_id into v_atual from public.atendimentos where pessoa_id = v.pessoa_id for update;

  update public.visitas
     set situacao = p_situacao, resultado_obs = nullif(btrim(p_observacao), ''),
         updated_at = now(), updated_by = auth.uid()
   where id = p_visita_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'visita.registrada', 'pessoa', v.pessoa_id::text,
          jsonb_build_object('nome', (select nome from public.pessoas where id = v.pessoa_id),
                             'situacao', p_situacao, 'quando', v.agendada_para));

  v_dest := public.etapa_por_papel(case when p_situacao = 'realizada' then 'visita_realizada' else 'agendamento' end);
  if v_dest is not null and v_atual is not null and v_dest <> v_atual then
    perform public.aplicar_movimentacao(v.pessoa_id, v_atual, v_dest, 'visita', null, p_observacao);
  end if;
end;
$$;

-- mover_etapa passa a respeitar as visitas:
--  * entrar em "Visita agendada" só agendando (precisa de data/endereço);
--  * sair de "Visita agendada" para "Visita realizada" registra a visita;
--    para qualquer outra etapa, cancela a visita pendente.
create or replace function public.mover_etapa(
  p_pessoa_id uuid, p_etapa_id smallint, p_motivo text default null, p_observacao text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_atual     smallint;
  v_tipo_at   public.etapa_tipo;
  v_papel_at  text;
  v_tipo_dst  public.etapa_tipo;
  v_papel_dst text;
  v_ativo     boolean;
begin
  if not public.is_gestor() then
    raise exception 'Somente gestores podem mudar a etapa.' using errcode = '42501';
  end if;
  if p_observacao is not null and char_length(p_observacao) > 500 then
    raise exception 'Observação muito longa.' using errcode = '22023';
  end if;

  select a.etapa_id, e.tipo, e.papel into v_atual, v_tipo_at, v_papel_at
    from public.atendimentos a join public.etapas e on e.id = a.etapa_id
   where a.pessoa_id = p_pessoa_id
   for update of a;
  if v_atual is null then
    raise exception 'Atendimento não encontrado.' using errcode = 'P0001';
  end if;

  select tipo, ativo, papel into v_tipo_dst, v_ativo, v_papel_dst from public.etapas where id = p_etapa_id;
  if v_tipo_dst is null or not v_ativo then
    raise exception 'Etapa inválida.' using errcode = '22023';
  end if;
  if p_etapa_id = v_atual then
    raise exception 'A pessoa já está nesta etapa.' using errcode = 'P0001';
  end if;
  if v_papel_dst = 'visita_agendada' then
    raise exception 'Para esta etapa, use “Agendar visita” (data, horário e endereço).' using errcode = 'P0001';
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

  -- Visita pendente acompanha a mudança.
  if v_papel_dst = 'visita_realizada' and v_papel_at = 'visita_agendada' then
    if exists (select 1 from public.visitas where pessoa_id = p_pessoa_id and situacao = 'agendada'
                                              and agendada_para > now() + interval '12 hours') then
      raise exception 'A visita agendada ainda não aconteceu.' using errcode = 'P0001';
    end if;
    update public.visitas set situacao = 'realizada', resultado_obs = nullif(btrim(p_observacao), ''),
                              updated_at = now(), updated_by = auth.uid()
     where pessoa_id = p_pessoa_id and situacao = 'agendada';
  else
    update public.visitas set situacao = 'cancelada', resultado_obs = 'Cancelada ao mudar a etapa',
                              updated_at = now(), updated_by = auth.uid()
     where pessoa_id = p_pessoa_id and situacao = 'agendada';
  end if;

  perform public.aplicar_movimentacao(
    p_pessoa_id, v_atual, p_etapa_id, 'gestor',
    case when v_tipo_dst = 'encerrada' then p_motivo end,
    p_observacao);
end;
$$;

-- Registrar "não deseja visita" também cancela visita pendente.
create or replace function public.visitas_cancelar_ao_encerrar()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.etapas where id = new.etapa_id and tipo in ('encerrada', 'concluida', 'inicial')) then
    update public.visitas set situacao = 'cancelada', resultado_obs = coalesce(resultado_obs, 'Atendimento encerrado'),
                              updated_at = now(), updated_by = auth.uid()
     where pessoa_id = new.pessoa_id and situacao = 'agendada';
  end if;
  return new;
end;
$$;

create trigger atendimentos_cancelar_visita
  after update of etapa_id on public.atendimentos
  for each row when (old.etapa_id is distinct from new.etapa_id)
  execute function public.visitas_cancelar_ao_encerrar();

-- Funil: na etapa "Visita agendada", atrasado = dia da visita já passou sem
-- registro do resultado.
drop function public.funil_resumo();
create or replace function public.funil_resumo(p_tz text default 'America/Sao_Paulo')
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_hoje date;
begin
  if not public.is_gestor() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz) then
    raise exception 'Fuso horário inválido.' using errcode = '22023';
  end if;
  v_hoje := (now() at time zone p_tz)::date;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', e.id, 'nome', e.nome, 'cor', e.cor, 'tipo', e.tipo, 'papel', e.papel,
             'prazo_horas', e.prazo_horas,
             'total', coalesce(c.total, 0), 'atrasados', coalesce(c.atrasados, 0))
           order by case e.tipo when 'inicial' then 0 when 'intermediaria' then 1 when 'concluida' then 2 else 3 end,
                    e.ordem, e.id), '[]'::jsonb)
    from public.etapas e
    left join (
      select a.etapa_id,
             count(*) as total,
             count(*) filter (where
               (et.prazo_horas is not null and a.etapa_desde < now() - make_interval(hours => et.prazo_horas))
               or (et.papel = 'visita_agendada' and exists (
                     select 1 from public.visitas v
                     where v.pessoa_id = a.pessoa_id and v.situacao = 'agendada'
                       and (v.agendada_para at time zone p_tz)::date < v_hoje))
             ) as atrasados
      from public.atendimentos a
      join public.etapas et on et.id = a.etapa_id
      group by a.etapa_id
    ) c on c.etapa_id = e.id
    where e.ativo or coalesce(c.total, 0) > 0
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS e privilégios
-- -----------------------------------------------------------------------------
alter table public.visitas enable row level security;
alter table public.visitas force row level security;

create policy "visitas: somente gestor" on public.visitas
  for select to authenticated using ((select public.is_gestor()));

revoke all on public.visitas from anon, authenticated, public;
grant select on public.visitas to authenticated;
grant all on public.visitas to service_role;

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
grant execute on function public.funil_resumo(text)                                to authenticated;
grant execute on function public.agendar_visita(uuid, timestamptz, text, uuid, text)   to authenticated;
grant execute on function public.reagendar_visita(uuid, timestamptz, text, uuid, text) to authenticated;
grant execute on function public.registrar_visita(uuid, text, text)                    to authenticated;
