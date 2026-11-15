# Connect Your Firebase: group-owned databases (preview)

This is the **first-stage manual project connection wizard**, not
automatic Google Cloud/Firebase project provisioning.

## Goal

One copy of the Volleyball Night website continues to be hosted at the
current Firebase Hosting URL. Each participating group uses its **own**
Firebase project and its own Firestore database. Groups do **not** need
GitHub accounts, independent code deployments, or their own Hosting site.

## What the new setup page does

Open the hosted app and choose **Connect another group's Firebase**, or
visit `/?mode=setup`.

1. Create a project in [Firebase Console](https://console.firebase.google.com/).
2. Create its `(default)` Firestore Standard-edition database.
3. In the new project's Firestore Rules tab, publish the minimal open
   prototype rules displayed by the wizard.
4. Register a **Web app** under Firebase Project settings → Your apps.
   Choose the **Config** snippet and paste the `firebaseConfig` object
   into Volleyball Night's wizard. Firebase Hosting does **not** need to
   be enabled in the group's project.
5. Enter a group name and click **Test connection and initialize if
   needed**. If `liveSessions/current` does not exist, the wizard
   creates a fresh, empty Volleyball Night session in THAT group.
   If the document already exists, it is preserved.
6. Click **Open this group's Volleyball Night**. The browser stores the
   selected group configuration locally. Other volunteers open the
   generated **Copy group link** URL.

Use **Switch mode** to move between kiosk, TV, scorekeeper and organizer.
Group identity is preserved in the URL. The share link contains a
base64url-encoded JSON object with the group's name and **public Firebase
Web app configuration**. It does **not** contain Firebase service
accounts, private keys, OAuth credentials, or passwords.

For a new phone or other browser, the shared link selects the correct
project immediately, even without any local browser settings.

## Original group is preserved

If no group has been configured, the existing
`volleyball-night` Firebase project remains the default. The
Original Volleyball Night local cache still uses
`volleyball-night-v01`. Each additional project uses its own
per-project local cache to prevent one group's data from appearing as
another's.

In the setup page, use **Switch back to original Volleyball Night** to
return to that database. This changes only the local browser's active
project; it does not delete or migrate any cloud data.

## Development scope and tradeoffs

- **Project creation is not automated yet.** Google's account/project
  creation permissions and OAuth onboarding are a separate next stage.
- **This preview is deliberately open.** Anyone with the group link
  can read and modify that group's Firestore session.
- **Group links are long.** They're self-contained, so no shared central
  group directory or hosting backend is required. A short, branded
  group-code or setup link would require some shared directory/storage
  or a group-specific redirect service.
- Different groups' Firestore data and quota/charges belong to their
  separate Firebase projects.
- Our Firebase Hosting project still serves the shared website assets.
- Automatic publication of code updates is a separate GitHub Actions
  integration and needs the Hosting deployment secret to be configured.
- New projects must allow requests from the hosted website; their
  Firebase API keys might require adjusting API restrictions if those
  are enabled.
- Exporting each group's player records is still available through the
  organizer JSON backup.

## A straightforward test

Create **one second test Firebase project**, complete the wizard, and
confirm it starts with zero players. Add a test player, then open the
generated group link on a phone. Confirm both devices synchronize.
Switch back to Original Volleyball Night; its existing players should
be unchanged.

The single copy of the front-end is now ready for this two-project
test. We can then consider automating project creation and onboarding.
