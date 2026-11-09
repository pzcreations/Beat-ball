-- Testes da Fase 1: igrejas, funil de etapas, contatos, recadastro e RLS.
-- Executa depois de 10_security_test.sql (reaproveita G1 = gestora, R2 =
-- recepção com consulta liberada).
\set ON_ERROR_STOP on

\set G1 '''11111111-1111-1111-1111-111111111111'''
\set R2 '''33333333-3333-3333-3333-333333333333'''
\set R3 '''55555555-5555-5555-5555-555555555555'''

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  (:R3, 'r3@ex.com', '{"full_name":"Recepção Três"}',
   format('{"provisioned":true,"app_role":"recepcao","provisioned_by":"%s"}', :G1)::jsonb);

select test.ok((select count(*) = 4 from public.igrejas where ativo), 'quatro igrejas cadastradas');
select test.ok((select count(*) = 6 from public.etapas), 'seis etapas iniciais');
select test.ok((select count(*) = 1 from public.atendimentos), 'atendimento criado para pessoa já existente');

-- ---------------------------------------------------------------------------
-- Recepção R3
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :R3), false);

select test.ok((select count(*) = 4 from public.igrejas), 'recepção lista as igrejas');
select test.ok((select count(*) = 6 from public.etapas), 'recepção lê os nomes das etapas');
select test.throws('insert into public.igrejas (nome) values (''Igreja Falsa'')', '42501', 'recepção não cria igreja');
select test.throws('select public.cadastrar_pessoa(''Pessoa Teste'', ''11999990000'', 99::smallint)', '22023', 'igreja inexistente rejeitada');

select test.ok((select (public.cadastrar_pessoa('Ana Paula Reis', '(11) 91111-2222', 3::smallint)) ->> 'situacao' = 'novo'),
               'cadastro com igreja');
select test.ok((select count(*) = 1 from public.atendimentos a join public.etapas e on e.id = a.etapa_id
                 where e.tipo = 'inicial'), 'nova pessoa entra em "Aguardando contato" e a recepção vê a etapa');
select test.throws('insert into public.pessoas (nome, numero, igreja_id) values (''Direto'', ''123'', 1)', '42501',
                   'cadastro direto na tabela bloqueado (só pela função)');

-- Recadastro: mesma pessoa (acentos/caixa diferentes) e em atendimento
select test.ok((select (public.cadastrar_pessoa('ana paula  reis', '11911112222', 3::smallint)) ->> 'situacao' = 'ja_em_atendimento'),
               'recadastro de quem está em atendimento não duplica');
-- Mesmo número, nome diferente (família)
select test.ok((select (public.cadastrar_pessoa('Bruno Reis', '11911112222', 3::smallint)) ->> 'situacao' = 'novo'),
               'mesmo número com outro nome cria nova pessoa');

-- Sem acesso ao histórico ou às ações do gestor
select test.ok((select count(*) = 0 from public.movimentacoes), 'recepção não lê movimentações');
select test.ok((select count(*) = 0 from public.contatos), 'recepção não lê contatos');
select test.ok((select count(*) = 0 from public.configuracoes), 'recepção não lê configurações');
select test.throws(format('select public.mover_etapa(%L, 2::smallint)', (select id from public.pessoas where nome = 'Ana Paula Reis')),
                   '42501', 'recepção não muda etapa');
select test.throws(format('select public.registrar_contato(%L, ''whatsapp'', ''conversou'')', (select id from public.pessoas where nome = 'Ana Paula Reis')),
                   '42501', 'recepção não registra contato');
select test.throws('select public.funil_resumo()', '42501', 'recepção não vê o funil');
select test.throws('update public.atendimentos set etapa_id = 5', '42501', 'recepção não altera atendimento direto');
update public.etapas set nome = 'Hackeada' where tipo = 'inicial';
reset role;
select test.ok((select nome = 'Aguardando contato' from public.etapas where tipo = 'inicial'), 'recepção não renomeia etapas');

-- ---------------------------------------------------------------------------
-- R2 (consulta liberada): vê as pessoas, mas a etapa só das que cadastrou
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :R2), false);
select public.cadastrar_pessoa('Carla Mendes', '11922223333', 1::smallint);
select test.ok((select count(*) >= 4 from public.pessoas), 'R2 consulta todos os cadastros');
select test.ok((select count(*) = 1 from public.atendimentos), 'R2 vê a etapa apenas de quem ela cadastrou');
reset role;

