import type { SiteGraph } from '../types.js';
import { TOKEN_BUDGET, countTokens } from '../budget.js';

export type SonnetAddendumResult = {
  text: string;
  truncated: boolean;
  truncatedSections: string[];
};

const EMPTY_FALLBACK = 'Brand site is being indexed; refer to BRAND CONTEXT only.';

export function projectSonnetAddendum(graph: SiteGraph): SonnetAddendumResult {
  if (graph.pages.length === 0) {
    return { text: EMPTY_FALLBACK, truncated: false, truncatedSections: [] };
  }
  const sections = {
    siteMap: renderSiteMap(graph),
    nav: renderNav(graph),
    intents: renderIntents(graph),
    keyFacts: renderKeyFacts(graph),
    faq: renderFaq(graph.faq, graph.faq.length),
  };
  let text = joinSections(sections);
  const truncatedSections: string[] = [];

  if (countTokens(text) > TOKEN_BUDGET) {
    sections.faq = renderFaq(graph.faq, 10);
    truncatedSections.push('faq');
    text = joinSections(sections);
  }
  if (countTokens(text) > TOKEN_BUDGET) {
    sections.faq = '';
    truncatedSections.push('faq_dropped');
    text = joinSections(sections);
  }
  if (countTokens(text) > TOKEN_BUDGET) {
    sections.intents = renderIntents(graph, 10);
    truncatedSections.push('intents');
    text = joinSections(sections);
  }
  if (countTokens(text) > TOKEN_BUDGET) {
    sections.intents = '';
    truncatedSections.push('intents_dropped');
    text = joinSections(sections);
  }
  if (countTokens(text) > TOKEN_BUDGET) {
    sections.keyFacts = '';
    truncatedSections.push('key_facts_dropped');
    text = joinSections(sections);
  }
  if (countTokens(text) > TOKEN_BUDGET) {
    sections.siteMap = renderSiteMap(graph, 30);
    truncatedSections.push('site_map');
    text = joinSections(sections);
  }
  return { text, truncated: truncatedSections.length > 0, truncatedSections };
}

function renderSiteMap(graph: SiteGraph, limit?: number): string {
  const lines = ['SITE MAP — pages you can navigate to:'];
  const pages = limit ? graph.pages.slice(0, limit) : graph.pages;
  for (const p of pages) {
    const label = p.title || p.h1 || p.url;
    lines.push(`  ${p.url.padEnd(28).slice(0, 28)} ${p.pageType} — ${label}`);
  }
  if (limit && graph.pages.length > limit) {
    lines.push(`  ... ${graph.pages.length - limit} more pages`);
  }
  return lines.join('\n');
}

function renderNav(graph: SiteGraph): string {
  const header = graph.navEdges.filter((e) => e.linkLocation === 'header');
  if (header.length === 0) return '';
  const labels = header.map((e) => e.anchorText).filter((x): x is string => Boolean(x));
  if (labels.length === 0) return '';
  return `NAV (from header):\n  ${labels.join(', ')}`;
}

function renderIntents(graph: SiteGraph, perPageLimit?: number): string {
  if (graph.intentsByPageId.size === 0) return '';
  const lines = ['ON-SCREEN INTENTS by page:'];
  for (const page of graph.pages) {
    const intents = graph.intentsByPageId.get(page.id);
    if (!intents || intents.length === 0) continue;
    lines.push(`  ${page.url}:`);
    const slice = perPageLimit ? intents.slice(0, perPageLimit) : intents;
    for (const i of slice) lines.push(`    - "${i.intentKey}"`);
  }
  if (lines.length === 1) return '';
  return lines.join('\n');
}

function renderKeyFacts(graph: SiteGraph): string {
  const lines: string[] = [];
  for (const policy of graph.policies) {
    lines.push(`${capitalize(policy.policyType)}: ${policy.summary}`);
  }
  for (const media of graph.media.values()) {
    if (media.role !== 'hero') continue;
    const alt = media.generatedAlt ?? media.originalAlt;
    if (alt) lines.push(`Hero image: ${alt}`);
  }
  if (lines.length === 0) return '';
  return `KEY FACTS:\n  ${lines.join('\n  ')}`;
}

function renderFaq(entries: SiteGraph['faq'], limit: number): string {
  if (entries.length === 0 || limit === 0) return '';
  const lines = [`FAQ (top ${Math.min(limit, entries.length)}):`];
  for (const e of entries.slice(0, limit)) {
    lines.push(`  Q: ${e.question}`);
    lines.push(`  A: ${e.answer}`);
  }
  return lines.join('\n');
}

function joinSections(s: Record<string, string>): string {
  return Object.values(s).filter((v) => v.length > 0).join('\n\n');
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}
