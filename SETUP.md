# Vital Air Time Clock: Android app

Same clock as the Claude page (Clock / Hours tabs, travel / working / break, weekly and pay-period totals,
CSV export), packaged as an Android app that syncs live between every phone through Firebase.
Works with no signal too; entries sync when the phone reconnects.

## 1. Create the shared timesheet (about 5 minutes, free)
1. Go to <https://console.firebase.google.com> and **Add project** (name it e.g. `vital-air-timeclock`, skip Analytics).
2. **Build > Authentication > Get started > Sign-in method > Anonymous > Enable.**
3. **Build > Firestore Database > Create database** (production mode, any region near you).
4. In Firestore open the **Rules** tab, paste the contents of `firestore.rules`, then **Publish**.
5. **Project settings (gear) > Your apps > Web (`</>`)**, register an app, and copy the `firebaseConfig` values.
6. Paste them into `www/config.js` and change `adminPin` to your own office PIN. Commit and push.

## 2. Get the APK
Every push to the default branch builds the app on GitHub (Actions tab, "Build Android APK").
On your phone, open the repo's **Releases > Latest Android app**, download `vital-air-time-clock.apk`, and
install it (Android will ask you to allow installs from your browser the first time).
Builds on other branches are under Actions > the run > Artifacts.

## Updating (in-app)
When a newer build is published, the app shows an **Update available** bar. Tap **Update now**, then **Install**
on Android's prompt. The first time, Android asks you to allow "Install unknown apps" for this app.
You can also tap **Check for updates** at the bottom of any screen. Hours are stored online and are never lost.

**One-time reinstall:** the first APK was signed with a throwaway key. Uninstall that one once, then install
the newest; every update after that installs over the top.

## Updating (editing the code)
Change anything (a tech name in `www/app.js`, jobs in `www/jobs.js`, the PIN in `www/config.js`), push, and
install the new APK over the old one. Hours are stored online, so updating the app never loses them.

## Notes
- The office PIN only hides the edit buttons; it is inside the app file, so treat it as a speed bump.
- Data: collections `punches` and `jobs` in Firestore. You can view or export them in the Firebase console.
- Local preview: `npx serve www` (or open `www/index.html`).
