'use strict';
/* AI: the optional Anthropic API proxy (the key stays on the NAS). */
const { API_KEY, MODEL, MODEL_QUICK } = require('../config');

async function callClaude(prompt, tier) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: tier === 'quick' ? MODEL_QUICK : MODEL, max_tokens: 4096, messages: [{ role: 'user', content: prompt }] })
  });
  const j = await r.json();
  if (!r.ok) { const e = new Error(j?.error?.message || 'Anthropic API error'); e.status = r.status; throw e; }
  return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
}

module.exports = { callClaude };
