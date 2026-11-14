# Volleyball Night

Indoor 6v6 volleyball check-in, team building, scheduling, live scoreboard, and TV display. Built with React + TypeScript + Vite + Cloud Firestore.

## Open the app

The app has four modes available at a single URL: check-in kiosk, TV display, scorekeeper, and organizer. The site defaults to the mode-selection home screen. All modes synchronize against the current Firestore session.

**This is an open design prototype:** Anyone with the app URL can read and edit shared volleyball night data. There is no sign-in or leader PIN yet.

## Run in GitHub Codespaces

1. Open the repository in GitHub → Code → Codespaces.
2. In the terminal, run `npm install` and `npm run dev`.
3. Open forwarded port **5173** for the preview.
4. Use **Switch mode** to move between the four modes.

## Publish to Firebase Hosting

See [HOSTING-SETUP.md](HOSTING-SETUP.md) for the browser-only deployment instructions. The repository now includes Firebase Hosting configuration and `npm run deploy:hosting`. Hosting deploys only the built site and leaves Firestore rules and session data unchanged.

## Build check

```bash
npm run build
```

The site is an early prototype. Team balance is heuristic and the organizer tools are currently not access-controlled.
