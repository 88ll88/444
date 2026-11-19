const TARGETS = [
  { owner: '88ll88', repo: '444', path: 'vvv.js', token: process.env.TOKEN_88LL88, hasNdate: true },
  { owner: '88ll88', repo: '888', path: 'ddd.js', token: process.env.TOKEN_88LL88, hasNdate: false },
  { owner: '88l88',  repo: '888', path: 'ddd.js', token: process.env.TOKEN_88L88,  hasNdate: false }
];

async function getGitHubFile({ owner, repo, path, token }) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' }
  });
  if (!res.ok) return null;
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
  return res.ok;
}

(async () => {
  try {
    // 1. 先從 88ll88/444/vvv.js 讀取 Ndate
    const vvvFile = await getGitHubFile(TARGETS[0]);
    if (!vvvFile) process.exit(0);

    const ndateMatch = vvvFile.content.match(/Ndate\s*=\s*['"](\d{4}-\d{2}-\d{2})['"]/);
    if (!ndateMatch) process.exit(0);
    const targetDate = ndateMatch[1];

    // 查詢 Ndate 是否大於今天 (UTC+8)，大於則離開
    const nowStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
    if (targetDate > nowStr) process.exit(0);

    // 2. 抓 9800 網頁驗證目標日期與 5 顆落球
    const res9800 = await fetch('http://www.9800.com.tw/');
    const html9800 = await res9800.text();
    const rowRegex = new RegExp(`今彩539.+${targetDate}(.+\\d{2}.+){5}`);
    const rowMatch = html9800.match(rowRegex);
    if (!rowMatch) process.exit(0);

    const ballMatches = rowMatch[0].match(/<div class=ball_red>(\d{2})<\/div>/g);
    if (!ballMatches || ballMatches.length !== 5) process.exit(0);
    const balls = ballMatches.map(b => b.match(/\d{2}/)[0]);

    // 3. 抓 pilio 網頁取得下一期日期 (Tday)
    const resPilio = await fetch('https://www.pilio.idv.tw/lto539/list.asp');
    const htmlPilio = await resPilio.text();
    const tdayMatch = htmlPilio.match(/var\s+Tday\s*=\s*new\s+Date\("(\d{4})\/(\d{2})\/(\d{2})/);
    if (!tdayMatch) process.exit(0);
    const nextDate = `${tdayMatch[1]}-${tdayMatch[2]}-${tdayMatch[3]}`;

    const newEntry = `['${targetDate}',['${balls.join("','")}']]`;
    const catchTime = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });

    // 4. 依序更新三個目標檔案
    for (const target of TARGETS) {
      const fileData = target === TARGETS[0] ? vvvFile : await getGitHubFile(target);
      if (!fileData) continue;

      const arrayMatch = fileData.content.match(/(var\s+\w+\s*=\s*\[)\s*([\s\S]*?)\s*(\];)/);
      if (!arrayMatch) continue;

      const varHeader = arrayMatch[1]; // 如 var vvv=[ 或 var ddd=[
      const oldBody = arrayMatch[2].trim();
      const varFooter = arrayMatch[3];

      if (oldBody.includes(`'${targetDate}'`)) continue; // 已寫入過則跳過

      const updatedBody = oldBody ? `${newEntry},\n${oldBody}` : newEntry;
      let finalOutput = '';

      if (target.hasNdate) {
        finalOutput = `Ndate='${nextDate}';//如Tday\n${varHeader}\n${updatedBody}\n${varFooter}\n`;
      } else {
        finalOutput = `${varHeader}\n${updatedBody}\n${varFooter}\n`;
      }

      const ok = await updateGitHubFile(target, finalOutput, fileData.sha, `Update ${target.path} (${targetDate})`);
      if (ok) {
        console.log(`[成功] ${target.owner}/${target.repo}/${target.path} | 進號時間：${catchTime} | 落球：${balls.join(',')}`);
      }
    }
  } catch (e) {
    process.exit(0);
  }
})();
