# 😂 Mentira Profissional — GitHub Pages + Supabase

Party game multiplayer inspirado em mesas caóticas de jogos de cartas: cada jogador escolhe seu personagem no próprio computador, entra em uma sala por código e as ações são sincronizadas em tempo real.

## Stack

- Next.js 16 + App Router
- `output: export` para gerar um site 100% estático para GitHub Pages
- Three.js para o cenário 3D leve
- Anime.js 4 para transições
- Supabase Realtime Broadcast + Presence para multiplayer e chat

## Por que Supabase?

O GitHub Pages hospeda arquivos estáticos. Ele não executa um servidor Node/Socket.IO para manter WebSockets próprios. O Next.js consegue exportar a aplicação inteira para HTML/CSS/JS estáticos, e esse resultado pode ser publicado no GitHub Pages.

Por isso, nesta versão o **frontend fica no GitHub Pages** e o **Realtime fica no Supabase**. Você não precisa manter um servidor próprio.

## 1. Criar o projeto no Supabase

Crie um projeto em https://supabase.com/.

No painel do projeto, pegue:

- Project URL
- Publishable key (`sb_publishable_...`)

Esta aplicação usa apenas Realtime Broadcast/Presence, então não é necessário criar tabelas para a primeira versão.

## 2. Configurar os secrets do GitHub

No repositório:

`Settings` → `Secrets and variables` → `Actions` → `New repository secret`

Crie:

`NEXT_PUBLIC_SUPABASE_URL`

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Não coloque chave `sb_secret_...` no código do site.

## 3. Nome do repositório

O workflow calcula automaticamente o base path usando o nome do repositório.

Exemplo:

`https://pdrfranca.github.io/mentira-profissional/`

Se seu repositório tiver outro nome, o workflow já ajusta o caminho.

## 4. Publicar

Suba estes arquivos para a branch `main`.

Depois:

`Settings` → `Pages` → `Build and deployment` → `Source` → **GitHub Actions**

O workflow `.github/workflows/deploy.yml` instala, gera `out/` e publica o resultado.

## 5. Jogar

Abra o endereço do GitHub Pages em dois computadores ou celulares.

Computador 1:

`Criar mesa` → escolhe personagem → compartilha o código.

Computador 2:

`código` → `Entrar` → escolhe personagem.

Cada navegador mantém seu personagem no `localStorage`, e os participantes da mesma sala aparecem na mesa por Presence.

## Multiplayer

A sala usa um canal Realtime:

`room:ABCDE`

- Presence: jogadores conectados
- Broadcast: estado do jogo, votos e chat
- O dono da mesa atua como autoridade da rodada nesta versão

Como a autoridade fica no navegador do host, atualizar/fechar o navegador do host encerra a sessão atual. Uma versão posterior pode migrar a autoridade para um estado persistido em banco e fazer host migration.

## Desenvolvimento local

```bash
npm install
npm run dev
```

Crie `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxx
NEXT_PUBLIC_BASE_PATH=
```

Abra `http://localhost:3000`.

## Build estático

```bash
npm run build
```

O Next.js cria a pasta `out/`.

Para servir localmente:

```bash
npx serve@latest out
```
