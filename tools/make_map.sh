#!/usr/bin/env bash
# 게임 지도(data/map.js) 다시 만들기 — 저장소 폴더에서: bash tools/make_map.sh
# 1) 행정동 경계 받기  2) 게임 단위로 표시  3) 합치기·단순화(mapshaper)  4) 섬 되살리기·이웃 계산
set -euo pipefail
VER=ver20260701
W=$(mktemp -d)
(cd tools && npm install --silent)
curl -sSL -o "$W/hjd.geojson" "https://raw.githubusercontent.com/vuski/admdongkor/master/$VER/HangJeongDong_$VER.geojson"
python3 tools/prep_units.py "$W/hjd.geojson" "$W/units_in.geojson"
P='+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs'
MS=tools/node_modules/.bin/mapshaper
$MS -i "$W/units_in.geojson" name=units -dissolve unit copy-fields=unitnm,sido,sidonm -proj "$P" -o "$W/full.json" format=geojson precision=1
$MS -i "$W/units_in.geojson" name=units -dissolve unit copy-fields=unitnm,sido,sidonm -proj "$P" -simplify interval=300 keep-shapes \
  -o "$W/units.json" format=geojson precision=1 \
  -innerlines + name=uline -o "$W/uline.json" format=geojson precision=1 target=uline \
  -dissolve sido target=units + name=sido -innerlines target=sido + name=sline -o "$W/sline.json" format=geojson precision=1 target=sline
python3 tools/build_map.py "$W" data/map.js
echo "확인: 울릉군 조각이 3개(울릉도+독도 2)인지 꼭 보기"
