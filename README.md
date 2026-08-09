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

## GitHub cloud data backup

Business data is **not** stored in the public website repo (that would expose customer ledgers).

Instead, in the app go to **Settings → GitHub Cloud Backup**:

1. Create a token at https://github.com/settings/tokens (scope: `gist`)
2. Paste token → **Save Token & Connect**
3. **Upload Data to GitHub** (creates a private Gist)
4. On another device: same token → **Restore Data from GitHub**

Token stays only in your browser (`localStorage`), not in the published website files.

