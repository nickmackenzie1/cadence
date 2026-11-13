'use strict';
/* HTTPS: the mkcert certificate made on the NAS, and the public CA for installing on your devices. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { TLS_DIR } = require('../config');
const { send } = require('./http');

function caCert() { try { return fs.readFileSync(path.join(TLS_DIR, 'rootCA.pem')); } catch { return null; } }
function caFingerprint() { const pem = caCert(); try { return pem ? new crypto.X509Certificate(pem).fingerprint256 : ''; } catch { return ''; } }
// the public root certificate, for installing on your devices (never the key)
function sendCA(res) {
  const pem = caCert();
  if (!pem) return send(res, 404, 'No certificate authority yet', 'text/plain');
  res.writeHead(200, { 'Content-Type': 'application/x-x509-ca-cert', 'Content-Disposition': 'attachment; filename="cadence-rootCA.crt"', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(pem);
}

function loadTLS() {
  try { return { cert: fs.readFileSync(path.join(TLS_DIR, 'cert.pem')), key: fs.readFileSync(path.join(TLS_DIR, 'key.pem')) }; } catch { return null; }
}

// loaded once at startup; null when there is no certificate (plain HTTP only)
const TLS = loadTLS();

module.exports = { TLS, caCert, caFingerprint, sendCA };
