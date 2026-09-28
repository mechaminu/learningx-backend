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
  res.json({ status: 'queued' });
  send(url, filename, host);
});

function send(url, name, host) {
    isBusy = true;
    const file = fs.createWriteStream(name);
    
    https.get(url,{headers:{'referer':host}}, (res) => {

        var fileSize = res.headers['content-length'];
       
        file.once('pipe', () => {
            (function showProgress() {
                var progress = Math.round( file.bytesWritten / fileSize * 100 );
                process.stdout.write('\rDownloading ' + name + ' : ' + file.bytesWritten+' bytes / '+fileSize+' bytes ('+progress+'%)');
                if ( progress <= 99 ) {
                    setTimeout(showProgress, 100);
                }
            })();
        });

        res.once("end", ()=> {
            process.stdout.write(' Done!\n');
            isBusy = false;
        });

        res.pipe(file);
    });
}