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

These rules allow the authenticated organizer UID to access `organizerChecks/{uid}`,
`organizerBackups/latest`, `liveSessions/current`, and the separate
`publicDisplays/current`. The public TV document is readable without
sign-in **only when its `enabled` field is true**. Other reads and all
non-organizer writes remain blocked. The legacy live session remains the
source of truth while the secure public projection is introduced.

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

## Phase 2 — Separate public TV feed (first role boundary)

**Publish updated Firestore rules first**, then `git pull` in Codespaces.
The current organizer-only live cloud session remains intact.

1. Open **Organizer → Settings → Live cloud session** and confirm **Connected**.
2. In **Public TV display**, check **Enable public TV feed** and accept
   the confirmation explaining that participants' names become public.
3. After the cloud status returns to **Connected**, click
   **Open public TV display**, or visit `?publicTv=1` on your running
   Volleyball Night preview URL. Unlike the organizer view, this route
   uses ONLY the read-only `publicDisplays/current` Firestore document.
4. Open the public TV link in a different browser where you are **not**
   signed into Firebase; confirm it receives team and score updates.
5. Uncheck the publication checkbox to revoke public Firestore reads.
   Wait for the cloud save to complete before closing the organizer tab.

**Public TV feed includes only:** date, confirmed team names, players'
display names, SUB counts, game pairing indices, scores, score target,
and game progress. It excludes unconfirmed teams, check-in attendance,
player IDs, skill rankings, height, gender, organizer settings and
historical team data.

**Important:** The TV feed publishes player names to anyone who can
retrieve the public document while enabled. Do not turn it on without
permission to display those names. Public display doesn't require an
organizer login, but kiosk and scorekeeper **still do** at this phase.

The original private `liveSessions/current` Firestore document is
still authoritative. This is an incremental migration, not a completed
split of player records or a completed kiosk/scorekeeper role system.
For new work, establish authenticated device-specific permissions and
separate editable documents; do not give kiosk or scorekeeper access
to the private live document.
