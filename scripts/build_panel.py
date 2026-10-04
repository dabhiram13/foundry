#!/usr/bin/env python3
"""Build browser assets and the self-contained MCP App resource."""
import base64
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
app = root / 'app'
esbuild = str(root / 'node_modules/.bin/esbuild')
tailwind = str(root / 'node_modules/.bin/tailwindcss')
font_names = ['manrope-latin-wght-normal.woff2']


def bundle(source, output, *, tsconfig=False):
    command = [esbuild, str(app / source), '--bundle', '--format=iife', '--minify',
               '--platform=browser', f'--outfile={app / output}']
    if tsconfig:
        command.append(f'--tsconfig={root / "tsconfig.json"}')
        notice = (app / 'assets/animate-ui.LICENSE.md').read_text()
        notice += '\nshadcn/ui source adaptations\n' + (app / 'assets/licenses/shadcn-ui.txt').read_text()
        command.append('--banner:js=/*! Animate UI adaptations\n' + notice + '\n*/')
    subprocess.run(command, check=True)


for name in font_names:
    source = root / 'node_modules/@fontsource-variable/manrope/files' / name
    (app / 'assets' / name).write_bytes(source.read_bytes())
subprocess.run([tailwind, '-i', str(app / 'src/globals.css'), '-o', str(app / 'style.css'),
                '--minify'], cwd=root, check=True)
bundle('src/main.tsx', 'app.js', tsconfig=True)
(app / 'app.js').write_text('\n'.join(line.rstrip() for line in (app / 'app.js').read_text().splitlines()) + '\n')
bundle('mcp-entry.js', 'mcp-bridge.js')
bridge = app / 'mcp-bridge.js'
try:
    html = (app / 'index.html').read_text()
    html = html.replace('<meta name="foundry-style-nonce" content="__FOUNDRY_STYLE_NONCE__">\n', '')
    style = (app / 'style.css').read_text()
    asset_data = {}
    mime_types = {'.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2'}
    for path in sorted((app / 'assets').rglob('*')):
        if path.is_file() and path.suffix in mime_types:
            url = '/' + path.relative_to(app).as_posix()
            data = 'data:' + mime_types[path.suffix] + ';base64,' + base64.b64encode(path.read_bytes()).decode()
            asset_data[url] = data
            html = html.replace(url, data)
            style = style.replace(url, data)
    style_link = '<link rel="stylesheet" href="/style.css">'
    html = html.replace(style_link, '<style>' + style + '</style>')
    html = html.replace('<script src="/app.js" defer></script>', '')
    scripts = []
    for source in ('mcp-bridge.js', 'app.js'):
        script = (app / source).read_text()
        for asset_path, data in asset_data.items():
            script = script.replace(asset_path, data)
        scripts.append('<script>' + script.replace('</script', '<\\/script') + '</script>')
    html = html.replace('</body>', '\n'.join(scripts) + '\n</body>')
    (app / 'panel.html').write_text('\n'.join(line.rstrip() for line in html.splitlines()) + '\n')
finally:
    bridge.unlink(missing_ok=True)
print('Built app/style.css, app/app.js, and app/panel.html')
