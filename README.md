# WADA Online — EmDash

Western Area Darts Association website built with Astro and EmDash.
This install currently runs on Node.js with SQLite and local media storage.
Cloudflare Workers, D1 and R2 deployment is a future step.

## Local setup

Use Node.js 22.16 or newer and npm.

```sh
npm ci
cp .env.example .env
npx emdash secrets generate
```

Set `EMDASH_ENCRYPTION_KEY` in `.env` to the generated key, then start the site:

```sh
npm run dev
```

Open [EmDash admin](http://localhost:4321/_emdash/admin) and complete setup.
Choose **Sample content** to import the bundled WADA records.
Use `localhost` consistently for passkeys. Each fresh install creates its own
administrator account; no accounts, passkeys or live database are stored in Git.

## Current integration

- Public pages: home, teams, venues, about, sponsors and documents.
- Admin collections: directories, seasons, divisions, fixtures, results, ladder
  snapshots, player averages, honours and competition history.
- Separate **Players** directory: 216 profiles linked to 217 averages snapshots.
- 745 WADA seed records in total, sourced from the original committed Astro data.

League/history frontend routes still need porting. Fourteen original competition
images are preserved in `migration-assets/` and await media-library upload.
Document PDFs currently use their original URLs.

## Commands

```sh
npm run dev
npm run typecheck
npm run test:players
npm run build
npm run validate:wada
npm run validate:competitions
```

For migrations into an existing database, first take a SQLite backup and follow
the migration documentation. Changing a seed file alone does not migrate existing
collections. Stop the development server before `npm run migrate:players` to
avoid SQLite write locks.

## Project files

- `src/`: server-rendered Astro routes, layouts and components.
- `seed/`: schema, original content and repeatable migration mappings.
- `scripts/`: seed builders, Players migration and verification tools.
- `migration-assets/`: original competition images awaiting upload.
- [Integration notes](docs/WADA-INTEGRATION.md).
- [League and history editing guide](docs/COMPETITION-EDITING.md).

Local `.env`, databases, uploaded files, backups, dependency folders and build
outputs are excluded from Git. Back up the live database and uploads separately.
