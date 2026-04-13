"""
api/fields.py
GET  /api/fields  → returns saved field definitions as JSON array
POST /api/fields  → returns the value to paste into FIELD_DEFINITIONS env var
"""

import json
import os
from http.server import BaseHTTPRequestHandler

ADMIN_PIN = os.environ.get("ADMIN_PIN", "")

# Default field definitions — used when FIELD_DEFINITIONS env var is not yet set
DEFAULT_FIELDS = [
    {"id": "date_prepared",        "label": "Date prepared",               "page": 1,  "sampleValue": "04/01/2026",                    "formSection": "hidden",   "formLabel": "Date"},
    {"id": "property_address_p1",  "label": "Property address (addendum)", "page": 1,  "sampleValue": "1234 Maple Ave",                "formSection": "property", "formLabel": "Street address"},
    {"id": "seller_name",          "label": "Seller name (addendum)",      "page": 1,  "sampleValue": "Robert Johnson",                "formSection": "parties",  "formLabel": "Seller name(s)"},
    {"id": "date_prepared_p4",     "label": "Date prepared (RPA p1)",      "page": 4,  "sampleValue": "04/01/2026",                    "formSection": "hidden",   "formLabel": "Date"},
    {"id": "property_address_p4",  "label": "Property address (RPA p1)",   "page": 4,  "sampleValue": "1234 Maple Ave",                "formSection": "property", "formLabel": "Street address"},
    {"id": "property_city",        "label": "City",                        "page": 4,  "sampleValue": "Chula Vista",                   "formSection": "property", "formLabel": "City"},
    {"id": "property_zip",         "label": "ZIP code",                    "page": 4,  "sampleValue": "91910",                         "formSection": "property", "formLabel": "ZIP"},
    {"id": "apn",                  "label": "APN",                         "page": 4,  "sampleValue": "640-030-15",                    "formSection": "property", "formLabel": "APN (optional)"},
    {"id": "seller_brokerage",     "label": "Seller brokerage firm",       "page": 4,  "sampleValue": "Pacific Coast Realty",          "formSection": "parties",  "formLabel": "Seller brokerage"},
    {"id": "seller_agent",         "label": "Seller agent",                "page": 4,  "sampleValue": "Maria Torres",                  "formSection": "parties",  "formLabel": "Seller agent"},
    {"id": "seller_agent_license", "label": "Seller agent DRE #",          "page": 4,  "sampleValue": "02198765",                      "formSection": "parties",  "formLabel": "Seller agent DRE #"},
    {"id": "offer_price",          "label": "Purchase price",              "page": 4,  "sampleValue": "$485,000",                      "formSection": "offer",    "formLabel": "Offer price"},
    {"id": "coe_days",             "label": "COE days",                    "page": 4,  "sampleValue": "21",                            "formSection": "timeline", "formLabel": "COE days"},
    {"id": "emd_amount",           "label": "Initial deposit (EMD)",       "page": 4,  "sampleValue": "$5,000",                        "formSection": "offer",    "formLabel": "Earnest money deposit"},
    {"id": "address_header",       "label": "Address header (pages 5-20)", "page": 5,  "sampleValue": "1234 Maple Ave, Chula Vista CA","formSection": "hidden",   "formLabel": "Full address"},
    {"id": "date_header",          "label": "Date header (pages 5-20)",    "page": 5,  "sampleValue": "04/01/2026",                    "formSection": "hidden",   "formLabel": "Date"},
]

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
        raw = os.environ.get("FIELD_DEFINITIONS", "")
        try:
            fields = json.loads(raw) if raw else DEFAULT_FIELDS
        except Exception:
            fields = DEFAULT_FIELDS
        self._send(200, "application/json", json.dumps(fields).encode())

    def do_POST(self):
        pin = self.headers.get("X-Admin-Pin", "")
        if ADMIN_PIN and pin != ADMIN_PIN:
            self._send(401, "application/json",
                       json.dumps({"error": "Invalid PIN"}).encode())
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            fields = json.loads(self.rfile.read(length))
        except Exception as e:
            self._send(400, "application/json",
                       json.dumps({"error": str(e)}).encode())
            return

        body = json.dumps({
            "ok": True,
            "message": "Copy the value below into your FIELD_DEFINITIONS env var in Vercel, then redeploy.",
            "FIELD_DEFINITIONS": json.dumps(fields),
        }).encode()
        self._send(200, "application/json", body)
