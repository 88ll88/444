const TARGETS = [
  { owner: '88ll88', repo: '444', path: 'vvv.js', token: process.env.TOKEN_88LL88, hasNdate: true },
  { owner: '88ll88', repo: '888', path: 'ddd.js', token: process.env.TOKEN_88LL88, hasNdate: false },
  { owner: '88l88',  repo: '888', path: 'ddd.js', token: process.env.TOKEN_88L88,  hasNdate: false }
];

const CHANNEL_ID = 'UCIU8ha-NHmLjtUwU7dFiXUA';

async function getGitHubFile({ owner, repo, path, token }) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json'
    }
  });
  if (!res.ok) {
    console.log(`[GitHub] 讀取失敗 ${owner}/${repo}/${path}: HTTP ${res.status}`);
    return null;
  }
  const data = await res.json();
  return {
    sha: data.sha,
    content: Buffer.from(data.content, 'base64').toString('utf8')
  };
}

async function updateGitHubFile({ owner, repo, path, token }, newContent, sha, message) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message,
      content: Buffer.from(newContent, 'utf8').toString('base64'),
      sha
    })
  });
  console.log(`[GitHub] 寫入 ${owner}/${repo}/${path}: ${res.ok ? '成功' : '失敗 HTTP ' + res.status}`);
  return res.ok;
}

async function getFirstFiveBalls(targetDate) {
  const ymd = targetDate.replace(/-/g, '');
  console.log(`[YT] 尋找日期 ${ymd} 的彩券開獎影片...`);
  const rssXml = await (await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`)).text();

  const entry = rssXml.match(
    new RegExp(`<entry>[\\s\\S]*?<yt:videoId>([^<]+)<\\/yt:videoId>[\\s\\S]*?<title>[^<]*${ymd}[^<]*彩券開獎[^<]*<\\/title>[\\s\\S]*?<\\/entry>`)
  );
  if (!entry) {
    console.log('[YT] RSS 找不到對應影片');
    return null;
  }

  const videoId = entry[1];
  console.log(`[YT] 找到影片 ID: ${videoId}`);
  const watchHtml = await (await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'Accept-Language': 'zh-TW,zh;q=0.9' }
  })).text();

  const capMatch = watchHtml.match(/"captionTracks":\s*(\[.*?\])/);
  if (!capMatch) {
    console.log('[YT] 網頁找不到字幕軌 (captionTracks)');
    return null;
  }

  const tracks = JSON.parse(capMatch[1]);
  const zhTrack = tracks.find(t => t.languageCode?.startsWith('zh')) || tracks[0];
  if (!zhTrack?.baseUrl) {
    console.log('[YT] 找不到字幕連結');
    return null;
  }

  const subXml = await (await fetch(zhTrack.baseUrl)).text();
  const lines = [...subXml.matchAll(/<text start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g)];
  console.log(`[YT] 抓到字幕行數: ${lines.length}`);

  let text = '';
  for (const m of lines) {
    const sec = parseFloat(m[1]);
    if (sec >= 210 && sec <= 510) {
      text += ' ' + m[2].replace(/<[^>]*>/g, '');
    }
  }

  const fixed = text
    .replace(/[零頂林]\s*([1-9])/g, '0$1')
    .replace(/一\s*([0-9])/g, '1$1')
    .replace(/二\s*([0-9])/g, '2$1')
    .replace(/三\s*([0-9])/g, '3$1');

  const nums = fixed.match(/\b(0[1-9]|[12]\d|3[0-9])\b/g) || [];
  const balls = [];
  for (const n of nums) {
    if (!balls.includes(n)) {
      balls.push(n);
      if (balls.length === 5) break;
    }
  }

  console.log(`[YT] 解析出前 5 球: ${JSON.stringify(balls)}`);
  return balls.length === 5 ? balls : null;
}

(async () => {
  try {
    console.log('=== 開始執行 ===');
    const vvvFile = await getGitHubFile(TARGETS[0]);
    if (!vvvFile) return;

    const ndateMatch = vvvFile.content.match(/Ndate\s*=\s*['"](\d{4}-\d{2}-\d{2})['"]/);
    if (!ndateMatch) {
      console.log('[檢查] vvv.js 找不到 Ndate');
      return;
    }
    const targetDate = ndateMatch[1];
    const nowStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
    console.log(`[檢查] Ndate=${targetDate}, 台灣今天=${nowStr}`);

    if (targetDate > nowStr) {
      console.log('[結束] Ndate 還沒到，不執行');
      return;
    }

    const balls = await getFirstFiveBalls(targetDate);
    if (!balls) {
      console.log('[結束] 尚未抓滿 5 顆球');
      return;
    }

    let nextDate = targetDate;
    try {
      const resPilio = await fetch('https://www.pilio.idv.tw/lto539/list.asp');
      const htmlPilio = await resPilio.text();
      const tdayMatch = htmlPilio.match(/var\s+Tday\s*=\s*new\s+Date\("(\d{4})\/(\d{2})\/(\d{2})/);
      if (tdayMatch) {
        nextDate = `${tdayMatch[1]}-${tdayMatch[2]}-${tdayMatch[3]}`;
      }
      console.log(`[Pilio] 下期 Tday=${nextDate}`);
    } catch (e) {
      console.log('[Pilio] 抓取失敗:', e.message);
    }

    const newEntry = `['${targetDate}',['${balls.join("','")}']]`;
    console.log(`[資料] 準備寫入: ${newEntry}`);

    for (const target of TARGETS) {
      const fileData = target === TARGETS[0] ? vvvFile : await getGitHubFile(target);
      if (!fileData) continue;

      const arrayMatch = fileData.content.match(/(var\s+\w+\s*=\s*\[)\s*([\s\S]*?)\s*(\];)/);
      if (!arrayMatch) {
        console.log(`[格式] 找不到陣列 ${target.owner}/${target.repo}/${target.path}`);
        continue;
      }

      const varHeader = arrayMatch[1];
      const oldBody = arrayMatch[2].trim();
      const varFooter = arrayMatch[3];

      if (oldBody.includes(`'${targetDate}'`)) {
        console.log(`[略過] ${target.owner}/${target.repo}/${target.path} 已有 ${targetDate}`);
        continue;
      }

      const updatedBody = oldBody ? `${newEntry},\n${oldBody}` : newEntry;
      const finalOutput = target.hasNdate
        ? `Ndate='${nextDate}';//如Tday\n${varHeader}\n${updatedBody}\n${varFooter}\n`
        : `${varHeader}\n${updatedBody}\n${varFooter}\n`;

      await updateGitHubFile(target, finalOutput, fileData.sha, `Update ${target.path} (${targetDate})`);
    }
    console.log('=== 執行結束 ===');
  } catch (err) {
    console.error('[錯誤]', err);
  }
})();
