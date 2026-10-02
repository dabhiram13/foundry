#!/usr/bin/env python3
"""Local Foundry controls. Loopback only; credentials never reach the browser."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import secrets
import threading
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
    '/assets/geist-latin-wght-normal.woff2': ('assets/geist-latin-wght-normal.woff2', 'font/woff2', True),
}
for _weight in (400, 500, 600):
    _name = f'assets/figtree-latin-{_weight}-normal.woff2'
    STATIC_ASSETS['/' + _name] = (_name, 'font/woff2', True)
for _asset in sorted((ROOT / 'app/assets/bots').glob('*.png')):
    if _asset.is_file() and _asset.resolve().parent == (ROOT / 'app/assets/bots').resolve():
        _name = _asset.relative_to(ROOT / 'app').as_posix()
        STATIC_ASSETS['/' + _name] = (_name, 'image/png', True)


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
        result = self.factory.snapshot()
        try:
            result['account'] = self.auth().status(self.auth_dir)
        except (ImportError, ValueError, OSError, RuntimeError) as exc:
            result['account'] = {'connected': False, 'sharing': False, 'error': str(exc)}
        with self.lock:
            result['jobs'] = {key: dict(value) for key, value in self.jobs.items()}
        return result

    def background(self, key, operation):
        with self.lock:
            if self.jobs.get(key, {}).get('status') == 'running':
                raise ValueError('This action is already running')
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
            with self.lock:
                if any(job['status'] == 'running' for job in self.jobs.values()):
                    raise ValueError('Stop running jobs before connecting or switching accounts')
            return self.background('sign-in', lambda: self.auth().sign_in(self.auth_dir))
        if action == 'sign-out':
            with self.lock:
                if any(job['status'] == 'running' for job in self.jobs.values()):
                    raise ValueError('Stop running jobs before signing out')
            return self.auth().sign_out(self.auth_dir)
        if action == 'models':
            return self.auth().models(self.auth_dir)
        raise ValueError('Unknown action')

    def close(self):
        self.pool.shutdown(wait=True, cancel_futures=True)


def make_server(service, port=0):
    token = secrets.token_urlsafe(32)
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def send(self, status, content, mime='application/json'):
            if mime == 'application/json':
                body = json.dumps(content).encode()
            elif isinstance(content, bytes):
                body = content
            else:
                body = content.encode()
            self.send_response(status)
            charset = '; charset=utf-8' if mime.startswith('text/') or mime == 'application/json' else ''
            self.send_header('Content-Type', mime + charset)
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Referrer-Policy', 'no-referrer')
            self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
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
