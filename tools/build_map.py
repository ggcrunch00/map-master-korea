# 게임용 지도 파일(data/map.js) 만들기
# 사용: python3 tools/build_map.py <작업폴더> <출력 map.js>
#   작업폴더에는 mapshaper로 만든 full.json(단순화 전), units.json(단순화), uline.json(시군구 경계선), sline.json(시도 경계선)이 있어야 함
#
# 하는 일
# 1) 단순화하면서 사라진 섬을 되살림: 넓이 1㎢ 이상 섬 + 꼭 남길 섬(독도·마라도 등)
# 2) 이웃(맞닿은 시군구) 계산: 단순화 뒤 같은 꼭짓점을 2개 이상 나누면 이웃
# 3) 화면 좌표(가로 1000)로 바꾸고 SVG 경로 글자로 저장
import json, math, sys, os

work, out = sys.argv[1], sys.argv[2]
load = lambda n: json.load(open(os.path.join(work, n), encoding="utf-8"))
full, simp, uline, sline = load("full.json"), load("units.json"), load("uline.json"), load("sline.json")

MIN_ISLAND = 1_000_000  # 1㎢
# 꼭 남길 섬: (이름, 투영 좌표 x, y 근처) — 넓이 1㎢보다 작아도 지도에 반드시 보여야 하는 섬
MUST_KEEP = {
    "독도": (1387500, 1924750), "마라도": (885045, 1459148),
}

def polys_of(g):
    return g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]

def area(r):
    s = 0
    for i in range(len(r) - 1):
        s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]
    return s / 2

def centroid(r):
    a = area(r)
    if abs(a) < 1e-9:
        xs = [p[0] for p in r]; ys = [p[1] for p in r]
        return sum(xs) / len(xs), sum(ys) / len(ys)
    cx = cy = 0
    for i in range(len(r) - 1):
        f = r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]
        cx += (r[i][0] + r[i + 1][0]) * f; cy += (r[i][1] + r[i + 1][1]) * f
    return cx / (6 * a), cy / (6 * a)

