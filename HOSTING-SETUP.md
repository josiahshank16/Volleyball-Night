# Publish Volleyball Night to a permanent Firebase Hosting URL

The application is a static Vite / React site that connects directly to
Firestore. Hosting publishes the website; Firestore continues storing the
live session. GitHub Codespaces is only used for development/deployment.

**No software needs to be installed on your Mac.** All terminal steps below
run inside your existing browser-based GitHub Codespace.

## One-time setup

1. Open [Firebase Console](https://console.firebase.google.com/project/volleyball-night/hosting/sites).
   Find **Hosting**, not **App Hosting**. If Firebase shows **Get started**
   or **Create site**, finish that flow to provision a **default Hosting
   site**. Since October 15, 2026, a newly created Firebase project
   might not yet have a default Hosting site.
2. Check the Hosting dashboard for the actual default site URL. If the
   site ID equals the project ID, it will be
   `https://volleyball-night.web.app`. The actual site ID may differ,
   so **do not share that URL before verifying it exists and serves the app**.
3. Open the GitHub Codespace for `josiahshank16/Volleyball-Night`.
4. Run `git pull`, then `npm install`.
5. In the Codespaces terminal, run:

   ```bash
   npx --yes firebase-tools@latest login --no-localhost
   ```

   Follow the Google authorization link displayed by the CLI. Use the
   same Google account that owns the Firebase project. The CLI will
   print instructions to bring the authorization code back to the
   **Codespaces terminal**. **Do not put that code in GitHub source
   files, issues, or ChatGPT.**
6. From the Codespaces terminal, verify project access with:

   ```bash
   npx --yes firebase-tools@latest projects:list
   ```

   Ensure the `volleyball-night` project appears.

## Deploy

Run this from the root of the repository inside Codespaces:

```bash
npm run deploy:hosting
```

The script builds the site into `dist` and deploys **Hosting only**
to Firebase project `volleyball-night`. It does **not** publish Firestore
security rules or touch the live Firestore data.

Look for **Deploy complete!** and the **Hosting URL:** printed by the CLI.
Open that URL from your browser or phone. A successful first deployment
should show the four-mode home screen with real-time check-ins, scores,
and scheduling.

## Direct mode links after deployment

Append these to your verified Hosting URL:

- Home: `/`
- Check-in kiosk: `/?mode=kiosk`
- TV display: `/?mode=tv`
- Scorekeeper: `/?mode=scorekeeper`
- Organizer: `/?mode=organizer`

No organizer login or PIN is required in this **deliberately open design
prototype**. Everyone with the URL can read and edit the shared session
through Firestore, including player names, ratings, and game history.

## Updating the published site later

Changes pushed to GitHub do **not** automatically update Hosting.
To publish a new version, use the same Codespace:

```bash
git pull
npm run deploy:hosting
```

No need to log in again unless the Firebase CLI session expired or the
Codespace was recreated. If so, repeat the no-localhost login step.

## Troubleshooting

- **Project not found / permission denied during deploy:** verify you
  authorized the Google account that owns the Firebase project.
- **Default Hosting site does not exist:** visit the Hosting console
  and create the default site before deploying.
- **Site opens but says Firestore permission denied:** Hosting does not
  deploy rules. Copy `firestore.rules` from GitHub into Firebase
  Console → Firestore → Rules and publish separately.
- **The project URL differs from volleyball-night.web.app:** use the
  exact deployed Hosting URL displayed by the CLI.
- **App opens but shows old code:** force-refresh the browser after
  deployment. HTML uses no-cache; hashed assets use long-term caching.

## Optional automatic deployments later

Once the first deploy is working, we can add a GitHub Actions Hosting
deployment workflow. That needs a GitHub secret with appropriately scoped
Firebase deployment credentials; keep such secrets out of the repository.
