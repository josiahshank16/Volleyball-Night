# One-flow Google group onboarding — current preview

The application uses one shared static Hosting site for the interface.
Each volleyball group owns a separate Google Cloud/Firebase project, a
Firestore database, and its own usage/quota. Participating groups do
not need GitHub accounts or independent Hosting sites.

## Expected user experience

1. Open the Volleyball Night home screen and choose **Create a group with Google**.
2. Enter the group name. The default Firestore location is **Iowa, US
   (us-central1)**; it may be changed **before** any provisioning starts.
   Firestore's location is permanent once the database is created.
3. Read and check the authorization statement. This acknowledges that
   Google Cloud resources will be created in the user's account.
4. Click **Continue with Google**, select a Google account, and approve
   Google's own OAuth consent prompt.
5. The app creates a Google Cloud project, adds Firebase, enables needed
   APIs, creates Firestore, publishes open prototype rules, registers
   the web app, and initializes an empty live session.
6. On success, click **Open my Volleyball Night** or copy the group link.

All provisioning operations run from the user's browser against
Google's APIs using a temporary access token. The token is **not saved**.

## A first-ever Firebase user

Google requires each Google account to accept the official Firebase
Terms of Service once. Our checkbox **does not** substitute for those
terms and Google's APIs cannot accept them programmatically.

If Google blocks Firebase activation for this reason, the screen
provides the official **Firebase Terms acceptance** link:
https://console.firebase.google.com/?forceCheckTos=true

Once the user accepts the terms, they return to the same Volleyball
Night setup screen and click **Continue setup with Google**. No
second project should be created.

A Google API 403 can also mean missing IAM permissions or another
Google API problem; the screen provides the detailed technical error.
Do not automatically assume every 403 is only a terms issue.

## Resume after errors, reloads, or expired OAuth tokens

The application saves a **non-sensitive checkpoint** in the browser
before submitting the Cloud project creation request. It includes the
project ID, group name, region, and setup stage, but **never** stores
Google bearer tokens, client secrets, or passwords.

On retry, Volleyball Night checks the existing project ID first.
- If the project exists, it resumes Firebase provisioning.
- If creation was interrupted, it checks and retries **the same ID**.
- If Firebase, Firestore, rules, or web app were already provisioned,
  the setup code attempts to reuse those existing resources.
- After success, the browser remembers the public group config and
  its share link for reopening.

Google's browser OAuth token model requires a user gesture to obtain
another access token once the first expires; the Resume/Continue
button asks Google to re-authorize when necessary.

The previous experimental saved project ID is migrated automatically,
so existing test projects are reused.

**Important:** Browser storage is not a cross-device account recovery
database. If a user changes devices midway through setup, they must
open **Developer tools and recovery**, locate their existing project
ID in Google Cloud Console, and select **Resume this project**. Do
not use **Set up a different group** to troubleshoot an incomplete
setup; it clears the local checkpoint but leaves any existing Google
Cloud project intact.

## Developer configuration (one-time only)

The original Volleyball Night OAuth Web Client ID remains required
for Google Identity Services. On an existing development browser it
is remembered locally from prior tests. To make the button work for
new browsers automatically, create a GitHub **Actions repository variable**
(not a secret) named `VITE_GOOGLE_OAUTH_CLIENT_ID` with the public
Web OAuth Client ID. The automatic Hosting deployment workflow will
include that variable when it builds the site. This is a **one-time
developer configuration**, not something participating groups must do.

For a manual deployment from Codespaces, add that same public value to a
local untracked `.env.local` file as
`VITE_GOOGLE_OAUTH_CLIENT_ID=YOUR_PUBLIC_WEB_CLIENT_ID` before running
`npm run deploy:hosting`. Do not commit `.env.local` or any OAuth
client secret. A local public Client ID cached from previous testing
can also be entered through Developer tools, but that cache applies
only to the current browser.

Create the OAuth client in Google Auth Platform with the live site's
authorized JavaScript origin (for example
`https://volleyball-night.web.app`). Enable testing access for
approved Google accounts until the app is verified for broader use.

The app is still a deliberately open prototype. Anyone with a
group's link can change that group's data. OAuth in this onboarding
flow grants project creation rights; it does NOT authenticate or
restrict kiosk, scorekeeper, TV, or organizer access.

## Repeatable tests without new Google accounts

Existing Google testers can create additional test projects (within
Google's project quota), or open a completed group again to test its
share link and synchronization. Use **Set up a different group** only
when intentionally creating another real Google Cloud project.

Google's Firebase Terms acceptance is account-wide and cannot be
reset to recreate the first-time consent experience. Reserve unused
Google accounts for the final first-time onboarding test.

## References

- Google Identity Services:
  https://developers.google.com/identity/oauth2/web/guides/use-token-model
- Google Cloud project create API:
  https://docs.cloud.google.com/resource-manager/reference/rest/v3/projects/create
- Firebase project REST provisioning:
  https://firebase.google.com/docs/projects/api/workflow_set-up-and-manage-project
- Firebase Terms:
  https://firebase.google.com/docs/projects/use-firebase-with-existing-cloud-project

## Cloud propagation and automatic retries

New Google Cloud projects, Service Usage APIs, Firebase Rules releases,
and Firestore browser access don't always become available instantly.

- During provisioning, transient Google API **403** replies are retried
  for up to **two minutes per affected step**. Explicit terms-acceptance
  or billing requirements are not silently retried.
- The browser checks actual Firestore **server reads** and session
  creation for up to **three minutes** after publishing rules. A visible
  progress message explains that activation may take a few minutes.
- A resumed setup first checks whether the exact intended rules are
  **already published**. It does not publish new identical rulesets
  unnecessarily, so retrying won't restart the rules rollout.
- If the limit is reached, the group project ID remains saved.
  The error suggests waiting another minute or two and choosing
  **Continue setup with Google** on the same project. Persistent IAM
  or rules errors still need troubleshooting; the app never assumes
  every 403 is temporary.

Firebase notes that new rules can take up to one minute to affect
new client reads, and longer for active listeners:
https://firebase.google.com/docs/firestore/security/get-started
