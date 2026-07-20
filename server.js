import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const file = join(process.cwd(), 'data', 'financial-profile.json');
const server = createServer(async (req, res) => {
  if (req.url !== '/api/state') { res.writeHead(404); return res.end('Not found'); }
  res.setHeader('content-type', 'application/json; charset=utf-8');
  if (req.method === 'GET') { try { return res.end(await readFile(file, 'utf8')); } catch { return res.end('{}'); } }
  if (req.method === 'PUT') { let body = ''; for await (const chunk of req) body += chunk; await mkdir(join(process.cwd(), 'data'), { recursive: true }); await writeFile(file, JSON.stringify(JSON.parse(body), null, 2)); res.end('{"saved":true}'); return; }
  res.writeHead(405); res.end('{}');
});
server.listen(4174, '127.0.0.1', () => console.log('JSON persistence: http://127.0.0.1:4174/api/state'));
