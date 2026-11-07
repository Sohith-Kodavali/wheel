import api from '../server/api.js';

const { handleApi } = api;

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

  await handleApi(req, res, url);
}
