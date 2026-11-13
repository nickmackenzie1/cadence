'use strict';
/* Configuration: everything that comes from the environment, and the data folder layout. */
const fs = require('fs');
const path = require('path');

const PORT = +process.env.PORT || 8484;
const DATA_DIR = process.env.DATA_DIR || '/data';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PASSWORD = process.env.APP_PASSWORD || '';          // optional login
const USERNAME = process.env.APP_USERNAME || 'cadence';
const API_KEY = process.env.ANTHROPIC_API_KEY || '';       // optional AI
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const MODEL_QUICK = process.env.ANTHROPIC_MODEL_QUICK || 'claude-haiku-5-5';
const KEEP_BACKUPS = +process.env.KEEP_BACKUPS || 30;
// HTTPS (mkcert): deploy.sh writes cert.pem/key.pem into ./certs on the NAS, mounted at /certs.
// When they exist, HTTPS runs on HTTPS_PORT and the plain HTTP port only redirects (and serves the public CA).
const TLS_DIR = process.env.TLS_DIR || '/certs';
const HTTPS_PORT = +process.env.HTTPS_PORT || 8443;
const HTTPS_PUBLIC_PORT = +process.env.HTTPS_PUBLIC_PORT || HTTPS_PORT;   // the port on the NAS (compose maps it to 8443 inside)

const STATE_FILE = path.join(DATA_DIR, 'state.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const ICON_DIR = path.join(DATA_DIR, 'favicons');
const BANNER_DIR = path.join(DATA_DIR, 'banners');
const COMPANY_DIR = path.join(DATA_DIR, 'companies');
fs.mkdirSync(BANNER_DIR, { recursive: true });
fs.mkdirSync(COMPANY_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });
fs.mkdirSync(ICON_DIR, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.woff2': 'font/woff2' };
const STARTED = Date.now();

module.exports = { API_KEY, BACKUP_DIR, BANNER_DIR, COMPANY_DIR, DATA_DIR, HTTPS_PORT, HTTPS_PUBLIC_PORT, ICON_DIR, KEEP_BACKUPS, MIME, MODEL, MODEL_QUICK, PASSWORD, PORT, PUBLIC_DIR, STARTED, STATE_FILE, TLS_DIR, USERNAME };
