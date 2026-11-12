# Volleyball Night

A tablet-first indoor 6v6 volleyball check-in, team generation and scheduling prototype (React + TypeScript + Vite).

## Run entirely in your browser using GitHub Codespaces

1. Open this repository in GitHub.
2. Select **Code > Codespaces > Create codespace on main**.
3. The dev container automatically runs `npm install` (it may take a moment).
4. In the Codespaces terminal, run `npm run dev`.
5. Open the forwarded **5173** port to view the app. If not automatically opened, select the **Ports** tab and click the globe icon beside port 5173.
6. In the app, switch to **Organizer mode > Settings > Add 18 sample players** to explore.

Build check: `npm run build`.

## Important limitations

- This is a **local-storage prototype**. Player and team data are not saved to Firebase or synchronized between separate devices yet.
- Organizer mode is **not secure authentication**. Do not use this prototype as a public check-in kiosk or enter real sensitive player data.
- You can export JSON backups from Settings, but importing backups is not implemented yet.
- The TV display works with the same browser storage, not across remote tablets and TVs.
- SUB borrowing is manual; the schedule generator does not automatically prevent borrowed-player conflicts.
- Only confirmed team drafts enter team history. The balancing heuristic is not guaranteed optimal.

## Next milestone

Test Codespaces preview, then add Firebase Authentication, Firestore with authorization rules, and Firebase Hosting for the shared tablet and TV display.
