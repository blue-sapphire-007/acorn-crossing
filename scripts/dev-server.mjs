import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 3000);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.ts': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  if (clean === '/' || clean === '/index.html') {
    return path.join(ROOT, 'index.html');
  }

  // Check public directory first (Vite convention: /assets/... -> public/assets/...)
  const pubCandidate = path.join(PUBLIC_DIR, clean);
  if (fs.existsSync(pubCandidate) && fs.statSync(pubCandidate).isFile()) {
    return pubCandidate;
  }

  // Direct workspace path
  const direct = path.join(ROOT, clean);
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) {
    return direct;
  }
  if (fs.existsSync(direct + '.ts')) {
    return direct + '.ts';
  }
  if (fs.existsSync(direct + '.js')) {
    return direct + '.js';
  }
  return null;
}

const server = http.createServer((req, res) => {
  const filePath = resolveFile(req.url || '/');
  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found: ' + req.url);
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    if (ext === '.ts') {
      const tsSource = fs.readFileSync(filePath, 'utf-8');
      const jsCode = stripTypeScriptTypes(tsSource, { mode: 'strip' });
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      res.end(jsCode);
    } else {
      const data = fs.readFileSync(filePath);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      res.end(data);
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(String(err));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Acorn Crossing TypeScript Dev Server running at http://localhost:${PORT}`);
});
