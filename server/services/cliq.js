'use strict';
/* Zoho Cliq: post to a channel with a webhook token (zapikey). The token lives on the NAS only. */
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config');
const { assertPublic } = require('../lib/net');

// ---- Zoho Cliq: post to a channel with a webhook token (zapikey). The token lives on the NAS only. ----
const CLIQ_FILE = path.join(DATA_DIR, 'cliq.json');
const CLIQ_HOSTS = { com: 'cliq.zoho.com', eu: 'cliq.zoho.eu', in: 'cliq.zoho.in', au: 'cliq.zoho.com.au', jp: 'cliq.zoho.jp', ca: 'cliq.zohocloud.ca', sa: 'cliq.zoho.sa' };
const readCliq = () => { try { return JSON.parse(fs.readFileSync(CLIQ_FILE, 'utf8')); } catch { return {}; } };
async function cliqPost(text) {
  const c = readCliq(); if (!c.channel || !c.zapikey) throw new Error('Zoho Cliq is not set up');
  const u = `https://${CLIQ_HOSTS[c.dc] || CLIQ_HOSTS.com}/api/v2/channelsbyname/${encodeURIComponent(c.channel)}/message?zapikey=${encodeURIComponent(c.zapikey)}`;
  await assertPublic(u);
  const r = await fetch(u, { method: 'POST', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: String(text).slice(0, 4000) }) });
  if (!r.ok && r.status !== 204) throw new Error('Cliq said ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return true;
}

module.exports = { CLIQ_FILE, CLIQ_HOSTS, cliqPost, readCliq };
