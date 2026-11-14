## Automatic Firebase Hosting deployments from GitHub

**Status:** The repository includes a build-then-deploy workflow that runs
on pushes to `main`, but the action will deliberately skip publication
until the one-time Firebase service-account secret exists in GitHub.

Your working hosted site remains online and unchanged until you complete
this setup. Failed builds never deploy.

### Enable deployment (one-time, in Codespaces)

1. Run `git pull` so you have the newest workflow.
2. If required, log in using `npx --yes firebase-tools@latest login --no-localhost`.
3. Run `npx --yes firebase-tools@latest init hosting:github`.
4. When prompted, link the repository
   `josiahshank16/Volleyball-Night` and Firebase project
   `volleyball-night`. Approve the GitHub authorization.
   The Firebase CLI can create a deploy service account and upload it
   to GitHub as an encrypted Actions secret.
5. In GitHub open **Settings → Secrets and variables → Actions** and
   confirm there is a repository secret named
   **FIREBASE_SERVICE_ACCOUNT_VOLLEYBALL_NIGHT**.
   If the CLI created a differently named secret, use that name in
   `.github/workflows/firebase-hosting.yml` instead.
6. The CLI might create additional workflow files. Because the
   repository already has a hand-written workflow, check the output of
   `git status --short` before committing anything. Avoid committing
   redundant or conflicting deployment workflows.
7. Open **GitHub → Actions → Publish Volleyball Night to Firebase Hosting**,
   choose **Run workflow**, and confirm its Deploy step completes.

After setup, changes committed to `main` automatically build and deploy
without reopening Codespaces or running `firebase deploy`.

**Never commit a service-account JSON key or paste it into chat.**
The repo stores only the reference to the encrypted secret.

For more detail, see Firebase's official
[GitHub Hosting integration](https://firebase.google.com/docs/hosting/github-integration)
and
[Firebase Hosting deployment action](https://github.com/FirebaseExtended/action-hosting-deploy).
