// 지리 문제 은행 점검: 저장소 폴더에서 node tests/check_questions.js
// - 번호 겹침, 분야 이름, 정답 지역이 지도에 실제로 있는지, 이름이 겹치는 시군구를 시도 없이 쓰지 않았는지 확인
global.window = {};
require("../data/map.js");
require("../data/geo.js");
const M = window.MAP, Q = window.GEO_Q;
const CATS = ["산·강·호수", "바다·섬·갯벌", "도시·행정", "가장 ~한 곳"];
const sidoNames = new Set(M.sido.map((s) => s.n));
const shortOf = Object.fromEntries(M.sido.map((s) => [s.c, s.short]));
const byName = {};
M.units.forEach((u) => (byName[u.n] = byName[u.n] || []).push(u));
let bad = 0;
const err = (q, m) => { bad++; console.log(`✗ ${q.id} ${m}`); };
const ids = new Set();
for (const q of Q) {
  if (ids.has(q.id)) err(q, "번호가 겹쳐요"); ids.add(q.id);
  if (!CATS.includes(q.cat)) err(q, "분야 이름이 이상해요: " + q.cat);
  if (!["sido", "unit"].includes(q.lv)) err(q, "lv는 sido 또는 unit");
  for (const k of ["q", "k", "ex"]) if (!q[k]) err(q, k + " 이(가) 비었어요");
  if (!Array.isArray(q.a) || !q.a.length) { err(q, "정답이 없어요"); continue; }
  if (q.all && q.a.length < 2) err(q, "all은 정답이 2곳 이상일 때만");
  if (new Set(q.a).size !== q.a.length) err(q, "정답이 겹쳐요");
  for (const a of q.a) {
    if (q.lv === "sido") { if (!sidoNames.has(a)) err(q, "시도 이름이 지도에 없어요: " + a); continue; }
    const m = a.match(/^(\S+) (.+)$/);
    if (m) {
      const hit = (byName[m[2]] || []).filter((u) => shortOf[u.s] === m[1]);
      if (hit.length !== 1) err(q, "시군구를 찾지 못했어요: " + a);
    } else {
      const hit = byName[a] || [];
      if (hit.length === 0) err(q, "시군구 이름이 지도에 없어요: " + a);
      if (hit.length > 1) err(q, `'${a}'은(는) ${hit.length}곳이라 "부산 중구"처럼 시도를 붙여야 해요`);
    }
  }
}
const cnt = {}; Q.forEach((q) => (cnt[q.cat] = (cnt[q.cat] || 0) + 1));
console.log(`문제 ${Q.length}개`, cnt);
console.log(bad ? `문제 ${bad}건 — 고쳐 주세요` : "모두 통과");
process.exit(bad ? 1 : 0);
