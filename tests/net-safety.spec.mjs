// Outbound safety: feed links can only be web addresses, and the server's fetches never reach the home network.
import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parseFeed } = require('../server/lib/feedparse.js');
const { guardedLookup, safeFetch } = require('../server/lib/net.js');

test('feed links and images that aren\'t http(s) are dropped', () => {
  const xml = `<rss><channel><title>x</title>
    <item><title>Bad</title><link>javascript:alert(1)</link><enclosure url="data:text/html,hi" type="image/png"/></item>
    <item><title>Good</title><link>https://example.com/a</link></item></channel></rss>`;
  const f = parseFeed(xml, 'https://example.com/feed');
  const items = f.items || f;
  expect(items.find(i => i.title === 'Bad').link || '').toBe('');
  expect(items.find(i => i.title === 'Good').link).toBe('https://example.com/a');
  expect(JSON.stringify(items)).not.toMatch(/javascript:|data:text/);
});

test('the connection itself refuses LAN addresses (no DNS rebinding)', async () => {
  const err = await new Promise(r => guardedLookup('localhost', {}, e => r(e)));
  expect(err && err.message).toBe('private address');
  await expect(safeFetch('http://127.0.0.1/')).rejects.toThrow(/ip literal/);
  await expect(safeFetch('file:///etc/passwd')).rejects.toThrow(/protocol/);
});
