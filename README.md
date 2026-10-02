# 😂 Mentira Profissional

Party game multiplayer para GitHub Pages + Supabase Realtime.

## Esta versão

Mantém a aparência visual da primeira versão do jogo (tema escuro, cyan/teal/rosa, cartões e tipografia original) e corrige o fluxo multiplayer.

### Correções principais

- A mensagem de chat aparece imediatamente para quem envia e também para todos os outros jogadores.
- O alvo recebe a primeira pergunta no próprio computador e consegue entregar as 3 respostas.
- O envio da resposta só libera a votação depois que o host recebe e sincroniza o estado.
- A resposta verdadeira passa a fazer parte do estado sincronizado para evitar perda da rodada se o host trocar.
- O canal Realtime agora é aguardado até ficar realmente `SUBSCRIBED` antes de enviar o primeiro evento.
- O host é definido corretamente ao criar a sala.
- O personagem pode ser alterado mesmo dentro da sala e a alteração é anunciada ao grupo.
- A presença atualiza os jogadores conectados.
- Se o alvo sair durante a fase de resposta, o host escolhe automaticamente outro jogador online para continuar a rodada.
- As configurações e o manual possuem rolagem própria e funcionam em telas baixas/celular.
- A identidade do personagem fica salva no `localStorage` de cada navegador.
- Exportação estática preparada para GitHub Pages.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## GitHub Pages

O workflow em `.github/workflows/deploy.yml` executa:

```text
npm install
npm run build
upload ./out
GitHub Pages
```

No repositório, use `Settings > Pages > Source > GitHub Actions`.

## Supabase

Abra a engrenagem no jogo e informe:

- Project URL
- Publishable key

Ou configure as variáveis de ambiente:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Nunca coloque uma `service_role`/secret no frontend.
