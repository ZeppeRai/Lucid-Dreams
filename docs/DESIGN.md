# Design · Mesa Virtual Lucid Dreams

Baseado no documento "Mesa Virtual: passo a passo". Aqui ficam as decisões e o que mudei em relação a ele.

## Arquitetura

Site estático → só entrega a página. Mestre e jogadores falam direto com o Supabase:
Auth anônimo (identidade), Postgres + RLS (dados e permissões), Realtime (Broadcast para o passageiro, Postgres Changes para o salvo).

## Onde vive cada regra

| O quê | Arquivo |
|---|---|
| Sucesso = 5/6, Tropeço = 1, PR = sucesso automático | `src/dice.js` (puro, testado) |
| Custos de Alteração/Chute/Finalizador (v0.2) | um único objeto `ACOES` |
| Signos | `src/data/signos.json` (v0.2), dados e não código |
| Permissões | RLS em `supabase/migrations/` — o papel na tela é só conforto |

## Decisões que divergem do passo a passo

1. **`create_room` e `join_room` são funções `security definer`.** O doc cria a sala e o jogador-mestre com dois inserts do cliente; isso deixaria qualquer um se inserir como `gm`. Aqui `players` não tem policy de insert, e só `name`/`color` são editáveis direto (`grant update (name, color)`).
2. **Código da sala gerado no servidor** (`gen_room_code`, 5 letras sem O/0/I/1), com garantia de unicidade.
3. **`players unique (room_id, user_id)`**: reentrar com o mesmo login não duplica o jogador.
4. **`rolls.difficulty`** (coluna nova) para todos verem Sucesso/Falha igual.
5. **Rolagem secreta só pelo mestre** (`with check`), e `player_id` do insert tem que ser do próprio login, para ninguém rolar em nome de outro.
6. **Trigger em `tokens`**: quem não é mestre só consegue alterar `x`/`y`, nem `hidden`, `owner_user` ou `stats`.
7. **Funções com `set search_path = public`**, boa prática para `security definer`.
8. **Ficha (`sheets`) legível só por dono e mestre.** O doc quer que os outros vejam signo e Lucidez, mas RLS é por linha, não por campo. Na v0.2: uma view `sheet_public` (signo, Lucidez) para todos os membros. Isso também mantém a Deriva secreta de verdade, e não só escondida na tela.
9. **Realtime**: as tabelas entram na publicação `supabase_realtime`; Postgres Changes respeita RLS, então rolagem secreta e token escondido não vazam.

## Pendências e riscos conhecidos

- **Stats do Pesadelo** (`tokens.stats`) ficam legíveis por quem lê o token. Para segredo real: tabela à parte lida só pelo mestre (v0.4).
- **Dado sorteado no cliente.** Basta entre amigos; para rigor, mover para uma função SQL.
- **Perdeu o navegador, perdeu o perfil anônimo.** v0.1: mestre reatribui. Depois: PIN de 4 dígitos.
- **A v0.1 ainda não foi exercitada contra um Supabase real.** Foram verificados: build, testes unitários e o SQL num Postgres local (com `auth.uid()` simulado). Realtime e login anônimo só no teste com 3 telas.
- Confirmar limites atuais do plano gratuito do Supabase antes de decidir.

## Roteiro

0.1 salas + rolador · 0.2 fichas e botões de custo · 0.3 cena e tokens (Broadcast no arrasto, gravação ao soltar, x/y em 0–1) · 0.4 painel do Pesadelo · 0.5 extras sob demanda.
