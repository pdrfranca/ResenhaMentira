# Supabase Realtime

O GitHub Pages hospeda o frontend estático. O Supabase Realtime faz a comunicação entre os computadores.

## 1. Projeto

Crie um projeto no Supabase.

## 2. Credenciais usadas pelo navegador

No painel do projeto, obtenha:

```text
Project URL
Publishable key
```

Cole no botão `⚙` dentro do jogo ou use as variáveis:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

## 3. Realtime

O jogo usa canais privados por código de sala no formato:

```text
mentira:ABCDE
```

São usados:

- Broadcast para estado, respostas, votos e chat.
- Presence para os jogadores conectados.

Não é necessário criar tabela para o MVP porque o estado da partida fica no host da sala e é enviado aos clientes por Realtime.

## 4. Segurança

A chave pública pode aparecer no frontend. Não exponha `service_role` nem outras chaves secretas.
