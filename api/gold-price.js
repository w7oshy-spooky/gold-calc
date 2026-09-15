'use strict';

const {
  normalizeGoldApiPayload,
  normalizeXausPayload,
} = require('../live-gold.js');

const GOLD_API_URL = 'https://api.gold-api.com/price/XAU';
const XAUS_URL = 'https://xaus.com/api/v1/spot';

async function fetchJson(fetchImpl, url) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), 5000) : null;

  try {
    const response = await fetchImpl(url, {
      headers: { accept: 'application/json' },
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (!response || !response.ok) {
      throw new Error(`Upstream HTTP ${response?.status || 'error'}`);
    }
    return await response.json();
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function createGoldPriceHandler({ fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is required');

  return async function goldPriceHandler(_req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');

    try {
      const primaryPayload = await fetchJson(fetchImpl, GOLD_API_URL);
      return res.status(200).json(normalizeGoldApiPayload(primaryPayload));
    } catch (primaryError) {
      try {
        const fallbackPayload = await fetchJson(fetchImpl, XAUS_URL);
        return res.status(200).json(normalizeXausPayload(fallbackPayload));
      } catch (fallbackError) {
        return res.status(502).json({ error: 'live_price_unavailable' });
      }
    }
  };
}

const handler = createGoldPriceHandler();
module.exports = handler;
module.exports.createGoldPriceHandler = createGoldPriceHandler;
