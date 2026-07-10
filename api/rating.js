import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { tab, key, rating } = req.body;
    if (!tab || !key) return res.status(400).json({ error: 'missing tab or key' });

    const storeKey = `rating:${tab}:${key}`;
    if (rating === 0 || rating === null) {
      await kv.del(storeKey);
    } else {
      await kv.set(storeKey, rating);
    }
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET') {
    const { tab } = req.query;
    if (!tab) return res.status(400).json({ error: 'missing tab' });

    const keys = await kv.keys(`rating:${tab}:*`);
    const ratings = {};
    if (keys.length) {
      const values = await kv.mget(...keys);
      keys.forEach((k, i) => {
        const itemKey = k.slice(`rating:${tab}:`.length);
        ratings[itemKey] = values[i];
      });
    }
    return res.status(200).json(ratings);
  }

  res.status(405).end();
}