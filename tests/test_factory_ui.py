"""Real loopback HTTP controls and SDK plugin metadata, without live inference."""
import asyncio
import json
from pathlib import Path
import re
import sys
import tempfile
import threading
import time
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from scripts.factory_ui import Service, make_server
from scripts.factory_mcp import build_server
from mcp import ClientSession, StdioServerParameters, stdio_client


class FactoryUITests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        base = Path(self.temp.name).resolve()
        self.service = Service(products_dir=base / 'products', data_dir=base / 'data')
        self.server = make_server(self.service)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f'http://127.0.0.1:{self.server.server_port}'
        with urlopen(self.url) as response:
            self.html = response.read().decode()
        self.token = re.search(r'name="foundry-token" content="([^"]+)"', self.html)[1]

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.service.close()
        self.temp.cleanup()

    def request(self, path, body=None, **headers):
        request = Request(self.url + path, headers={
            'X-Foundry-Token': self.token, 'Content-Type': 'application/json', **headers},
            data=None if body is None else json.dumps(body).encode())
        with urlopen(request) as response:
            return json.loads(response.read())

    def test_name_idea_workspace_and_artifact_are_reachable_through_http(self):
        project = self.request('/api/create', {'name': 'HTTP product', 'idea': 'Save one useful note locally.'})
        listing = self.request('/api/snapshot')
        self.assertEqual(listing['projects'][0]['id'], project['id'])
        self.assertEqual(project['stage'], 'research')
        artifact = self.request(f"/api/artifact?id={project['id']}&path=docs/product/idea.md")
        self.assertIn('Save one useful note', artifact['content'])
        self.assertRegex(artifact['revision'], r'^[0-9a-f]{64}$')
        self.assertNotIn('ACCESS_TOKEN', json.dumps(listing))
        for path in ['../.env', '/etc/passwd', 'docs/../../../.env']:
            with self.assertRaises(HTTPError) as error:
                self.request(f"/api/artifact?id={project['id']}&path={path}")
            self.assertEqual(error.exception.code, 400)

    def test_ui_approval_requires_the_exact_reviewed_revision(self):
        project = self.service.factory.create('Reviewed product', 'Require exact owner review.')
        project['stage'] = 'scope'
        project['status'] = 'awaiting_approval'
        spec = Path(project['path']) / 'docs/specs/product.md'
        spec.parent.mkdir(parents=True, exist_ok=True)
        spec.write_text('# Scope\n\n## Acceptance criteria\n\n- AC-1: reviewed.\n')
        self.service.factory._replace(project)
        reviewed = self.request(
            f"/api/artifact?id={project['id']}&path=docs/specs/product.md")
        with self.assertRaises(HTTPError) as missing_revision:
            self.request('/api/approve', {
                'id': project['id'], 'reviewed_revision': None})
        self.assertEqual(missing_revision.exception.code, 400)
        spec.write_text(spec.read_text() + '\n- AC-2: changed after review.\n')

        with self.assertRaises(HTTPError) as error:
            self.request('/api/approve', {
                'id': project['id'], 'reviewed_revision': reviewed['revision']})
        self.assertEqual(error.exception.code, 400)
        current = self.service.factory.snapshot()['projects'][0]
        self.assertEqual((current['stage'], current['status']), ('scope', 'awaiting_approval'))

        latest = self.request(
            f"/api/artifact?id={project['id']}&path=docs/specs/product.md")
        approved = self.request('/api/approve', {
            'id': project['id'], 'reviewed_revision': latest['revision']})
        self.assertEqual(approved['stage'], 'design')

    def test_cross_origin_bad_host_and_missing_token_are_rejected(self):
        for headers in [{'Origin': 'https://attacker.invalid'}, {'Host': 'attacker.invalid'}, {'X-Foundry-Token': ''}]:
            with self.subTest(headers=headers), self.assertRaises(HTTPError) as error:
                self.request('/api/create', {'name':'Blocked','idea':'Blocked'}, **headers)
            self.assertEqual(error.exception.code, 403)
        self.assertEqual(self.service.factory.snapshot()['projects'], [])
        with self.assertRaises(HTTPError) as error:
            self.request('/api/create', {'name':'Blocked','idea':'Blocked','credential_env':{'ACCESS_TOKEN':'blocked'}})
        self.assertEqual(error.exception.code, 400)

    def test_static_react_bundle_logo_and_font_are_strictly_served(self):
        with urlopen(self.url + '/app.js') as response:
            self.assertEqual(response.headers.get_content_type(), 'text/javascript')
            self.assertIn(b'createRoot', response.read())
        with urlopen(self.url + '/assets/foundry-mark.svg') as response:
            self.assertEqual(response.headers.get('Content-Type'), 'image/svg+xml')
            self.assertIn("img-src 'self' data:", response.headers['Content-Security-Policy'])
            self.assertIn("font-src 'self' data:", response.headers['Content-Security-Policy'])
            self.assertEqual(response.read(),
                             (self.service.root / 'app/assets/foundry-mark.svg').read_bytes())
        with urlopen(self.url + '/assets/geist-latin-wght-normal.woff2') as response:
            self.assertEqual(response.headers.get('Content-Type'), 'font/woff2')
            self.assertEqual(response.read(),
                             (self.service.root / 'app/assets/geist-latin-wght-normal.woff2').read_bytes())
        with self.assertRaises(HTTPError) as error:
            urlopen(self.url + '/assets/missing.png')
        self.assertEqual(error.exception.code, 404)

    def test_account_switch_is_blocked_while_a_stage_runs(self):
        self.service.jobs['fixture'] = {'status':'running','error':None}
        for action in ['sign-in', 'sign-out']:
            with self.assertRaisesRegex(ValueError, 'running jobs'):
                self.service.dispatch(action, {})
        self.assertEqual(len(self.service.jobs), 1)

    def test_background_job_reflects_returned_interruption(self):
        self.service.background('truthful', lambda: {
            'status': 'interrupted', 'history': [{'note': 'Owner stopped the stage'}]})
        deadline = time.monotonic() + 2
        while time.monotonic() < deadline and self.service.jobs['truthful']['status'] == 'running':
            time.sleep(0.01)
        self.assertEqual(self.service.jobs['truthful'], {
            'status': 'interrupted', 'error': 'Owner stopped the stage'})

    def test_mcp_global_and_thread_ui_and_owner_only_approval(self):
        server = build_server(self.service)
        tools = {tool.name: tool for tool in asyncio.run(server.list_tools())}
        self.assertIn('foundry_create', tools)
        meta = tools['foundry_open'].meta
        self.assertEqual(meta['ui']['resourceUri'], 'ui://foundry/factory')
        self.assertEqual(meta['openai/ui']['entrypoints'], [{'type':'global'}, {'type':'thread'}])
        self.assertEqual(tools['foundry_approve'].meta['ui']['visibility'], ['app'])
        for name in ('foundry_run', 'foundry_sign_in', 'foundry_sign_out', 'foundry_models'):
            self.assertTrue(tools[name].annotations.open_world_hint, name)
        for name in ('foundry_open', 'foundry_snapshot', 'foundry_create',
                     'foundry_artifact', 'foundry_cancel', 'foundry_approve', 'foundry_configure'):
            self.assertFalse(tools[name].annotations.open_world_hint, name)
        resources = asyncio.run(server.list_resources())
        self.assertTrue(any(str(item.uri) == 'ui://foundry/factory' for item in resources))

    def test_packaged_stdio_server_delivers_tools_state_and_panel(self):
        async def check():
            parameters = StdioServerParameters(command=sys.executable, args=[
                str(self.service.root / 'scripts/factory_mcp.py'),
                '--data-dir', str(Path(self.temp.name).resolve() / 'mcp-data'),
                '--products-dir', str(Path(self.temp.name).resolve() / 'mcp-products')])
            async with stdio_client(parameters) as (reader, writer):
                async with ClientSession(reader, writer) as client:
                    await client.initialize()
                    tools = await client.list_tools()
                    self.assertEqual(len(tools.tools), 11)
                    result = await client.call_tool('foundry_snapshot', {})
                    self.assertFalse(result.is_error)
                    self.assertEqual(json.loads(result.content[0].text)['projects'], [])
                    panel = await client.read_resource('ui://foundry/factory')
                    html = panel.contents[0].text
                    self.assertTrue('create-form' in html, 'Factory panel contains the product entry form')
                    self.assertTrue('data:image/svg+xml;base64,' in html, 'Panel includes the logo offline')
                    self.assertTrue('data:font/woff2;base64,' in html, 'Panel includes its font offline')
                    self.assertFalse('/assets/' in html, 'Panel must not request local asset routes')
                    self.assertFalse('src="/app.js"' in html, 'Panel must include its own application bundle')
        asyncio.run(asyncio.wait_for(check(), timeout=15))
