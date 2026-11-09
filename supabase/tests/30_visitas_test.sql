-- Testes da Fase 2: agendamento, reagendamento e registro de visitas.
\set ON_ERROR_STOP on

\set G1 '''11111111-1111-1111-1111-111111111111'''
\set R2 '''33333333-3333-3333-3333-333333333333'''
\set R3 '''55555555-5555-5555-5555-555555555555'''
\set G2 '''77777777-7777-7777-7777-777777777777'''

-- Segundo gestor (o pastor)
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  (:G2, 'pastor@ex.com', '{"full_name":"Pastor Marcos"}',
   format('{"provisioned":true,"app_role":"gestor","provisioned_by":"%s"}', :G1)::jsonb);

select test.ok((select count(*) = 3 from public.etapas where papel is not null), 'etapas de agendamento e visita identificadas');

-- Pessoa nova para os testes
set role authenticated;
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :R3), false);
select public.cadastrar_pessoa('Daniel Souza', '11977776666', 1::smallint);
reset role;

\set DANIEL '(select id from public.pessoas where nome = ''Daniel Souza'')'
\set VISITA '(select id from public.visitas where pessoa_id = (select id from public.pessoas where nome = ''Daniel Souza'') and situacao = ''agendada'')'
\set ETAPA '(select e.papel from public.atendimentos a join public.etapas e on e.id = a.etapa_id where a.pessoa_id = (select id from public.pessoas where nome = ''Daniel Souza''))'

-- ---------------------------------------------------------------------------
-- Recepção não agenda nem vê visitas
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :R3), false);
select test.throws(format('select public.agendar_visita(%L, now() + interval ''1 day'', ''Rua A, 10'', %L)',
                          (select id from public.pessoas where nome = 'Daniel Souza'), :G2),
                   '42501', 'recepção não agenda visita');
select test.throws('insert into public.visitas (pessoa_id, agendada_para, endereco, visitante_id) values (gen_random_uuid(), now(), ''Rua A'', gen_random_uuid())',
                   '42501', 'recepção não insere visita direto');
reset role;

-- ---------------------------------------------------------------------------
-- Gestor agenda
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :G1), false);

select test.throws(format('select public.mover_etapa(%L, %s::smallint)', (select id from public.pessoas where nome = 'Daniel Souza'),
                          (select id from public.etapas where papel = 'visita_agendada')),
                   'P0001', 'não entra em "Visita agendada" sem agendar');
select test.throws(format('select public.agendar_visita(%L, now() - interval ''3 days'', ''Rua A, 10'', %L)',
                          (select id from public.pessoas where nome = 'Daniel Souza'), :G2),
                   '22023', 'data no passado rejeitada');
select test.throws(format('select public.agendar_visita(%L, now() + interval ''1 day'', ''Rua'', %L)',
                          (select id from public.pessoas where nome = 'Daniel Souza'), :G2),
                   '22023', 'endereço obrigatório');
select test.throws(format('select public.agendar_visita(%L, now() + interval ''1 day'', ''Rua A, 10'', %L)',
                          (select id from public.pessoas where nome = 'Daniel Souza'), :R3),
                   '22023', 'visitante precisa ser gestor');

select public.agendar_visita(:DANIEL, now() + interval '2 days', 'Rua das Palmeiras, 45 — Planalto', :G2::uuid, 'Levar Bíblia');
select test.ok((select :ETAPA = 'visita_agendada'), 'agendar move para "Visita agendada" (mesmo vindo do início)');
select test.ok((select count(*) = 1 from public.visitas where pessoa_id = :DANIEL and situacao = 'agendada'), 'visita pendente criada');
select test.throws(format('select public.agendar_visita(%L, now() + interval ''3 days'', ''Rua B, 20'', %L)',
                          (select id from public.pessoas where nome = 'Daniel Souza'), :G2),
                   'P0001', 'só uma visita pendente por pessoa');
select test.throws(format('select public.registrar_visita(%L, ''realizada'')', (select id from public.visitas where situacao = 'agendada' and pessoa_id = (select id from public.pessoas where nome = 'Daniel Souza'))),
                   'P0001', 'não marca como realizada uma visita futura');

-- Reagendar
select public.reagendar_visita(:VISITA, now() + interval '1 hour', 'Rua das Palmeiras, 45 — Planalto', :G1::uuid, null);
select test.ok((select visitante_id = :G1::uuid and agendada_para < now() + interval '2 hours' from public.visitas
                where pessoa_id = :DANIEL and situacao = 'agendada'), 'reagendamento altera data e visitante');
select test.ok((select count(*) = 1 from public.audit_log where action = 'visita.reagendada'), 'reagendamento auditado');

