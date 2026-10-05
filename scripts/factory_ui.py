#!/usr/bin/env python3
"""Local Foundry controls. Loopback only; credentials never reach the browser."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import base64
import hashlib
import json
import mimetypes
import os
from pathlib import Path
import re
import secrets
import sys
import threading
import time
from urllib.parse import parse_qs, urlsplit
import webbrowser

try:
    from . import factory, providers
except ImportError:
    import factory, providers

ROOT = Path(__file__).resolve().parents[1]

# A finite UI asset map, not an arbitrary file server. Origin/token guards are unchanged.
STATIC_ASSETS = {
    '/': ('index.html', 'text/html', False),
    '/app.js': ('app.js', 'text/javascript', False),
    '/style.css': ('style.css', 'text/css', False),
    '/assets/foundry-mark.svg': ('assets/foundry-mark.svg', 'image/svg+xml', True),
    '/assets/foundry-wordmark.svg': ('assets/foundry-wordmark.svg', 'image/svg+xml', True),
    '/assets/inter-latin-wght-normal.woff2': ('assets/inter-latin-wght-normal.woff2', 'font/woff2', True),
    '/assets/manrope-latin-wght-normal.woff2': ('assets/manrope-latin-wght-normal.woff2', 'font/woff2', True),
}
for _weight in (400, 500, 600):
    _name = f'assets/figtree-latin-{_weight}-normal.woff2'
    STATIC_ASSETS['/' + _name] = (_name, 'font/woff2', True)
for _asset in sorted((ROOT / 'app/assets/bots').glob('*.png')):
    if _asset.is_file() and _asset.resolve().parent == (ROOT / 'app/assets/bots').resolve():
        _name = _asset.relative_to(ROOT / 'app').as_posix()
        STATIC_ASSETS['/' + _name] = (_name, 'image/png', True)


def documentation_assets():
    """Only expose files emitted by the static docs build, never repository files."""
    directory = providers._path(ROOT, 'site/dist')
    assets = {}
    if not directory.is_dir():
        return assets
    for path in directory.rglob('*'):
        relative = path.relative_to(directory).as_posix()
        if not relative.startswith(('docs/', '_astro/', 'pagefind/')):
            continue
        providers._path(ROOT, 'site/dist/' + relative)
        if not path.is_file():
            continue
        url = '/' + relative
        if url.endswith('/index.html'):
            url = url[:-10]
        assets[url] = (path, mimetypes.guess_type(path.name)[0] or 'application/octet-stream')
    return assets


def documentation_policy(content):
    directives = []
    for tag, directive in (('script', 'script-src'), ('style', 'style-src')):
        hashes = []
        for body in re.findall(rf'<{tag}\b[^>]*>(.*?)</{tag}>', content, re.DOTALL | re.IGNORECASE):
            encoded = base64.b64encode(hashlib.sha256(body.encode()).digest()).decode()
            hashes.append(f"'sha256-{encoded}'")
        extra = " 'wasm-unsafe-eval'" if tag == 'script' else ''
        directives.append(f"{directive} 'self'{extra} " + ' '.join(hashes))
    return ("default-src 'self'; " + '; '.join(directives)
            + "; style-src-attr 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; "
            "frame-ancestors 'none'; base-uri 'none'; form-action 'self'")


class Service:
    def __init__(self, root=ROOT, products_dir=None, data_dir=None):
        self.factory = factory.Factory(root, products_dir, state_dir=data_dir)
        self.root = Path(root).resolve()
        self.auth_dir = Path(data_dir or self.root).resolve() / '.foundry/state/chatgpt'
        # ponytail: four local jobs; add a durable queue when hosting for multiple owners.
        self.pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix='foundry')
        self.jobs = {}
        self.lock = threading.Lock()

    def auth(self):
        try:
            from . import chatgpt_auth
        except ImportError:
            import chatgpt_auth
        return chatgpt_auth

    def snapshot(self):
        started = time.monotonic()
        request_id = secrets.token_hex(8)

        def trace(phase):
            if os.environ.get('FOUNDRY_TRACE_REQUESTS') == '1':
                print(json.dumps({'event': 'snapshot_phase', 'request_id': request_id,
                                  'phase': phase,
                                  'elapsed_ms': round((time.monotonic() - started) * 1000)}),
                      file=sys.stderr, flush=True)
        trace('factory_start')
        result = self.factory.snapshot()
        factory_finished = time.monotonic()
        trace('account_start')
        try:
            result['account'] = self.auth().status(self.auth_dir)
        except (ImportError, ValueError, OSError, RuntimeError) as exc:
            result['account'] = {'connected': False, 'sharing': False, 'error': str(exc)}
        account_finished = time.monotonic()
        trace('jobs_start')
        with self.lock:
            result['jobs'] = {key: dict(value) for key, value in self.jobs.items()}
        finished = time.monotonic()
        trace('complete')
        if finished - started >= 1:
            print(json.dumps({'event': 'slow_snapshot',
                              'request_id': request_id,
                              'factory_ms': round((factory_finished - started) * 1000),
                              'account_ms': round((account_finished - factory_finished) * 1000),
                              'jobs_ms': round((finished - account_finished) * 1000)}),
                  file=sys.stderr, flush=True)
        return result

    def background(self, key, operation):
        with self.lock:
            if self.jobs.get(key, {}).get('status') == 'running':
                raise ValueError('This action is already running')
            account_jobs = {'sign-in', 'sign-out'}
            if key in account_jobs and any(job.get('status') == 'running' for job in self.jobs.values()):
                raise ValueError('Stop running jobs before connecting or switching accounts')
            if key not in account_jobs and any(self.jobs.get(name, {}).get('status') == 'running'
                                               for name in account_jobs):
                raise ValueError('Wait for the account change to finish before starting product work')
            self.jobs[key] = {'status': 'running', 'error': None, 'cancel_requested': False}
        def work():
            try:
                result = operation()
                status = result.get('status') if isinstance(result, dict) else None
                if status in {'failed', 'interrupted'}:
                    history = result.get('history') or []
                    error = history[-1].get('note') if history and isinstance(history[-1], dict) else None
                    outcome = {'status': status, 'error': providers.Redactor().clean(error or status)}
                else:
                    outcome = {'status': 'completed', 'error': None}
            except Exception as exc:
                outcome = {'status': 'failed', 'error': providers.Redactor().clean(str(exc))}
            with self.lock:
                self.jobs[key] = outcome
        self.pool.submit(work)
        return {'status': 'running', 'job': key}

    def dispatch(self, action, data):
        if not isinstance(data, dict):
            raise ValueError('Expected a JSON object')
        if action == 'create':
            if set(data) - {'name', 'idea', 'adapter', 'model', 'reasoning'}:
                raise ValueError('Unknown product settings')
            return self.factory.create(**data)
        if action == 'configure':
            identifier = data.pop('id')
            return self.factory.configure(identifier, **data)
        if action == 'run':
            identifier = data['id']
            def run():
                project = next((p for p in self.factory.snapshot()['projects'] if p['id'] == identifier), None)
                if not project:
                    raise ValueError('Unknown product')
                settings = project.get('settings', project)
                environment = None
                if settings.get('adapter', project.get('adapter')) == 'chatgpt':
                    environment = {'ACCESS_TOKEN': self.auth().access_token(self.auth_dir)}
                while True:
                    with self.lock:
                        if self.jobs[identifier].get('cancel_requested'):
                            return next((p for p in self.factory.snapshot()['projects'] if p['id'] == identifier), None)
                    result = self.factory.run(identifier, credential_env=environment)
                    if result['status'] != 'completed' or (result['stage'] == 'release' and any(a.get('stage') == 'release' for a in result.get('artifacts', []))):
                        return result
                    if settings.get('adapter', project.get('adapter')) == 'chatgpt':
                        environment = {'ACCESS_TOKEN': self.auth().access_token(self.auth_dir)}
            return self.background(identifier, run)
        if action == 'approve':
            if set(data) != {'id', 'reviewed_revision'}:
                raise ValueError('Approval requires the reviewed document revision')
            revision = data['reviewed_revision']
            if (not isinstance(revision, str) or len(revision) != 64
                    or any(char not in '0123456789abcdef' for char in revision)):
                raise ValueError('Approval requires a valid reviewed document revision')
            return self.factory.approve(data['id'], reviewed_revision=revision)
        if action == 'cancel':
            with self.lock:
                if data['id'] in self.jobs:
                    self.jobs[data['id']]['cancel_requested'] = True
            return self.factory.cancel(data['id'])
        if action == 'sign-in':
            return self.background('sign-in', lambda: self.auth().sign_in(self.auth_dir))
        if action == 'sign-out':
            return self.background('sign-out', lambda: self.auth().sign_out(self.auth_dir))
        if action == 'models':
            return self.auth().models(self.auth_dir)
        raise ValueError('Unknown action')

    def close(self):
        self.pool.shutdown(wait=True, cancel_futures=True)


def make_server(service, port=0):
    token = secrets.token_urlsafe(32)
    docs_assets = documentation_assets()
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def send(self, status, content, mime='application/json', policy=None):
            style_nonce = secrets.token_urlsafe(24)
            if mime == 'text/html' and isinstance(content, str):
                content = content.replace('__FOUNDRY_STYLE_NONCE__', style_nonce)
            if isinstance(content, bytes):
                body = content
            elif mime == 'application/json':
                body = json.dumps(content).encode()
            else:
                body = content.encode()
            self.send_response(status)
            charset = '; charset=utf-8' if mime.startswith('text/') or mime == 'application/json' else ''
            self.send_header('Content-Type', mime + charset)
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Referrer-Policy', 'no-referrer')
            self.send_header('Content-Security-Policy', policy or f"default-src 'self'; script-src 'self'; style-src 'self' 'nonce-{style_nonce}'; style-src-attr 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
            self.end_headers()
            self.wfile.write(body)

        def guard(self, protected=True):
            host = f'127.0.0.1:{self.server.server_port}'
            if self.headers.get('Host') != host or self.headers.get('Origin', 'http://' + host) != 'http://' + host:
                raise PermissionError('Only the local Foundry origin is allowed')
            if protected and not secrets.compare_digest(self.headers.get('X-Foundry-Token', ''), token):
                raise PermissionError('Open Foundry locally to authorize this action')

        def do_GET(self):
            try:
                parsed = urlsplit(self.path)
                self.guard(parsed.path.startswith('/api/'))
                if parsed.path == '/api/snapshot':
                    self.send(200, service.snapshot())
                elif parsed.path == '/api/artifact':
                    params = parse_qs(parsed.query)
                    self.send(200, service.factory.artifact_record(params['id'][0], params['path'][0]))
                elif parsed.path in docs_assets:
                    path, mime = docs_assets[parsed.path]
                    providers._path(ROOT, path.relative_to(ROOT))
                    if mime == 'text/html':
                        content = path.read_text()
                        self.send(200, content, mime, documentation_policy(content))
                    else:
                        self.send(200, path.read_bytes(), mime, documentation_policy(''))
                elif parsed.path == '/docs':
                    self.send_response(302)
                    self.send_header('Location', '/docs/')
                    self.send_header('Content-Length', '0')
                    self.end_headers()
                elif parsed.path.startswith('/docs/') and not docs_assets:
                    self.send_response(302)
                    self.send_header('Location', 'https://github.com/dabhiram13/foundry/blob/main/docs/README.md')
                    self.send_header('Content-Length', '0')
                    self.end_headers()
                elif parsed.path in STATIC_ASSETS:
                    name, mime, binary = STATIC_ASSETS[parsed.path]
                    path = ROOT / 'app' / name
                    content = path.read_bytes() if binary else path.read_text()
                    if name == 'index.html':
                        content = content.replace('__FOUNDRY_TOKEN__', token)
                    self.send(200, content, mime)
                else:
                    self.send(404, {'error': 'Not found'})
            except PermissionError as exc:
                self.send(403, {'error': str(exc)})
            except (ValueError, KeyError, OSError) as exc:
                self.send(400, {'error': providers.Redactor().clean(str(exc))})

        def do_POST(self):
            try:
                self.guard()
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= 256 * 1024:
                    raise ValueError('Request must be between 1 byte and 256 KiB')
                if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                    raise ValueError('Use application/json')
                parsed = urlsplit(self.path)
                if not parsed.path.startswith('/api/') or '/' in parsed.path[5:]:
                    raise ValueError('Unknown action')
                result = service.dispatch(parsed.path[5:], json.loads(self.rfile.read(size)))
                self.send(200, result)
            except PermissionError as exc:
                self.send(403, {'error': str(exc)})
            except (ValueError, KeyError, TypeError, OSError, factory.Error, providers.Error, RuntimeError) as exc:
                self.send(400, {'error': providers.Redactor().clean(str(exc))})
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    server.daemon_threads = True
    return server


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--products-dir', type=Path)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    service = Service(products_dir=args.products_dir)
    server = make_server(service, args.port)
    url = f'http://127.0.0.1:{server.server_port}'
    print(f'Foundry: {url}', flush=True)
    if not args.no_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        service.close()


if __name__ == '__main__':
    main()
