-- Testes de segurança e regras de negócio da migration.
-- Executar com: scripts/test-db.sh
\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- Utilitários de teste
-- ---------------------------------------------------------------------------
create schema test;
grant usage on schema test to anon, authenticated;

create function test.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'FALHOU: %', msg;
  end if;
  raise notice 'ok - %', msg;
end $$;

-- Executa SQL e exige que falhe com o código de erro informado.
create function test.throws(sql text, expected_state text, msg text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if sqlstate = expected_state then
      raise notice 'ok - % (erro % esperado)', msg, sqlstate;
      return;
    end if;
    raise exception 'FALHOU: % — erro inesperado % %', msg, sqlstate, sqlerrm;
  end;
  raise exception 'FALHOU: % — deveria ter falhado', msg;
end $$;
grant execute on all functions in schema test to anon, authenticated;

-- IDs fixos
\set G1 '''11111111-1111-1111-1111-111111111111'''
\set R1 '''22222222-2222-2222-2222-222222222222'''
\set R2 '''33333333-3333-3333-3333-333333333333'''
\set X  '''44444444-4444-4444-4444-444444444444'''

-- ---------------------------------------------------------------------------
-- 1. Criação de usuários (como o Auth/servidor faria)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  -- gestora inicial: criada pelo painel do Supabase e promovida via SQL
  (:G1, 'gestora@ex.com', '{"full_name":"Gestora  Ana "}', '{}');

-- Bootstrap do primeiro gestor (SQL Editor: sem auth.uid()).
update public.profiles set role = 'gestor', active = true where id = :G1;

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  -- recepção provisionada pelo servidor (app_metadata só a service role define)
  (:R1, 'r1@ex.com', '{"full_name":"Recepção Um"}',
        format('{"provisioned":true,"app_role":"recepcao","provisioned_by":"%s"}', :G1)::jsonb),
  (:R2, 'r2@ex.com', '{"full_name":"Recepção Dois"}',
        format('{"provisioned":true,"app_role":"recepcao","can_view_records":true,"provisioned_by":"%s"}', :G1)::jsonb),
  -- auto-cadastro indevido tentando se declarar gestor via user_metadata
  (:X,  'x@ex.com',  '{"full_name":"Intruso","app_role":"gestor","provisioned":true}', '{}');

select test.ok((select full_name = 'Gestora Ana' from public.profiles where id = :G1), 'nome normalizado no perfil');
select test.ok((select role = 'recepcao' and active and not can_view_records from public.profiles where id = :R1), 'R1 provisionado como recepção ativa');
select test.ok((select can_view_records from public.profiles where id = :R2), 'R2 com permissão de consulta');
select test.ok((select role = 'recepcao' and not active from public.profiles where id = :X), 'auto-cadastro nasce inativo e sem papel de gestor');
select test.ok((select count(*) = 2 from public.audit_log where action = 'usuario.criado'
                 and actor_id = :G1::uuid), 'criação de usuários provisionados auditada com o gestor como autor');

-- ---------------------------------------------------------------------------
-- 2. Anônimo não acessa nada
-- ---------------------------------------------------------------------------
set role anon;
select test.throws('select * from public.pessoas', '42501', 'anon não lê pessoas');
select test.throws('select * from public.profiles', '42501', 'anon não lê perfis');
select test.throws('insert into public.pessoas (nome, numero) values (''Zé Teste'', ''123'')', '42501', 'anon não cadastra');
select test.throws('select public.dashboard_stats()', '42501', 'anon não executa dashboard_stats');
reset role;

-- ---------------------------------------------------------------------------
-- 3. Recepção R1
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :R1), false);

-- tenta forjar o responsável: coluna não é gravável pelo cliente
select test.throws(format('insert into public.pessoas (nome, numero, created_by) values (''Fulano'', ''999'', %L)', :G1),
                   '42501', 'recepção não define created_by');

