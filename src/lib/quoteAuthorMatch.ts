/**
 * Fuzzy match API `author` against user-selected quote sources (names may differ slightly).
 */

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,'"`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** True if `author` refers to one of the people in `favorites` (case / punctuation tolerant). */
export function isAuthorFromFavoriteList(
  author: string,
  favorites: string[]
): boolean {
  if (favorites.length === 0) return true;
  const a = norm(author);
  if (!a) return false;

  return favorites.some((raw) => {
    const f = norm(raw);
    if (!f) return false;
    if (a === f) return true;
    if (a.includes(f) || f.includes(a)) {
      const minLen = Math.min(a.length, f.length);
      if (minLen < 4) return a === f;
      return true;
    }
    const aParts = a.split(" ").filter(Boolean);
    const fParts = f.split(" ").filter(Boolean);
    if (fParts.length === 1 && fParts[0].length >= 2) {
      const token = fParts[0];
      return aParts.some((w) => w === token || (token.length >= 4 && w.includes(token)));
    }
    if (fParts.length >= 2) {
      return fParts.every((t) => t.length < 2 || a.includes(t));
    }
    return false;
  });
}
