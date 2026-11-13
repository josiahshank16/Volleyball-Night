# Firebase: first organizer and protected Firestore test

**Firebase project:** `volleyball-night`

The organizer account you registered in Firebase Authentication is allowlisted
by UID in `firestore.rules`. Your client SDK is configured in `src/firebase.ts`.
This UID is a public account identifier, **not a secret**.

## Required: publish the repository rules to Firebase

Adding `firestore.rules` to GitHub does **not** automatically deploy it.
Complete these steps in your browser:

1. Open https://console.firebase.google.com/project/volleyball-night/firestore/rules
2. Confirm that the Firestore Standard `(default)` database exists.
3. Open the `firestore.rules` file in the root of this GitHub repository.
4. Copy **its entire contents** into the Firebase Rules editor, replacing the old rules.
5. Click **Publish**. Do not choose Test mode and do not allow all reads or writes.
6. Return to Codespaces, run `git pull`, and refresh the app.
7. In **Organizer → Settings → Firebase connection**, sign in and click **Test Firestore read/write**.
8. A success message means both the real write and the read were permitted.

Rules only permit the configured organizer UID to write a small connectivity
test at `organizerChecks/{uid}` and read/write `organizerBackups/latest`.
Everything else is denied, including public access and all other users.

## Safely test a cloud backup

After the read/write test succeeds, choose **Upload local data backup**.
The app checks whether a backup already exists, asks for confirmation, and
downloads an additional JSON copy before uploading. A separate **Restore cloud
backup here** button can replace local browser state **only on explicit
confirmation**. It downloads a backup of the existing browser data first.

**This is not multi-device realtime synchronization.** The app still runs from
localStorage during ordinary use. No kiosk or TV account is authorized to read
profiles. Next we will split public display data from private profiles, add
limited kiosk roles and safely migrate to granular Firestore documents.

## Important security cautions

- Keep Firebase user passwords and service account files out of the repository.
- The app's Firebase Web SDK config isn't a service account.
- Avoid public rules for player profiles or for backups.
- The organizer UI itself isn't auth-gated yet: do not publish it for real use.
- Only publish the complete reviewed `firestore.rules` file to the intended
  Firebase project.
