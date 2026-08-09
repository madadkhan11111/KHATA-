# KhataBook Pro

Khata (customer ledger) and Rooznamcha (daily cash book) for shops and small businesses. Works in the browser and as a Windows desktop app (Electron).

## Run in browser (local)

```bash
npm run web
```

Open [http://localhost:8080](http://localhost:8080). Use **Chrome or Edge** for folder auto-backup.

## Run desktop app (easiest)

**Double-click:** `Start KhataBook Pro.bat` in the project folder.

First time only (if the app does not open):

1. Install [Node.js](https://nodejs.org) (LTS)
2. Open Command Prompt in this folder
3. Run: `npm install`
4. Double-click `Start KhataBook Pro.bat` again

Do **not** double-click `index.html` for the desktop app — that opens the browser only.

## Run desktop app (command line)

```bash
npm install
npm start
```

## Build Windows portable .exe

Double-click `Build Desktop App.bat`, or:

```bash
npm run pack
```

If build fails (OneDrive or permissions), use `Start KhataBook Pro.bat` instead — no install needed.

Installer build (`npm run dist`) may require running Command Prompt as Administrator on some PCs.

## Deploy on GitHub Pages

1. Push this repo to GitHub (`main` branch).
2. Repo **Settings → Pages → Source**: GitHub Actions.
3. After the workflow runs, site URL is:
   `https://YOUR_USERNAME.github.io/REPO_NAME/`

Set that URL in `site-config.js` as `websiteUrl`.

## Accounts for users worldwide

The **website** is on GitHub Pages.  
**User ledgers** are private in Firebase (each user only sees their own data).

Why not store all user data in the GitHub repo? That would make customer ledgers public. Firebase keeps each account private and works for shops worldwide.

### One-time owner setup (free)

1. Open https://console.firebase.google.com/ → Create project  
2. Build → Authentication → enable **Email/Password** and **Google**  
3. Build → Firestore Database → Create database  
4. Paste rules from `firestore.rules`  
5. Project settings → Your apps → Web → copy config into `site-config.js` → `firebase: { ... }`  
6. Add authorized domain: `madadkhan11111.github.io`  
7. Push/redeploy

Then any user can open the site, **Create Account**, and their data syncs automatically (no manual backup folder).


