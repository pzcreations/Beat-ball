# Recepção

Sistema web (PWA) para cadastro de pessoas na recepção, com dois perfis de acesso (**Recepção** e **Gestor**), banco de dados PostgreSQL com Row Level Security, trilha de auditoria e painel administrativo. Pensado primeiro para celular, funciona também em tablets e computadores, e pode ser instalado na tela inicial como aplicativo.

**Stack:** Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind CSS 4 · componentes no padrão shadcn/ui · Lucide · Supabase (PostgreSQL, Auth, RLS) · Zod.

---

## Funcionalidades

| Perfil | O que pode fazer |
|---|---|
| **Recepção** | Cadastrar pessoas (nome + número); ver os próprios cadastros; consultar **todos** os cadastros somente se o gestor liberar; alterar o próprio nome e senha. |
| **Gestor** | Tudo da recepção, mais: painel com indicadores reais e gráfico de 30 dias; listar, buscar (nome ou número, sem distinção de acentos), filtrar por período e responsável e ordenar os cadastros; editar; excluir com confirmação; exportar CSV; gerenciar usuários e permissões; redefinir senhas; consultar o histórico de atividades. |

Telas: login, início da recepção, cadastro, consulta, painel do gestor, gerenciamento de cadastros, edição, equipe (usuários), histórico e minha conta.

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
2. Em **SQL Editor**, cole e execute todo o conteúdo de [`supabase/migrations/20261106000000_recepcao_init.sql`](supabase/migrations/20261106000000_recepcao_init.sql).
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
3. Faça o deploy.

O HTTPS é automático. O sistema já envia HSTS, e o PWA e os cookies `Secure` exigem HTTPS.

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

`test:db` precisa do PostgreSQL 15+ instalado localmente (`initdb`, `pg_ctl`, `psql` e as extensões *contrib*). O script sobe um banco temporário com uma simulação mínima do ambiente Supabase, aplica a migration e executa 55 verificações. Entre elas: anônimo sem acesso; recepção sem poder editar, excluir, ler o histórico, se promover ou forjar o responsável; usuário inativo bloqueado; auditoria com antes/depois; proteção do último gestor; integridade referencial.

---

## Estrutura

```
app/
  login/                 tela e ação de login
  (app)/                 área autenticada (layout com menu)
    inicio/              início da recepção
    cadastrar/           formulário de cadastro
    consulta/            consulta da recepção (escopo definido pelo RLS)
    conta/               configurações da conta
    gestor/              área administrativa (exige gestor)
      cadastros/         listagem, filtros, edição e exclusão
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
