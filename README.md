# Ritual — Weekly Life Tracker

## Local dev

```bash
npm install
npm run dev
```

## Deploy to Netlify

1. Push this folder to a GitHub repo
2. Go to netlify.com → Add new site → Import from GitHub
3. Build settings are pre-configured in `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Deploy

## Up Bank

The spending habit connects to Up Bank via a Netlify serverless function (no CORS issues).

To connect: open the Up app → Settings → scroll to API → create a personal token → paste it into the app's Settings (⚙️).
