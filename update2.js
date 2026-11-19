const CHANNEL_ID = 'UCIU8ha-NHmLjtUwU7dFiXUA';

async function getFirstFiveBalls(targetDate) {
  const ymd = targetDate.replace(/-/g, '');
  const rssXml = await (await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`)).text();

  const entry = rssXml.match(
    new RegExp(`<entry>[\\s\\S]*?<yt:videoId>([^<]+)<\\/yt:videoId>[\\s\\S]*?<title>[^<]*${ymd}[^<]*彩券開獎[^<]*<\\/title>[\\s\\S]*?<\\/entry>`)
  );
  if (!entry) return null;

  const videoId = entry[1];
  const watchHtml = await (await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'Accept-Language': 'zh-TW,zh;q=0.9' }
  })).text();

  const capMatch = watchHtml.match(/"captionTracks":\s*(\[.*?\])/);
  if (!capMatch) return null;

  const tracks = JSON.parse(capMatch[1]);
  const zhTrack = tracks.find(t => t.languageCode?.startsWith('zh')) || tracks[0];
  if (!zhTrack?.baseUrl) return null;

  const subXml = await (await fetch(zhTrack.baseUrl)).text();
  const lines = [...subXml.matchAll(/<text start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g)];

  let text = '';
  for (const m of lines) {
    const sec = parseFloat(m[1]);
    if (sec >= 210 && sec <= 320) {
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

  return balls.length === 5 ? { videoId, balls } : null;
}

(async () => {
  const result = await getFirstFiveBalls('2026-11-10');
  console.log(result);
})();
