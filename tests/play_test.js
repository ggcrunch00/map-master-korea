// 자동 플레이 점검: 단계별로 문제를 풀어 보고 오류·결과를 확인
// 사용: (저장소 폴더에서) python3 -m http.server 8140 을 켠 뒤 node tests/play_test.js <사진 저장 폴더>
const { chromium } = require("playwright");
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const errs = [];
  async function run(lv, vw, vh, opts) {
    const p = await b.newPage({ viewport: { width: vw, height: vh } });
    p.on("pageerror", (e) => errs.push(lv + ": " + e.message));
    p.on("console", (m) => m.type() === "error" && errs.push(lv + " console: " + m.text()));
    await p.goto("http://localhost:8140/index.html");
    await p.waitForTimeout(600);
    await p.click('#modeChips [data-m="name"]');
    await p.click(`.stage[data-lv="${lv}"]`);
    if (lv === 2) await p.click('#sidoChips [data-s="12"]');
    await p.click("#goBtn");
    let miss = 0, n = await p.evaluate(() => Q.length);
    for (let i = 0; i < n; i++) {
      // 일부러 첫 문제는 한 번 틀리기
      const pt = await p.evaluate(({ wrong }) => {
        const q = cur();
        // 정답 묶음에서 가장 넓은 시군구(시도 문제는 시도 안 가장 넓은 곳)
        let c = q.groups[0].slice().sort((a, b) => { const A = unitBy[a].el.getBBox(), B = unitBy[b].el.getBBox(); return B.width * B.height - A.width * A.height; })[0];
        if (wrong) c = M.units.find((x) => !q.groups[0].includes(x.c) && !x.el.classList.contains("off")).c;
        const u = unitBy[c];
        const r = new DOMPoint(u.x, u.y).matrixTransform(svg.getScreenCTM());
        const hit = document.elementFromPoint(r.x, r.y);
        return { x: r.x, y: r.y, ok: !!(hit && hit.closest && hit.closest("path.u") && hit.closest("path.u").dataset.c === c), name: u.n };
      }, { wrong: i === 0 });
      if (!pt.ok) { miss++; }
      await p.mouse.click(pt.x, pt.y);
      if (i === 0) {
        await p.waitForTimeout(150);
        if (opts.shotWrong) await p.screenshot({ path: `${OUT}/lv${lv}_wrong_${vw}.png` });
        await p.waitForTimeout(200);
        const pt2 = await p.evaluate(() => { const g = cur().groups[0]; const c = g.slice().sort((a, b) => { const A = unitBy[a].el.getBBox(), B = unitBy[b].el.getBBox(); return B.width * B.height - A.width * A.height; })[0]; const u = unitBy[c]; const r = new DOMPoint(u.x, u.y).matrixTransform(svg.getScreenCTM()); return { x: r.x, y: r.y }; });
        await p.mouse.click(pt2.x, pt2.y);
      }
      await p.waitForTimeout(lv === 3 ? 820 : 800);
      if (await p.evaluate(() => !G.on)) break;
    }
    await p.waitForTimeout(400);
    const res = await p.evaluate(() => ({ score: $("#rScore").textContent, first: $("#rFirst").textContent, ok: $("#rOk").textContent, shown: !$("#result").hidden }));
    console.log(`단계${lv} ${vw}x${vh}: 문제 ${n}, 중심점이 다른 곳에 걸림 ${miss}, 결과`, res);
    await p.screenshot({ path: `${OUT}/lv${lv}_result_${vw}.png` });
    await p.close();
  }
  await run(1, 1280, 800, { shotWrong: true });
  await run(2, 390, 844, { shotWrong: true });
  await run(3, 1280, 800, {});
  console.log("오류:", errs.length ? errs : "없음");
  await b.close();
})();
