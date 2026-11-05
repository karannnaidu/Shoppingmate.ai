import { describe, expect, it } from 'vitest';
import { buildSitemapTree, isPathExcluded, normalizeExclusion, pageKey, pagePath } from './sitemap.js';

describe('sitemap helpers', () => {
  it('pagePath / pageKey treat trailing slashes and www as the same page', () => {
    expect(pagePath('https://calmosis.com/about/')).toBe('/about');
    expect(pagePath('https://calmosis.com/')).toBe('/');
    expect(pageKey('https://www.calmosis.com/about/')).toBe(pageKey('https://calmosis.com/about'));
  });

  it('isPathExcluded: folder covers itself and everything below; page is exact', () => {
    const ex = ['/blog/', '/legal/terms'];
    expect(isPathExcluded('https://calmosis.com/blog/', ex)).toBe(true);
    expect(isPathExcluded('https://calmosis.com/blog/what-is-vijaya/', ex)).toBe(true);
    expect(isPathExcluded('https://calmosis.com/blogger', ex)).toBe(false);
    expect(isPathExcluded('https://calmosis.com/legal/terms/', ex)).toBe(true);
    expect(isPathExcluded('https://calmosis.com/legal/privacy/', ex)).toBe(false);
    expect(isPathExcluded('https://calmosis.com/shop/holistic-gummy/', ex)).toBe(false);
  });

  it('normalizeExclusion never allows skipping the whole site', () => {
    expect(normalizeExclusion('/', true)).toBeNull();
    expect(normalizeExclusion('blog', true)).toBe('/blog/');
    expect(normalizeExclusion('/legal/terms/', false)).toBe('/legal/terms');
  });

  it('buildSitemapTree groups folders with sub-pages and keeps single pages top-level', () => {
    const tree = buildSitemapTree([
      'https://calmosis.com/',
      'https://calmosis.com/about',
      'https://calmosis.com/about/',
      'https://calmosis.com/shop/',
      'https://calmosis.com/shop/holistic-gummy/',
      'https://calmosis.com/shop/green-mantra/',
      'https://calmosis.com/blog/what-is-vijaya/',
    ]);
    expect(tree.topLevel.map((p) => p.path)).toEqual(['/', '/about']);
    expect(tree.folders.map((f) => f.folder)).toEqual(['/blog/', '/shop/']);
    const shop = tree.folders.find((f) => f.folder === '/shop/')!;
    expect(shop.index?.path).toBe('/shop');
    expect(shop.pages.map((p) => p.path)).toEqual(['/shop/green-mantra', '/shop/holistic-gummy']);
    expect(tree.folders.find((f) => f.folder === '/blog/')!.index).toBeNull();
  });
});
