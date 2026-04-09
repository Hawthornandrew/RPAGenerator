"""
api/coordinates.py
GET  /api/coordinates  → returns the saved field coordinate map as JSON
POST /api/coordinates  → saves a new coordinate map (admin only, pin-protected)
"""

import json
import os
from http.server import BaseHTTPRequestHandler

# The coordinates are stored as an environment variable FIELD_COORDINATES
# set in Vercel dashboard. This means:
#   - Updating coordinates = updating the env var + redeploying (or using the mapper tool)
#   - Everyone on the team reads the same coordinates

ADMIN_PIN = os.environ.get("ADMIN_PIN", "")  # Set in Vercel env vars

CORS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Pin",
}


class handler(BaseHTTPRequestHandler):

    def log_message(self, *a): pass

    def _send(self, status, content_type, body):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        for k, v in CORS.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(200, "text/plain", b"")

    def do_GET(self):
        raw = os.environ.get("FIELD_COORDINATES", "{}")
        try:
            coords = json.loads(raw)
        except Exception:
            coords = {}
        body = json.dumps(coords).encode()
        self._send(200, "application/json", body)

    def do_POST(self):
        # Verify admin pin
        pin = self.headers.get("X-Admin-Pin", "")
        if ADMIN_PIN and pin != ADMIN_PIN:
            self._send(401, "application/json",
                       json.dumps({"error": "Invalid PIN"}).encode())
            return

        # Read and validate body
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw    = self.rfile.read(length)
            coords = json.loads(raw)
        except Exception as e:
            self._send(400, "application/json",
                       json.dumps({"error": str(e)}).encode())
            return

        # We can't update env vars at runtime, so we return the coordinates
        # as a JSON string for the admin to paste into Vercel env vars.
        # This is the simplest, most reliable approach for a small team.
        body = json.dumps({
            "ok": True,
            "message": "Copy the value below into your FIELD_COORDINATES env var in Vercel, then redeploy.",
            "FIELD_COORDINATES": json.dumps(coords)
        }).encode()
        self._send(200, "application/json", body)
