# Recepção

Sistema web (PWA) para cadastro de pessoas na recepção, com dois perfis de acesso (**Recepção** e **Gestor**), banco de dados PostgreSQL com Row Level Security, trilha de auditoria e painel administrativo. Pensado primeiro para celular, funciona também em tablets e computadores, e pode ser instalado na tela inicial como aplicativo.

**Stack:** Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind CSS 4 · componentes no padrão shadcn/ui · Lucide · Supabase (PostgreSQL, Auth, RLS) · Zod.

---

## Funcionalidades

| Perfil | O que pode fazer |
|---|---|
| **Recepção** | Cadastrar pessoas (nome + número); ver os próprios cadastros; consultar **todos** os cadastros somente se o gestor liberar; alterar o próprio nome e senha. |
| **Gestor** | Tudo da recepção, mais: painel com indicadores reais e gráfico de 30 dias; listar, buscar (nome ou número, sem distinção de acentos), filtrar por período e responsável e ordenar os cadastros; editar; excluir com confirmação; exportar CSV; gerenciar usuários e permissões; redefinir senhas; consultar o histórico de atividades. |

Telas: login, início da recepção, cadastro, consulta, painel do gestor, atendimentos (funil), ficha da pessoa, gerenciamento de cadastros, equipe (usuários), histórico, configurações e minha conta.

### Acompanhamento pastoral (funil de etapas)

Depois do cadastro, cada pessoa passa por etapas com cores próprias:

🟡 **Aguardando contato** (prazo 24 h) → 🔵 **Aguardando agendamento** (prazo 3 dias) → 🔷 **Visita agendada** → 🟢 **Visita realizada** → ✅ **Acompanhamento concluído**. A qualquer momento a pessoa pode ir para ⚪ **Encerrado**, sempre com motivo.

- **Igreja obrigatória no cadastro.** As quatro igrejas já vêm configuradas; o aparelho lembra a última igreja usada.
- **Atendimentos** (gestor): abas por etapa no celular e quadro Kanban com arrastar e soltar no computador. Cada cartão tem os botões **Chamar no WhatsApp** (mensagem pronta), **Registrar contato** e **Mudar etapa**.
- **Registrar contato:** "conversou" avança a pessoa para *Aguardando agendamento*; "não atendeu" conta a tentativa; "não deseja visita" encerra o atendimento.
- **Regras garantidas pelo banco:** só gestores mudam etapas; avança ou volta uma etapa por vez; encerrar exige motivo; um atendimento encerrado ou concluído só sai dali reabrindo.
- **Cadastro repetido:** mesmo número **e** mesmo nome reabre o atendimento (ou registra o novo cadastro, se já estiver em andamento). Mesmo número com outro nome cria uma pessoa nova, e a ficha mostra o aviso "mesmo número de…".
- **Atrasos:** quem passa do prazo da etapa ganha a marca 🔴 *Atrasado*, e o painel lista quem precisa de atenção.
- **A recepção vê apenas a etapa das pessoas que ela mesma cadastrou.** Ela não vê contatos, histórico do atendimento nem configurações.
- **Configurações** (gestor): renomear e recolorir etapas, ajustar prazos, criar, reordenar, desativar ou excluir etapas intermediárias; gerenciar igrejas; editar a mensagem do WhatsApp (`{primeiro_nome}`, `{nome}`, `{gestor}`, `{igreja}`).
- **Linha do tempo** na ficha: cadastros, contatos, visitas e mudanças de etapa, com autor e horário.

### Visitas pastorais

