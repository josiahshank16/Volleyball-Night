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

See [HOSTING-SETUP.md](HOSTING-SETUP.md) for the browser-only deployment instructions and [AUTOMATIC-DEPLOY.md](AUTOMATIC-DEPLOY.md) for automatic publishing after the one-time GitHub secret setup. The repository now includes Firebase Hosting configuration and `npm run deploy:hosting`. Hosting deploys only the built site and leaves Firestore rules and session data unchanged.

## Build check

```bash
npm run build
```

The site is an early prototype. Team balance is heuristic and the organizer tools are currently not access-controlled.

## Edit teams by dragging

In **Organizer → Team builder**, use the grip beside a player's name to drag that player into another team's card. A highlighted border shows the destination. A team can hold up to eight players. This works with mouse, touch and keyboard. The tap-to-swap and team dropdown controls remain available. **Confirm teams again** after changes to save the final lineup and history.

## Dependency audit

See [DEPENDENCY-AUDIT.md](DEPENDENCY-AUDIT.md) for the current npm audit findings and why we haven't applied an unsafe forced Firebase downgrade.

## Connect independent Firebase groups

Visit **Connect another group's Firebase** on the home screen or open
`/?mode=setup`. A guided wizard accepts the group's Firebase Web app
configuration, initializes an empty Firestore session if needed, and
generates a group link to use on other devices. Each group owns its
data and Firestore usage, while sharing the same hosted UI.

See [GROUP-SETUP.md](GROUP-SETUP.md) for exact setup and testing steps.
