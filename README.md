# 2027

Your 2027 plan as an iPhone app: Week, Month and Year.

## Put it online (about 10 minutes, no terminal)

1. **GitHub.** Create a new private repository called `plan-2027`. Click "uploading an existing file" and drag in everything from this folder, including the `netlify` folder. Commit.
2. **Netlify.** Add new site, then Import an existing project, then GitHub, then `plan-2027`. Leave the build command and publish directory empty. Deploy.
3. **Your sync key.** In Netlify, go to Site configuration, then Environment variables, and add `SYNC_KEY` with a long phrase only you know. Then go to Deploys and click Trigger deploy.
4. **Your iPhone.** Open the site in Safari, tap Share, then Add to Home Screen. Open 2027 from your home screen, go to Year, then More, paste your key and tap Save. The status changes to Synced.
5. **Your laptop.** Open the same address and paste the key once.
6. **Let Claude see your progress.** On GitHub, go to Settings, then Developer settings, then Personal access tokens, then Fine-grained tokens, then Generate new token. Name it `2027 plan` and pick the longest expiry. Under Repository access choose Only select repositories, then `plan-2027`. Under Permissions, set Contents to Read and write. Generate it and copy it. In Netlify's Environment variables, add `GITHUB_TOKEN` (the token) and `GITHUB_REPO` (`yourusername/plan-2027`), then Trigger deploy. Within the hour a `progress` branch appears in your repo with `progress.json` in it.

## Good to know

- Everything saves on your phone straight away, even offline. The key backs it up and keeps your phone and laptop in step.
- The server also keeps one snapshot per day, and Export backup in Year, then More, downloads a copy any time.
- To update the app, replace `index.html` in GitHub. Netlify redeploys and the app picks it up next time you open it.
- Don't add a `netlify.toml`. This app doesn't need one.
- The GitHub token can only touch this one repo, and it lives in Netlify, never in the app. If it expires, the app keeps working and only the copy for Claude pauses until you make a new one.

## What's in here

- `index.html`: the app
- `netlify/functions/plan.mjs`: saves and loads your plan, protected by `SYNC_KEY`
- `netlify/functions/mirror.mjs`: every hour, copies your progress to the `progress` branch for Claude to read. It only commits when something changed, never triggers a rebuild, and stays off until step 6 is done
- `sw.js`, `manifest.webmanifest`, icons: home screen install and offline use
- `package.json`: lets Netlify install its storage library
- `_headers`: makes sure updates arrive
