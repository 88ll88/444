const fs = require('fs');
const https = require('https');

const OUTPUT_FILE = 'sss.js';
const DURATION_MS = 20 * 60 * 1000; // 錄製 20 分鐘
const INTERVAL_MS = 4000; // 每 4 秒抓一次，間隔拉寬一點

const GAMES = [
  { name: '今彩539', type: 'lto539' },
  { name: '大樂透', type: 'ltobig' },
  { name: '威力彩', type: 'lto' },
  { name: '3星彩', type: 'lto3' },
  { name: '4星彩', type: 'lto4' }
];

function getTaiwanTime() {
  const now = new Date();
  const twTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return twTime.toISOString().replace('T', ' ').substring(0, 19);
}

let logs = [];
if (fs.existsSync(OUTPUT_FILE)) {
  try {
    const content = fs.readFileSync(OUTPUT_FILE, 'utf8');
    const match = content.match(/var\s+sss\s*=\s*(\[[\s\S]*?\]);/);
    if (match) logs = JSON.parse(match[1]);
  } catch (e) {
    logs = [];
  }
}

function save() {
  fs.writeFileSync(OUTPUT_FILE, `var sss = ${JSON.stringify(logs, null, 2)};\n`, 'utf8');
}

function fetchRaw(ltotype) {
  const url = `https://www.pilio.idv.tw/Live/DrawLiveRead.asp?ltotype=${ltotype}`;
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const text = data.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
        resolve(text);
      });
    }).on('error', () => resolve(''));
  });
}

async function run() {
  const start = Date.now();
  const lastMap = {};

  const timer = setInterval(async () => {
    if (Date.now() - start > DURATION_MS) {
      clearInterval(timer);
      return;
    }

    for (const game of GAMES) {
      const current = await fetchRaw(game.type);
      if (current && current !== lastMap[game.type]) {
        lastMap[game.type] = current;
        
        // 把抓到的號碼轉成你想要的格式 (例如把逗號隔開的號碼變成 1：xx，2：xx)
        const balls = current.split(/[\s,]+/).filter(Boolean);
        const formattedBalls = balls.map((ball, index) => `${index + 1}：${ball}`).join('，');

        logs.push(`${getTaiwanTime()} | ${game.name} | ${formattedBalls}`);
        save();
      }
    }
  }, INTERVAL_MS);
}

run();
