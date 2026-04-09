# H&A Offer Generator — Team Version

React app + 2 Python API endpoints. Your whole team accesses the same
pre-mapped RPA template. No coordinates to guess — you place fields once
visually, save them to Vercel, and everyone gets a perfect filled PDF.

## Architecture

```
Browser (React)
  ├── Loads template PDF from  GET /api/template   (Vercel Blob)
  ├── Loads coordinates from   GET /api/coordinates (Vercel env var)
  ├── Renders PDF pages with   pdfjs-dist
  ├── Fills PDF in-browser with pdf-lib
  └── Downloads filled PDF instantly

Vercel (Python serverless)
  ├── api/template.py     — proxies template PDF from Blob
  └── api/coordinates.py  — serves/receives field coordinate map
```

## First-time Vercel setup

### 1. Environment variables (Vercel dashboard → Settings → Env Vars)

| Variable            | Value                                      |
|---------------------|--------------------------------------------|
| `TEMPLATE_URL`      | Your Vercel Blob URL for the template PDF  |
| `FIELD_COORDINATES` | `{}` (empty for now, you'll fill this in)  |
| `ADMIN_PIN`         | A PIN only you know (e.g. `ha2026`)        |

### 2. Deploy

```bash
npm install
git init && git add . && git commit -m "H&A Offer Generator"
# push to GitHub → connect Vercel → auto-deploys
```

### 3. Map the fields (one-time, ~10 minutes)

1. Open your deployed app — it shows the field mapper automatically
2. For each field in the sidebar, click where that text goes on the PDF
3. Click **Save to server**, enter your `ADMIN_PIN`
4. Copy the `FIELD_COORDINATES` value shown
5. Paste it into Vercel → Settings → Environment Variables → `FIELD_COORDINATES`
6. Redeploy (Vercel dashboard → Deployments → Redeploy)

Done. Your whole team now gets the mapper-verified coordinates.

### Re-mapping a field

Click **Edit field positions** in the top nav, adjust, save again, update env var, redeploy.

## Local development

```bash
npm start
```

The app will hit `/api/...` — you'll need to run a local server or
just test against your deployed Vercel URL by setting `REACT_APP_API_URL`.
