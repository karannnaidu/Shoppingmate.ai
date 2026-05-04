import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const PORT = 5174;

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

createServer((req, res) => {
  const urlPath = req.url === '/' ? '/examples/host-page.html' : req.url ?? '/';
  const safe = urlPath.replace(/\.\./g, '');
  const filePath = resolve(root, '.' + safe);
  try {
    const data = readFileSync(filePath);
    const ext = safe.slice(safe.lastIndexOf('.'));
    res.setHeader('content-type', TYPES[ext] ?? 'application/octet-stream');
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end('not found');
  }
}).listen(PORT, () => {
  console.log(`[widget] http://localhost:${PORT}`);
});
