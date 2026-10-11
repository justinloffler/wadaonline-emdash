import { getEmDashCollection, getEmDashEntry, sanitizeHref, type EmDashCollections, type FileValue } from 'emdash';

/** Read all published records, including collections larger than one API page. */
export async function getWadaCollection<C extends keyof EmDashCollections>(collection: C) {
  const first = await getEmDashCollection(collection, { status: 'published', limit: 100 });
  if (first.error) throw first.error;
  const entries = [...first.entries];
  const cacheHints = [first.cacheHint];
  let cursor = first.nextCursor;
  while (cursor) {
    const page = await getEmDashCollection(collection, { status: 'published', limit: 100, cursor });
    if (page.error) throw page.error;
    entries.push(...page.entries);
    cacheHints.push(page.cacheHint);
    cursor = page.nextCursor;
  }
  return { entries, cacheHints };
}

export async function getWadaProfile() {
  const result = await getEmDashEntry('site_profile', 'site');
  if (result.error) throw result.error;
  return result;
}

export function documentHref(file?: FileValue | null, originalUrl?: string | null) {
  return sanitizeHref(file?.url || (file?.id ? `/_emdash/api/media/file/${encodeURIComponent(file.id)}` : originalUrl) || '');
}
