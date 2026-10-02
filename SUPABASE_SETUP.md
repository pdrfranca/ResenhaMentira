# Multiplayer com Supabase Realtime

O jogo não precisa de banco de dados para funcionar. Ele usa um canal público por sala, Presence para presença dos jogadores e Broadcast para eventos do jogo e chat.

## 1. Criar o projeto

No Supabase, crie um projeto novo.

## 2. Copiar as credenciais

No Dashboard, abra o diálogo Connect ou Settings → API Keys e copie:

- Project URL
- Publishable key (`sb_publishable_...`)

Não use a Secret key no navegador.

## 3. Configurar o jogo

Você pode abrir ⚙ no jogo e colar os valores. Eles ficam salvos apenas no localStorage daquele navegador.

Ou, localmente, crie `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

## 4. GitHub Pages

No GitHub, abra:

`Settings → Secrets and variables → Actions`

Crie:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

O workflow lê esses secrets durante o build.

## 5. Realtime

O aplicativo usa canais públicos. Caso o serviço Realtime esteja desativado no projeto, ative o Realtime no Dashboard.

Não há SQL obrigatório para esse modo do jogo.
