const fs = require('fs');

(async () => {
  try {
    let vvvContent = fs.readFileSync('vvv.js', 'utf8');
    const ndateMatch = vvvContent.match(/Ndate\s*=\s*['"](\d{4}-\d{2}-\d{2})['"]/);
    if (!ndateMatch) process.exit(0);
    const targetDate = ndateMatch[1];

    // 查詢 Ndate 是否大於今天 (UTC+8)，大於則離開
    const nowStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
    if (targetDate > nowStr) process.exit(0);

    const res9800 = await fetch('http://www.9800.com.tw/');
    const html9800 = await res9800.text();
    const rowRegex = new RegExp(`今彩539.+${targetDate}(.+\\d{2}.+){5}`);
    const rowMatch = html9800.match(rowRegex);
    if (!rowMatch) process.exit(0);

    const ballMatches = rowMatch[0].match(/<div class=ball_red>(\d{2})<\/div>/g);
    if (!ballMatches || ballMatches.length !== 5) process.exit(0);
    const balls = ballMatches.map(b => b.match(/\d{2}/)[0]);

    const resPilio = await fetch('https://www.pilio.idv.tw/lto539/list.asp');
    const htmlPilio = await resPilio.text();
    const tdayMatch = htmlPilio.match(/var\s+Tday\s*=\s*new\s+Date\("(\d{4})\/(\d{2})\/(\d{2})/);
    if (!tdayMatch) process.exit(0);
    const nextDate = `${tdayMatch[1]}-${tdayMatch[2]}-${tdayMatch[3]}`;

    const newEntry = `['${targetDate}',['${balls.join("','")}']]`;
    const arrayBodyMatch = vvvContent.match(/var\s+vvv\s*=\s*\[\s*([\s\S]*?)\s*\];/);
    if (!arrayBodyMatch) process.exit(0);

    let oldBody = arrayBodyMatch[1].trim();
    if (oldBody.includes(`'${targetDate}'`)) process.exit(0);

    const updatedBody = oldBody ? `${newEntry},\n${oldBody}` : newEntry;
    const finalOutput = `Ndate='${nextDate}';//如Tday\nvar vvv=[\n${updatedBody}\n];\n`;

    fs.writeFileSync('vvv.js', finalOutput, 'utf8');
  } catch (e) {
    process.exit(0);
  }
})();
