# Google OAuth group provisioning experiment

This is a **proof of concept**, not a finished public onboarding service. Existing
Volleyball Night players, sessions, and Hosting remain unchanged.

## Goal

Test whether an individual organizer can sign in with Google and authorize
our browser-hosted app to create their own Google Cloud project via
Google Cloud Resource Manager. If it works, subsequent steps will add Firebase,
create the Firestore database, install rules, register the web app, and set up
the initial session.

### One-time developer configuration (only for our application)

1. Open [Google Auth Platform → Clients](https://console.cloud.google.com/auth/clients?project=volleyball-night).
2. Select **volleyball-night** (the project hosting the app).
3. If prompted, configure Google Auth Platform Branding and Audience.
   Choose **External**, **Testing** and add your own Google account to
   **Test users**. Add the Google Cloud scope
   `https://www.googleapis.com/auth/cloud-platform` if requested by Data Access.
4. Create a **Web application** OAuth Client. In **Authorized JavaScript origins**,
   add the live website origin, usually `https://volleyball-night.web.app`.
   If you open the app at `https://volleyball-night.firebaseapp.com`,
   add that origin separately. Origins contain no path, trailing slash,
   or URL query.
5. Copy the **Web Client ID** (ending in `.apps.googleusercontent.com`).
   This is a public identifier. Do **not** use or share a client secret.
6. Enable **Cloud Resource Manager API** in our `volleyball-night`
   project if it is not enabled. The API is called through our OAuth client.
   Google may require the associated APIs to be enabled on the quota
   consumer project.

### Test the new UI

After building and manually deploying the latest commit, open
`https://volleyball-night.web.app/?mode=setup`.

1. Enter a new group name such as **Volleyball OAuth Test**.
2. Check the authorization acknowledgment.
3. Expand **Show one-time developer configuration** and paste the Web
   Client ID. This is saved only in your browser during the experiment.
4. Press **Continue with Google**. Choose your account and grant the
   requested permissions. Google's consent screen is authoritative.
5. The app calls `GET https://cloudresourcemanager.googleapis.com/v3/projects/992829373528`
   with the short-lived OAuth token to confirm it can call Cloud Resource
   Manager from the browser.
6. If successful, you get an optional **Create a separate test Cloud project**
   button. It explicitly confirms before sending
   `POST https://cloudresourcemanager.googleapis.com/v3/projects`.
   A randomly generated project ID prevents conflicts. The app tracks
   the long-running Google operation and displays the created project ID.
7. If anything fails, **stop and share the error message**. Don't keep
   clicking the create button if a project might already have been created.

**Caution:** The test project is a real Google Cloud resource owned by your
Google account, although the experiment does not enable billing or
Firestore. Project creation may be subject to quotas and organization
policies. This test does not delete projects automatically.

### Important limits

- It does **not yet** add Firebase, a Firestore database, Firestore rules,
  or a Volleyball Night player session. This tests the first provisioning
  steps before building the rest.
- It requests a broad **Google Cloud Platform OAuth scope**. The access
  token stays in React component memory and is not written to localStorage
  or GitHub. The browser saves only the **public OAuth Client ID**.
- Google's OAuth testing and verification rules apply, including
  authorized origins and test-user restrictions.
- Google's Firebase Terms require direct user acceptance through the
  Firebase Console when applicable; checkboxes on our site do not
  replace acceptance.
- The app uses the Google's official JavaScript Identity Services token
  client; we don't impersonate Google sign-in.
- If Google Cloud restricts browser API calls, we may have to adjust our
  architecture; the test will show that clearly.

### Reference docs

- [Google Identity Services JavaScript](https://developers.google.com/identity/oauth2/web/guides/load-3p-authorization-library)
- [Cloud Resource Manager project creation](https://docs.cloud.google.com/resource-manager/reference/rest/v3/projects/create)
- [Firebase project setup via REST](https://firebase.google.com/docs/projects/api/workflow_set-up-and-manage-project)
