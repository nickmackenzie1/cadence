'use strict';
// Parses RSS/Atom off the main thread (feeds.js parseOff): one long-lived worker, text in, compact JSON out.
const { parentPort } = require('worker_threads');
const { parseFeed } = require('../lib/feedparse');
parentPort.on('message', ({ id, text, url }) => {
  try { parentPort.postMessage({ id, data: parseFeed(text, url) }); } catch (e) { parentPort.postMessage({ id, error: e.message }); }
});
