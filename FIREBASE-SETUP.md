# Firebase setup for Volleyball Night

Our current app still uses browser-local storage. The files here prepare us
for a secure Firestore migration and Firebase Hosting, but do **not** enable
cloud synchronization yet.

## Do this in Firebase Console (browser only)

1. Visit https://console.firebase.google.com/ and select **Add project**.
2. Use a project name such as `volleyball-night`. The available project ID may have a suffix; keep the exact ID.
3. Keep the **Spark / no-cost** plan. Google Analytics is optional and not required.
4. From Project Overview, add a **Web app** (</> icon). Name it `Volleyball Night Web`.
5. Copy the web-app Firebase configuration values. These are web client identifiers, not service-account secrets.
6. In **Build > Firestore Database**, create a Firestore Standard database, using **Production mode**, with the default `(default)` database and a nearby US location. Keep its security rules closed.
7. In **Build > Authentication > Sign-in method**, enable **Email/Password** for trusted organizer and kiosk-device accounts. We will set up roles and safe rules before using real player profiles.
8. Return to ChatGPT with the **project ID** and Web app Firebase config. Do **not** share login passwords, private service-account JSON, or API credentials that grant admin access.

## Development path

- Connect the app with the Firebase Web SDK from Vite environment variables.
- Establish a signed-in kiosk/operator mode, separate from organizer privileges.
- Add strongly scoped Firestore security rules and test them with the Rules emulator.
- Migrate player profiles, sessions, confirmed rosters, and schedules to Firestore.
- Add realtime listeners for the check-in, scoreboard, and TV views.
- Publish the built `dist` directory using **Firebase Hosting**.

## Security boundary

A public URL does not imply that visitors can write any Firestore data. The
kiosk interface can be accessible without each player registering, but writes
will require an authorized kiosk session. Organizers have their own sign-in.
Public self-check-in from personal devices is a separate feature and will need
a carefully scoped flow. We will not open unrestricted writes to player profiles.

## Hosting

`firebase.json` points Hosting at the Vite build folder `dist` and rewrites
app routes to `index.html`. This is static Firebase Hosting; we do not need
Firebase App Hosting or Cloud Functions to publish the initial app.

Do not run `firebase deploy --only firestore` until the authorization rules
are implemented and tested. The current `firestore.rules` intentionally denies
every read and write.
