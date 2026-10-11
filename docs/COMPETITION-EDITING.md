# WADA league and history editing

Open http://localhost:4321/_emdash/admin. Use **localhost** consistently for passkeys.
These are real EmDash collections with typed SQL columns, reference pickers,
structured repeaters and Portable Text; editors do not need to change JSON files.

## Imported content

| Admin group | Collection | Imported entries |
|---|---|---:|
| League | Divisions | 4 |
| League | Seasons | 1 |
| League | Season team lists | 4 (24 team links) |
| League | League rules | 1 |
| League | Fixtures | 45 |
| League | Match results | 12 |
| League | Official ladder snapshots | 4 |
| League | Ladder standings | 24 |
| WADA | Players | 216 |
| League | Player averages | 217 |
| History | Season honours | 3 |
| History | Shield awards | 14 |
| History | Cup competitions | 8 |
| History | Cup event history | 43 |
| History | Cup event results | 59 |
| History | Cup event rosters | 3 |
| History | Cup photos and draw sheets | 14 |
| History | Association records | 1 |
| Resources | Checkout charts | 1 |

Total: 674 league/history/player records, plus the 71 directory entries imported earlier (745 total).
The 14 photo entries contain captions, alt text, source paths and relationships.
Their original image files are preserved under `migration-assets/src/assets/`;
**they still need uploading into the EmDash media library and selecting in each Image field**.
The original document PDFs also remain linked at their original URLs.

## Entering league data

1. Create a Season, including its dates, state, round count and calendar events.
   Dates use YYYY-MM-DD without a time-zone conversion. Calendar events may be
   after the season end (for example, the January presentation).
2. Create a Season team list for each division and select its teams. Team membership
   belongs to the season; editing a team's current home venue does not move it between divisions.
3. Add Fixtures with a season, division, round, match date, home team and away team.
   Each fixture is one match. Use the same season/division/round/team pairing in Match results.
4. Enter both scores in Match results. **Forfeit identifies the team that forfeited**;
   its opponent wins. The imported round 10 walkover is 0–0 with `away` forfeiting.
   Do not change those scores to an invented score.
5. Create or select the person's profile in **Players**. Enter **Player averages** as a
   cumulative snapshot at a given round, and select its **Player** reference. Keep
   the name and registration as published, team, season and division on that snapshot. Score and darts
   are raw totals; averages should be calculated from them. Zero-dart rows must not divide by zero.
   `180s this season`, annual 180s and lifetime 180s are separate totals.
6. Official ladder snapshots are correction/baseline records: one per season/division/round.
   Add the associated Ladder standings separately. Preserve official points rather than
   inferring wins from points: the source includes adjustments and draws.
7. Save and publish when entries are ready. Before publishing, check that the home and
   away teams differ, belong to the selected season/division, and that the match has not
   already been entered. The schema validates individual fields, but does not yet enforce
   cross-field league rules or composite uniqueness in the admin editor.

Registration numbers are **not unique player identities**: the source contains repeated
numbers and `OCC`. All 217 snapshots remain separate and link to 216 Players profiles.
Adam Sumner (464) has two averages linked to one profile. Ben Purvis and David Froud
both have 512 in the source: their profiles remain separate and are flagged for review.
OCC/unnumbered players are not merged speculatively. Players hold identity and notes;
team and season belong to each average. A profile's Player averages field lists its related snapshots.
The Player picker is optional in the schema to permit migration of existing data, but
editors should always select a Player before publishing a new average.

## Coverage and publication

The committed original snapshot contains only the **Winter 2026 Division 1 draw** (15 rounds),
**round 10 results and official ladders** for all four divisions, and **round 10 statistics**.
No missing rounds, other draws or additional seasons have been fabricated.

This stage integrates the database and admin forms. The public league, results, statistics
and honour-roll pages have **not yet been ported**. The existing directory pages keep working.
When porting the league pages, preserve the original calculation in `src/lib/data.ts`:
latest official ladder baseline + later match results, missing-round checks, forfeit handling,
and minimum-games eligibility. Do not combine the round 10 snapshot with round 10 results again.

Historic winners, rosters and venues remain text as published, because historical teams
and names do not necessarily match current directory entries. Reports and introductions
are Portable Text with the original wording and paragraph boundaries preserved.
The checkout chart remains explicitly **unverified**, exactly as the source marks it.

## Files and repeatable migration

- `scripts/competition-schema.mjs`: editable collection/field definitions.
- `scripts/build-competition-seed.mjs`: converts an explicit original checkout/snapshot.
- `seed/wada-competition-schema.json`: generated definitions for the 19 league/history/player collections.
- `seed/wada-competition.json`: repeatable import, including dependency entries.
- `seed/wada-source-manifest.json`: per-record source pointers, file SHA-256 hashes and image manifest.
- `seed/seed.json`: full bundled model/content for a future fresh installation.

Regenerate and validate from the original committed snapshot:

```sh
node scripts/build-competition-seed.mjs /path/to/original-wada SOURCE_COMMIT_SHA
node scripts/verify-competition-source.mjs /path/to/original-wada
npm run validate:competitions
```

Before an import, back up `data.db` with SQLite's backup API (not a plain copy of a live WAL database).
Then run `npm run migrate:competitions`. It uses the local database directly with
`--on-conflict=skip`; it does not use the authentication bypass or create a temporary admin.
Reimports preserve existing records and admin edits. They add missing collections and entries. Existing collections are skipped, including
new fields in their seed definitions. Adding or changing fields on an existing collection
requires an explicit schema migration. For the separate Players directory, run
`npm run migrate:players` after backing up the database and stopping the dev server
with `npx astro dev stop` to avoid SQLite write locks. Restart with `npm run dev` afterward. This creates profiles, adds
the Player reference to existing averages, preserves pre-existing links, and refuses
to overwrite pending drafts. `scripts/player-model.mjs` defines conservative matching;
`seed/wada-player-links.json` records the fixed import mapping.
The import contains no menus, widgets, site settings or user records.

The directory seed entries are included solely to resolve dependency references by stable seed ID;
existing directory values are skipped. Do not change the conflict policy to `update`.

For an initial import, verify all stored data and links:

```sh
python3 scripts/verify-competition-db.py data.db backups/BEFORE_IMPORT.db
```

This comparison intentionally fails if imported records are edited later; it is an import
verification tool, not a rule requiring admins to keep the original data forever.

Source: original Git commit `dba1e7544d0a8d90fd7917bca1cc1e9a18b783ff`.
Uncommitted changes in the old iCloud working tree are not included.
EmDash reference: https://docs.emdashcms.com/themes/seed-files/ and
https://docs.emdashcms.com/reference/field-types/ (verified using the docs MCP server).

The Association records collection uses the internal slug `association_records` to avoid
a collision between generated types and TypeScript’s built-in `Record` utility.
