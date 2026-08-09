/**
 * Firebase Auth + Firestore cloud data for KhataBook Pro.
 * Website can stay on GitHub Pages / Vercel.
 * Each signed-in user only reads/writes their own Firestore document.
 */
const AccountCloud = {
    app: null,
    auth: null,
    db: null,
    user: null,
    ready: false,
    syncTimer: null,
    syncing: false,
    pendingSync: false,
    lastSyncError: '',

    isConfigured() {
        const cfg = window.KHATA_CONFIG?.firebase;
        return !!(cfg && cfg.apiKey && cfg.projectId && !String(cfg.apiKey).includes('YOUR_'));
    },

    async init() {
        this.bindAuthUi();
        if (!this.isConfigured()) {
            this.showSetupNeeded();
            return;
        }
        if (typeof firebase === 'undefined') {
            this.showAuthError('Firebase SDK failed to load. Check your internet connection.');
            return;
        }

        try {
            this.app = firebase.apps?.length
                ? firebase.app()
                : firebase.initializeApp(window.KHATA_CONFIG.firebase);
            this.auth = firebase.auth();
            this.db = firebase.firestore();
            try {
                this.db.settings({ ignoreUndefinedProperties: true });
            } catch (_) {
                /* settings may only be called once */
            }
            this.ready = true;

            this.auth.onAuthStateChanged(async (user) => {
                this.user = user;
                if (user) {
                    await this.onLoggedIn(user);
                } else {
                    this.showAuthScreen();
                }
            });
        } catch (err) {
            console.error(err);
            this.showAuthError(err.message || 'Firebase init failed');
        }
    },

    bindAuthUi() {
        document.getElementById('btn-auth-login')?.addEventListener('click', () => this.loginEmail());
        document.getElementById('btn-auth-signup')?.addEventListener('click', () => this.signupEmail());
        document.getElementById('btn-auth-google')?.addEventListener('click', () => this.loginGoogle());
        document.getElementById('btn-auth-logout')?.addEventListener('click', () => this.logout());
        document.getElementById('btn-auth-logout-side')?.addEventListener('click', () => this.logout());
        document.getElementById('btn-cloud-sync-now')?.addEventListener('click', () => this.syncNow(true));
        document.getElementById('link-show-signup')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleAuthMode('signup');
        });
        document.getElementById('link-show-login')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleAuthMode('login');
        });
        document.getElementById('link-forgot-password')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.resetPassword();
        });
    },

    toggleAuthMode(mode) {
        const isSignup = mode === 'signup';
        const title = document.getElementById('auth-title');
        const sub = document.getElementById('auth-subtitle');
        const loginBtn = document.getElementById('btn-auth-login');
        const signupBtn = document.getElementById('btn-auth-signup');
        const forgotWrap = document.getElementById('auth-forgot-wrap');
        const switchLogin = document.getElementById('auth-switch-login');
        const switchSignup = document.getElementById('auth-switch-signup');

        if (title) title.textContent = isSignup ? 'Create your account' : 'Welcome back';
        if (sub) {
            sub.textContent = isSignup
                ? 'Create a free account — your book syncs privately.'
                : 'Log in to open your Khata book.';
        }
        if (loginBtn) {
            loginBtn.hidden = isSignup;
            loginBtn.style.display = isSignup ? 'none' : 'inline-flex';
        }
        if (signupBtn) {
            signupBtn.hidden = !isSignup;
            signupBtn.style.display = isSignup ? 'inline-flex' : 'none';
        }
        if (forgotWrap) {
            forgotWrap.hidden = isSignup;
            forgotWrap.style.display = isSignup ? 'none' : 'block';
        }
        if (switchLogin) {
            switchLogin.hidden = !isSignup;
            switchLogin.style.display = isSignup ? 'block' : 'none';
        }
        if (switchSignup) {
            switchSignup.hidden = isSignup;
            switchSignup.style.display = isSignup ? 'none' : 'block';
        }
        this.setAuthMessage('');
    },

    showSetupNeeded() {
        const screen = document.getElementById('auth-screen');
        const app = document.querySelector('.app-container');
        if (app) app.hidden = true;
        if (screen) screen.hidden = false;
        const box = document.getElementById('auth-card');
        if (!box) return;
        box.innerHTML = `
            <h1>Connect Firebase</h1>
            <p class="auth-sub">Your app data needs a free Firebase project (2 minutes).</p>
            <ol class="auth-steps">
                <li>Open <a href="https://console.firebase.google.com/" target="_blank" rel="noopener">Firebase Console</a></li>
                <li>Create a project (or open an existing one)</li>
                <li><strong>Authentication</strong> → Sign-in method → enable <strong>Email/Password</strong> and <strong>Google</strong></li>
                <li><strong>Firestore Database</strong> → Create database</li>
                <li>Paste security rules from the file <code>firestore.rules</code></li>
                <li>Project settings → Your apps → Web app → copy the <code>firebaseConfig</code></li>
                <li>Paste that config into <code>site-config.js</code></li>
                <li>Authentication → Settings → Authorized domains → add <code>madadkhan11111.github.io</code></li>
            </ol>
            <p class="auth-sub">Then refresh after saving <code>site-config.js</code>.</p>
        `;
    },

    showAuthScreen() {
        const screen = document.getElementById('auth-screen');
        const app = document.querySelector('.app-container');
        if (screen) screen.hidden = false;
        if (app) app.hidden = true;
        this.toggleAuthMode('login');
        this.updateAccountWidgets();
    },

    async onLoggedIn(user) {
        const screen = document.getElementById('auth-screen');
        const app = document.querySelector('.app-container');
        if (screen) screen.hidden = true;
        if (app) app.hidden = false;

        await this.loadFromCloud();
        this.updateAccountWidgets();
        if (typeof updateUI === 'function') updateUI();
        if (typeof updateProfileDisplay === 'function') updateProfileDisplay();
        if (typeof showToast === 'function') {
            showToast(`Signed in as ${user.email || 'user'}`, 'success');
        }
        await this.pushToCloud(false);
    },

    updateAccountWidgets() {
        const email = this.user?.email || '';
        const indicator = document.getElementById('backup-indicator-text');
        const status = document.getElementById('account-sync-status');
        const emailEl = document.getElementById('account-user-email');
        const profileStatus = document.querySelector('.profile-mini .status');

        if (indicator) {
            if (!this.user) indicator.textContent = 'Firebase: Sign in';
            else if (this.lastSyncError) indicator.textContent = 'Firebase: Save failed';
            else indicator.textContent = 'Firebase: Synced';
        }
        if (emailEl) emailEl.textContent = email || 'Not signed in';
        if (status) {
            status.textContent = this.lastSyncError
                ? this.lastSyncError
                : (this.user
                    ? 'Your data saves automatically to Firebase Cloud.'
                    : 'Sign in to sync with Firebase.');
        }
        if (profileStatus) profileStatus.textContent = email ? email.split('@')[0] : 'Guest';
    },

    setAuthMessage(msg, isError = true) {
        const el = document.getElementById('auth-message');
        if (!el) return;
        el.textContent = msg || '';
        el.style.color = isError ? '#fda4af' : '#5eead4';
    },

    getAuthFields() {
        return {
            email: (document.getElementById('auth-email')?.value || '').trim(),
            password: document.getElementById('auth-password')?.value || ''
        };
    },

    async signupEmail() {
        if (!this.ready) return;
        const { email, password } = this.getAuthFields();
        if (!email || password.length < 6) {
            this.setAuthMessage('Enter a valid email and password (min 6 characters).');
            return;
        }
        try {
            this.setAuthMessage('Creating account…', false);
            await this.auth.createUserWithEmailAndPassword(email, password);
        } catch (err) {
            this.setAuthMessage(err.message || 'Sign up failed');
        }
    },

    async loginEmail() {
        if (!this.ready) return;
        const { email, password } = this.getAuthFields();
        if (!email || !password) {
            this.setAuthMessage('Enter email and password.');
            return;
        }
        try {
            this.setAuthMessage('Signing in…', false);
            await this.auth.signInWithEmailAndPassword(email, password);
        } catch (err) {
            this.setAuthMessage(err.message || 'Login failed');
        }
    },

    async resetPassword() {
        if (!this.ready) return;
        const { email } = this.getAuthFields();
        if (!email) {
            this.setAuthMessage('First type your email above, then click Forgot password.');
            document.getElementById('auth-email')?.focus();
            return;
        }
        try {
            this.setAuthMessage('Sending reset email…', false);
            const continueUrl = window.KHATA_CONFIG?.websiteUrl || (window.location.origin + window.location.pathname);
            await this.auth.sendPasswordResetEmail(email, {
                url: continueUrl,
                handleCodeInApp: false
            });
            this.setAuthMessage('Reset email sent. Check Inbox and Spam (from noreply@khata-your.firebaseapp.com).', false);
        } catch (err) {
            const code = err?.code || '';
            if (code === 'auth/user-not-found') {
                this.setAuthMessage('No email/password account found. If you use Google login, click Continue with Google.');
            } else if (code === 'auth/invalid-email') {
                this.setAuthMessage('Enter a valid email address.');
            } else if (code === 'auth/too-many-requests') {
                this.setAuthMessage('Too many tries. Wait a few minutes.');
            } else {
                this.setAuthMessage(err.message || 'Could not send reset email.');
            }
        }
    },

    async loginGoogle() {
        if (!this.ready) return;
        try {
            this.setAuthMessage('Opening Google…', false);
            const provider = new firebase.auth.GoogleAuthProvider();
            await this.auth.signInWithPopup(provider);
        } catch (err) {
            this.setAuthMessage(err.message || 'Google sign-in failed');
        }
    },

    async logout() {
        try {
            await this.auth.signOut();
            localStorage.removeItem('khata-data');
            location.reload();
        } catch (err) {
            if (typeof showToast === 'function') showToast(err.message || 'Logout failed', 'error');
        }
    },

    docRef() {
        if (!this.user || !this.db) return null;
        return this.db.collection('users').doc(this.user.uid);
    },

    dataWeight(data) {
        if (!data) return 0;
        const customers = Array.isArray(data.customers) ? data.customers : [];
        const rooz = Array.isArray(data.rooznamcha) ? data.rooznamcha : [];
        const trash = Array.isArray(data.trash) ? data.trash : [];
        const tx = customers.reduce((n, c) => n + (Array.isArray(c.transactions) ? c.transactions.length : 0), 0);
        return customers.length * 10 + rooz.length * 5 + tx + trash.length;
    },

    sanitizeData(data) {
        try {
            return JSON.parse(JSON.stringify(data ?? {}));
        } catch (_) {
            return {
                customers: [],
                rooznamcha: [],
                trash: [],
                settings: { shopName: 'My Business', currency: 'Rs.', language: 'en', nextKhataNo: 1, nextTransactionNo: 1001 }
            };
        }
    },

    async loadFromCloud() {
        const ref = this.docRef();
        if (!ref || typeof db === 'undefined') return;
        try {
            const snap = await ref.get();
            const localWeight = this.dataWeight(db.data);

            if (snap.exists) {
                const remote = snap.data()?.khataData;
                const remoteWeight = this.dataWeight(remote);
                if (remote && Array.isArray(remote.customers) && Array.isArray(remote.rooznamcha)) {
                    if (remoteWeight >= localWeight && remoteWeight > 0) {
                        db.data = remote;
                        if (!db.data.trash) db.data.trash = [];
                        if (!db.data.settings) {
                            db.data.settings = {
                                shopName: 'My Business',
                                currency: 'Rs.',
                                language: 'en',
                                nextKhataNo: 1,
                                nextTransactionNo: 1001
                            };
                        }
                        localStorage.setItem('khata-data', JSON.stringify(db.data));
                        this.lastSyncError = '';
                        return;
                    }
                }
            }
            await this.pushToCloud(false);
        } catch (err) {
            console.error('Firebase load failed', err);
            this.lastSyncError = this.friendlyError(err);
            if (typeof showToast === 'function') {
                showToast('Cloud load failed: ' + this.lastSyncError, 'error');
            }
            try { await this.pushToCloud(false); } catch (_) { /* ignore */ }
        }
    },

    friendlyError(err) {
        const code = err?.code || '';
        const msg = err?.message || String(err || 'Unknown error');
        if (code === 'permission-denied' || /permission/i.test(msg)) {
            return 'Permission denied — publish Firestore rules for users/{userId}.';
        }
        if (/API has not been used|service_disabled|Firestore/i.test(msg) && /enable|disabled|not been used/i.test(msg)) {
            return 'Create Firestore Database in Firebase Console first.';
        }
        if (/offline|unavailable|Failed to get document/i.test(msg)) {
            return 'Offline or Firestore not ready. Check internet + Firestore setup.';
        }
        if (/undefined/i.test(msg)) {
            return 'Invalid data field (undefined). Retrying with cleaned data.';
        }
        return msg.slice(0, 140);
    },

    queueSync() {
        if (!this.user || !this.ready) return;
        clearTimeout(this.syncTimer);
        this.syncTimer = setTimeout(() => this.pushToCloud(false), 500);
    },

    async syncNow(showMsg = false) {
        clearTimeout(this.syncTimer);
        await this.pushToCloud(showMsg);
    },

    async pushToCloud(showMsg = false) {
        const ref = this.docRef();
        if (!ref || typeof db === 'undefined') return;

        if (this.syncing) {
            this.pendingSync = true;
            return;
        }

        this.syncing = true;
        const indicator = document.getElementById('backup-indicator-text');
        if (indicator) indicator.textContent = 'Firebase: Saving…';

        try {
            localStorage.setItem('khata-data', JSON.stringify(db.data));

            const payload = this.sanitizeData(db.data);
            await ref.set({
                email: this.user.email || '',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                khataData: payload
            }, { merge: true });

            this.lastSyncError = '';
            if (indicator) indicator.textContent = 'Firebase: Synced';
            if (showMsg && typeof showToast === 'function') showToast('Saved to Firebase Cloud', 'success');
            this.updateAccountWidgets();
        } catch (err) {
            console.error('Firebase save failed', err);
            this.lastSyncError = this.friendlyError(err);
            if (indicator) indicator.textContent = 'Firebase: Save failed';
            if (typeof showToast === 'function') {
                showToast('Save failed: ' + this.lastSyncError, 'error');
            }
            this.updateAccountWidgets();
        } finally {
            this.syncing = false;
            if (this.pendingSync) {
                this.pendingSync = false;
                setTimeout(() => this.pushToCloud(false), 300);
            }
        }
    },

    showAuthError(msg) {
        this.showSetupNeeded();
        const el = document.getElementById('auth-message');
        if (el) {
            el.textContent = msg;
            el.style.color = 'var(--danger)';
        }
    }
};

window.AccountCloud = AccountCloud;
