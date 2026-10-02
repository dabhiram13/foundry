#!/usr/bin/env python3
"""Build the self-contained MCP App resource from the same local factory UI."""
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
app = root / 'app'
subprocess.run([str(root / 'node_modules/.bin/esbuild'), str(app / 'mcp-entry.js'),
                '--bundle', '--format=iife', '--minify', f'--outfile={app / "mcp-bridge.js"}'], check=True)
html = (app / 'index.html').read_text()
html = html.replace('<link rel="stylesheet" href="/style.css"><script src="/app.js" defer></script>',
                    '<style>' + (app / 'style.css').read_text() + '</style>')
html = html.replace('</body>', '<script>' + (app / 'mcp-bridge.js').read_text().replace('</script', '<\\/script') + '</script>\n<script>' + (app / 'app.js').read_text().replace('</script', '<\\/script') + '</script>\n</body>')
(app / 'panel.html').write_text('\n'.join(line.rstrip() for line in html.splitlines()) + '\n')
(app / 'mcp-bridge.js').unlink()
print('Built app/panel.html')
