// Nav PRD Phase 0 - host-action / tool / turn baseline for one merchant.
//
//   node --env-file=.env apps/api/scripts/nav-baseline.mjs [merchantId] [days]
//
// Reads metric_events (agent.tool.invoked, agent.turn.completed) and prints:
// success rate per tool + channel, p50/p95 tool latency, result payload size,
// verified rate (once Phase 1 reports it), and p50/p95 turn latency by mode.
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../../packages/db/package.json', import.meta.url));
const postgres = require('postgres');

const url = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_PUBLIC_URL or DATABASE_URL required');
const sql = postgres(url, { ssl: 'require' });
const merchantId = process.argv[2] ?? 'SM-2SCCLZ';
const days = Number(process.argv[3] ?? 7);

const pct = (p) => sql`percentile_cont(${p}) WITHIN GROUP (ORDER BY (tags->>'latencyMs')::numeric)`;

console.log(`Nav baseline - merchant ${merchantId}, last ${days} days\n`);

const tools = await sql`
  SELECT tags->>'toolName' AS tool,
         COALESCE(tags->>'channel', '(untagged)') AS channel,
         COUNT(*)::int AS n,
         ROUND(100.0 * AVG(CASE WHEN tags->>'ok' = 'true' THEN 1 ELSE 0 END), 1) AS ok_pct,
         ROUND(${pct(0.5)}) AS p50_ms,
         ROUND(${pct(0.95)}) AS p95_ms,
         ROUND(AVG((tags->>'resultTokensEst')::numeric)) AS avg_result_tokens,
         COUNT(*) FILTER (WHERE tags ? 'verified')::int AS verified_n,
         COUNT(*) FILTER (WHERE tags->>'verified' = 'true')::int AS verified_true
  FROM metric_events
  WHERE merchant_id = ${merchantId}
    AND metric_name = 'agent.tool.invoked'
    AND ts > now() - make_interval(days => ${days})
  GROUP BY 1, 2
  ORDER BY n DESC`;

console.log('Tools:');
console.table(tools);

const overall = await sql`
  SELECT COUNT(*)::int AS n,
         ROUND(100.0 * AVG(CASE WHEN tags->>'ok' = 'true' THEN 1 ELSE 0 END), 1) AS ok_pct,
         ROUND(${pct(0.5)}) AS p50_ms,
         ROUND(${pct(0.95)}) AS p95_ms
  FROM metric_events
  WHERE merchant_id = ${merchantId}
    AND metric_name = 'agent.tool.invoked'
    AND tags->>'channel' = 'host'
    AND ts > now() - make_interval(days => ${days})`;
console.log('Host actions overall (G1 metric):');
console.table(overall);

const failures = await sql`
  SELECT tags->>'actionType' AS action, tags->>'failReason' AS reason, COUNT(*)::int AS n
  FROM metric_events
  WHERE merchant_id = ${merchantId}
    AND metric_name = 'agent.tool.invoked'
    AND tags->>'ok' = 'false'
    AND ts > now() - make_interval(days => ${days})
  GROUP BY 1, 2
  ORDER BY n DESC
  LIMIT 15`;
console.log('Top failures:');
console.table(failures);

const turns = await sql`
  SELECT COALESCE(tags->>'mode', '?') AS mode,
         COUNT(*)::int AS n,
         ROUND(${pct(0.5)}) AS p50_ms,
         ROUND(${pct(0.95)}) AS p95_ms,
         ROUND(AVG((tags->>'toolCalls')::numeric), 2) AS avg_tool_calls,
         ROUND(AVG((tags->>'llmCalls')::numeric), 2) AS avg_llm_calls
  FROM metric_events
  WHERE merchant_id = ${merchantId}
    AND metric_name = 'agent.turn.completed'
    AND ts > now() - make_interval(days => ${days})
  GROUP BY 1`;
console.log('Turns (G2 metric):');
console.table(turns);

await sql.end();
