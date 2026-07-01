/**
 * Turn a name into a URL-safe slug, e.g. "Acme Inc." -> "acme-inc".
 * `uniqueSlug` appends a short random suffix and retries against a model until
 * it finds one that isn't taken (used for organizations and public links).
 */
export function slugify(input) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'org';
}

export async function uniqueSlug(Model, base, field = 'slug') {
  const root = slugify(base);
  let candidate = root;
  let n = 0;
  // Loop until the slug is free. Suffix with an incrementing counter.
  while (await Model.exists({ [field]: candidate })) {
    n += 1;
    candidate = `${root}-${n}`;
  }
  return candidate;
}
