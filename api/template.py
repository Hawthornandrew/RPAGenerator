"""
api/template.py
GET /api/template → streams the RPA template PDF from Vercel Blob
Keeps the blob URL out of the client bundle.
"""

import os
import urllib.request
from http.server import BaseHTTPRequestHandler

TEMPLATE_URL = os.environ.get("TEMPLATE_URL", "")

CORS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


class handler(BaseHTTPRequestHandler):

    def log_message(self, *a): pass

    def _send_headers(self, status, content_type, content_length=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        if content_length:
            self.send_header("Content-Length", str(content_length))
        # Cache for 1 hour — template rarely changes
        self.send_header("Cache-Control", "public, max-age=3600")
        for k, v in CORS.items():
            self.send_header(k, v)
        self.end_headers()

    def do_OPTIONS(self):
        self._send_headers(200, "text/plain", 0)

    def do_GET(self):
        if not TEMPLATE_URL:
            err = b'{"error": "TEMPLATE_URL env var not set"}'
            self._send_headers(500, "application/json", len(err))
            self.wfile.write(err)
            return

        try:
            with urllib.request.urlopen(TEMPLATE_URL) as resp:
                pdf_bytes = resp.read()
            self._send_headers(200, "application/pdf", len(pdf_bytes))
            self.wfile.write(pdf_bytes)
        except Exception as e:
            err = f'{{"error": "{str(e)}"}}'.encode()
            self._send_headers(500, "application/json", len(err))
            self.wfile.write(err)
