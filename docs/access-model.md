# Group access migration

The current group app is an open prototype: `liveSessions/current` holds the
entire app state as a JSON string, and its Firestore rules allow anyone with
the group URL to read and replace that string. A PIN in React cannot secure
that document. Do not present the PIN UI as protection until the data and
rules migration below is finished and tested on a disposable group.

## Intended roles

| Role | Entry | Access |
| --- | --- | --- |
| Group owner | Google OAuth account bound when the group is created, with IAM permissions on that group's Firebase project | PIN creation and rotation, access settings, group website updates |
| Leader | Six-digit group PIN checked by Firebase Authentication | Organizer and scorekeeper; no Google account needed on each device |
| Player kiosk | Open | Search/check in and submit a new player profile |
| TV | Open | Published teams, schedule, and scores only |

The central site will become a public launchpad. When it is converted later, only
the designated original-project owner account may enter its private app/admin
pages. Each independent group uses its own project, owner, leader account, and
PIN. No group PIN or Google access token is embedded in the website bundle,
URL, local storage, or public Firestore document.

## Firestore separation

* `liveSessions/current`: profiles, drafts, confirmed teams, history, games,
  and organizer preferences. Only the PIN-authenticated leader account can
  read and write. Keep the existing JSON shape during migration.
* `publicPlayers/{playerId}`: ID and display name for kiosk search. Public
  read. Kiosk may create a new entry, but only a leader may edit or delete an
  existing one.
* `registrations/{playerId}`: new-player self rating and optional profile
  details. Kiosk may create one bounded entry; only a leader may read/list.
  Organizer merges new registrations into the protected session.
* `attendance/current`: checked-in player IDs. Public read and constrained
  updates. Organizer listens here for live arrivals. Attendance never
  replaces team or score documents.
* `publicDisplays/current`: an explicit projection with names, team rosters,
  schedule, and scores. Public read, leader write.
* `access/config`: bound Google owner subject, leader Firebase UID, and PIN
  rotation epoch. Client reads denied. The Google project owner creates and
  updates this through Google's administrative APIs with a short-lived OAuth
  token. Settings must compare the signed-in Google subject before an update.

An open kiosk necessarily lets a visitor check names in or out and submit a
registration. Firestore rules must limit those public writes to attendance
and new player submissions. They must never permit public writes to team,
score, history, or access settings.

## Activation order

1. Read and export the existing group state. Do not delete the original
   document during migration.
2. On a new Spark group, the owner completes Firebase Console's one-time
   Authentication setup and enables Email/Password under Sign-in method. The
   public Identity Platform initialization API requires billing for this path.
   Under owner-authorized Google OAuth, verify email/password Auth is ready,
   create the group's PIN account, and write the access configuration. Bind
   the Google account subject at setup for new groups; an IAM collaborator is not implicitly
   a Volleyball Night settings owner.
3. Seed the new public player and attendance documents from the original
   state, then publish the owner-approved group website version that supports
   both schemas. Run owner Google OAuth from the central site's authorized
   origin; independent sites redirect there with their public group config.
4. Publish restrictive Firestore rules and confirm PIN sign-in, public kiosk
   check-in, public TV read, and denied public leader writes in a test group.
   Only then mark the group protected. If activation stops, resume this same
   group rather than creating a new project.
5. Rotate the PIN by updating the Firebase password and invalidating old
   sessions in the rules; never store the PIN in Firestore or the app bundle.

Existing independent groups continue using their current rules until their
owner explicitly runs migration. Updating Hosting files alone must not claim
that the database has become protected.
