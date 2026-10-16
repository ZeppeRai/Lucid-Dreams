# Lucid Dreams · Mesa Virtual

Mesa virtual para o RPG **Lucid Dreams**: site estático (Vite + JS puro) ligado ao **Supabase** (Postgres, login anônimo, Realtime). Sem servidor próprio.

Design completo e roteiro de versões: [`docs/DESIGN.md`](docs/DESIGN.md).

## Rodando

1. Crie um projeto no Supabase e ative **Authentication → Anonymous sign-ins**.
2. Rode `supabase/migrations/0001_schema.sql` no SQL Editor.
3. `cp .env.example .env` e preencha URL e anon key.
4. `npm install && npm run dev`
5. `npm test` roda os testes das regras de dado.

## Estado

| Versão | Entrega | Status |
|---|---|---|
| 0.1 | Salas, entrada por código, rolador animado | **código pronto, falta testar contra um Supabase real** |
| 0.2 | Fichas + botões de custo | a fazer |
| 0.3 | Cena e tokens arrastáveis | a fazer |
| 0.4 | Painel do Pesadelo | a fazer |