insert into public.pessoas (nome, numero) values ('  João   da Silva ', '11987654321');
insert into public.pessoas (nome, numero) values ('Maria Conceição', '4321');

select test.ok((select count(*) = 2 from public.pessoas), 'R1 vê os próprios cadastros');
select test.ok((select bool_and(created_by = :R1::uuid) from public.pessoas), 'created_by preenchido pelo servidor');
select test.ok((select nome = 'João da Silva' from public.pessoas where numero = '11987654321'), 'nome normalizado');
select test.ok((select count(*) = 1 from public.pessoas where nome_busca like '%joao%'), 'busca sem acentos');

select test.throws('insert into public.pessoas (nome, numero) values (''Ab'', ''123'')', '23514', 'nome curto rejeitado');
select test.throws('insert into public.pessoas (nome, numero) values (''Nome Válido'', ''12a'')', '23514', 'número não numérico rejeitado');
select test.throws('insert into public.pessoas (nome, numero) values (''Nome Válido'', ''12'')', '23514', 'número curto rejeitado');
select test.throws('insert into public.pessoas (nome, numero) values (''Nome Válido'', ''123456789012345678901'')', '23514', 'número longo rejeitado');

-- não edita / não exclui (RLS filtra: 0 linhas afetadas)
update public.pessoas set nome = 'Alterado Indevido';
delete from public.pessoas;
select test.ok((select count(*) = 2 and bool_and(nome <> 'Alterado Indevido') from public.pessoas), 'recepção não edita nem exclui');

-- perfil: muda o próprio nome, mas não papel/permissões/ativação
update public.profiles set full_name = 'Recepção Um Novo' where id = :R1;
select test.ok((select full_name = 'Recepção Um Novo' from public.profiles where id = :R1), 'recepção altera o próprio nome');
select test.throws(format('update public.profiles set role = ''gestor'' where id = %L', :R1), '42501', 'recepção não se promove a gestor');
select test.throws(format('update public.profiles set can_view_records = true where id = %L', :R1), '42501', 'recepção não se concede consulta');
select test.throws(format('update public.profiles set email = ''novo@ex.com'' where id = %L', :R1), '42501', 'recepção não altera e-mail (sem grant)');
select test.ok((select count(*) = 1 from public.profiles), 'recepção vê apenas o próprio perfil');
update public.profiles set full_name = 'Hackeado' where id = :R2;
reset role;
select test.ok((select full_name = 'Recepção Dois' from public.profiles where id = :R2), 'recepção não altera perfil alheio');
set role authenticated;
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :R1), false);

-- histórico e funções administrativas
select test.ok((select count(*) = 0 from public.audit_log), 'recepção não lê o histórico');
select test.throws('insert into public.audit_log (action, entity) values (''sessao.login'', ''sessao'')', '42501', 'recepção não escreve no histórico');
select test.throws('delete from public.audit_log', '42501', 'recepção não apaga o histórico');
select test.throws('select public.dashboard_stats()', '42501', 'recepção não acessa indicadores');
select test.throws('select public.registrar_evento(''dados.exportados'')', '42501', 'recepção não registra exportação');
select test.throws('select public.registrar_evento(''pessoa.excluida'')', '22023', 'evento arbitrário rejeitado');
select public.registrar_evento('sessao.login');
reset role;

-- ---------------------------------------------------------------------------
-- 4. Recepção R2 (com permissão de consulta) e usuário inativo X
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :R2), false);
select test.ok((select count(*) = 2 from public.pessoas), 'R2 autorizado consulta todos os cadastros');
update public.pessoas set nome = 'Alterado Indevido';
select test.ok((select count(*) = 0 from public.pessoas where nome = 'Alterado Indevido'), 'consulta não implica edição');

select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :X), false);
select test.ok((select count(*) = 0 from public.pessoas), 'inativo não vê cadastros');
select test.throws('insert into public.pessoas (nome, numero) values (''Pessoa Teste'', ''123'')', '42501', 'inativo não cadastra');
select test.throws('select public.registrar_evento(''sessao.login'')', '42501', 'inativo não registra eventos');
reset role;

