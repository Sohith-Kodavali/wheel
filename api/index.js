import { handleApi } from '../server/api.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  let url;
  try {
    url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  } catch {
    res.statusCode = 400;
    res.end('Bad request');
    return;
  }

  // Vercel's catch-all function routes only match a single path segment, so
  // vercel.json rewrites every /api/* request here with the original path in
  // the __path query parameter.
  const forwardedPath = url.searchParams.get('__path');
  if (forwardedPath !== null) {
    url.searchParams.delete('__path');
    if (url.pathname === '/api/index' || url.pathname === '/api') {
      url.pathname = `/api/${forwardedPath}`;
    }
  }

  await handleApi(req, res, url);
}
