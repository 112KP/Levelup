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
npm run build:mobile
```

### Vitals

The ability-streak and vitals migrations must already be applied before deploying the matching
frontend. The vitals migration was run manually and its SQL file is intentionally not retained in
this repository. This repository does not apply schema changes remotely.

After applying it, verify with a disposable profile whose six abilities and four current/max vital
values start at 10 and 100/100:

- Add 21 Strength: Body and Mind ceilings each rise by 21; current values do not rise.
- Reset, then add 21 Strength and 21 Agility on the same day: Body and Mind ceilings each rise by
  42.
- Add 21 Intelligence or Career: only Mind rises. Add 21 Sense: only Emotion rises. Add 21 Vitality:
  only Energy rises.
- On the migration backfill, confirm Mind current rises by 50 and Body current is only clamped if
  needed; Emotion and Energy current start at their new ceilings.
- Raise a ceiling from 100 to 121, then apply a +5 Body effect: Body current becomes 105.
- Apply negative item/dungeon effects below zero and positive effects above max: values clamp to 0
  and their ceiling. Check Fatigue clamps to 0–100.
- Attempt authenticated client writes to the new current/max columns and any profile max; they must
  be denied. Confirm a newly created profile starts all four vitals at 100/100.
- Run the migration a second time and confirm current values are preserved apart from clamping.
- Grant XP sufficient for a level-up; no current or max vital value should change.

### Account progress reset

The account reset RPC must be installed in Supabase before deploying the matching frontend. Its
migration was applied manually and its SQL file is intentionally not retained in this repository.
From **Settings > Account Reset**, type `RESET` to return progress to the initial level, stats, vital
values, fatigue, gold, rank, streaks, and history. Quest templates, skills, items, dungeons, unlocked
titles, account, profile name, and timezone are preserved. Test with a disposable account before
using it on a personal account.

### Inventory item effects

Inventory item effects can change Body, Mind, Emotion, Energy, Fatigue, and Gold; they do not
change abilities. Run [the item-effect migration](./supabase/migrations/20261031223300_remove_item_ability_effects.sql)
manually in the Supabase SQL editor so using a consumable ignores any legacy ability-effect keys.

## Android app

The Android app uses Capacitor and shares this repository's React application. The web app continues to build for GitHub Pages; Android bundles use a separate root-based Vite build.

### Local Android development

Install Android Studio and its Android SDK, then install the project dependencies and provide the Supabase values in `.env.local` as described above.

```bash
npm install
npm run cap:sync
npm run cap:open
```

`cap:sync` builds the mobile web bundle and copies it into the Android project. In Android Studio, run the app on an emulator or connected device. To update the Android project after web code changes, rerun `npm run cap:sync`.

Web pushes and Android releases are separate: the shared app code is built for both, but a web deployment does not update installed Android apps. For each mobile release, generate a new signed bundle, increment its version code, and publish it through Play Console.

The initial Android application ID is `io.github.keyurpatel.levelup`, based on the GitHub username. Confirm that it is available before creating the Play Console listing; changing it after publishing means creating a different app.

### Google sign-in setup

Native Google sign-in opens the system browser and returns through the app's custom URL scheme. In Supabase **Authentication > URL Configuration**, add this Redirect URL:

```text
io.github.keyurpatel.levelup://login-callback
```

Keep the Supabase project's existing OAuth callback URL registered in the Google OAuth client. The Android app ID, Android manifest deep link, and Supabase redirect URL must stay aligned.

### Account deletion and privacy

The app and web deletion resource are available at:

- Privacy policy: `https://112kp.github.io/Levelup/privacy-policy.html`
- Account deletion instructions: `https://112kp.github.io/Levelup/delete-account.html`

Signed-in users can also open **Delete account** from the account menu. They must type `DELETE` to confirm. Deletion is handled by the Supabase Edge Function `delete-account`, which verifies the signed-in user, removes their rows from the user-owned tables, and deletes their Supabase Auth account. The function uses Supabase's server-side `SUPABASE_SERVICE_ROLE_KEY`; never put this key in `.env.local`, Vite variables, the Android project, or Git.

Deploy the function to the linked Supabase project:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase functions deploy delete-account
```

The function requires Supabase's `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` Edge Function environment variables. Confirm both are present in the project's Edge Function secrets before enabling account deletion in a release. After deployment, test deletion with a disposable account and verify its auth user and related records are removed.

The public policy describes the data and services currently visible in this codebase. Review it against the actual Supabase project configuration, Google OAuth settings, provider retention practices, and applicable legal requirements before publication.

The GitHub Pages deployment must be enabled and publicly reachable before using the policy and deletion URLs in Play Console. Pages only receives these files after the deployment workflow publishes the repository's `main` branch.

### Play Console reviewer access

Create a dedicated email-and-password test account in the app and ensure it is verified and can sign in. Keep it populated with representative, non-sensitive sample data so reviewers can access the authenticated screens. In Play Console's **App content > App access**, provide the test email, a temporary password, and concise steps to reach the app's features. Enter credentials only in Play Console, not in this repository or a public issue. Confirm the account remains available during review.

### Google Play release

In Android Studio, use **Build > Generate Signed Bundle / APK > Android App Bundle** to create a signed `.aab` for Play Console. Keep the upload key and passwords backed up securely and out of Git. Increment `versionCode` in `android/app/build.gradle` for every upload.

Before submitting, complete the Play Console app listing, Data safety declaration, content rating, target audience, app access instructions, screenshots, and store graphic. These details require the publisher's account and accurate product/data-use information; they are not generated by this repository.

## GitHub Actions

Pull requests targeting `develop` or `main` run lint, typecheck, and build through `.github/workflows/ci.yml`.

Pushes to `main` use `.github/workflows/deploy.yml` to build and deploy to GitHub Pages. Add these repository secrets under **Settings > Secrets and variables > Actions > New repository secret**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

If GitHub Pages is unavailable for this private repository on the active GitHub plan, make the repository public or use a plan that supports Pages for private repositories before relying on its public policy and deletion URLs.
