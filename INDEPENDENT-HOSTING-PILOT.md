# Independent Firebase Hosting installer (pilot)

This is an **opt-in test**, not an automatic change to group creation.

## Goal

A completed group can deploy a static copy of the Volleyball Night app into
its **own** Firebase project. Its visitors then load HTML, JS and CSS from
that project's `<site-id>.web.app` hostname, and Firestore reads and writes
go directly to that same group's project. The original
`volleyball-night.web.app` stays available as a test fallback.

## How it is wired

1. `npm run build` generates `dist/group-install-manifest.json`, listing
   the published Vite HTML, JS, CSS and any other static assets.
2. From a completed group's setup screen, click **Install website to this group**.
   The project owner authorizes Google using the existing OAuth test client;
   the access token stays only in browser memory.
3. `hostingInstaller.ts` downloads exactly the published assets, injects the
   group's **public** Firebase web configuration into `index.html`, gzips each
   file and calculates SHA256 hashes of the compressed bytes.
4. Owner-authorized API requests enable Firebase Hosting, create/find the
   project's default Hosting site, create a version, populate its files,
   upload required hashes, finalize and create the live release.
5. `groupConnection.ts` detects the embedded configuration and uses that
   project's Firebase database. The site never falls back to the original
   Volleyball Night database if the embedded configuration is malformed.
6. Only after Firebase confirms publication does the original setup page store
   and display the independent website URL. It is not saved as a share link
   if the installer fails.

## Test procedure

- Start with a test group created in the Google account that owns its
  Firebase project. Return to the completed group setup screen.
- Click **Install website to this group**, authorize the same Google account,
  and observe the real Hosting API operations.
- Open the new `https://<site-id>.web.app` URL. Verify that the group name
  and project ID are correct in the home screen and organizer settings.
- From two different devices on that hostname, test check-in, scores and
  TV updates. Confirm that both devices remain synchronized.
- In browser dev tools, confirm the HTML and JavaScript assets load from
  the **group** hostname and Firestore requests target the group's project,
  not the original project.
- Disconnect access to the main hub *after opening* a group website and
  verify its normal operation.
- If a browser rejects the file upload due to CORS, capture the console
  failure; the installer intentionally reports the error without destroying
  the preexisting shared-link app. We may need a different upload transport.

## Next steps after the pilot passes

- Make independent Hosting deployment automatic for new groups.
- Add a supported update/reinstall workflow for owners.
- Move the original project to a launcher-only website, with migration
  handling for existing group links.
- Before launching publicly, replace prototype open-write Firestore rules
  with real group roles and device permissions.

## Scope and cautions

- This pilot is browser-only; no owner's service-account key is created or
  stored by Volleyball Night or GitHub.
- A published independent site is **not automatically updated** by later hub
  GitHub deploys. Owner-triggered reinstall publishes the current app.
- The initial developer OAuth client must permit the *hub* as an authorized
  JavaScript origin. The installed app's everyday Firestore features do not
  use that OAuth client.
- The group still owns the Firebase resource usage and any billing.
- The central source repository is shared, not the running Hosting service.
