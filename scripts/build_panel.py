#!/usr/bin/env python3
"""Build browser assets and the self-contained MCP App resource."""
import base64
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
app = root / 'app'
esbuild = str(root / 'node_modules/.bin/esbuild')


def bundle(source, output):
    subprocess.run([esbuild, str(app / source), '--bundle', '--format=iife', '--minify',
                    f'--outfile={app / output}'], check=True)


bundle('vendor-entry.js', 'vendor.js')
bundle('mcp-entry.js', 'mcp-bridge.js')
bridge = app / 'mcp-bridge.js'
try:
    html = (app / 'index.html').read_text()
    style = (app / 'style.css').read_text()
    logo = 'data:image/png;base64,' + base64.b64encode(
        (app / 'assets/foundry-mark.png').read_bytes()).decode()
    html = html.replace('/assets/foundry-mark.png', logo)
    style = style.replace('/assets/foundry-mark.png', logo)
    html = html.replace('<link rel="stylesheet" href="/style.css">', '<style>' + style + '</style>')
    for source in ('vendor.js', 'app.js'):
        html = html.replace(f'<script src="/{source}" defer></script>', '')
    scripts = []
    for source in ('vendor.js', 'mcp-bridge.js', 'app.js'):
        scripts.append('<script>' + (app / source).read_text().replace('</script', '<\\/script') + '</script>')
    html = html.replace('</body>', '\n'.join(scripts) + '\n</body>')
    (app / 'panel.html').write_text('\n'.join(line.rstrip() for line in html.splitlines()) + '\n')
finally:
    bridge.unlink(missing_ok=True)
print('Built app/vendor.js and app/panel.html')
