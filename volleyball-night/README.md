# Volleyball Night — v0.1 local prototype

A touchscreen-first indoor 6v6 volleyball organizer built with React, TypeScript and Vite.

## Run on your Mac

1. Install Node.js LTS from https://nodejs.org/ if you don't have it.
2. Extract this ZIP and open **Terminal**.
3. Change to the project folder by typing `cd ` (including the trailing space), dragging the extracted `volleyball-night` folder onto the Terminal window, and pressing Return.
4. Run `npm install` (first time only).
5. Run `npm run dev`.
6. Open the **Local** URL shown in Terminal (usually http://localhost:5173).
7. For subsequent sessions, run `npm run dev` again. Press `Control + C` to stop.

On the same Wi-Fi network, other devices may be able to access the **Network** URL shown in Terminal. **IMPORTANT:** local storage data does **not** sync across devices; adding a player on one device does not add them on another. The final Firebase version will fix this.

## Quick demo

1. Click **Organizer mode** in the lower-left corner.
2. Open **Settings → Add 18 sample players**. These sample players are automatically checked in.
3. Open **Team builder**, choose a configuration, then **Generate teams**.
4. Tap player names to swap two players; use the dropdown next to a player to move them to another team.
5. Use **Regenerate** to try a different arrangement.
6. Select **Confirm teams** to save a historical lineup.
7. Open **Game schedule**, select cycles and generate a schedule. Use **Next game** to advance.
8. Open **TV display** in a separate browser tab. It reads the confirmed rosters and current game. Updates to another tab on the *same browser origin/device* are shared via localStorage events.

## What's included

- Player names, persistent local profiles, 10 descriptively named skill levels
- Separate self-assessed skill and organizer overrides
- Gender and height (36–84 inches, 1-inch steps), both optional
- Shared-device check-in, prevent duplicate check-in
- Automatic roster-size suggestions; 4–8 real players, max 2 automatic SUB slots per roster
- Multi-factor balancing (effective skill, gender distribution, actual height, tall-player distribution, teammate history)
- Regenerate, move and swap players, manual SUB addition/removal
- Confirmed team history (only confirmed drafts count)
- One-court schedules: 3 teams (1v2, 2v3, 1v3), 4 teams (1v2, 3v4, 1v3, 2v4, optional 1v4, 2v3), extra cycles, and approximate schedules for 5+ teams
- Read-only TV page
- JSON backup export

## Important prototype limitations

**This is a local prototype, not yet suitable for untrusted/public access.**

- Organizer mode is a UI toggle, **not authentication**. There are no secured roles or server-side access rules yet.
- Data is saved in each browser's `localStorage`. Clearing site data or switching devices loses access to that device's saved profiles and history. Use **Settings → Download JSON backup** regularly. Import is not yet implemented.
- The TV page is synchronized within the same origin/browser storage, not remotely. Firebase is needed for live updates across independent devices.
- Team generation uses heuristic search, not a guaranteed globally optimal solution. It treats missing gender/height as unknown; numerical skill values are only visible if the organizer enables them.
- Borrowed SUB players are not automatically assigned. Organizers decide who lends a player, and there is no conflict-free borrowing allocator yet.
- The scheduling algorithm for five or more teams is experimental. Three/four-team rotations match the planned patterns.
- Team confirmation adds a history entry each time. Confirm only lineups actually used; currently there is no undo/remove-history control.
- Editing attendance or regenerating after confirmation clears the current confirmed lineup/schedule. Existing historical records remain.
- Profile creation requires a valid name, but duplicate names are currently allowed (player IDs remain unique).
- The UI uses custom CSS for a lightweight prototype. shadcn/ui components can be adopted in a later iteration without affecting the core algorithms.

## Developer commands

- `npm run dev` — development server
- `npm run build` — type-check and production build
- `npm run preview` — preview build locally

## Next milestone

Connect Firebase Authentication, Firestore and Hosting; secure organizer writes using Firestore rules and a supported restricted check-in flow; make live TV view synchronize across devices; support JSON restore and confirmed-round history editing.
