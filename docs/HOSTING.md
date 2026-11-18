# skycollector.app: hosting and domain (set up 2026-11-17)

Mirrors spacecollector.app, in a project of its own so nothing Sky does touches Space Collector.

- **Google project:** `sky-collector-app` (Sevaan's personal account, sevaan@gmail.com), Firebase added, billing linked
  (the account Space Collector's project uses). APIs on: Firebase Hosting, Cloud Run, Cloud Functions, Cloud Build,
  Artifact Registry, Firestore.
- **Hosting site:** `sky-collector-app` → https://sky-collector-app.web.app, custom domains `skycollector.app` and
  `www.skycollector.app` (redirects to the bare domain).
- **DNS at Namecheap** (Advanced DNS; nameservers stay Namecheap's):
  - `A @ 199.36.158.100`, `TXT @ hosting-site=sky-collector-app`, `CNAME www sky-collector-app.web.app`
  - Removed: the parking `CNAME www parkingpage.namecheap.com` and the `URL Redirect @`.
  - Mail settings left on Email Forwarding (MX and SPF unchanged).
- **The page:** a coming-soon page built by `node scripts/build-site.mjs` into `site/public` (the hero, the Flight Plan
  back that flips to a Legendary card made from the game's own card code, /privacy). Deploy: `python3 -I
  scripts/deploy-site.py` (Hosting REST API with the personal gcloud login; never the firebase CLI, which is a work
  account on this Mac). `scripts/fb.py` is a small helper for other Firebase REST calls.
- **Icons:** the app icon (icons/icon.svg, exported by `node scripts/export-icons.mjs`) is copied in by build-site.mjs:
  /favicon.ico (16, 32, 48), /favicon-32.png, /apple-touch-icon.png (180), /icon-512.png (the share preview, og:image)
  and /icon.svg. The hero shows the same icon.

## Not set up yet: Sky's server

The project is ready for a Cloud Run service `api` like Space Collector's (functions/index.js is the reference). It
needs, first: an adsb.lol key (docs/DATA-TERMS.md: feeder or sponsor; 500 requests a day without one), and Sevaan's
go-ahead to deploy. Then add the `/api/**` rewrite in scripts/deploy-site.py and set `DEPLOYED` in js/server.js.
