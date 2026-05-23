#!/usr/bin/env python3
"""Shows X-Forwarded-For as received by the backend (JSON for curl tests)."""

import json
from http.server import BaseHTTPRequestHandler, HTTPServer


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        xff = self.headers.get("X-Forwarded-For", "")
        body = {
            "path": self.path,
            "x_forwarded_for": xff,
            "x_forwarded_for_chain": [p.strip() for p in xff.split(",") if p.strip()],
            "x_real_ip": self.headers.get("X-Real-IP", ""),
            "remote_addr_seen_by_app": self.client_address[0],
        }
        data = json.dumps(body, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        return


if __name__ == "__main__":
    HTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
