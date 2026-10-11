# WADA integration

Working project: `/Users/justinloffler/Developer/wadaonline`.

Source: the original Astro project's Git commit `dba1e7544d0a8d90fd7917bca1cc1e9a18b783ff`.
The committed snapshot was used because the original working tree is in iCloud and some file reads stall.
Any uncommitted changes in that source folder have not been imported.

## Imported and editable

The admin's WADA group contains Venues (4), Teams (24), Committee (4), Sponsors (10),
Documents (11), In memory (17), and WADA site details (1). All imported entries are published locally.
Team venues are entry pickers. Aliases are structured repeater rows. History and tributes
are Portable Text. Sponsors and committee members have optional media-library image fields.
Documents offer a PDF upload field; an uploaded file takes precedence over its original URL.
The 11 existing document links are preserved; remote PDFs have not yet been downloaded into the media library.

Public routes: `/`, `/teams/`, `/venues/`, `/about/`, `/sponsors/`, `/documents/`.
The original TeamCard component has been adapted to the current theme tokens.
The starter's EmDash layout and article pages remain available; its sample posts are no longer the homepage.
The current blue/Inter template styling follows this project's AGENTS.md rather than reproducing the original red/Archivo design.

## Editing

Start with `npm run dev` from this project and open `http://localhost:4321/_emdash/admin`.
Edit the `site` entry in WADA site details for the homepage headline, history and contact information.
Use the individual collection forms for team, venue, committee, sponsor and document changes.
Save and publish to update the server-rendered public pages. Keep captain contact details private.

## Repeatable import

`seed/wada-schema.json` defines the seven collections. `seed/wada.json` includes the original records.
To rebuild that seed from an original Astro checkout/snapshot:

```sh
node scripts/build-wada-seed.mjs /absolute/path/to/original-wada
npx emdash seed seed/wada.json --validate
npm run migrate:wada
```

The import uses `--on-conflict=skip`: existing entries and schema are preserved, including admin edits.
Do not use `update` for routine reimports. Existing databases require an explicit migration;
changing a bundled seed alone does not update their schema.

`seed/wada-site.json` applies branding and the primary menu separately. It was applied once.
Only reapply it intentionally: seed menu application replaces items even when conflict handling is `skip`.
`seed/seed.json` bundles the starter schema with the WADA model for a future fresh setup.

Before the initial import, the live SQLite database was backed up using SQLite's backup API to
`backups/before-wada-integration.db`; the previous homepage is `backups/starter-index.astro`.
The original projects have not been edited or removed. This site has not been deployed.

## League and history schema/data integration

The second stage adds 18 collections and 458 records: seasons, divisions, team lists,
fixtures, results, ladder baselines/standings, player averages, honours, cup events,
reports, rosters, photo metadata, records and checkouts. See [COMPETITION-EDITING.md](COMPETITION-EDITING.md)
for the model, coverage, editor workflow and repeatable migration commands.

All 14 referenced image originals are preserved locally in `migration-assets/`.
They still need media-library uploads. Public league/history routes remain to be ported.

## Players directory

Players is a separate master collection with 216 profiles, linked to all 217 imported
Player averages snapshots. Profiles contain a full name, registration, review flag,
aliases and notes. Team/season membership remains on the averages. Registration is
not unique; duplicate 512 and OCC values need editorial review, not automatic merges.
Run `npm run migrate:players` for an existing stage-two database after taking a backup.
The bundled seed and competition builder include the same model for fresh installs.

## Next stages

Port the season/results/stats/honour-roll routes using the normalized collections.
Retain the original ladder calculation and missing-round checks. Upload legacy PDFs and
competition images through the media library. Configure Cloudflare Workers, D1 and R2
after the local editing workflow and public routes are verified.

Players migration backup: `backups/before-players-import-20261011-213906/data.db`.
