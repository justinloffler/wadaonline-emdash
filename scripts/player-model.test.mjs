import test from 'node:test';
import assert from 'node:assert/strict';
import { derivePlayers } from './player-model.mjs';
const average = (slug,name,registration) => ({slug,data:{name,registration}});
test('repeated numbered identity shares a profile across teams, and input order does not change IDs', () => {
  const rows=[average('team-a','Adam Sumner','464'),average('team-b','Adam Sumner','464')];
  const first=derivePlayers(rows), reversed=derivePlayers([...rows].reverse());
  assert.equal(first.players.length,1); assert.equal(first.links.length,2);
  assert.equal(first.links[0].playerSlug,first.links[1].playerSlug);
  assert.equal(first.players[0].slug,reversed.players[0].slug);
});
test('different people with the same number remain separate and flagged', () => {
  const {players}=derivePlayers([average('ben','Ben Purvis','512'),average('david','David Froud','512')]);
  assert.equal(players.length,2);
  assert.ok(players.every(p=>p.data.registration_review==='Duplicate number — review'));
});
test('OCC and missing numbers never merge automatically even with the same name', () => {
  const {players}=derivePlayers([average('a','Chris Smith','OCC'),average('b','Chris Smith','OCC'),average('c','Pat Jones',''),average('d','Pat Jones','')]);
  assert.equal(players.length,4); assert.equal(new Set(players.map(p=>p.slug)).size,4);
  assert.ok(players.every(p=>p.data.registration_review==='OCC / unnumbered'));
});
test('name and registration normalization tolerates formatting differences', () => {
  const {players}=derivePlayers([average('a','Adam Sumner','464'),average('b','  ADAM  SUMNER ',' 464 ')]);
  assert.equal(players.length,1);
});
