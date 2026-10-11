import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { resolve, basename } from 'node:path';

// Source is an explicit checkout/snapshot; running this never changes the source.
const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/build-wada-seed.mjs /path/to/original-wada');
const schema = JSON.parse(await readFile(new URL('../seed/wada-schema.json', import.meta.url), 'utf8'));
const root = resolve(source, 'src/content');
const content = {};
for (const collection of ['venues', 'teams', 'committee', 'sponsors', 'documents', 'memorials']) {
  content[collection] = [];
  for (const file of (await readdir(resolve(root, collection))).filter(f => f.endsWith('.json')).sort()) {
    const data = JSON.parse(await readFile(resolve(root, collection, file), 'utf8'));
    const slug = basename(file, '.json');
    if (collection === 'teams') {
      data.aliases = (data.aliases ?? []).map(name => ({ name }));
      if (data.venue) data.venue = `$ref:venues:${data.venue}`;
    }
    if ('order' in data) { data.display_order = data.order; delete data.order; }
    if ('venueNote' in data) { data.venue_note = data.venueNote; delete data.venueNote; }
    if (collection === 'documents' && data.file) {
      throw new Error(`${file}: local document needs a media upload before import`);
    }
    if (collection === 'memorials' && data.tribute) data.tribute = paragraphs([data.tribute]);
    content[collection].push({ id: `${collection}:${slug}`, slug, status: 'published', data });
  }
}
const venues = new Set(content.venues.map(e => `$ref:${e.id}`));
for (const team of content.teams) {
  if (team.data.venue && !venues.has(team.data.venue)) throw new Error(`Unresolved venue: ${team.slug}`);
}
const settings = JSON.parse(await readFile(resolve(root, 'settings/site.json'), 'utf8'));
const about = await readFile(resolve(source, 'src/pages/about.astro'), 'utf8');
const story = about.split('<div class="text">')[1]?.split('</div>')[0];
const intro = [...(story ?? '').matchAll(/<p>([^<]+)<\/p>/g)].map(m => m[1]);
if (!intro.length) throw new Error('Original About page story could not be extracted');
content.site_profile = [{ id: 'site_profile:site', slug: 'site', status: 'published', data: {
  title: settings.name, short_name: settings.shortName,
  headline: 'Every throw. Every team. Every Wednesday.',
  tagline: 'Wednesday nights · Western suburbs · Since 1989',
  content: paragraphs(intro), email: settings.email, facebook: settings.facebook,
  home_ground: settings.homeGround.name, home_address: settings.homeGround.address,
  results_due: settings.resultsDue, eligibility_notice: settings.eligibilityNotice,
}}];
function paragraphs(values) {
  return values.map((text, i) => ({ _type: 'block', _key: `paragraph-${i}`, style: 'normal', markDefs: [], children: [{ _type: 'span', _key: `span-${i}`, text, marks: [] }] }));
}
const seed = { version: '1', meta: { name: 'WADA directory import' }, collections: schema.collections, content };
await mkdir(new URL('../seed/', import.meta.url), { recursive: true });
await writeFile(new URL('../seed/wada.json', import.meta.url), JSON.stringify(seed, null, 2) + '\n');
console.log(Object.fromEntries(Object.entries(content).map(([key, values]) => [key, values.length])));
