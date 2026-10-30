# Cérebrum · Sistema de RH

Sistema de RH do Hotel Fazenda Santa Bárbara — https://rhsantabarbara.com.br

## Tecnologias

- React, Vite, TypeScript, Tailwind CSS e shadcn/ui
- Supabase (banco, login, arquivos e funções)
- Vercel (publicação automática a cada envio na branch `main`)

## Rodar no computador

```sh
npm install
npm run dev
```

As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` ficam no arquivo `.env`.

## Publicação

- Site: a Vercel publica sozinha quando há envio para a `main`.
- Funções do Supabase: publicadas pelo GitHub Actions (`.github/workflows`).
- Mudanças no banco: arquivos em `supabase/migrations`, rodados no SQL Editor do Supabase.
