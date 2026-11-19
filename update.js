const str = '<li><FONT color="#990000"><b>今彩539</b></FONT> 第<FONT color=#000000>115279</FONT>期 【2026-11-18】<br/><div class=ball_red>39</div> <div class=ball_red>35</div> <div class=ball_red>22</div> <div class=ball_red>27</div> <div class=ball_red>20</div> <br/></li>';

const match = str.match(/今彩539.+2026-11-18(.+\d{2}.+){5}/);
console.log("比對結果：", match ? "成功" : "失敗");
if (match) {
  // 把裡面所有的兩碼數字抓出來
  const balls = str.match(/<div class=ball_red>(\d{2})<\/div>/g).map(s => s.match(/\d{2}/)[0]);
  const result = ['2026-11-18', balls];
  console.log("格式化輸出：", JSON.stringify(result));
}
