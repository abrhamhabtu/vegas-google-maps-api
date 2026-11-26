"""Static dev server for the Vegas map.

- Listens on every interface, so a phone on the same Wi-Fi or Tailscale tailnet can open it.
- Gzips text assets (the 12 MB city snapshot shrinks to a fraction) and keeps the compressed
  bytes in memory until the file changes.
- Always revalidates (Cache-Control: no-cache) but answers unchanged files with a tiny 304 via
  ETags, so edits show up on reload without re-downloading everything.
- HTTP/1.1 keep-alive, so the ~100 ES module requests reuse connections.

Usage: python3 scripts/dev-server.py [port]   (default 8080; PORT env var also works)
"""
import gzip
import http.server
import os
import socket
import socketserver
import subprocess
import sys
import threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COMPRESSIBLE = {'.json', '.js', '.mjs', '.css', '.html', '.svg', '.txt', '.md', '.map'}
_gz_cache = {}  # path -> (etag, gzipped bytes)


class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def setup(self):
        super().setup()
        try:
            self.request.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        except OSError:
            pass

    def end_headers(self):
        # Allow browser disk-cache hits for large immutable data/vendor payloads on reload.
        if self.path.startswith(('/landmarks/footprints.json', '/landmarks/vendor/clipper/')):
            self.send_header('Cache-Control', 'public, max-age=3600')
        else:
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, fmt, *args):  # quieter: only errors
        if args and str(args[1]).startswith(('4', '5')) and str(args[1]) != '404':
            super().log_message(fmt, *args)

    def do_HEAD(self):
        self.do_GET(head=True)

    def do_GET(self, head=False):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            index = os.path.join(path, 'index.html')
            if os.path.exists(index) and self.path.split('?')[0].endswith('/'):
                path = index
            else:
                return super().do_HEAD() if head else super().do_GET()
        if not os.path.isfile(path):
            return super().do_HEAD() if head else super().do_GET()
        stat = os.stat(path)
        etag = f'"{stat.st_mtime_ns:x}-{stat.st_size:x}"'
        if self.headers.get('If-None-Match') == etag:
            self.send_response(304)
            self.send_header('ETag', etag)
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        ext = os.path.splitext(path)[1].lower()
        gzip_ok = ext in COMPRESSIBLE and 'gzip' in self.headers.get('Accept-Encoding', '')
        if gzip_ok:
            cached = _gz_cache.get(path)
            if not cached or cached[0] != etag:
                with open(path, 'rb') as f:
                    cached = (etag, gzip.compress(f.read(), compresslevel=4))
                _gz_cache[path] = cached
            body = cached[1]
        else:
            with open(path, 'rb') as f:
                body = f.read()
        self.send_response(200)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Length', str(len(body)))
        self.send_header('ETag', etag)
        self.send_header('Vary', 'Accept-Encoding')
        if gzip_ok:
            self.send_header('Content-Encoding', 'gzip')
        self.end_headers()
        if not head:
            self.wfile.write(body)


Handler.extensions_map.update({'.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json'})


def addresses(port):
    """localhost plus every IPv4 this machine has; 100.64.0.0/10 addresses are the tailnet."""
    urls = [f'http://localhost:{port}']
    try:
        out = subprocess.run(['ifconfig'], capture_output=True, text=True, timeout=2).stdout
    except (OSError, subprocess.SubprocessError):
        out = ''
    seen = set()
    for line in out.splitlines():
        parts = line.split()
        if len(parts) >= 2 and parts[0] == 'inet' and not parts[1].startswith('127.'):
            ip = parts[1]
            if ip in seen:
                continue
            seen.add(ip)
            a, b = (int(x) for x in ip.split('.')[:2])
            tailnet = a == 100 and 64 <= b <= 127
            urls.append(f'http://{ip}:{port}' + ('   <- Tailscale: open this on your phone' if tailnet else ''))
    return urls


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def prewarm_cache():
    """Pre-gzip footprints.json and all app modules/styles in the background so first page load never stalls."""
    skip_dirs = {'.git', 'node_modules', 'docs', 'tests', 'scripts', '__pycache__'}
    footprints = os.path.join(ROOT, 'landmarks', 'footprints.json')
    if os.path.isfile(footprints):
        try:
            stat = os.stat(footprints)
            etag = f'"{stat.st_mtime_ns:x}-{stat.st_size:x}"'
            with open(footprints, 'rb') as f:
                _gz_cache[footprints] = (etag, gzip.compress(f.read(), compresslevel=6))
        except OSError:
            pass
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in skip_dirs and not d.startswith('.')]
        for name in filenames:
            ext = os.path.splitext(name)[1].lower()
            if ext not in COMPRESSIBLE:
                continue
            target = os.path.join(dirpath, name)
            if target == footprints:
                continue
            try:
                stat = os.stat(target)
                etag = f'"{stat.st_mtime_ns:x}-{stat.st_size:x}"'
                cached = _gz_cache.get(target)
                if cached and cached[0] == etag:
                    continue
                with open(target, 'rb') as f:
                    _gz_cache[target] = (etag, gzip.compress(f.read(), compresslevel=4))
            except OSError:
                pass


if __name__ == '__main__':
    threading.Thread(target=prewarm_cache, daemon=True).start()
    port = int(sys.argv[1] if len(sys.argv) > 1 else os.environ.get('PORT', 8080))
    with Server(('', port), Handler) as server:
        print('Vegas map is being served at:')
        for url in addresses(port):
            print('  ' + url)
        sys.stdout.flush()
        server.serve_forever()
