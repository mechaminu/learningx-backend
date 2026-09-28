const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = 52022;
let isBusy = false;

function safeFilename(filename) {
  if (typeof filename !== 'string') return null;
  const extension = path.extname(filename);
  const clean = filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').trim();
  if (!clean || clean === '.' || clean === '..') return null;
  const stem = clean.slice(0, extension ? -extension.length : undefined);
  const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i;
  const usable = reserved.test(clean) ? `_${clean}` : clean;
  // Keep the extension when shortening long lecture titles.
  const suffix = extension.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  if (Buffer.byteLength(usable) <= 200) return usable;
  let prefix = reserved.test(clean) ? `_${stem}` : stem;
  while (Buffer.byteLength(prefix + suffix) > 200) prefix = prefix.slice(0, -1);
  return prefix + suffix;
}

app.post('/download', (req, res) => {
  if (isBusy) return res.status(503).json({ error: 'Another download in progress' });
  const { url, filename, host } = req.body || {};
  const name = safeFilename(filename);
  if (!url || !host || !name) {
    return res.status(400).json({ error: 'Invalid url, filename, or host parameter' });
  }
  if (typeof url !== 'string' || typeof host !== 'string' || !url.startsWith('https://')) {
    return res.status(400).json({ error: 'Invalid url or host parameter' });
  }
  isBusy = true;
  res.json({ status: 'queued', filename: name });
  download(url, name, host);
});

function download(url, name, host) {
  const destination = path.join(process.cwd(), name);
  const file = fs.createWriteStream(destination, { flags: 'wx' });
  let request;
  let completed = false;
  let opened = false;
  let settled = false;
  let failed = false;

  function finish(error) {
    if (settled) return;
    settled = true;
    isBusy = false;
    if (error) {
      failed = true;
      console.error(`Download failed (${name}):`, error);
      if (request) request.destroy();
      file.destroy();
    } else {
      console.log(`Download complete: ${name}`);
    }
  }

  file.on('open', () => { opened = true; });
  file.on('error', finish);
  file.on('finish', () => { completed = true; });
  file.on('close', () => {
    if (!settled && completed) finish();
    else if (!settled) finish(new Error('File closed before download completed'));
    if (failed && opened) fs.unlink(destination, err => {
      if (err && err.code !== 'ENOENT') console.error('Partial file cleanup failed:', err);
    });
  });

  try {
    request = https.get(url, { headers: { referer: host } }, response => {
      if (response.statusCode !== 200) {
        response.resume();
        finish(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      response.on('error', finish);
      response.on('aborted', () => finish(new Error('Response aborted')));
      response.pipe(file);
    });
    request.on('error', finish);
  } catch (error) {
    finish(error);
  }
}

if (require.main === module) {
  app.listen(PORT, () => console.log(`Backend downloader listening at http://localhost:${PORT}/download`));
}

module.exports = { app, safeFilename };
