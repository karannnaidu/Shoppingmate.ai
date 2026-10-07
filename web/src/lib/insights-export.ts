import type { InsightFacts } from '@shoppingmate/db/insights';
import { PAGE_LABEL } from './insights-copy';

// Scale plan: "Export Insights for your team" — the same facts the Insights
// page shows, as a spreadsheet-friendly CSV (one block per table).

function cell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function block(title: string, header: string[], rows: unknown[][]): string {
  return [title, header.map(cell).join(','), ...rows.map((r) => r.map(cell).join(',')), ''].join('\n');
}

const page = (t: string) => PAGE_LABEL[t] ?? t;

export function insightsCsv(f: InsightFacts): string {
  return [
    block('Summary', ['metric', 'value'], [
      ['days', f.days],
      ['visits', f.sessions],
      ['conversion rate %', (f.conversionRate * 100).toFixed(2)],
      ['currency', f.currency],
      ['typical order value', (f.aov / 100).toFixed(2)],
    ]),
    block('Funnel', ['step', 'visits'], Object.entries(f.steps).map(([k, v]) => [k, v])),
    block('Where people stop', ['from', 'to', 'reached', 'continued', 'stopped', 'value at risk'], f.leaks.map((l) => [
      l.from, l.to, l.reached, l.continued, l.lost, (l.valueAtRisk / 100).toFixed(2),
    ])),
    block('Pages', ['page', 'views', 'avg seconds', 'avg scroll %', 'quick exits', 'avg load ms'], f.pages.map((p) => [
      page(p.pageType), p.views, Math.round(p.avgSeconds), Math.round(p.avgScroll), p.quickExits, p.avgLcpMs ?? '',
    ])),
    block('Products', ['path', 'views', 'add to cart', 'rate %'], f.products.map((p) => [p.path, p.views, p.addToCart, (p.rate * 100).toFixed(1)])),
    block('Traffic sources', ['source', 'visits', 'purchases'], f.bySource.map((s) => [s.source, s.sessions, s.purchases])),
    block('Devices', ['device', 'visits', 'purchases'], f.byDevice.map((d) => [d.device, d.sessions, d.purchases])),
    block('Taps that did nothing / friction', ['page', 'device', 'kind', 'what', 'count'], f.friction.map((x) => [page(x.pageType), x.device, x.kind, x.label, x.count])),
    block('Form fields people gave up on', ['page', 'field', 'count'], f.abandonedFields.map((a) => [page(a.pageType), a.field, a.count])),
    block('What shoppers asked your assistant', ['type', 'text', 'count'], [
      ...f.voice.needs.map((n) => ['need', n.text, n.count]),
      ...f.voice.objections.map((o) => ['doubt', o.text, o.count]),
      ...f.voice.unanswered.map((u) => ['unanswered', u, 1]),
    ]),
  ].join('\n');
}
