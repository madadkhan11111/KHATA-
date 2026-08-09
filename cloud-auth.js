/**
 * Multi-user accounts on GitHub Cloud (private Gists).
 * - Sign in with GitHub (Device Flow) — no token paste, no folder backup
 * - Each user's Khata data is stored in their own private Gist
 * - Website stays on GitHub Pages
 */
const AccountCloud = {
    CODE_URL: 'https://github.com/login/device/code',
    TOKEN_URL: 'https://github.com/login/oauth/access_token',
    API: 'https://api.github.com',
    SCOPE: 'gist read:user',
    FILE_NAME: 'khata_cloud_data.json',
    STORAGE_TOKEN: 'khata-gh-token',
    STORAGE_GIST: 'khata-gh-gist',
    STORAGE_USER: 'khata-gh-user',

    user: null,
    token: null,
    gistId: null,
    syncTimer: null,
    syncing: false,
    pollTimer: null,

    clientId() {
        return window.KHATA_CONFIG?.githubOAuthClientId || '';
    },

    isConfigured() {
        const id = this.clientId();
        return !!(id && !id.includes('YOUR_'));
    },

    async init() {
        this.bindAuthUi();
        if (!this.isConfigured()) {
            this.showSetupNeeded();
            return;
        }

        const saved = localStorage.getItem(this.STORAGE_TOKEN);
        if (saved) {
            this.token = saved;
            this.gistId = localStorage.getItem(this.STORAGE_GIST) || null;
            try {
                await this.fetchUser();
                await this.onLoggedIn();
                return;
            } catch (e) {
                this.clearSession();
            }
        }
        this.showAuthScreen();
    },

    bindAuthUi() {
        document.getElementById('btn-auth-github')?.addEventListener('click', () => this.startGitHubLogin());
        document.getElementById('btn-auth-login')?.addEventListener('click', () => this.startGitHubLogin());
        document.getElementById('btn-auth-signup')?.addEventListener('click', () => this.startGitHubLogin());
        document.getElementById('btn-auth-google')?.addEventListener('click', () => this.startGitHubLogin());
        document.getElementById('btn-auth-logout')?.addEventListener('click', () => this.logout());
        document.getElementById('btn-cloud-sync-now')?.addEventListener('click', () => this.syncNow(true));
    },

    showSetupNeeded() {
        const screen = document.getElementById('auth-screen');
        const app = document.querySelector('.app-container');
        if (app) app.hidden = true;
        if (screen) screen.hidden = false;
        const box = document.getElementById('auth-card');
        if (!box) return;
        box.innerHTML = `
            <div class="auth-brand"><i class="fas fa-book-bookmark"></i><span>KhataPro</span></div>
            <h1>Connect GitHub Cloud</h1>
            <p class="auth-sub">Owner setup (one time): create a GitHub OAuth App so users can sign in and store data in private GitHub Gists.</p>
            <ol class="auth-steps">
                <li>Open <a href="https://github.com/settings/developers" target="_blank" rel="noopener">GitHub Developer Settings</a> → OAuth Apps → New</li>
                <li>Homepage: <code>https://madadkhan11111.github.io/KHATA-/</code></li>
                <li>Callback: <code>https://madadkhan11111.github.io/KHATA-/</code></li>
                <li>Enable <strong>Device Flow</strong> on the app</li>
                <li>Copy <strong>Client ID</strong> into <code>site-config.js</code> → <code>githubOAuthClientId</code></li>
            </ol>
            <p class="auth-sub">Then refresh this page. Users worldwide sign in with GitHub — data saves automatically.</p>
        `;
    },

    showAuthScreen() {
        const screen = document.getElementById('auth-screen');
        const app = document.querySelector('.app-container');
        if (screen) screen.hidden = false;
        if (app) app.hidden = true;
        this.rewriteAuthCard();
        this.updateAccountWidgets();
    },

    rewriteAuthCard() {
        const box = document.getElementById('auth-card');
        if (!box || box.querySelector('#btn-auth-github')) return;
        // Keep existing markup from index.html if present; just tweak labels
        const title = document.getElementById('auth-title');
        const sub = document.getElementById('auth-subtitle');
        const loginBtn = document.getElementById('btn-auth-login');
        const signupBtn = document.getElementById('btn-auth-signup');
        const googleBtn = document.getElementById('btn-auth-google');
        const email = document.getElementById('auth-email');
        const pass = document.getElementById('auth-password');
        if (title) title.textContent = 'Sign in to KhataPro';
        if (sub) sub.textContent = 'Your data is stored privately in GitHub Cloud. Sign in with GitHub to use the app on any device.';
        if (email) email.closest('.form-group')?.remove();
        if (pass) pass.closest('.form-group')?.remove();
        if (loginBtn) loginBtn.hidden = true;
        if (signupBtn) signupBtn.hidden = true;
        if (googleBtn) {
            googleBtn.id = 'btn-auth-github';
            googleBtn.innerHTML = '<i class="fab fa-github"></i> Continue with GitHub';
            googleBtn.onclick = () => this.startGitHubLogin();
        }
        const sw1 = document.getElementById('auth-switch-signup');
        const sw2 = document.getElementById('auth-switch-login');
        if (sw1) sw1.innerHTML = 'Free for shops worldwide — each account’s data stays private.';
        if (sw2) sw2.hidden = true;
    },

    async onLoggedIn() {
        const screen = document.getElementById('auth-screen');
        const app = document.querySelector('.app-container');
        if (screen) screen.hidden = true;
        if (app) app.hidden = false;
        await this.loadFromCloud();
        this.updateAccountWidgets();
        if (typeof updateUI === 'function') updateUI();
        if (typeof updateProfileDisplay === 'function') updateProfileDisplay();
        if (typeof showToast === 'function') {
            showToast(`Signed in as @${this.user?.login || 'user'}`, 'success');
        }
    },

    updateAccountWidgets() {
        const indicator = document.getElementById('backup-indicator-text');
        const status = document.getElementById('account-sync-status');
        const emailEl = document.getElementById('account-user-email');
        const profileStatus = document.querySelector('.profile-mini .status');
        const name = this.user ? `@${this.user.login}` : '';

        if (indicator) indicator.textContent = this.user ? 'GitHub Cloud: Synced' : 'GitHub Cloud: Sign in';
        if (emailEl) emailEl.textContent = name || 'Not signed in';
        if (status) {
            status.textContent = this.user
                ? 'Data saves automatically to your private GitHub Gist.'
                : 'Sign in with GitHub to sync.';
        }
        if (profileStatus) profileStatus.textContent = this.user?.login || 'Guest';
    },

    setAuthMessage(msg, isError = true) {
        const el = document.getElementById('auth-message');
        if (!el) return;
        el.innerHTML = msg || '';
        el.style.color = isError ? 'var(--danger)' : 'var(--success)';
    },

    clearSession() {
        this.token = null;
        this.user = null;
        this.gistId = null;
        localStorage.removeItem(this.STORAGE_TOKEN);
        localStorage.removeItem(this.STORAGE_GIST);
        localStorage.removeItem(this.STORAGE_USER);
    },

    async startGitHubLogin() {
        if (!this.isConfigured()) {
            this.showSetupNeeded();
            return;
        }
        try {
            this.setAuthMessage('Connecting to GitHub…', false);
            const body = new URLSearchParams({
                client_id: this.clientId(),
                scope: this.SCOPE
            });
            const res = await fetch(this.CODE_URL, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body
            });
            const data = await res.json();
            if (!res.ok || !data.device_code) {
                throw new Error(data.error_description || data.error || 'Could not start GitHub login');
            }

            const verifyUrl = data.verification_uri || 'https://github.com/login/device';
            this.setAuthMessage(
                `Open <a href="${verifyUrl}" target="_blank" rel="noopener">${verifyUrl}</a><br>` +
                `Enter code: <strong style="font-size:1.2rem;letter-spacing:2px">${data.user_code}</strong>`,
                false
            );
            window.open(verifyUrl, '_blank', 'noopener');

            clearInterval(this.pollTimer);
            const started = Date.now();
            this.pollTimer = setInterval(async () => {
                if (Date.now() - started > (data.expires_in || 900) * 1000) {
                    clearInterval(this.pollTimer);
                    this.setAuthMessage('Code expired. Click Continue with GitHub again.');
                    return;
                }
                try {
                    const tokenRes = await fetch(this.TOKEN_URL, {
                        method: 'POST',
                        headers: {
                            Accept: 'application/json',
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        body: new URLSearchParams({
                            client_id: this.clientId(),
                            device_code: data.device_code,
                            grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
                        })
                    });
                    const tokenData = await tokenRes.json();
                    if (tokenData.access_token) {
                        clearInterval(this.pollTimer);
                        this.token = tokenData.access_token;
                        localStorage.setItem(this.STORAGE_TOKEN, this.token);
                        await this.fetchUser();
                        await this.onLoggedIn();
                    } else if (tokenData.error && tokenData.error !== 'authorization_pending' && tokenData.error !== 'slow_down') {
                        clearInterval(this.pollTimer);
                        this.setAuthMessage(tokenData.error_description || tokenData.error);
                    }
                } catch (err) {
                    // keep polling
                }
            }, Math.max(5, data.interval || 5) * 1000);
        } catch (err) {
            console.error(err);
            this.setAuthMessage(err.message || 'GitHub login failed');
        }
    },

    async api(path, options = {}) {
        const res = await fetch(`${this.API}${path}`, {
            ...options,
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${this.token}`,
                'X-GitHub-Api-Version': '2022-11-28',
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });
        if (!res.ok) {
            const t = await res.text();
            throw new Error(`${res.status}: ${t.slice(0, 160)}`);
        }
        if (res.status === 204) return null;
        return res.json();
    },

    async fetchUser() {
        this.user = await this.api('/user');
        localStorage.setItem(this.STORAGE_USER, JSON.stringify({
            login: this.user.login,
            id: this.user.id,
            avatar: this.user.avatar_url
        }));
    },

    async logout() {
        this.clearSession();
        localStorage.removeItem('khata-data');
        location.reload();
    },

    async loadFromCloud() {
        try {
            if (!this.gistId) {
                // Find existing khata gist
                const gists = await this.api('/gists?per_page=50');
                const found = (gists || []).find(g => g.files && g.files[this.FILE_NAME]);
                if (found) {
                    this.gistId = found.id;
                    localStorage.setItem(this.STORAGE_GIST, this.gistId);
                }
            }
            if (!this.gistId) {
                await this.pushToCloud();
                return;
            }
            const gist = await this.api(`/gists/${this.gistId}`);
            const file = gist.files?.[this.FILE_NAME];
            let content = file?.content;
            if (!content && file?.raw_url) {
                const raw = await fetch(file.raw_url, {
                    headers: { Authorization: `Bearer ${this.token}` }
                });
                content = await raw.text();
            }
            if (content) {
                const parsed = JSON.parse(content);
                if (parsed.customers && parsed.rooznamcha) {
                    db.data = parsed;
                    if (!db.data.trash) db.data.trash = [];
                    localStorage.setItem('khata-data', JSON.stringify(db.data));
                    return;
                }
            }
            await this.pushToCloud();
        } catch (err) {
            console.error('GitHub load failed', err);
            if (typeof showToast === 'function') {
                showToast('Could not load GitHub cloud data. Working offline.', 'error');
            }
        }
    },

    queueSync() {
        if (!this.token || !this.user) return;
        clearTimeout(this.syncTimer);
        this.syncTimer = setTimeout(() => this.pushToCloud(), 800);
    },

    async syncNow(showMsg = false) {
        clearTimeout(this.syncTimer);
        await this.pushToCloud(showMsg);
    },

    async pushToCloud(showMsg = false) {
        if (!this.token || !this.user || this.syncing) return;
        this.syncing = true;
        const indicator = document.getElementById('backup-indicator-text');
        if (indicator) indicator.textContent = 'GitHub Cloud: Saving…';
        try {
            const content = JSON.stringify(db.data, null, 2);
            if (!this.gistId) {
                const created = await this.api('/gists', {
                    method: 'POST',
                    body: JSON.stringify({
                        description: 'KhataBook Pro — private cloud data (auto)',
                        public: false,
                        files: { [this.FILE_NAME]: { content } }
                    })
                });
                this.gistId = created.id;
                localStorage.setItem(this.STORAGE_GIST, this.gistId);
            } else {
                await this.api(`/gists/${this.gistId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        files: { [this.FILE_NAME]: { content } }
                    })
                });
            }
            if (indicator) indicator.textContent = 'GitHub Cloud: Synced';
            if (showMsg && typeof showToast === 'function') showToast('Saved to GitHub Cloud', 'success');
            this.updateAccountWidgets();
        } catch (err) {
            console.error('GitHub save failed', err);
            if (indicator) indicator.textContent = 'GitHub Cloud: Offline';
            if (showMsg && typeof showToast === 'function') showToast('GitHub save failed: ' + err.message, 'error');
        } finally {
            this.syncing = false;
        }
    }
};

window.AccountCloud = AccountCloud;
