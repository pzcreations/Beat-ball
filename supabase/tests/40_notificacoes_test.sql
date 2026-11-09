-- Testes da Fase 3: notificações (assinaturas, preferências e configuração).
\set ON_ERROR_STOP on

\set G1 '''11111111-1111-1111-1111-111111111111'''
\set G2 '''77777777-7777-7777-7777-777777777777'''
\set R3 '''55555555-5555-5555-5555-555555555555'''

grant usage on schema test to service_role;
grant execute on all functions in schema test to service_role;

select test.ok((select char_length(cron_secret) = 64 from public.sistema_config), 'segredo do agendador gerado automaticamente');

-- Assinaturas gravadas pelo servidor (service role)
insert into public.push_assinaturas (user_id, endpoint, p256dh, auth) values
  (:G1, 'https://push.example.com/aaaaaaaaaaaaaaaaaaaa', repeat('k', 87), repeat('a', 22)),
  (:G2, 'https://push.example.com/bbbbbbbbbbbbbbbbbbbb', repeat('k', 87), repeat('a', 22));

-- ---------------------------------------------------------------------------
-- Recepção
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :R3), false);
select test.throws('select * from public.sistema_config', '42501', 'recepção não lê configuração do sistema (segredos)');
select test.throws('select * from public.notificacoes_enviadas', '42501', 'recepção não lê controle de envios');
select test.ok((select count(*) = 0 from public.push_assinaturas), 'recepção não vê aparelhos de outros');
select test.throws('insert into public.push_assinaturas (user_id, endpoint, p256dh, auth) values (gen_random_uuid(), ''https://x.example.com/zzzzzzzzzzzzzzzzzz'', repeat(''k'', 87), repeat(''a'', 22))',
                   '42501', 'cliente não grava assinatura direto');
select test.throws('insert into public.notificacao_prefs (novo_cadastro) values (false)', '42501', 'recepção não cria preferências de notificação');
select test.throws('select public.contar_atrasados()', '42501', 'recepção não executa função do agendador');
reset role;

-- ---------------------------------------------------------------------------
-- Gestor
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :G1), false);
select test.throws('select cron_secret from public.sistema_config', '42501', 'nem o gestor lê os segredos do sistema');
select test.ok((select count(*) = 1 from public.push_assinaturas), 'gestor vê apenas os próprios aparelhos');
delete from public.push_assinaturas;
reset role;
select test.ok((select count(*) = 1 from public.push_assinaturas where user_id = :G2::uuid), 'gestor não remove aparelhos de outro gestor');
select test.ok((select count(*) = 0 from public.push_assinaturas where user_id = :G1::uuid), 'gestor remove o próprio aparelho');

set role authenticated;
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :G1), false);
insert into public.notificacao_prefs (novo_cadastro) values (false);
select test.ok((select user_id = :G1::uuid and not novo_cadastro and resumo_diario from public.notificacao_prefs),
               'gestor grava as próprias preferências');
update public.notificacao_prefs set lembrete_visita = false;
select test.ok((select count(*) = 1 from public.notificacao_prefs where not lembrete_visita), 'gestor altera as próprias preferências');
select test.throws(format('insert into public.notificacao_prefs (user_id, novo_cadastro) values (%L, false)', :G2), '42501',
                   'gestor não grava preferências de outro');
reset role;

-- ---------------------------------------------------------------------------
-- Funções do agendador (service role)
-- ---------------------------------------------------------------------------
set role service_role;
select test.ok((select public.marcar_envio('resumo_diario', current_date)), 'primeiro envio do dia é marcado');
select test.ok((select not public.marcar_envio('resumo_diario', current_date)), 'segundo envio no mesmo dia é evitado');
select test.ok((select public.contar_atrasados() >= 1), 'contagem de atrasados para o alerta diário');
reset role;

select test.throws('update public.sistema_config set site_url = ''http://inseguro.com''', '23514', 'endereço do site exige https');
