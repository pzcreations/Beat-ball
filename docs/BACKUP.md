# Backup do banco de dados

O GitHub gera **toda semana (domingo, 3h da manhã)** uma cópia completa do banco do Supabase. Isso inclui cadastros, igrejas, etapas, histórico, contatos, visitas e usuários. A cópia é **criptografada com AES-256** e guardada por **90 dias** na aba **Actions** do repositório.

> **Por que criptografado?** O repositório pode ser público. Sem a senha de backup (`BACKUP_PASSPHRASE`), o arquivo é ilegível para qualquer pessoa.

---

## Configuração (uma vez)

### 1. Pegar a string de conexão do Supabase

1. Abra o projeto no Supabase e clique em **Connect** (botão verde no topo).
2. Escolha **Connection String** → tipo **URI** → **Session pooler**.
   - Use o **Session pooler**: a conexão "Direct" não funciona a partir do GitHub.
3. Copie o endereço. Ele tem este formato:
   `postgresql://postgres.SEU-PROJETO:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`
4. Troque `[YOUR-PASSWORD]` pela **senha do banco**. Se não souber a senha, redefina em **Project Settings → Database → Reset database password**. O sistema não usa essa senha, então nada para de funcionar.
   - Se a senha tiver caracteres especiais (`@ : / ? # %`), prefira gerar uma senha só com letras e números.

### 2. Criar a senha do backup

Crie uma senha **longa**, com 16 caracteres ou mais (uma frase serve, por exemplo `cadastro-visita-planalto-2026-oracao`).

**Guarde essa senha num lugar seguro, fora do computador e do GitHub.** Sem ela, os backups não podem ser abertos, nem por você.

### 3. Cadastrar os dois segredos no GitHub

1. No repositório, abra **Settings → Secrets and variables → Actions**.
2. Clique em **New repository secret** e crie:
   - **Name:** `SUPABASE_DB_URL` · **Secret:** o endereço do passo 1, já com a senha.
   - **Name:** `BACKUP_PASSPHRASE` · **Secret:** a senha do passo 2.

### 4. Testar agora

1. Abra a aba **Actions → Backup do banco → Run workflow → Run workflow**.
2. Espere 1 a 2 minutos. O resultado esperado é ✅ verde.
3. Clique na execução: no fim da página, em **Artifacts**, aparece `backup-recepcao-AAAA-MM-DD`.

Se ficar ❌ vermelho, abra a execução e veja a mensagem. As causas mais comuns são o segredo com o nome errado, a senha do banco errada ou o uso da conexão "Direct" em vez de "Session pooler".

---

## Restaurar (em caso de necessidade)

> Restaurar **substitui todos os dados atuais** pelos do backup. Faça com calma e, se possível, com ajuda técnica.

Procedimento testado para recuperar dados **no mesmo projeto** (por exemplo, depois de uma exclusão por engano):

1. **Baixe** o arquivo em **Actions → (execução da data desejada) → Artifacts** e descompacte o `.zip`.
2. **Descriptografe**, num computador com GnuPG instalado. O comando pede a senha do backup:
   ```bash
   gpg --decrypt recepcao-AAAA-MM-DD.dump.gpg > recepcao.dump
   ```
3. **Esvazie as tabelas atuais.** No SQL Editor do Supabase, rode:
   ```sql
   do $$ declare r record; begin
     for r in select tablename from pg_tables where schemaname = 'public' loop
       execute format('truncate table public.%I cascade', r.tablename);
     end loop;
   end $$;
   ```
4. **Restaure os dados**, com o PostgreSQL 17 instalado (ou o Docker `postgres:17`), usando a mesma string de conexão do segredo `SUPABASE_DB_URL`:
   ```bash
   PGOPTIONS='-c session_replication_role=replica' \
   pg_restore --data-only --no-owner --no-privileges --schema=public \
     --dbname "SUPABASE_DB_URL" recepcao.dump
   ```
   O ajuste `session_replication_role=replica` evita que as automações do banco (como o histórico) rodem de novo durante a restauração.
5. **Apague os arquivos** `recepcao.dump` do computador: eles contêm dados pessoais.

Os logins (schema `auth`) também estão no backup. Em geral não é preciso restaurá-los, porque os usuários continuam existindo no Supabase. Para recriar o sistema num **projeto novo**, rode antes todas as migrations da pasta `supabase/migrations` e peça ajuda técnica para restaurar também os usuários.

---

## Observações

- **Custo:** gratuito. Cada execução leva cerca de 1 minuto do GitHub Actions.
- **Repositório público:** o GitHub **desativa agendamentos** depois de 60 dias sem nenhuma alteração no repositório, e avisa por e-mail antes. Se isso acontecer, abra **Actions → Backup do banco** e clique em **Enable workflow**.
- **Mais segurança:** considere tornar o repositório **privado** em **Settings → General → Danger Zone → Change visibility**. O backup continua funcionando igual.
- O backup não substitui o plano pago do Supabase. Ele cobre o risco principal (perder os dados) sem custo.