def inside(pt, r):
    x, y = pt; c = False
    for i in range(len(r) - 1):
        x1, y1 = r[i]; x2, y2 = r[i + 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c

def dp(pts, tol):
    # 더글러스-포이커 단순화(선 모양 유지)
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; dmax, idx = 0, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1e-9
        d = abs(dy * px - dx * py + b[0] * a[1] - b[1] * a[0]) / L if (dx or dy) else math.hypot(px - a[0], py - a[1])
        if d > dmax: dmax, idx = d, i
    if dmax > tol:
        return dp(pts[: idx + 1], tol)[:-1] + dp(pts[idx:], tol)
    return [a, b]

def small_ring(r, tol=60):
    s = dp(r, tol)
    if len(s) < 4:  # 너무 작으면 원래 점에서 고르게 6개
        n = len(r) - 1; step = max(1, n // 6)
        s = r[:-1:step] + [r[0]]
    return s

simp_by = {f["properties"]["unit"]: f for f in simp["features"]}
added = {}
for f in full["features"]:
    u = f["properties"]["unit"]; sf = simp_by[u]
    souts = [p[0] for p in polys_of(sf["geometry"])]
    for poly in polys_of(f["geometry"]):
        r = poly[0]; a = abs(area(r)); c = centroid(r)
        must = any(math.hypot(c[0] - mx, c[1] - my) < 5000 for mx, my in MUST_KEEP.values())
        if a < MIN_ISLAND and not must: continue
        if any(inside(c, sr) for sr in souts): continue
        g = sf["geometry"]
        if g["type"] == "Polygon":
            g["type"], g["coordinates"] = "MultiPolygon", [g["coordinates"]]
        g["coordinates"].append([small_ring(r)])
        added.setdefault(sf["properties"]["unitnm"], 0); added[sf["properties"]["unitnm"]] += 1

# 화면 좌표
xs, ys = [], []
for f in simp["features"]:
    for poly in polys_of(f["geometry"]):
        for x, y in poly[0]: xs.append(x); ys.append(y)
minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
PAD = 12000
minx -= PAD; maxx += PAD; miny -= PAD; maxy += PAD
W = 1000; K = W / (maxx - minx); H = round((maxy - miny) * K)
T = lambda x, y: (round((x - minx) * K, 1), round((maxy - y) * K, 1))
fmt = lambda v: ("%.1f" % v).rstrip("0").rstrip(".")

def ring_path(r):
    pts = [T(*p) for p in r[:-1]]
    out, last = [], None
    for p in pts:
        if p != last: out.append(p)
        last = p
    if len(out) < 3: return ""
    return "M" + "L".join(fmt(x) + " " + fmt(y) for x, y in out) + "Z"

def geom_path(g):
    s = ""
    for poly in polys_of(g):
        for r in poly: s += ring_path(r)
    return s

def lines_path(fc):
    s = ""
    geoms = [f["geometry"] for f in fc["features"]] if "features" in fc else fc["geometries"]
    for g in geoms:
        parts = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
        for line in parts:
            pts = [T(*p) for p in line]
            s += "M" + "L".join(fmt(x) + " " + fmt(y) for x, y in pts)
    return s

# 이웃: 단순화된 경계의 꼭짓점 공유
owner = {}
for f in simp["features"]:
    u = f["properties"]["unit"]
    for poly in polys_of(f["geometry"]):
        for r in poly:
            for p in r[:-1]:
                owner.setdefault((p[0], p[1]), set()).add(u)
pair = {}
for us in owner.values():
    if len(us) < 2: continue
    us = sorted(us)
    for i in range(len(us)):
        for j in range(i + 1, len(us)):
            pair[(us[i], us[j])] = pair.get((us[i], us[j]), 0) + 1
nb = {}
for (a, b), n in pair.items():
    if n >= 2:
        nb.setdefault(a, set()).add(b); nb.setdefault(b, set()).add(a)

SHORT = {"11": "서울", "26": "부산", "27": "대구", "28": "인천", "12": "전남광주", "30": "대전", "31": "울산",
         "36": "세종", "41": "경기", "51": "강원", "43": "충북", "44": "충남", "52": "전북", "47": "경북", "48": "경남", "50": "제주"}

units, sidos = [], {}
for f in sorted(simp["features"], key=lambda f: f["properties"]["unit"]):
    p = f["properties"]
    polys = polys_of(f["geometry"])
    big = max((pl[0] for pl in polys), key=lambda r: abs(area(r)))
    cx, cy = T(*centroid(big))
    # 넓이(㎢) — 단순화 전 기준
    units.append({"c": p["unit"], "n": p["unitnm"], "s": p["sido"], "d": geom_path(f["geometry"]),
                  "x": cx, "y": cy, "nb": sorted(nb.get(p["unit"], []))})
    sd = sidos.setdefault(p["sido"], {"c": p["sido"], "n": p["sidonm"], "short": SHORT[p["sido"]], "pts": []})
    sd["pts"].append((cx, cy, abs(area(big))))

sido_list = []
for s in sidos.values():
    tw = sum(w for _, _, w in s["pts"])
    s["x"] = round(sum(x * w for x, _, w in s["pts"]) / tw, 1); s["y"] = round(sum(y * w for _, y, w in s["pts"]) / tw, 1)
    del s["pts"]; sido_list.append(s)
sido_list.sort(key=lambda s: s["c"])

# 지도 위 표시(작아서 안 보이는 섬에 이름표)
marks = [{"n": n, "x": T(x, y)[0], "y": T(x, y)[1]} for n, (x, y) in MUST_KEEP.items() if n == "독도"]
data = {"w": W, "h": H, "ver": "2026-07-01", "units": units, "sido": sido_list, "marks": marks,
        "uline": lines_path(uline), "sline": lines_path(sline)}
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, "w", encoding="utf-8") as fo:
    fo.write("// 자동 생성 파일(tools/build_map.py). 직접 고치지 마세요.\n")
    fo.write("// 경계 출처: 통계청 SGIS 행정동 경계 → vuski/admdongkor ver20260701(MIT) 가공\n")
    fo.write("window.MAP = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
print("되살린 섬:", sum(added.values()), "개", dict(sorted(added.items(), key=lambda x: -x[1])[:8]))
print("단위", len(units), "시도", len(sido_list), "크기", os.path.getsize(out) // 1024, "KB", "화면", W, "x", H)
print("이웃 없는 단위:", [u["n"] for u in units if not u["nb"]])