-- ---------------------------------------------------------------------------
-- 5. Gestor
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :G1), false);

select test.ok((select count(*) = 2 from public.pessoas), 'gestor vê todos os cadastros');
select test.ok((select count(*) = 4 from public.profiles), 'gestor vê todos os usuários');

update public.pessoas set nome = 'João da Silva Santos' where numero = '11987654321';
select test.ok((select updated_by = :G1::uuid and created_by = :R1::uuid and updated_at >= created_at
                from public.pessoas where numero = '11987654321'), 'edição registra updated_by e preserva created_by');
select test.throws(format('update public.pessoas set created_by = %L', :G1), '42501', 'nem o gestor altera created_by');
select test.ok((select details -> 'antes' ->> 'nome' = 'João da Silva' and details -> 'depois' ->> 'nome' = 'João da Silva Santos'
                from public.audit_log where action = 'pessoa.editada'), 'edição auditada com antes/depois');

delete from public.pessoas where numero = '4321';
select test.ok((select count(*) = 1 from public.pessoas), 'gestor exclui');
select test.ok((select count(*) = 1 from public.audit_log where action = 'pessoa.excluida' and actor_id = :G1::uuid), 'exclusão auditada');

-- indicadores
select test.ok((select (s ->> 'total')::int = 1 and (s ->> 'hoje')::int = 1 and (s ->> 'ultimos_7_dias')::int = 1
                       and (s ->> 'mes')::int = 1 and jsonb_array_length(s -> 'serie') = 30
                       and (s -> 'por_usuario_mes' -> 0 ->> 'total')::int = 1
                from (select public.dashboard_stats() as s) t), 'indicadores calculados a partir dos dados reais');
select test.throws('select public.dashboard_stats(''Fuso/Invalido'')', '22023', 'fuso horário inválido rejeitado');

-- administração de usuários
update public.profiles set can_view_records = true where id = :R1;
select test.ok((select count(*) = 1 from public.audit_log where action = 'usuario.editado'
                 and details -> 'alteracoes' ? 'pode_consultar'), 'alteração de permissão auditada');

select test.throws(format('update public.profiles set role = ''recepcao'' where id = %L', :G1), 'P0001', 'último gestor não pode ser rebaixado');
select test.throws(format('update public.profiles set active = false where id = %L', :G1), 'P0001', 'último gestor não pode ser desativado');

update public.profiles set active = false where id = :R1;
select public.registrar_evento('dados.exportados', null, '{"linhas": 1}');
select public.registrar_evento('usuario.senha_redefinida', :R2, '{}');
select test.throws('select public.registrar_evento(''usuario.senha_redefinida'', ''nao-existe'')', '22023', 'redefinição exige usuário válido');
select test.ok((select count(*) >= 8 from public.audit_log), 'gestor lê o histórico');
reset role;

-- R1 desativado perde acesso imediatamente
set role authenticated;
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :R1), false);
select test.ok((select count(*) = 0 from public.pessoas), 'usuário desativado perde acesso aos cadastros');
select test.throws('insert into public.pessoas (nome, numero) values (''Pessoa Teste'', ''123'')', '42501', 'usuário desativado não cadastra');
reset role;

-- Ninguém (nem gestor) consegue apagar/alterar o histórico
set role authenticated;
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :G1), false);
select test.throws('delete from public.audit_log', '42501', 'gestor não apaga o histórico');
select test.throws('update public.audit_log set action = ''sessao.login''', '42501', 'gestor não altera o histórico');
reset role;

-- Usuário com cadastros não pode ser apagado (apenas desativado)
select test.throws(format('delete from auth.users where id = %L', :R1), '23503', 'usuário com cadastros não é apagado (integridade)');

\echo '======================================'
\echo 'Todos os testes de banco passaram.'
\echo '======================================'
