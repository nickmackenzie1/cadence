'use strict';
// Expands calendars off the main thread (calendar.js readAll()): .ics text in, events out.
const { workerData, parentPort } = require('worker_threads');
try {
  const { eventsFrom } = require('./calendar');
  const { items, from, to } = workerData;
  parentPort.postMessage({ events: items.flatMap(it => eventsFrom(it.cal, it.text, from, to)) });
} catch (e) { parentPort.postMessage({ error: e.message }); }
