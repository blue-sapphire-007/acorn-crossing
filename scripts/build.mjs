import fs from 'node:fs';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else if (entry.name.endsWith('.ts')) {
      let code = fs.readFileSync(s, 'utf-8');
      let js = stripTypeScriptTypes(code, { mode: 'strip' });
      js = js.replace(/(from\s+['"][^'"]+)\.ts(['"])/g, '$1.js$2');
      fs.writeFileSync(d.replace(/\.ts$/, '.js'), js);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

copyDir(path.join(ROOT, 'public'), DIST);
copyDir(path.join(ROOT, 'styles'), path.join(DIST, 'styles'));
copyDir(path.join(ROOT, 'src'), path.join(DIST, 'src'));

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
html = html.replace('./src/main.ts', './src/main.js');
fs.writeFileSync(path.join(DIST, 'index.html'), html);
console.log('Static client-side build complete -> ./dist');
