// 빈 지도 채우기 자동 점검: 시도 16곳을 여러 꼴(전체 이름·줄임말+Enter)로 채우고, 틀린 이름·바뀐 이름 알림, 시군구 단계 일부 채우고 그만하기
// 사용: python3 -m http.server 8140 을 켠 뒤 node tests/fill_test.js <사진 저장 폴더> [가로] [세로]
const { chromium } = require("playwright");
const [OUT, VW = "1280", VH = "800"] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +VW, height: +VH } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8140/index.html#fill");
  await p.waitForTimeout(600);
  await p.click('.stage[data-lv="1"]');
  await p.click("#goBtn");
  const type = async (t, enter) => { await p.fill("#fInput", t); if (enter) await p.press("#fInput", "Enter"); await p.waitForTimeout(40); };
  const fb = () => p.evaluate(() => $("#fFeedback").textContent);
  // 틀린 이름, 바뀐 이름
  await type("부여", true); const m1 = await fb();
  await type("전라남도", true); const m2 = await fb();
  // '경기'만 쓰면 기다리고(채우지 않음), Enter면 채움
  await type("경기", false); const c1 = await p.evaluate(() => F.found);
  await p.press("#fInput", "Enter"); const c2 = await p.evaluate(() => F.found);
  const names = ["서울특별시", "부산", "대구시", "인천광역시", "전남광주", "대전", "울산광역시", "세종", "강원도", "충북", "충청남도", "경북", "경상남도", "제주도", "전북특별자치도"];
  for (const n of names) await type(n, true);
  await p.waitForTimeout(300);
  const r1 = await p.evaluate(() => ({ shown: !$("#result").hidden, title: $("#rTitle").textContent, score: $("#rScore").textContent + "/" + $("#rMax").textContent }));
  await p.screenshot({ path: `${OUT}/fill_sido_${VW}.png` });
  // 3단계 전국 시군구: 이름 겹침(중구 5곳), 줄임말
  await p.click("#homeBtn"); await p.click('.card[data-g="fill"]'); await p.click('.stage[data-lv="3"]'); await p.click("#goBtn");
  await type("중구", true); const z = await p.evaluate(() => F.found);
  await type("수원시", false); await type("고양", true); await type("영종구", false);
  await p.waitForTimeout(100);
  await p.screenshot({ path: `${OUT}/fill_unit_play_${VW}.png` });
  await p.click("#fGiveUp"); await p.waitForTimeout(300);
  const r2 = await p.evaluate(() => ({ score: $("#rScore").textContent + "/" + $("#rMax").textContent, miss: $("#rOk").textContent }));
  await p.click("#review button"); await p.waitForTimeout(200);
  await p.screenshot({ path: `${OUT}/fill_unit_result_${VW}.png` });
  console.log("틀린 이름:", m1, "| 바뀐 이름:", m2);
  console.log("'경기'만 썼을 때 채운 수", c1, "→ Enter 뒤", c2);
  console.log("시도 결과", r1);
  console.log("'중구' 한 번에 채운 수", z, "| 시군구 결과", r2);
  console.log("오류:", errs.length ? errs : "없음");
  await b.close();
})();
