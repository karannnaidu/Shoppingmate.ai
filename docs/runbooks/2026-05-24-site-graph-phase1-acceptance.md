# Site Graph Phase 1 Acceptance — Demo Merchant Only

**Goal:** flip `siteGraphEnabled = true` for `SHOPPINGMATE_DEMO_MERCHANT_ID`, run an initial crawl, eyeball the projection, verify Sage stops inventing intents.

## Steps

1. Apply migration in production:
   ```bash
   railway run --service api pnpm --filter @shoppingmate/db db:migrate
   ```

2. Flip the flag for the demo merchant:
   ```bash
   railway run --service api psql $DATABASE_URL -c \
     "UPDATE merchants SET site_graph_enabled = true WHERE id = 'SM-XPK2EN';"
   ```

3. Enqueue the initial crawl from a Node REPL or one-off script:
   ```bash
   railway run --service worker node -e "require('@shoppingmate/jobs').siteGraphCrawlQueue.add('crawl', { merchantId: 'SM-XPK2EN' })"
   ```

4. Tail worker logs for ~5 minutes:
   ```bash
   railway logs --service worker --tail 200
   ```
   Expect: `site-graph-crawl` finishes with `status: ok`, then `site-graph-extract` runs and bumps `siteGraphVersion` to 1.

5. Verify projection cache populated:
   ```sql
   SELECT consumer, length(output), generated_at, source_graph_version
   FROM projection_cache WHERE merchant_id = 'SM-XPK2EN';
   ```
   Expect: one row with `consumer = 'sonnet_addendum'`, `output` length > 200, version = 1.

6. Verify sitePages and pageIntents populated:
   ```sql
   SELECT count(*) FROM site_pages WHERE merchant_id = 'SM-XPK2EN';
   SELECT count(*) FROM page_intents WHERE page_id IN (
     SELECT id FROM site_pages WHERE merchant_id = 'SM-XPK2EN'
   );
   ```
   Expect: pages ≥ 5, intents ≥ 10.

7. Sage live test on shoppingmate.ai demo widget:
   - Open shoppingmate.ai, click the widget bubble, switch to voice
   - Say: "show me pricing"
   - Expected: cursor glides to Pricing nav link, Starter card highlighted, no spoken tool syntax
   - Say: "tell me about your jewelry vertical"
   - Expected: Sage uses real product cards; no invented intents like `demo_catalog_selection`
   - Click the Pricing card visibly on screen (without speaking)
   - Expected: a `[VISITOR_CONTEXT]` history entry is added server-side (verify via `redis-cli HGET session:<sid> history` or by Sage's next reply referencing it appropriately — and only if relevant)

8. Eyeball Phase 1 success metrics:
   - 20 demo turns over 24h, zero invented intents
   - Projection ≤ 2K tokens (length of `output` < ~10000 chars as a rough proxy)
   - Vision spend < $0.50 per crawl (check Gemini billing console)
   - No host-action `not_found` errors in the bridge log

9. (Optional) Manual refresh via dashboard:
   - Sign in to /app/site-graph as the demo merchant
   - Click "Refresh now"
   - Expect: redirected back to /app/site-graph; within a minute, a fresh crawl appears in `site_crawls`

## Rollback

```bash
railway run --service api psql $DATABASE_URL -c \
  "UPDATE merchants SET site_graph_enabled = false WHERE id = 'SM-XPK2EN';"
```

Existing flows continue using the original prompt (SITE_GRAPH_SLOT placeholder remains unrendered; visitor_action handler silently drops on null session, so widget activity is harmless).

## What ships in Phase 1

- DB: 10 new tables (`site_crawls`, `crawl_artifacts`, `site_pages`, `page_links`, `page_intents`, `faq_entries`, `policy_documents`, `media_index`, `projection_cache`, plus `merchants.site_graph_enabled`/`site_graph_version` columns)
- Worker: BullMQ queues `site-graph-crawl`, `site-graph-extract`, `site-graph-drift` (nightly cron at 3am UTC)
- API: `/v1/site-graph/:merchantId/intents`, `/webhooks/shopify/products/update`, `visitor_action` handler on `/v1/widget/:sessionId/agent` WS
- Agent: `SITE_GRAPH_SLOT` + `VISITOR AWARENESS` section in both standard and demo Sonnet prompts
- Widget: `VisitorActivityTracker` (click/popstate/focusin; 200ms throttle; no form values)
- Dashboard: `/app/site-graph` read-only tile + manual refresh

## What's deferred to Phase 2

- Per-URL narrow re-extract (Shopify webhook currently triggers full re-crawl)
- Rate limit on dashboard refresh button (currently 1-per-click; no debounce)
- Multi-merchant site-graph dashboard (current view is single-merchant only)
- Selector-cache integration with `pageIntents.selectorHints`
