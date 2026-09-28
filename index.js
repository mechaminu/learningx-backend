const express = require('express');
const app = express();
app.use(express.json());
const cors = require('cors');
app.use(cors());  // Enable CORS for all routes
const https = require('https');
const fs = require('fs');
const process = require('process');
const readline = require('readline'); // ← 추가

const PORT = 52022;
app.listen(PORT, () => console.log(`Backend downloader listening at http://localhost:${PORT}/download`));

let isBusy = false;

function safeFilename(name) {
  if (typeof name !== 'string') return null;
  const safe = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '');
  if (!safe || /^\.+$/.test(safe)) return null;
  return /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(safe) ? `_${safe}` : safe;
}

console.log("KHU LearningX Lecture Downloader (HTTP mode)");
console.log("Awaiting download requests via HTTP POST at /download\n");

app.post('/download', (req, res) => {
  if (isBusy) {
    return res.status(503).json({ error: 'Another download in progress' });
  }
  const { url, filename, host } = req.body;
  if (!url || !filename || !host) {
    return res.status(400).json({ error: 'Missing url, filename, or host parameter' });
  }
  const name = safeFilename(filename);
  if (!name) return res.status(400).json({ error: 'Invalid filename' });
  res.json({ status: 'queued' });
  send(url, name, host);
});

function send(url, name, host) {
    isBusy = true;
    const file = fs.createWriteStream(name);
    let failed = false;
    const fail = (error) => {
        if (failed) return;
        failed = true;
        isBusy = false;
        console.error(`Download failed (${name}):`, error);
        file.destroy();
    };
    file.on('error', fail);
    
    try {
    https.get(url,{headers:{'referer':host}}, (res) => {

        var fileSize = res.headers['content-length'];
       
        file.once('pipe', () => {
            (function showProgress() {
                var progress = Math.round( file.bytesWritten / fileSize * 100 );
                process.stdout.write('\rDownloading ' + name + ' : ' + file.bytesWritten+' bytes / '+fileSize+' bytes ('+progress+'%)');
                if ( !failed && progress <= 99 ) {
                    setTimeout(showProgress, 100);
                }
            })();
        });

        res.once("end", ()=> {
            if (!failed) process.stdout.write(' Done!\n');
            if (!failed) isBusy = false;
        });

        res.on('error', fail);
        res.on('aborted', () => fail(new Error('Response aborted')));
        res.pipe(file);
    }).on('error', fail);
    } catch (error) {
        fail(error);
    }
}