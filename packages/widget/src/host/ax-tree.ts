// W3C AccName 1.2-inspired accessible-name + intent resolver.
// No external deps. Used by host-action tools (site.scroll_to, site.highlight,
// site.click, site.navigate) to map a free-text intent (e.g. "starter plan
// card") to a real HTMLElement on the host page.

const STOPWORDS = new Set([
  'the', 'a', 'an', 'to', 'of', 'on', 'in', 'and', 'or',
  'section', 'button', 'link', 'card', 'tile', 'now',
]);

const ROLE_KEYWORDS: Array<{ keyword: string; matchTag: RegExp; matchRole?: string }> = [
  { keyword: 'button', matchTag: /^(button)$/i, matchRole: 'button' },
  { keyword: 'link', matchTag: /^(a)$/i, matchRole: 'link' },
  { keyword: 'card', matchTag: /^(article|div|section)$/i },
  { keyword: 'section', matchTag: /^(section|main|article)$/i },
];

const MIN_SCORE = 0.4;

type Candidate = {
  element: HTMLElement;
  role: string;
  name: string;
  visible: boolean;
};

export function resolveIntent(intent: string, hints?: Map<string, string>): HTMLElement | null {
  if (hints) {
    const sel = hints.get(intent.toLowerCase().trim());
    if (sel) {
      try {
        const el = document.querySelector(sel);
        if (el instanceof HTMLElement && isVisible(el)) return el;
      } catch {
        // bad selector — fall through to AX-tree
      }
    }
  }
  const intentTokens = tokenize(intent);
  if (intentTokens.size === 0) return null;
  const candidates = collectCandidates(document.body);
  let best: { c: Candidate; score: number } | null = null;
  for (const c of candidates) {
    if (!c.visible) continue;
    const score = scoreCandidate(c, intent, intentTokens);
    if (score < MIN_SCORE) continue;
    if (!best || score > best.score) best = { c, score };
  }
  return best?.c.element ?? null;
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 0 && !STOPWORDS.has(t)),
  );
}

function collectCandidates(root: HTMLElement): Candidate[] {
  const out: Candidate[] = [];
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  // Skip the root (body) itself — its textContent aggregates all children.
  let node: Node | null = tw.nextNode();
  while (node) {
    if (node instanceof HTMLElement) {
      const name = accessibleName(node);
      if (name) {
        out.push({
          element: node,
          role: node.getAttribute('role') ?? node.tagName.toLowerCase(),
          name,
          visible: isVisible(node),
        });
      }
    }
    node = tw.nextNode();
  }
  return out;
}

function accessibleName(el: HTMLElement): string {
  // AccName 1.2 (subset): aria-labelledby → aria-label → <label for> → alt/title → text
  const labelledby = el.getAttribute('aria-labelledby');
  if (labelledby) {
    const parts = labelledby
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
      .filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
  }
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();
  if (el.id) {
    const associated = document.querySelector(`label[for="${cssEscape(el.id)}"]`);
    if (associated?.textContent) return associated.textContent.trim();
  }
  const alt = el.getAttribute('alt') ?? el.getAttribute('title');
  if (alt) return alt.trim();
  const text = (el.textContent ?? '').trim();
  if (text && text.length < 200) return text;
  return '';
}

function isVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  if (!style) return true;
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (style.opacity === '0') return false;
  // Note: getBoundingClientRect() returns 0×0 in test environments (happy-dom /
  // JSDOM) even for visible elements, so we intentionally skip the rect check.
  return true;
}

function scoreCandidate(c: Candidate, intent: string, intentTokens: Set<string>): number {
  const nameTokens = tokenize(c.name);
  if (nameTokens.size === 0) return 0;
  let intersect = 0;
  for (const t of intentTokens) if (nameTokens.has(t)) intersect++;
  const union = new Set([...intentTokens, ...nameTokens]).size;
  const jaccard = union === 0 ? 0 : intersect / union;
  let roleBonus = 0;
  const intentLower = intent.toLowerCase();
  for (const rk of ROLE_KEYWORDS) {
    if (!intentLower.includes(rk.keyword)) continue;
    if (rk.matchTag.test(c.element.tagName) || c.role === rk.matchRole) {
      roleBonus = 0.15;
      break;
    }
  }
  const stopId = c.element.getAttribute('data-tour-stop');
  let stopBonus = 0;
  if (stopId) {
    const stopTokens = tokenize(stopId.replace(/-/g, ' '));
    let stopHits = 0;
    for (const t of intentTokens) if (stopTokens.has(t)) stopHits++;
    if (stopHits > 0) stopBonus = 0.5 * (stopHits / intentTokens.size);
  }
  return Math.min(1, jaccard + roleBonus + stopBonus);
}

function cssEscape(s: string): string {
  return s.replace(/(["\\])/g, '\\$1');
}

// Resolve a free-text field intent (e.g. "Email", "Pincode", "Full name") to a
// form control. Prefers the page's OWN stable identifiers (id/name/data-field)
// over fuzzy text, so we drive the same elements the site's code uses. An
// optional hints map (Phase 2: from the crawl graph) takes top priority.
export function resolveField(intent: string, hints?: Map<string, string>): HTMLElement | null {
  if (hints) {
    const sel = hints.get(intent.toLowerCase().trim());
    if (sel) {
      try {
        const el = document.querySelector(sel);
        if (el instanceof HTMLElement && isVisible(el)) return el;
      } catch {
        /* bad selector — fall through */
      }
    }
  }
  const tokens = tokenize(intent);
  if (tokens.size === 0) return null;
  const controls = Array.from(
    document.querySelectorAll<HTMLElement>('input, textarea, select'),
  ).filter((el) => isVisible(el) && !isUnfillable(el));

  let best: { el: HTMLElement; score: number } | null = null;
  for (const el of controls) {
    const score = scoreField(el, tokens);
    if (score <= 0) continue;
    if (!best || score > best.score) best = { el, score };
  }
  return best?.el ?? null;
}

function isUnfillable(el: HTMLElement): boolean {
  const t = (el.getAttribute('type') ?? '').toLowerCase();
  return t === 'hidden' || t === 'submit' || t === 'button' || (el as HTMLInputElement).disabled;
}

function fieldNames(el: HTMLElement): string[] {
  const names: string[] = [];
  const id = el.id;
  if (id) {
    names.push(id);
    const lbl = document.querySelector(`label[for="${cssEscape(id)}"]`);
    if (lbl?.textContent) names.push(lbl.textContent);
  }
  const nameAttr = el.getAttribute('name');
  if (nameAttr) names.push(nameAttr);
  const dataField = el.getAttribute('data-field') ?? el.getAttribute('data-testid');
  if (dataField) names.push(dataField);
  const aria = el.getAttribute('aria-label');
  if (aria) names.push(aria);
  const ph = el.getAttribute('placeholder');
  if (ph) names.push(ph);
  // Wrapping <label>Email <input/></label>
  const parentLabel = el.closest('label');
  if (parentLabel?.textContent) names.push(parentLabel.textContent);
  return names;
}

function scoreField(el: HTMLElement, intentTokens: Set<string>): number {
  let best = 0;
  for (const raw of fieldNames(el)) {
    const nameTokens = tokenize(raw);
    if (nameTokens.size === 0) continue;
    let intersect = 0;
    for (const t of intentTokens) if (nameTokens.has(t)) intersect++;
    if (intersect === 0) continue;
    // Coverage of the intent's tokens (so "pincode" fully matches a "pincode" field).
    const coverage = intersect / intentTokens.size;
    if (coverage > best) best = coverage;
  }
  return best;
}
