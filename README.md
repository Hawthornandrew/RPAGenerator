# H&A Offer Generator

React app for generating filled California RPA PDFs. Your team accesses one shared URL — field positions are mapped once by an admin, then everyone can generate offer PDFs instantly in the browser.

---

## How it works

1. **Admin maps fields once** — upload the RPA template, click to place each field on the PDF
2. **Positions saved to Vercel** — stored as a `FIELD_COORDINATES` env var, shared across the whole team
3. **Team fills offers** — 4-step form, click "Generate & download RPA PDF", done
4. **PDF filled in the browser** — `pdf-lib` stamps text at your mapped coordinates, no server round-trip

---

## Project structure

```
rpa-mapper-v2/
├── api/
│   ├── coordinates.py   GET/POST field coordinate map
│   ├── fields.py        GET/POST field definitions
│   └── template.py      GET proxies template PDF from Vercel Blob
├── src/
│   ├── App.js           Root — loading, mapper, and generator modes
│   ├── FieldMapper.jsx  Visual click-to-place field mapper (admin only)
│   ├── FieldManager.jsx Add/edit/delete fields without touching code
│   ├── OfferGenerator.jsx  4-step offer form + PDF download
│   ├── api.js           Fetch/save helpers for all 3 endpoints
│   ├── fields.js        HEADER_PAGES constant only
│   └── pdfUtils.js      pdf-lib fill + pdfjs render helpers
├── public/index.html
├── package.json
├── vercel.json
└── README.md
```

---

## First-time Vercel setup

### 1. Set environment variables

In Vercel dashboard → your project → **Settings → Environment Variables**:

| Variable             | Value                                             |
|----------------------|---------------------------------------------------|
| `TEMPLATE_URL`       | Vercel Blob URL for `_Merged__RPA_Template.pdf`   |
| `FIELD_COORDINATES`  | `{}`                                              |
| `FIELD_DEFINITIONS`  | _(leave blank — defaults load from api/fields.py)_|
| `ADMIN_PIN`          | A PIN only you know, e.g. `ha2026`                |

### 2. Upload template to Vercel Blob

Vercel dashboard → **Storage → your Blob store → Upload** → select `_Merged__RPA_Template.pdf` → copy the URL → paste as `TEMPLATE_URL`.

### 3. Deploy

```bash
npm install
git init && git add . && git commit -m "H&A Offer Generator"
# push to GitHub → connect Vercel → auto-deploys
```

---

## Admin: mapping field positions (one-time, ~10 min)

1. Open your deployed URL — it shows the **Field Mapper** automatically on first deploy
2. Sidebar lists all 16 fields one at a time
3. Navigate to the correct page, click exactly where the text should appear
4. Repeat for all fields — positions auto-save as you go
5. Click **Save to server**, enter your `ADMIN_PIN`
6. Copy the `FIELD_COORDINATES` value shown
7. Paste into Vercel → `FIELD_COORDINATES` env var → Save → **Redeploy**

Done. Every team member now opens the URL and goes straight to the offer form.

---

## Admin: adjusting a field position

Click **Edit positions** in the top nav → click the field in the sidebar → click the new location → Save to server → update env var → redeploy.

---

## Admin: adding or editing fields

Click **Manage fields** in the top nav. You can:
- **Add a field** — label, PDF page, sample value, which form section it appears in
- **Edit** any existing field
- **Delete** a field
- **Reorder** fields with the ▲▼ arrows

After saving, copy the `FIELD_DEFINITIONS` value and paste it into Vercel → `FIELD_DEFINITIONS` env var → redeploy. New fields appear in both the mapper (for position placement) and the offer form.

---

## Local development

```bash
npm start
# Runs on http://localhost:3000
# API calls hit /api/* — point to your deployed Vercel URL or run a local proxy
```
