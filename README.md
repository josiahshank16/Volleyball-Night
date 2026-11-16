# Volleyball Night

Indoor 6v6 volleyball check-in, team building, scheduling, live scoreboard, and TV display. Built with React + TypeScript + Vite + Cloud Firestore.

## Open the hub and group apps

The central `volleyball-night.web.app` site is the launchpad for creating and finding independent groups. Each group's own `.web.app` site has four modes: check-in kiosk, TV display, scorekeeper, and organizer. Those modes synchronize against that group's own Firestore session. Old central group links show a handoff to the independent site.

An open group's six-digit PIN prompts on Organizer, Scorekeeper, and Switch mode buttons. Direct mode URLs and the group database remain open; the PIN is a convenience prompt, not data protection. Check-in and TV remain open. Already protected groups retain their existing Firebase Authentication path.

The hub owner area verifies a Google account through Google's userinfo API and compares its verified email with `VITE_HUB_OWNER_EMAIL`. Configure this exact email in the GitHub Actions repository variable before enabling the owner area. It contains a read-only summary and backup download for the original project; the original project no longer runs gameplay on the central site. This is a client-side hub gate: it does not secure an open Firestore database. The public Create and Find flows remain available to group owners using their own Google accounts.

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

Team balance is heuristic. The PIN prompts are not access control for the group database.

## Edit teams by dragging

In **Organizer → Team builder**, use the grip beside a player's name to drag that player into another team's card. A highlighted border shows the destination. A team can hold up to eight players. This works with mouse, touch and keyboard. The tap-to-swap and team dropdown controls remain available. **Confirm teams again** after changes to save the final lineup and history.

## Dependency audit

See [DEPENDENCY-AUDIT.md](DEPENDENCY-AUDIT.md) for the current npm audit findings and why we haven't applied an unsafe forced Firebase downgrade.

## Connect independent Firebase groups

Groups can use **Create a group** from the hub or visit `/?mode=setup`. After one Google authorization, Volleyball Night requests a separate Google Cloud project, activates Firebase, creates Firestore, publishes its open group rules, initializes the first session, and installs the app into that group's Firebase Hosting. The wizard reaches 100% and shares the group's own URL only after the Hosting release succeeds. It then links directly to that site to set the group PIN. Interrupted setup saves the project ID and verified database connection locally for safe retry. If Hosting fails, the same group can retry installation without creating another project.

**Find my groups** checks each accessible group's default Hosting site and live release. It opens the independent URL when published. Updates to the central app do not automatically update installed group sites; group owners can publish the current version from Find my groups. Legacy central group links show a handoff page instead of running gameplay on the hub.

The manual **Bring your own Firebase** wizard remains at `/?mode=manual-setup` for advanced use. See [GOOGLE-OAUTH-EXPERIMENT.md](GOOGLE-OAUTH-EXPERIMENT.md) for guided setup and testing.


## One-step Google setup (preview)

The group onboarding screen asks for a **group name**, a **project authorization acknowledgment**, and **Continue with Google**. The app creates the project, provisions Firebase, and publishes the group website in one continuous flow, preserving the project ID before making network requests. If a new Google account must accept official Firebase terms, the wizard opens the official Google terms page and resumes afterward. Google access tokens are kept in memory only.

Our Google OAuth client must be configured once by the application developer. Project creation and Firebase provisioning are tested, but this streamlined UX hasn't yet been validated with a brand-new Google account.
