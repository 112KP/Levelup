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

## GitHub Actions

Pull requests targeting `develop` or `main` run lint, typecheck, and build through `.github/workflows/ci.yml`.

Pushes to `main` use `.github/workflows/deploy.yml` to build and deploy to GitHub Pages. Add these repository secrets under **Settings > Secrets and variables > Actions > New repository secret**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

GitHub Pages is currently unavailable for this private repository on the active GitHub plan. Make the repository public or use a plan that supports Pages for private repositories before merging a deployment change into `main`.
