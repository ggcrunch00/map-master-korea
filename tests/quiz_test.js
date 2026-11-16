// 지리 문제 자동 점검: 모든 문제를 (1) 한 번 틀리고 맞히기 (2) '모르겠어요'로 넘기기를 번갈아 하며 끝까지 풀어 봄
// 사용: python3 -m http.server 8140 을 켠 뒤 node tests/quiz_test.js <사진 저장 폴더> [가로] [세로]
const { chromium } = require("playwright");
const [OUT, VW = "1280", VH = "800"] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +VW, height: +VH } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8140/index.html");
  await p.waitForTimeout(600);
  await p.click('#modeChips [data-m="quiz"]');
  await p.click('#countChips [data-n="0"]');
  await p.click("#goBtn");
  const n = await p.evaluate(() => Q.length);
  let shots = 0;
  const pt = (code) => p.evaluate((c) => { const u = unitBy[c]; const r = new DOMPoint(u.x, u.y).matrixTransform(svg.getScreenCTM()); const h = document.elementFromPoint(r.x, r.y); return { x: r.x, y: r.y, ok: !!(h && h.closest("path.u") && h.closest("path.u").dataset.c === c) }; }, code);
  for (let i = 0; i < n; i++) {
    const q = await p.evaluate(() => ({ groups: cur().groups.map((g) => g.slice()), all: cur().all, title: cur().title }));
    if (i % 3 === 2) { await p.click("#skipBtn"); }
    else {
      // 정답 아닌 곳 한 번 누르기
      const wrongC = await p.evaluate(() => M.units.find((u) => !cur().groups.flat().includes(u.c)).c);
      await p.evaluate(() => fitHome());
      let w = await pt(wrongC); await p.mouse.click(w.x, w.y);
      for (const g of q.all ? q.groups : [q.groups[0]]) {
        // 정답 묶음 안에서 가장 넓은 시군구 중심을 누름(작은 곳이면 확대)
        const c = await p.evaluate((g) => g.slice().sort((a, b) => { const A = unitBy[a].el.getBBox(), B = unitBy[b].el.getBBox(); return B.width * B.height - A.width * A.height; })[0], g);
        await p.evaluate((c) => fitBox(unitBy[c].el.getBBox(), 1.5), c);
        const r = await pt(c);
        if (!r.ok) errs.push(`문제 ${i + 1} 중심점이 다른 곳에 걸림: ${c}`);
        await p.mouse.click(r.x, r.y); await p.waitForTimeout(60);
      }
    }
    await p.waitForTimeout(150);
    const st = await p.evaluate(() => ({ next: !$("#nextBtn").hidden, fb: $("#feedback").textContent }));
    if (!st.next) errs.push(`문제 ${i + 1} 끝났는데 다음 단추가 없음: ${q.title} / ${st.fb}`);
    if (shots < 2 && q.all) { await p.screenshot({ path: `${OUT}/quiz_all_${VW}.png` }); shots++; }
    if (i === 0) await p.screenshot({ path: `${OUT}/quiz_first_${VW}.png` });
    await p.click("#nextBtn");
  }
  await p.waitForTimeout(300);
  const res = await p.evaluate(() => ({ shown: !$("#result").hidden, score: $("#rScore").textContent, ok: $("#rOk").textContent }));
  await p.click("#review button");
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${OUT}/quiz_result_${VW}.png` });
  console.log(`문제 ${n}개 끝까지 풀기:`, res);
  console.log("오류:", errs.length ? errs : "없음");
  await b.close();
})();
