"""
Bundle the web build into one self-contained HTML page (JS and images inlined),
so the app can be previewed in a phone browser from any static host.

    npm run preview:build    # writes dist-preview/kowhai-budget.html
"""
import base64, glob, os, re, sys
src, out = sys.argv[1], sys.argv[2]
js = open(glob.glob(f'{src}/_expo/static/js/web/entry-*.js')[0]).read()
def to_data(m):
    path = os.path.join(src, m.group(1).lstrip('/'))
    if not os.path.exists(path): return m.group(0)
    return '"data:image/png;base64,' + base64.b64encode(open(path,'rb').read()).decode() + '"'
js, n = re.subn(r'"(/assets/[^"]+\.png)"', to_data, js)
print('inlined assets:', n, ' </script occurrences:', js.count('</script'))
js = js.replace('</script', '<\\/script')
html = f'''<title>Kōwhai Budget</title>
<meta name="description" content="Budgeting app preview (demo data)">
<style>
  :root {{ --bg: #f4f4f2; --fg: #1d1d1f; color-scheme: light; }}
  html, body {{ height: 100%; }}
  body {{ overflow: hidden; background: var(--bg); color: var(--fg); }}
  #root {{ display: flex; height: 100%; flex: 1; }}
</style>
<div id="root"></div>
<script>
  // Expo Router reads the URL path; start the app at its home route wherever this page is hosted.
  try {{ if (location.pathname !== '/') history.replaceState(null, '', '/'); }} catch (e) {{}}
</script>
<script>
{js}
</script>
'''
open(out,'w').write(html)
print('size MB', round(len(html)/1e6,2))
