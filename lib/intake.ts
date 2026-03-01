export function normalizeText(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 120);
}

export function buildIntakeDedupeKey(params: {
  source?: string | null;
  reporterEmail?: string | null;
  title?: string | null;
}) {
  const source = normalizeText(params.source || 'web');
  const email = normalizeText(params.reporterEmail);
  const title = normalizeText(params.title);
  return `${source}|${email}|${title}`.slice(0, 255);
}
