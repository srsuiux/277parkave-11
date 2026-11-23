import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// Dev-only: lets the in-app feedback mode drop notes + screenshots into ./feedback
function feedbackSink() {
  return {
    name: 'feedback-sink',
    configureServer(server) {
      server.middlewares.use('/__feedback', (req, res) => {
        res.setHeader('content-type', 'application/json');
        if (req.method !== 'POST') { res.statusCode = 405; return res.end('{"ok":false}'); }
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const dir = path.resolve(server.config.root, 'feedback');
            const shots = path.join(dir, 'shots');
            fs.mkdirSync(shots, { recursive: true });
            const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            for (const n of data.notes) {
              if (typeof n.screenshot === 'string' && n.screenshot.startsWith('data:image/jpeg;base64,')) {
                const name = `${stamp}-${String(Number(n.n) | 0).padStart(2, '0')}.jpg`;
                fs.writeFileSync(path.join(shots, name), Buffer.from(n.screenshot.split(',')[1], 'base64'));
                n.screenshot = `shots/${name}`;
              }
            }
            const file = `feedback-${stamp}.json`;
            fs.writeFileSync(path.join(dir, file), JSON.stringify(data, null, 2));
            res.end(JSON.stringify({ ok: true, file: `feedback/${file}`, count: data.notes.length }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: String(e) }));
          }
        });
      });
    },
  };
}

// Dev-only: Layout mode (press L) saves object positions/rotations/sizes to ./layout.json
function layoutSink() {
  return {
    name: 'layout-sink',
    configureServer(server) {
      server.middlewares.use('/__layout', (req, res) => {
        res.setHeader('content-type', 'application/json');
        if (req.method !== 'POST') { res.statusCode = 405; return res.end('{"ok":false}'); }
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const file = path.resolve(server.config.root, 'layout.json');
            if (fs.existsSync(file)) {   // keep every previous save so nothing is ever lost
              const dir = path.resolve(server.config.root, 'layout-backups'); fs.mkdirSync(dir, { recursive: true });
              fs.copyFileSync(file, path.join(dir, `layout-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`));
            }
            fs.writeFileSync(file, JSON.stringify(data, null, 2));
            res.end(JSON.stringify({ ok: true, count: Object.keys(data).length }));
          } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ ok: false, error: String(e) })); }
        });
      });
    },
  };
}

// Dev-only: press P in the preview (or call window.__fp.snapshot(name)) to save a screenshot into ./docs/screenshots/
function snapshotSink() {
  return {
    name: 'snapshot-sink',
    configureServer(server) {
      server.middlewares.use('/__snapshot', (req, res) => {
        res.setHeader('content-type', 'application/json');
        if (req.method !== 'POST') { res.statusCode = 405; return res.end('{"ok":false}'); }
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
          try {
            const { name, image } = JSON.parse(body);
            if (typeof image !== 'string' || !image.startsWith('data:image/jpeg;base64,')) throw new Error('expected a jpeg data URL');
            const safe = String(name || 'snapshot').replace(/[^a-z0-9._-]/gi, '-').slice(0, 60);
            const dir = path.resolve(server.config.root, 'docs', 'screenshots'); fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, `${safe}.jpg`), Buffer.from(image.split(',')[1], 'base64'));
            res.end(JSON.stringify({ ok: true, file: `docs/screenshots/${safe}.jpg` }));
          } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ ok: false, error: String(e) })); }
        });
      });
    },
  };
}

export default defineConfig({ plugins: [feedbackSink(), layoutSink(), snapshotSink()] });