- **Agendar visita** (gestor): data, horário, endereço (informado pela pessoa na conversa), quem fará a visita (um gestor, por exemplo o pastor) e observação. A pessoa vai automaticamente para *Visita agendada*. Essa etapa só é alcançada agendando; arrastar ou "Mudar etapa" para ela é recusado.
- **Agenda:** visitas sem registro do resultado (em vermelho), de hoje, de amanhã e dos próximos 30 dias, com o filtro **Minhas visitas**. Cada visita tem o botão de mapa (abre o endereço no Google Maps), o WhatsApp com mensagem de confirmação, **Registrar visita** e **Reagendar**.
- **Registrar visita:** *realizada* leva a pessoa para *Visita realizada*; *pessoa ausente* ou *cancelada* volta para *Aguardando agendamento*, para combinar nova data.
- **Retornos:** a partir de *Visita realizada* é possível agendar nova visita. Todas as visitas ficam no histórico da pessoa.
- **Atraso:** uma visita cujo dia passou sem registro do resultado aparece como atrasada no funil, na Agenda e no Painel.
- Encerrar, reabrir ou voltar a etapa cancela a visita pendente automaticamente.
- O **Painel** mostra as visitas de hoje, e a recepção não vê visitas nem endereços.

---

## Arquitetura de segurança

O navegador **nunca** conversa diretamente com o Supabase. Toda chamada parte do servidor Next.js (padrão *Backend-for-Frontend*). Assim:

- **Tokens fora do alcance de JavaScript.** A sessão fica em cookies `httpOnly`, `Secure` (em produção) e `SameSite=Lax`. Um eventual XSS não consegue roubar a sessão.
- **Nenhuma chave no frontend.** Nenhuma variável usa o prefixo `NEXT_PUBLIC_`, e a CSP restringe as conexões do navegador ao próprio site (`connect-src 'self'`).

As permissões são verificadas em **quatro camadas independentes**. Mudar a URL ou manipular a interface não dá acesso a nada:

1. **`proxy.ts`**: exige sessão válida em todas as páginas internas e bloqueia `/gestor/*` para quem não é gestor ativo, com redirecionamento 307 antes de qualquer renderização.
2. **Páginas e layouts** (`lib/auth.ts`): leem o papel e o status do **banco** a cada requisição (`requireUser` / `requireGestor`).
3. **Server Actions e rota de exportação**: cada uma repete a verificação antes de agir.
4. **Banco de dados**: as políticas RLS, os privilégios por coluna e os triggers impõem as regras mesmo para quem chamar a API do Supabase diretamente.

Outras proteções:

| Ameaça | Proteção |
|---|---|
| SQL Injection | Consultas parametrizadas pelo PostgREST/supabase-js. Os curingas de busca são escapados. Os parâmetros da URL são validados com Zod. |
| XSS | React escapa todo o conteúdo. CSP com *nonce* por requisição e `strict-dynamic`. Nenhum `dangerouslySetInnerHTML`. |
| CSRF | As Server Actions só aceitam POST e verificam a origem. Cookies `SameSite=Lax`. A exportação recusa requisições vindas de outros sites (`Sec-Fetch-Site`). |
| Clickjacking | `frame-ancestors 'none'` e `X-Frame-Options: DENY`. |
| Força bruta | Limite de tentativas por IP + e-mail e por e-mail, somado ao rate limit do Supabase Auth. |
| Escalada de privilégio | O papel vem só de `app_metadata` (definido pelo servidor) e é alterado só por gestor. Um trigger bloqueia mudanças de papel/permissão por não-gestores e impede remover o último gestor ativo. |
| Usuário desligado | Ao ser desativado, o acesso aos dados é bloqueado **na hora** (RLS) e o login fica bloqueado no Auth. |
| Adulteração de responsabilidade | `created_by`/`created_at`/`updated_by` são preenchidos por trigger. O cliente não tem privilégio de escrita nessas colunas. |
| Fórmulas em planilhas | O CSV exportado neutraliza células iniciadas por `= + - @`. |
| Dados em cache | O service worker armazena **apenas** arquivos estáticos. Páginas e dados pessoais nunca vão para o cache. |
| Auditoria | `audit_log` registra criação, edição (antes/depois), exclusão, alterações de usuários e permissões, redefinição de senha, login, logout e exportações. Nem o gestor pode alterar ou apagar o histórico. |

