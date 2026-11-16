# Group access models

## Default: shared group PIN for mode buttons

New independent groups use a six-digit PIN saved as a SHA-256 reference in the
existing open `liveSessions/current` group state. The setup wizard links to
the PIN page after group initialization. The current PIN is required to change
it. Check-in and TV buttons are open; Organizer, Scorekeeper, and Switch mode
buttons ask for the PIN. Direct mode URLs, including `?mode=organizer` and
`?mode=scorekeeper`, are reachable without it. The PIN page itself can also be
reached directly; the first PIN can be set by anyone who gets there first.

This is a convenience prompt, not access control. Anyone who can reach the
group's Firestore project can read and replace the group data, and the PIN
reference is in that readable data. Publicly editable data includes roster
details, attendance, teams, scores, and history. Do not use this model for
sensitive player information or a group that requires protected records.

## Optional protected group migration (existing implementation)

The current group app is an open prototype: `liveSessions/current` holds the
entire app state as a JSON string, and its Firestore rules allow anyone with
the group URL to read and replace that string. A PIN in React cannot secure
that document. The separate Firebase Authentication model below requires a
rules migration and a one-time Authentication enablement; new groups do not
need it for the convenience prompt above.

## Intended roles

| Role | Entry | Access |
| --- | --- | --- |
| Group owner | Google OAuth account bound when the group is created, with IAM permissions on that group's Firebase project | Initial PIN, lost-PIN recovery, access settings, group website updates |
| Leader | Six-digit group PIN checked by Firebase Authentication | Organizer and scorekeeper; current PIN can authorize a change to a new PIN |
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
  rotation cutoff. Client reads denied. The Google project owner creates and
  recovers this through Google's administrative APIs with a short-lived OAuth
  token. A freshly PIN-authenticated leader may update only the cutoff to a
  Firestore server timestamp while changing the Firebase Auth password.

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
5. Rotate the PIN by signing in with the current PIN, setting the server
   timestamp cutoff, and updating the Firebase password. Previous sessions
   fail the rules check. The Google owner can recover a forgotten PIN. Never
   store the PIN in Firestore or the app bundle.

Existing independent groups continue using their current rules until their
owner explicitly runs migration. Updating Hosting files alone must not claim
that the database has become protected.
