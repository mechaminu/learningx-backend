const WebSocket = require('ws');
const https = require('https');
const fs = require('fs');
const process = require('process');
const wss = new WebSocket.Server({port:52022});
var isBusy = false;
var isConnected = false;

console.log("KHU LearningX Lecture Downloader");
console.log("크롬 확장프로그램을 통해 선택된 강의 영상을 다운로드 합니다")
console.log("한번에 하나의 강의만 다운로드 가능합니다\n")

var cnt = 0;
function animatedWait() {
    
    if (!isConnected) {
        if (cnt-- <= 0) {
            process.stdout.clearLine();
            process.stdout.write('\r크롬 확장프로그램이 작동할 때까지 대기중');
            cnt = cnt + 5;
        }
        else
        {
            process.stdout.write('.')
        }
        setTimeout(animatedWait,1000);
    }
}

wss.once('listening', () => {
    animatedWait();
});

wss.on('connection', ws => {
    isConnected = true;
    console.log('\r확장프로그램 작동 확인! 브라우저에서 확장프로그램을 통해 강의를 선택하세요')
    ws.on('message', msg => {
        if (isBusy) {
            console.log("\r진행중인 다운로드가 종료될 때까지 기다려주세요")
            return;
        }
        var data = JSON.parse(msg.toString());
        send(data.url, data.filename, data.host)
    })
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