**LGPD:** coletamos apenas nome e número, o acesso é restrito por perfil (a recepção vê só os próprios cadastros, salvo autorização) e todas as operações ficam registradas com autor e horário.

---

## Configuração (passo a passo)

### 1. Criar o projeto no Supabase

1. Acesse <https://supabase.com/dashboard> e crie um projeto. Região sugerida: **South America (São Paulo)**.
2. Em **SQL Editor**, execute **na ordem** cada arquivo da pasta [`supabase/migrations`](supabase/migrations), um de cada vez (cole o conteúdo e clique em **Run**):
   1. `20261106000000_recepcao_init.sql`: tabelas, segurança e auditoria;
   2. `20261110000000_atendimento_pastoral.sql`: igrejas e acompanhamento pastoral;
   3. `20261112000000_visitas.sql`: agendamento das visitas.

   Rode apenas os arquivos que ainda não foram executados. Cadastros existentes entram automaticamente em "Aguardando contato".
   - Se preferir a CLI: `npx supabase link --project-ref <ref>` e depois `npx supabase db push`.

### 2. Ajustar a autenticação (importante)

Em **Authentication → Sign In / Providers → Email**:

- **Desative "Allow new users to sign up".** Só o gestor cria usuários, pelo próprio sistema. Mesmo se essa opção ficar ligada por engano, contas criadas por auto-cadastro nascem **inativas** e sem acesso a dados.
- Mantenha *Secure email change* ativo.

Recomendado em **Authentication → Sessions / Settings**:

- *JWT expiry*: 900 segundos (15 min). Sessões revogadas expiram mais rápido.
- Em planos que permitem, defina *Inactivity timeout* (ex.: 12 h).

### 3. Obter as chaves

Em **Project Settings → API Keys**:

| Variável | Onde encontrar | Observação |
|---|---|---|
| `SUPABASE_URL` | Project Settings → Data API → Project URL | |
| `SUPABASE_PUBLISHABLE_KEY` | *Publishable key* (ou a `anon` legada) | Usada em nome do usuário, sempre sujeita ao RLS. |
| `SUPABASE_SECRET_KEY` | *Secret key* (ou a `service_role` legada) | **Secreta.** Ignora o RLS. Usada só no servidor, para criar usuários, redefinir senhas e bloquear logins, sempre depois de confirmar que quem pede é gestor. |
| `APP_TIMEZONE` | — | Opcional. Padrão `America/Sao_Paulo`. |

```bash
cp .env.example .env.local
# preencha os valores
```

### 4. Criar o primeiro gestor

1. Em **Authentication → Users → Add user → Create new user**, informe e-mail e senha e marque *Auto Confirm User*.
2. No **SQL Editor**, promova esse usuário (troque o e-mail):

```sql
update public.profiles
   set role = 'gestor', active = true, full_name = 'Nome do Gestor'
 where email = 'gestor@suaempresa.com.br';
```

A partir daí, todos os outros usuários são criados pela tela **Equipe** do próprio sistema.

### 5. Rodar localmente

Requer Node.js 20.9+.

```bash
npm install
npm run dev        # http://localhost:3000
```

### 6. Publicar (produção)

Funciona em qualquer hospedagem com Node.js. Na **Vercel**:

1. Importe o repositório.
2. Cadastre as variáveis do passo 3 em *Settings → Environment Variables*.
3. Faça o deploy. O [`vercel.json`](vercel.json) já coloca o servidor em São Paulo (`gru1`), junto do banco.
4. Em *Settings → Git → Production Branch*, confirme a branch onde está o código.

O HTTPS é automático. O sistema já envia HSTS, e o PWA e os cookies `Secure` exigem HTTPS.