-- ---------------------------------------------------------------------------
-- Gestor: contatos e movimentações
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :G1), false);

\set ANA '(select id from public.pessoas where nome = ''Ana Paula Reis'')'
\set ETAPA_ANA '(select etapa_id from public.atendimentos where pessoa_id = (select id from public.pessoas where nome = ''Ana Paula Reis''))'

select test.ok((select count(*) >= 2 from public.movimentacoes where pessoa_id = :ANA), 'linha do tempo registra cadastro e recadastro');

select public.registrar_contato(:ANA, 'whatsapp', 'nao_atendeu', 'Sem resposta');
select test.ok((select tentativas_contato = 1 and etapa_id = (select id from public.etapas where tipo = 'inicial')
                from public.atendimentos where pessoa_id = :ANA), '"não atendeu" conta tentativa e mantém a etapa');

select public.registrar_contato(:ANA, 'whatsapp', 'conversou', 'Quer a visita no sábado');
select test.ok((select e.nome = 'Aguardando agendamento' and a.tentativas_contato = 0
                from public.atendimentos a join public.etapas e on e.id = a.etapa_id where a.pessoa_id = :ANA),
               '"conversou" avança para Aguardando agendamento');

select test.throws(format('select public.mover_etapa(%L, %s::smallint)', (select id from public.pessoas where nome = 'Ana Paula Reis'),
                          (select id from public.etapas where tipo = 'concluida')),
                   'P0001', 'não pula etapas');
select public.agendar_visita(:ANA, now() + interval '2 days', 'Rua das Flores, 100', :G1::uuid, 'Sábado 15h');
select public.mover_etapa(:ANA, (select id from public.etapas where nome = 'Aguardando agendamento'), null, 'Remarcar');
select test.ok((select e.nome = 'Aguardando agendamento' from public.atendimentos a join public.etapas e on e.id = a.etapa_id
                where a.pessoa_id = :ANA), 'avança e volta uma etapa');

select test.throws(format('select public.mover_etapa(%L, %s::smallint)', (select id from public.pessoas where nome = 'Ana Paula Reis'),
                          (select id from public.etapas where tipo = 'encerrada')),
                   '22023', 'encerrar exige motivo');
select public.mover_etapa(:ANA, (select id from public.etapas where tipo = 'encerrada'), 'mudou_se', null);
select test.throws(format('select public.mover_etapa(%L, %s::smallint)', (select id from public.pessoas where nome = 'Ana Paula Reis'),
                          (select id from public.etapas where nome = 'Visita agendada')),
                   'P0001', 'encerrado só pode ser reaberto');
select test.ok((select count(*) >= 3 from public.audit_log where action = 'pessoa.etapa_alterada'), 'mudanças de etapa auditadas');
select test.ok((select count(*) = 2 from public.audit_log where action = 'pessoa.contato_registrado'), 'contatos auditados');
reset role;

-- Recadastro de pessoa encerrada → reabre
set role authenticated;
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :R3), false);
select test.ok((select (public.cadastrar_pessoa('Ana Paula Reis', '11911112222', 1::smallint)) ->> 'situacao' = 'reaberto'),
               'recadastro de pessoa encerrada reabre o atendimento');
reset role;
select test.ok((select a.etapa_id = public.etapa_inicial_id() from public.atendimentos a
                where a.pessoa_id = (select id from public.pessoas where nome = 'Ana Paula Reis')),
               'atendimento reaberto volta para Aguardando contato');
select test.ok((select count(*) = 1 from public.pessoas where nome = 'Ana Paula Reis'), 'reabertura não duplica a pessoa');
select test.ok((select observacao like '%Igreja Adventista do Planalto%' from public.movimentacoes
                where origem = 'recadastro' order by id desc limit 1), 'igreja diferente informada fica anotada');

-- "Não deseja visita" encerra com motivo
set role authenticated;
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :G1), false);
select public.registrar_contato((select id from public.pessoas where nome = 'Bruno Reis'), 'ligacao', 'nao_deseja', null);
select test.ok((select e.tipo = 'encerrada' from public.atendimentos a join public.etapas e on e.id = a.etapa_id
                where a.pessoa_id = (select id from public.pessoas where nome = 'Bruno Reis')),
               '"não deseja visita" encerra o atendimento');
select test.ok((select motivo = 'nao_deseja' from public.movimentacoes
                where pessoa_id = (select id from public.pessoas where nome = 'Bruno Reis') order by id desc limit 1),
               'motivo do encerramento registrado');
