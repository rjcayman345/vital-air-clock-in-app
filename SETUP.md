# Vital Air Time Clock: Android app

Same clock as the Claude page (Clock / Hours tabs, travel / working / break, weekly and pay-period totals,
CSV export), packaged as an Android app that syncs live between every phone through Firebase.
Works with no signal too; entries sync when the phone reconnects.

## 1. Connect the shared timesheet (Firebase)
Your Firebase project is already filled in (`www/config.js`). In the Firebase console, finish these once:
1. **Authentication > Sign-in method:** enable **Anonymous** (techs) and **Email/Password** (Rohan).
2. **Authentication > Users > Add user:** email `rohan.vitalair@gmail.com`, and a **6-digit PIN** as the password (Firebase needs at least 6 characters, so use numbers only, e.g. `482916`).
3. **Authentication > Settings > User actions:** turn **off** "Enable create (sign-up)" so nobody can make accounts.
4. **Firestore Database > Rules:** paste all of `firestore.rules` and **Publish**.

## Admin (Rohan)
On the Clock tab, tap **Office login**, enter the PIN, and tap **Sign in**. The **Hours** tab then appears with every
tech's timesheet, edit/delete on entries, job management, and **PDF timesheets** (a summary page plus one page per tech for
the selected week or pay period; with a tech selected, just that tech). Techs never see the Hours tab, and the database
rules stop anyone but Rohan's account from editing or deleting entries.

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
- Data: collections `punches` and `jobs` in Firestore. You can view or export them in the Firebase console.
- Local preview: `npx serve www` (or open `www/index.html`).
