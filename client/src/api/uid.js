// Client-side unique id for React keys on not-yet-saved builder items.
let counter = 0;
export function uid(prefix = 'id') {
  counter += 1;
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${counter}_${rand}`;
}
