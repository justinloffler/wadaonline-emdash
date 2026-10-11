"""Read-only verification of seeded fields and ordered relationships.
Usage: python3 scripts/verify-competition-db.py DATABASE [PRE_IMPORT_BACKUP]
"""
import json, pathlib, sqlite3, sys
root = pathlib.Path(__file__).resolve().parent.parent
seed = json.loads((root / 'seed/wada-competition.json').read_text())
new = json.loads((root / 'seed/wada-competition-schema.json').read_text())
def connect(path):
    db = sqlite3.connect(pathlib.Path(path).resolve().as_uri() + '?mode=ro', uri=True)
    db.row_factory = sqlite3.Row
    return db
c = connect(sys.argv[1])
fields_checked = links_checked = records_checked = 0
for collection in new['collections']:
    slug = collection['slug']
    for entry in seed['content'][slug]:
        row = c.execute(f'SELECT * FROM "ec_{slug}" WHERE slug=? AND locale=?', (entry['slug'], 'en')).fetchone()
        assert row is not None, (slug, entry['slug'], 'missing entry')
        assert row['status'] == 'published', (slug, entry['slug'], 'not published')
        records_checked += 1
        for field in collection['fields']:
            key = field['slug']
            if key not in entry['data']:
                continue
            expected = entry['data'][key]
            if field['type'] == 'reference':
                validation = json.loads(c.execute('''SELECT f.validation FROM _emdash_fields f
                    JOIN _emdash_collections col ON col.id=f.collection_id
                    WHERE col.slug=? AND f.slug=?''', (slug, key)).fetchone()[0])
                target = validation['targetCollection']
                actual = [r[0] for r in c.execute(f'''SELECT target.slug FROM _emdash_content_references link
                    JOIN _emdash_relations relation ON relation.id=link.relation_id
                    JOIN "ec_{target}" target ON target.translation_group=link.child_group AND target.locale='en'
                    WHERE relation.slug=? AND link.parent_group=? ORDER BY link.sort_order''',
                    (validation['relation'], row['translation_group']))]
                expected = expected if isinstance(expected, list) else [expected]
                expected = [r.split(':', 2)[2] for r in expected]
                assert actual == expected, (slug, entry['slug'], key, actual, expected)
                links_checked += len(actual)
            else:
                actual = row[key]
                if field['type'] in ('repeater', 'portableText', 'json', 'multiSelect'):
                    actual = json.loads(actual)
                elif field['type'] == 'boolean':
                    actual = bool(actual)
                assert actual == expected, (slug, entry['slug'], key, actual, expected)
                fields_checked += 1
if len(sys.argv) > 2:
    before = connect(sys.argv[2])
    # The import must not mutate accounts, credentials, site branding, menus,
    # or any pre-existing directory entries. New schema/seed bookkeeping may change.
    tables = [f'ec_{col["slug"]}' for col in seed['collections'] if col['slug'] not in {s['slug'] for s in new['collections']}]
    tables += ['users', 'credentials', '_emdash_menu_items', '_emdash_widgets']
    for table in tables:
        a = [dict(r) for r in before.execute(f'SELECT * FROM "{table}" ORDER BY id')]
        b = [dict(r) for r in c.execute(f'SELECT * FROM "{table}" ORDER BY id')]
        assert a == b, f'Pre-existing data changed in {table}'
    print('Existing directory entries, accounts, passkeys, menus and widgets unchanged.')
print(f'Verified {records_checked} records, {fields_checked} stored field values and {links_checked} ordered relationship targets.')
