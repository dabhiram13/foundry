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
        self.assertNotIn('ACCESS_TOKEN', json.dumps(listing))
        for path in ['../.env', '/etc/passwd', 'docs/../../../.env']:
            with self.assertRaises(HTTPError) as error:
                self.request(f"/api/artifact?id={project['id']}&path={path}")
            self.assertEqual(error.exception.code, 400)

    def test_cross_origin_bad_host_and_missing_token_are_rejected(self):
        for headers in [{'Origin': 'https://attacker.invalid'}, {'Host': 'attacker.invalid'}, {'X-Foundry-Token': ''}]:
            with self.subTest(headers=headers), self.assertRaises(HTTPError) as error:
                self.request('/api/create', {'name':'Blocked','idea':'Blocked'}, **headers)
            self.assertEqual(error.exception.code, 403)
        self.assertEqual(self.service.factory.snapshot()['projects'], [])
        with self.assertRaises(HTTPError) as error:
            self.request('/api/create', {'name':'Blocked','idea':'Blocked','credential_env':{'ACCESS_TOKEN':'blocked'}})
        self.assertEqual(error.exception.code, 400)

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
                    self.assertIn('Your software factory', panel.contents[0].text)
        asyncio.run(asyncio.wait_for(check(), timeout=15))
