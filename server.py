import http.server
import socketserver

PORT = 8088

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

# Fix for Windows registry MIME type bug that serves CSS as text/plain
CustomHandler.extensions_map['.css'] = 'text/css'
CustomHandler.extensions_map['.js'] = 'application/javascript'
CustomHandler.extensions_map['.html'] = 'text/html'

with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), CustomHandler) as httpd:
    print("Serving at port", PORT, "with correct MIME types (Threaded)!")
    httpd.serve_forever()