select test.throws(format('select public.registrar_contato(%L, ''sms'', ''conversou'')', (select id from public.pessoas where nome = 'Bruno Reis')),
                   '22023', 'canal de contato inválido rejeitado');

-- Edição com troca de igreja auditada
update public.pessoas set igreja_id = 4 where nome = 'Carla Mendes';
select test.ok((select details -> 'depois' ->> 'igreja' = 'Igreja Adventista Martinho Prado' from public.audit_log
                where action = 'pessoa.editada' order by id desc limit 1), 'troca de igreja auditada');
reset role;

-- ---------------------------------------------------------------------------
-- Funil e atrasos
-- ---------------------------------------------------------------------------
update public.atendimentos set etapa_desde = now() - interval '2 days'
 where pessoa_id = (select id from public.pessoas where nome = 'Carla Mendes');

set role authenticated;
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :G1), false);
select test.ok((select (f -> 0 ->> 'tipo') = 'inicial' and (f -> 0 ->> 'atrasados')::int = 1
                       and (f -> 0 ->> 'total')::int = (select count(*) from public.atendimentos a join public.etapas e
                                                         on e.id = a.etapa_id where e.tipo = 'inicial')
                from (select public.funil_resumo() as f) x), 'funil conta pessoas e atrasados (>24h)');

-- ---------------------------------------------------------------------------
-- Configuração de etapas, igrejas e mensagem
-- ---------------------------------------------------------------------------
insert into public.etapas (nome, cor, ordem, prazo_horas) values ('Retorno', 'lilas', 40, 168);
select test.ok((select tipo = 'intermediaria' from public.etapas where nome = 'Retorno'), 'gestor cria etapa intermediária');
select test.throws('insert into public.etapas (nome, cor, tipo) values (''Outra inicial'', ''amarelo'', ''inicial'')', '42501',
                   'tipo da etapa não é definido pelo cliente');
select test.throws('update public.etapas set ativo = false where tipo = ''inicial''', 'P0001', 'etapa essencial não é desativada');
select public.mover_etapa((select id from public.pessoas where nome = 'Carla Mendes'),
                          (select id from public.etapas where nome = 'Aguardando agendamento'));
select test.throws('update public.etapas set ativo = false where nome = ''Aguardando agendamento''', 'P0001',
                   'etapa com pessoas não é desativada');
select test.throws('update public.etapas set cor = ''rosa'' where nome = ''Retorno''', '23514', 'cor fora da paleta rejeitada');
update public.etapas set nome = 'Retorno pastoral', ativo = false where nome = 'Retorno';
select test.ok((select not ativo from public.etapas where nome = 'Retorno pastoral'), 'etapa vazia pode ser desativada e renomeada');
delete from public.etapas where nome = 'Retorno pastoral';
select test.ok((select count(*) = 0 from public.etapas where nome = 'Retorno pastoral'), 'etapa nunca usada pode ser excluída');
select test.throws('delete from public.etapas where nome = ''Visita agendada''', 'P0001', 'etapa já usada não é excluída');

update public.configuracoes set mensagem_whatsapp = 'Olá, {primeiro_nome}! Graça e paz.';
select test.ok((select mensagem_whatsapp like 'Olá, {primeiro_nome}%' and updated_by = :G1::uuid from public.configuracoes),
               'gestor edita a mensagem do WhatsApp');
select test.throws('update public.configuracoes set mensagem_whatsapp = ''oi''', '23514', 'mensagem curta demais rejeitada');

update public.igrejas set nome = 'Igreja Adventista Central de Teste' where id = 2;
select test.ok((select count(*) >= 3 from public.audit_log where action = 'config.alterada'), 'alterações de configuração auditadas');
reset role;

-- Igreja desativada não aceita novos cadastros
update public.igrejas set ativo = false where id = 2;
set role authenticated;
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :R3), false);
select test.throws('select public.cadastrar_pessoa(''Pessoa Nova'', ''11933334444'', 2::smallint)', '22023', 'igreja desativada não aceita cadastro');
reset role;

-- Exclusão de pessoa remove atendimento e histórico do funil (cascata)
delete from public.pessoas where nome = 'Bruno Reis';
select test.ok((select count(*) = 0 from public.atendimentos a left join public.pessoas p on p.id = a.pessoa_id where p.id is null),
               'sem atendimentos órfãos após exclusão');