No **Render**: *New → Blueprint*, selecione o repositório (o arquivo [`render.yaml`](render.yaml) já traz build, start, região e variáveis) e preencha as três chaves do Supabase quando o Render pedir. Não defina `NODE_ENV` manualmente: o build precisa das dependências de desenvolvimento. No plano gratuito, o serviço "dorme" após um período sem acesso, e o primeiro acesso seguinte demora cerca de um minuto.

Em servidor próprio: `npm run build && npm start`, atrás de um proxy reverso com HTTPS (nginx, Caddy etc.) que repasse `X-Forwarded-For`/`X-Forwarded-Host`.

---

## Instalação no celular (PWA)

- **Android (Chrome):** abra o site e toque em **Instalar aplicativo** (ou menu ⋮ → *Adicionar à tela inicial*).
- **iPhone (Safari):** toque em **Compartilhar** → *Adicionar à Tela de Início*.

O aplicativo abre em tela cheia, sem a barra do navegador. Sem internet, mostra um aviso, porque os dados nunca ficam guardados no aparelho.

---

## Testes

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm run build       # build de produção
npm run test:db     # migration + RLS num PostgreSQL local descartável
```

`test:db` precisa do PostgreSQL 15+ instalado localmente (`initdb`, `pg_ctl`, `psql` e as extensões *contrib*). O script sobe um banco temporário com uma simulação mínima do ambiente Supabase, aplica as migrations e executa 139 verificações. Entre elas: anônimo sem acesso; recepção sem poder editar, excluir, ler o histórico, se promover ou forjar o responsável; usuário inativo bloqueado; auditoria com antes/depois; proteção do último gestor; integridade referencial; igreja obrigatória; regras de transição do funil; reabertura em cadastro repetido; recepção vendo só a etapa de quem cadastrou; proteção das etapas essenciais; agendamento, reagendamento e registro de visitas; cancelamento automático da visita ao encerrar; recepção sem acesso a endereços.

---

## Estrutura

```
app/
  login/                 tela e ação de login
  (app)/                 área autenticada (layout com menu)
    inicio/              início da recepção (com a etapa de cada cadastro)
    cadastrar/           formulário de cadastro
    consulta/            consulta da recepção (escopo definido pelo RLS)
    conta/               configurações da conta
    gestor/              área administrativa (exige gestor)
      atendimentos/      funil: abas (celular) e Kanban (computador)
      agenda/            visitas: sem registro, hoje, amanhã e próximos dias
      cadastros/         listagem, filtros e ficha da pessoa (linha do tempo)
      configuracoes/     etapas, igrejas e mensagem do WhatsApp
      mais/              menu complementar no celular
      usuarios/          equipe, permissões e senhas
      historico/         trilha de auditoria
      exportar/          exportação CSV
  actions/               Server Actions compartilhadas
  manifest.ts            Web App Manifest
components/              interface (ui/, app-shell/, pessoas/, charts/, audit/)
lib/                     auth, validação (Zod), dados, Supabase, formatação
proxy.ts                 sessão, CSP com nonce e bloqueio de rotas
public/sw.js             service worker (cache só de estáticos)
supabase/migrations/     esquema, RLS, triggers e funções
supabase/tests/          testes de segurança do banco
scripts/                 test-db.sh e geração de ícones
```

---

## Observações de operação

- **Usuários não são apagados, são desativados.** Quem fez cadastros continua vinculado a eles (integridade referencial), e a desativação corta o acesso imediatamente.
- **Limite de tentativas de login:** fica em memória, por instância. Com várias instâncias, troque `lib/rate-limit.ts` por um armazenamento compartilhado (ex.: Redis/Upstash).
- **Retenção (LGPD):** defina uma política de retenção para `pessoas` e `audit_log` conforme a finalidade do tratamento. A exclusão pelo gestor é registrada no histórico.
- **Tipos do banco:** `lib/database.types.ts` espelha a migration. Se o esquema mudar, regenere com `npx supabase gen types typescript --project-id <id>`.
