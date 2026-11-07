#!/usr/bin/env bash
# Exports a single-bundle web build (no per-route code splitting) and inlines it into one HTML file.
set -euo pipefail
cd "$(dirname "$0")/.."
cp app.json app.json.bak
trap 'mv app.json.bak app.json' EXIT
node -e "const f='app.json',a=require('./'+f);a.expo.plugins=[['expo-router',{asyncRoutes:false}]];require('fs').writeFileSync(f,JSON.stringify(a,null,2)+'\n')"
npx expo export --platform web --output-dir dist-preview/web
python3 scripts/build_preview.py dist-preview/web dist-preview/kowhai-budget.html
