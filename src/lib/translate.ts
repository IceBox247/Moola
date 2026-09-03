/**
 * Lightweight text translation via Google's public translate endpoint (no key).
 * Best-effort: returns null on any failure so callers fall back to the original
 * text. Used to translate support tickets to English and replies back to the
 * user's language.
 */
export type Translation = { text: string; src: string };

export async function translateText(text: string, target = 'en'): Promise<Translation | null> {
  const q = (text ?? '').trim();
  if (!q) return null;
  try {
    const url =
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}` +
      `&dt=t&q=${encodeURIComponent(q.slice(0, 1500))}`;
    const ctrl = AbortSignal.timeout(6000);
    const res = await fetch(url, { cache: 'no-store', signal: ctrl });
    if (!res.ok) return null;
    // Shape: [ [ [translated, original, ...], ... ], ..., srcLang, ... ]
    const data = (await res.json()) as [Array<[string]>, unknown, string];
    const segments = data?.[0];
    if (!Array.isArray(segments)) return null;
    const out = segments.map((s) => (Array.isArray(s) ? s[0] : '')).join('');
    const src = typeof data[2] === 'string' ? data[2] : 'auto';
    if (!out) return null;
    return { text: out, src };
  } catch {
    return null;
  }
}
