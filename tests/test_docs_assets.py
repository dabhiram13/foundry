import base64
import hashlib
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import factory_ui
import providers


class DocumentationAssetsTests(unittest.TestCase):
    def test_search_json_is_served_verbatim_without_unlocking_the_api(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(factory_ui, 'ROOT', Path(tmp)):
            root = Path(tmp)
            metadata = root / 'site/dist/pagefind/pagefind-entry.json'
            metadata.parent.mkdir(parents=True)
            metadata.write_bytes(b'{"version":"fixture"}')
            server = factory_ui.make_server(object())
            worker = threading.Thread(target=server.serve_forever, daemon=True)
            worker.start()
            try:
                origin = f'http://127.0.0.1:{server.server_port}'
                with urlopen(origin + '/pagefind/pagefind-entry.json?ts=123', timeout=5) as response:
                    self.assertEqual(response.headers.get_content_type(), 'application/json')
                    self.assertIn("'wasm-unsafe-eval'", response.headers['Content-Security-Policy'])
                    self.assertEqual(response.read(), metadata.read_bytes())
                with self.assertRaises(HTTPError) as denied:
                    urlopen(origin + '/api/snapshot', timeout=5)
                self.assertEqual(denied.exception.code, 403)
                denied.exception.close()
            finally:
                server.shutdown()
                server.server_close()
                worker.join(timeout=5)

    def test_only_static_docs_outputs_are_mapped(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(factory_ui, 'ROOT', Path(tmp)):
            root = Path(tmp)
            for name in ('docs/index.html', 'docs/getting-started/index.html', '_astro/site.js', 'pagefind/index.pf_meta', 'private.txt'):
                path = root / 'site/dist' / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('fixture')
            mapping = factory_ui.documentation_assets()
            self.assertEqual(set(mapping), {'/docs/', '/docs/getting-started/', '/_astro/site.js', '/pagefind/index.pf_meta'})

    def test_linked_docs_asset_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(factory_ui, 'ROOT', Path(tmp)):
            root = Path(tmp)
            (root / 'secret.txt').write_text('not public')
            (root / 'site/dist/docs').mkdir(parents=True)
            (root / 'site/dist/docs/index.html').symlink_to(root / 'secret.txt')
            with self.assertRaises(providers.Error):
                factory_ui.documentation_assets()

    def test_inline_script_policy_uses_exact_content_not_unsafe_eval(self):
        script = 'console.log("static docs")'
        policy = factory_ui.documentation_policy(f'<script>{script}</script>')
        digest = base64.b64encode(hashlib.sha256(script.encode()).digest()).decode()
        self.assertIn(f"'sha256-{digest}'", policy)
        self.assertIn("'wasm-unsafe-eval'", policy)
        self.assertNotIn("'unsafe-eval'", policy)
        self.assertNotIn("script-src 'self' 'unsafe-inline'", policy)


if __name__ == '__main__':
    unittest.main()
