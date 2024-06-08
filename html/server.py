# https://stackoverflow.com/a/25708957
import http.server


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_my_headers()
        super().end_headers()

    def send_my_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')


if __name__ == '__main__':
    http.server.test(HandlerClass=NoCacheHandler)
