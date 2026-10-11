"""Verify a Players migration against its pre-migration SQLite backup (read-only)."""
import sqlite3,json,sys,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
links=json.loads((root/'seed/wada-player-links.json').read_text())
def connect(p):
 c=sqlite3.connect(pathlib.Path(p).resolve().as_uri()+'?mode=ro',uri=True); c.row_factory=sqlite3.Row; return c
before=connect(sys.argv[2]); after=connect(sys.argv[1])
# All source fields and identities must be unchanged; only publication/revision bookkeeping may change.
ignored={'updated_at','published_revision_id','draft_revision_id','revision_number','_rev','version'}
columns=[r['name'] for r in before.execute('PRAGMA table_info(ec_stats)') if r['name'] not in ignored]
for row in before.execute('SELECT * FROM ec_stats'):
 actual=after.execute('SELECT * FROM ec_stats WHERE id=?',(row['id'],)).fetchone()
 for key in columns: assert row[key]==actual[key],(row['slug'],key,row[key],actual[key])
 assert not actual['draft_revision_id'],('pending draft',row['slug'])
# All other pre-existing content, accounts and menu records must remain identical.
tables=[r[0] for r in before.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'ec_%'") if r[0]!='ec_stats']
tables+=['users','credentials','_emdash_menu_items','_emdash_widgets']
for table in tables:
 a=[dict(r) for r in before.execute(f'SELECT * FROM "{table}" ORDER BY id')]
 b=[dict(r) for r in after.execute(f'SELECT * FROM "{table}" ORDER BY id')]
 assert a==b,('pre-existing table changed',table)
# Existing relations are preserved byte-for-byte, and exactly one player link is added per average.
for row in before.execute('SELECT * FROM _emdash_content_references'):
 actual=after.execute('SELECT * FROM _emdash_content_references WHERE id=?',(row['id'],)).fetchone()
 assert dict(row)==dict(actual),('existing relation changed',row['id'])
assert after.execute('SELECT count(*) FROM ec_players WHERE deleted_at IS NULL').fetchone()[0]==216
for link in links:
 rows=after.execute('''SELECT p.slug FROM _emdash_content_references r
 JOIN _emdash_relations rel ON rel.id=r.relation_id
 JOIN ec_stats s ON s.translation_group=r.parent_group
 JOIN ec_players p ON p.translation_group=r.child_group
 WHERE rel.slug='player_averages' AND s.slug=? AND s.locale='en' AND p.locale='en' ''',(link['statsSlug'],)).fetchall()
 assert [r[0] for r in rows]==[link['playerSlug']],link['statsSlug']
assert after.execute("SELECT count(*) FROM ec_players WHERE registration='512'").fetchone()[0]==2
assert after.execute("SELECT count(*) FROM ec_players WHERE name='Adam Sumner'").fetchone()[0]==1
print('Verified 216 Players, 217 linked averages, preserved original source fields, existing relationships, other content, accounts and credentials.')
