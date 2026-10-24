# Levelup project instructions

## Supabase MCP connection
This workspace has the Supabase MCP server connected. Use it ONLY to read
schema/table/RPC context so generated code matches the real database
accurately. Do NOT use it to create, alter, or drop tables, columns,
policies, or functions — all schema changes for this project are reviewed
and tested separately before being run in the Supabase SQL editor. If a
schema change seems needed, stop and say what's missing instead of
creating it yourself.

## Stack
- Frontend: React + TypeScript, Tailwind CSS, Vite, hosted on GitHub Pages
- Backend: Supabase (Postgres, Auth, RLS) — no custom server
- Types: always pull from src/types/database.types.ts, never redefine row shapes

## Visual style
Dark background (#070a12), glowing purple panel borders (#9b5cf0 edge,
rgba(168,110,255,0.38) border), blue accents (#3ec6ff) for interactive
elements, parrot-green glowing numbers (#c7ffe0 text-shadow #17b866),
Rajdhani for labels, JetBrains Mono for numbers.
