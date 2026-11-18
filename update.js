const fs = require('fs');
const https = require('https');

const TARGET_URL = 'https://www.pilio.idv.tw/Live/DrawLiveRead.asp?ltotype=lto539';
const OUTPUT_FILE = 'sss.js';
const DURATION_MS = 15 * 60 * 1000; // 持續監聽 15 分鐘（20:31 ~ 20:46）
const INTERVAL_MS = 4000; // 每 4 秒抓一次

// 取得台灣時間字串 (YYYY-MM-DD HH:mm:ss)
function getTaiwanTime() {
  const now = new Date();
  const twTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return twTime.toISOString().replace('T', ' ').substring(0, 19);
}

// 讀取現有的 sss.js 資料
let records = [];
if (fs.existsSync(OUTPUT_FILE)) {
  try {
    const content = fs.readFileSync(OUTPUT_FILE, 'utf8');
    const match = content.match(/var\s+sss\s*=\s*(\[[\s\S]*?\]);/);
    if (match) {
      records = JSON.parse(match[1]);
    }
  } catch (e) {
    records = [];
  }
}

// 寫入 sss.js
function saveToFile() {
  const fileContent = `var sss = ${JSON.stringify(records, null, 2)};\n`;
  fs.writeFileSync(OUTPUT_FILE, fileContent, 'utf8');
}

// 抓取即時直播內容
function fetchLive() {
  return new Promise((resolve) => {
    https.get(TARGET_URL, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // 去除 HTML 標籤與多餘空白，保留純文字與名稱
        const cleanText = data.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
        resolve(cleanText);
      });
    }).on('error', () => resolve(''));
  });
}

async function startRecording() {
  const startTime = Date.now();
  let lastSnapshot = '';

  console.log(`[${getTaiwanTime()}] 開始監聽即時開獎...`);

  const timer = setInterval(async () => {
    // 超過 15 分鐘自動結束
    if (Date.now() - startTime > DURATION_MS) {
      clearInterval(timer);
      console.log(`[${getTaiwanTime()}] 監聽結束，共紀錄 ${records.length} 筆資料。`);
      return;
    }

    const currentText = await fetchLive();
    
    // 只有當抓到有效文字，且跟上一秒的內容不一樣時（代表有新球掉出或切換彩種），才寫入紀錄
    if (currentText && currentText !== lastSnapshot) {
      lastSnapshot = currentText;
      const timeStr = getTaiwanTime();
      
      records.unshift({
        time: timeStr,
        raw: currentText
      });

      saveToFile();
      console.log(`[${timeStr}] 新增紀錄: ${currentText}`);
    }
  }, INTERVAL_MS);
}

startRecording();
