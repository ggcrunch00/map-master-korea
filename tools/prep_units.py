# 행정동 경계에 '게임 단위(시군구)' 코드를 붙이는 스크립트
# - 일반구(예: 수원시장안구)는 상위 시(수원시)로 합침
# - 세종은 시 하나, 제주는 제주시·서귀포시(행정시)를 그대로 단위로 씀
import json, re, sys
src, out = sys.argv[1], sys.argv[2]
d = json.load(open(src, encoding="utf-8"))
for f in d["features"]:
    p = f["properties"]
    nm, sgg = p["sggnm"], p["sgg"]
    m = re.match(r"^(.+?시)(.+구)$", nm)
    if m:
        unit, unitnm = sgg[:4] + "0", m.group(1)
    else:
        unit, unitnm = sgg, nm
    if p["sidonm"] == "세종특별자치시":
        unitnm = "세종특별자치시"
    f["properties"] = {"unit": unit, "unitnm": unitnm, "sido": p["sido"], "sidonm": p["sidonm"]}
json.dump(d, open(out, "w", encoding="utf-8"), ensure_ascii=False)
units = {(f["properties"]["unit"], f["properties"]["unitnm"]) for f in d["features"]}
print("게임 단위 수", len(units), "시도 수", len({f["properties"]["sido"] for f in d["features"]}))
