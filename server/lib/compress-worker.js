'use strict';
// Brotli for bundle.js, in its own thread (bundle.js): best compression takes seconds, and doing it on Node's shared
// thread pool held up file reads for everything else while it ran. One job at a time, in the order asked.
const { parentPort } = require('worker_threads');
const zlib = require('zlib');
parentPort.on('message', ({ id, buf }) => {
  try {
    const out = zlib.brotliCompressSync(Buffer.from(buf), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.byteLength, [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT } });
    parentPort.postMessage({ id, out }, [out.buffer]);
  } catch (e) { parentPort.postMessage({ id, error: e.message }); }
});
