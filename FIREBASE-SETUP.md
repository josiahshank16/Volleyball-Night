# Firebase live-session setup (organizer-only preview)

Project: `volleyball-night`

## Deploy updated rules (required)

GitHub changes do **not** deploy Firestore rules automatically.

1. Open Firebase Console and select **Volleyball Night**.
2. Open the three-line navigation menu (top-left).
3. Under **Databases & Storage**, choose **Firestore**.
4. Click the **Rules** tab next to **Data**.
5. In GitHub, open the root-level `firestore.rules` file.
6. Copy the entire file and replace the contents of Firebase's Rules editor.
7. Click **Publish** and verify Firebase reports success.

These rules allow the authenticated organizer UID to read/write only
`organizerChecks/{uid}`, `organizerBackups/latest`, and
`liveSessions/current`. They **do not** permit public reads, anonymous
writes, or unrestricted users. The new live session is in **one document**
for testing, not the final data model.

## Activate protected synchronization

1. In Codespaces: `git pull` and `npm install` (if necessary).
2. Open the Volleyball Night preview; go to the corner menu → **Organizer preview** → **Settings**.
3. In **Firebase connection**, sign in as the authorized organizer.
4. Click **Test Firestore read/write**. If permission denied, check that
   the *new* GitHub `firestore.rules` was published.
5. Download your JSON backup in Settings (recommended).
6. In **Live cloud session**, choose:
   - **Create cloud session from this browser** if this is the browser
     containing your authoritative data and no live session exists yet.
   - **Join existing cloud session** if someone already created the live session.
7. Confirm the action. The app downloads a JSON backup before replacing
   local state or creating a new live session.
8. Test editing a player or the scoreboard in another browser/device
   **signed in with the same authorized organizer account**. The app
   subscribes to the protected Firestore document.

**Do not enter real data on a public kiosk yet.** Only organizers have
Firestore permission. The unprotected Organizer preview switch in the
UI is for development and does not grant Firestore access.

## Safeguards and known limitations

- Local browser data is never silently uploaded on first login.
- Creating a cloud session refuses to overwrite an existing cloud document.
- Joining a cloud session explicitly confirms the browser replacement,
  and downloads a local JSON copy first.
- In cloud mode, changes are committed using Firestore transactions.
- Each client has a serialized transaction queue to keep rapid score taps
  in order. There is still a transient optimistic UI while writes complete.
- If a cloud write fails, the interface displays a connection error and
  retains the browser copy; verify connectivity before continuing.
- Firestore has a **1 MiB maximum document size**. This single-document
  prototype must be split into separate collections before real use.
- The organizer dashboard, kiosk, and TV are **not yet publicly deployable**.
  Kiosk and TV roles, restricted profile access, and secure hosting are next.
- The existing **Upload local data backup** and **Restore cloud backup here**
  controls are separate from the live session. Disconnect live mode before
  restoring a backup.

## Next milestone

Split profiles and sessions into granular Firestore records; add scoped
kiosk, scorekeeper and public display permissions; remove organizer-preview
access from public users; and deploy to Firebase Hosting.
