# 😂 Mentira Profissional

Party game multiplayer para GitHub Pages.

## Stack

- Next.js 16 + static export
- Three.js para o ambiente 3D leve
- Anime.js para transições
- Supabase Realtime para Presence + Broadcast

## Rodar local

```bash
npm install
npm run dev
```

## Multiplayer

O GitHub Pages não executa servidor Node/Socket.IO. O frontend estático usa Supabase Realtime para conectar as máquinas.

1. Crie um projeto no Supabase.
2. No Dashboard, copie a Project URL e a Publishable key.
3. No jogo, abra ⚙ → Multiplayer e cole as duas informações.
4. Alternativamente, configure `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

5. Para GitHub Pages, configure os mesmos valores em:
   `Settings → Secrets and variables → Actions`.

Crie os secrets:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Não use a `service_role`/secret key no navegador.

## Publicação

O workflow em `.github/workflows/deploy.yml` gera `out/` e publica no GitHub Pages.

No repositório, em `Settings → Pages`, deixe `Source: GitHub Actions`.

## Realtime

O jogo usa um canal público por sala no formato `mentira:ABCDE`, Presence para a lista de jogadores e Broadcast para estado, votos e chat. O Broadcast do chat usa `self: true`, então a própria pessoa que envia também recebe a mensagem no seu navegador.
