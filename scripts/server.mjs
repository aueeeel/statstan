import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(process.argv.includes('--production') ? 'dist' : '.');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.webm': 'video/webm', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' };
createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/') pathname = '/index.html';
    if (pathname === '/check' || pathname === '/check/') pathname = '/check.html';
    const file = resolve(root, '.' + pathname);
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    const data = await readFile(file);
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    const headers = { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes' };
    if (range) {
      const start = Number(range[1]); const end = Math.min(range[2] ? Number(range[2]) : data.length - 1, data.length - 1);
      if (start > end || start >= data.length) { res.writeHead(416, { 'Content-Range': `bytes */${data.length}` }).end(); return; }
      res.writeHead(206, { ...headers, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${data.length}` });
      res.end(data.subarray(start, end + 1));
    } else { res.writeHead(200, { ...headers, 'Content-Length': data.length }); res.end(req.method === 'HEAD' ? undefined : data); }
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Страница не найдена'); }
}).listen(Number(process.env.PORT || 4173), '0.0.0.0', () => console.log(`Local: http://localhost:${process.env.PORT || 4173}`));
