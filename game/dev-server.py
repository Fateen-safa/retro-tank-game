"""Local dev server for the game: like `python -m http.server`, but tells the browser not to
cache files, so a normal reload always picks up code changes.

Run from the `retro game` folder:  python game/dev-server.py   then open http://localhost:8080/game/
"""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    with http.server.ThreadingHTTPServer(('127.0.0.1', PORT), NoCacheHandler) as httpd:
        print(f'Serving {ROOT} at http://localhost:{PORT}/game/')
        httpd.serve_forever()
