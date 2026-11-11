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

When game rules, player-facing labels, or formulas change, update the Player
Manual content in the same change.

## Inventory RPCs
- `use_item` checks the authenticated owner and locks the item row. Consumables with quantity at least one consume one and apply only their configured vital, fatigue, and gold effects with the existing clamps; materials consume one without stat effects; equipment must be equipped and is logged without consumption or one-off stat changes. Every successful use writes an `item_use` activity entry.
- Ability keys in item effects are positive-only display bonuses. `use_item` must never apply them to stored abilities; ability points come from streak milestones.
- `toggle_equip` checks ownership, locks the item row, and toggles `is_equipped` for equipment, materials, and consumables. The Inventory Equipment and Materials tabs show equipped items; equipped consumables remain in Consumables with an Equipped chip.
