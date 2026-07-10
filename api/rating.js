import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { tab, key, field, value } = req.body;
    if (!tab || !key || !field) return res.status(400).json({ error: 'missing tab, key, or field' });

    const storeKey = `${field}:${tab}:${key}`;
    if (value === 0 || value === null || value === '') {
      await kv.del(storeKey);
    } else {
      await kv.set(storeKey, value);
    }
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET') {
    const { tab } = req.query;
    if (!tab) return res.status(400).json({ error: 'missing tab' });

    const ratingKeys = await kv.keys(`rating:${tab}:*`);
    const statusKeys = await kv.keys(`status:${tab}:*`);
    const ratings = {};
    const statuses = {};

    if (ratingKeys.length) {
      const values = await kv.mget(...ratingKeys);
      ratingKeys.forEach((k, i) => { ratings[k.slice(`rating:${tab}:`.length)] = values[i]; });
    }
    if (statusKeys.length) {
      const values = await kv.mget(...statusKeys);
      statusKeys.forEach((k, i) => { statuses[k.slice(`status:${tab}:`.length)] = values[i]; });
    }

    return res.status(200).json({ ratings, statuses });
  }

  res.status(405).end();
}