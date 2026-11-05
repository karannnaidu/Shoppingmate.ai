// Run the real page reader on one live URL (no DB writes) — prints what the
// assistant would learn. Usage: GEMINI_API_KEY=… tsx scripts/try-extract-page.ts <url>
import { extractStructured } from '../src/steps/siteGraph/extractStructured.js';
import { geminiExtractCall } from '../src/llm/geminiExtract.js';

const url = process.argv[2] ?? 'https://calmosis.com/shop/holistic-gummy/';
const html = await (await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; ShoppingmateBot/0.1)' } })).text();
const out = await extractStructured({ html, url, llmCall: geminiExtractCall });
console.log(JSON.stringify({ pageType: out.pageType, title: out.title, h1: out.h1, product: out.product && { ...out.product, raw: undefined }, faq: out.faq.length, intents: out.intents.length, navLinks: out.navLinks.length }, null, 2));