-- Faltou → volta para aguardando agendamento
select public.registrar_visita(:VISITA, 'faltou', 'Ninguém em casa');
select test.ok((select :ETAPA = 'agendamento'), 'falta volta para "Aguardando agendamento"');
select test.ok((select situacao = 'faltou' and resultado_obs = 'Ninguém em casa' from public.visitas where pessoa_id = :DANIEL),
               'falta registrada com observação');
select test.throws(format('select public.registrar_visita(%L, ''realizada'')', (select id from public.visitas where pessoa_id = (select id from public.pessoas where nome = 'Daniel Souza'))),
                   'P0001', 'visita já registrada não muda');

-- Nova visita e realizada
select public.agendar_visita(:DANIEL, now() - interval '2 hours', 'Rua das Palmeiras, 45', :G2::uuid, null);
select public.registrar_visita(:VISITA, 'realizada', 'Oramos com a família');
select test.ok((select :ETAPA = 'visita_realizada'), 'visita realizada move para "Visita realizada"');
select test.ok((select count(*) = 2 from public.visitas where pessoa_id = :DANIEL), 'histórico mantém todas as visitas');

-- Retorno: nova visita a partir de "Visita realizada"
select public.agendar_visita(:DANIEL, now() + interval '7 days', 'Rua das Palmeiras, 45', :G2::uuid, 'Retorno');
select test.ok((select :ETAPA = 'visita_agendada'), 'nova visita (retorno) a partir de "Visita realizada"');

-- Encerrar cancela a visita pendente
select public.mover_etapa(:DANIEL, (select id from public.etapas where tipo = 'encerrada'), 'mudou_se', null);
select test.ok((select count(*) = 0 from public.visitas where pessoa_id = :DANIEL and situacao = 'agendada'), 'encerrar cancela a visita pendente');
select test.ok((select situacao = 'cancelada' from public.visitas where pessoa_id = :DANIEL order by created_at desc limit 1), 'visita marcada como cancelada');
select test.throws(format('select public.agendar_visita(%L, now() + interval ''1 day'', ''Rua A, 10'', %L)',
                          (select id from public.pessoas where nome = 'Daniel Souza'), :G2),
                   'P0001', 'atendimento encerrado precisa ser reaberto para agendar');

-- Voltar de "Visita agendada" para "Aguardando agendamento" cancela a pendente
select public.mover_etapa(:DANIEL, (select id from public.etapas where tipo = 'inicial'));
select public.mover_etapa(:DANIEL, (select id from public.etapas where papel = 'agendamento'));
select public.agendar_visita(:DANIEL, now() + interval '1 day', 'Rua das Palmeiras, 45', :G2::uuid, null);
select public.mover_etapa(:DANIEL, (select id from public.etapas where papel = 'agendamento'), null, 'Remarcar depois');
select test.ok((select count(*) = 0 from public.visitas where pessoa_id = :DANIEL and situacao = 'agendada'), 'voltar etapa cancela a visita pendente');

-- Arrastar para "Visita realizada" registra a visita (quando já aconteceu)
select public.agendar_visita(:DANIEL, now() - interval '1 hour', 'Rua das Palmeiras, 45', :G2::uuid, null);
select public.mover_etapa(:DANIEL, (select id from public.etapas where papel = 'visita_realizada'));
select test.ok((select situacao = 'realizada' from public.visitas where pessoa_id = :DANIEL order by created_at desc limit 1),
               'mover para "Visita realizada" registra a visita');

select test.ok((select count(*) >= 5 from public.audit_log where action = 'visita.agendada'), 'agendamentos auditados');
select test.ok((select count(*) >= 2 from public.audit_log where action = 'visita.registrada'), 'resultados auditados');
reset role;

-- ---------------------------------------------------------------------------
-- Atraso no funil: visita de ontem sem registro
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :G1), false);
select public.cadastrar_pessoa('Elisa Prado', '11966665555', 3::smallint);
select public.agendar_visita((select id from public.pessoas where nome = 'Elisa Prado'), now() + interval '1 hour', 'Av. Central, 900', :G2::uuid, null);
reset role;
update public.visitas set agendada_para = now() - interval '2 days'
 where pessoa_id = (select id from public.pessoas where nome = 'Elisa Prado');
set role authenticated;
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :G1), false);
select test.ok((select (x ->> 'atrasados')::int = 1 from jsonb_array_elements(public.funil_resumo()) x
                where x ->> 'papel' = 'visita_agendada'), 'visita passada sem registro conta como atrasada');

-- Etapas de visita são essenciais
select test.throws('update public.etapas set ativo = false where papel = ''visita_realizada''', 'P0001', 'etapa de visita não é desativada');
select test.throws('update public.etapas set papel = null where papel = ''visita_realizada''', '42501', 'papel da etapa não é alterado pelo usuário');
reset role;

-- Recepção (R2, consulta liberada) não vê visitas
set role authenticated;
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :R2), false);
select test.ok((select count(*) = 0 from public.visitas), 'recepção não vê visitas nem endereços');
reset role;
