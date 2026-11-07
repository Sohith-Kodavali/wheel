import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from './server/api.js';
import { backend, store } from './server/store.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 5173);

function lanAddress() {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) return address.address;
    }
  }
  return '';
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const PAGES = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/chef': 'chef.html',
  '/chef/': 'chef.html',
  '/analytics': 'analytics.html',
  '/analytics/': 'analytics.html',
  '/settings': 'settings.html',
  '/settings/': 'settings.html',
};

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
    });
    res.end(data);
  });
}

http
  .createServer(async (req, res) => {
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      res.writeHead(400).end('Bad request');
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      res.writeHead(400).end('Bad request');
      return;
    }

    if (PAGES[pathname]) {
      sendFile(res, path.join(root, PAGES[pathname]));
      return;
    }

    const filePath = path.resolve(root, `.${pathname}`);
    if (!filePath.startsWith(root + path.sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    fs.stat(filePath, (error, stat) => {
      if (!error && stat.isFile()) {
        sendFile(res, filePath);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    });
  })
  .listen(port, () => {
    console.log('');
    console.log('  The Milkshake Factory — tablet app');
    console.log(`  Order screen : http://localhost:${port}`);
    console.log(`  Chef panel   : http://localhost:${port}/chef`);
    console.log(`  Analytics    : http://localhost:${port}/analytics`);
    console.log(`  Settings     : http://localhost:${port}/settings`);
    const lan = lanAddress();
    if (lan) console.log(`  Other devices: http://${lan}:${port}`);
    console.log(
      `  Storage      : ${backend === 'supabase' ? 'Supabase' : 'local SQLite (data/orders.db)'}`,
    );
    if (backend === 'supabase') {
      store
        .health()
        .then(() => console.log('  Supabase     : connected'))
        .catch((error) => console.error(`  Supabase     : ${error.message}`));
    }
    console.log('');
  });
