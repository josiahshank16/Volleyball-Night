# Volleyball Night: open design preview

This is a **deliberately open prototype**, not a production permission setup.
Anybody with the site address can access and change the current cloud session,
including player names, ratings, teams, scores and history. No sign-in,
registration, or PIN is required.

## One URL / four modes

The application URL with no query parameters opens a mode selector.
- **Check-in kiosk**: `?mode=kiosk`
- **TV display**: `?mode=tv`
- **Scorekeeper**: `?mode=scorekeeper`
- **Organizer**: `?mode=organizer`

Use **Switch mode** to return to the selector. All four modes use the
existing `liveSessions/current` Firestore document. Nothing is migrated
or discarded.

## Activate the open design prototype

1. In GitHub Codespaces, run `git pull` and refresh Vite.
2. Open `firestore.rules` from the repository, copy everything, and
   paste it into Firebase Console → Firestore → Rules → **Publish**.
   The open rules permit any viewer to read and modify the current
   session. They continue to deny listing and deleting the session.
3. Load the app URL without query parameters. Select a mode.
4. All modes connect automatically to the existing Firebase session.
   No authentication is requested.
5. If the connection fails immediately after publishing rules, wait a
   moment and click **Retry connection** in Organizer → Settings.
6. If no cloud session exists, open Organizer → Settings and select
   **Create first cloud session**. Existing cloud data will not be
   overwritten by this action.
7. Test on two separate devices, and download a JSON backup from Settings.

**Hosting** is not deployed by this commit. Until Firebase Hosting is
configured, the URL remains the forwarded GitHub Codespaces preview URL.

## Future leader PIN

A four-digit PIN will be added later as a **convenience gate for mode
switching**. A client-side PIN alone is not a Firestore security
boundary, and would not prevent a technically knowledgeable visitor
from editing cloud data while the open rules remain deployed.

## Legacy

The previous organizer login, device pairing and optional public-TV
publishing setup are no longer required for this open preview.
The legacy Firebase Authentication accounts and devices documents are
not removed from your Firebase project. Old URLs using `?publicTv=1`,
`?display=1`, or `?scorekeeper=1` remain compatible.
