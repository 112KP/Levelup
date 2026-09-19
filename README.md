# Levelup

Levelup is a React and TypeScript web application backed by Supabase and deployed to GitHub Pages.

## Branches

- `main`: production branch; pushes deploy to GitHub Pages.
- `develop`: integration branch for completed feature work.
- `feature/<short-description>`: short-lived feature branches created from `develop`.

## Development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set the Supabase project URL and public anon key in `.env.local`. Never commit that file.

Available checks:

```bash
npm run lint
npm run typecheck
npm run build
```
