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
    },

    toggleAuthMode(mode) {
        const isSignup = mode === 'signup';
        const title = document.getElementById('auth-title');
        const sub = document.getElementById('auth-subtitle');
        const loginBtn = document.getElementById('btn-auth-login');
        const signupBtn = document.getElementById('btn-auth-signup');
        const switchLogin = document.getElementById('auth-switch-login');
        const switchSignup = document.getElementById('auth-switch-signup');
        if (title) title.textContent = isSignup ? 'Create your account' : 'Welcome back';
        if (sub) {
            sub.textContent = isSignup
                ? 'Sign up free — your Khata data syncs privately to Firebase.'
                : 'Log in — your Khata data syncs privately to Firebase Cloud.';
        }
        if (loginBtn) {
            loginBtn.hidden = isSignup;
            loginBtn.style.display = isSignup ? 'none' : 'inline-flex';
        }
        if (signupBtn) {
            signupBtn.hidden = !isSignup;
            signupBtn.style.display = isSignup ? 'inline-flex' : 'none';
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
            <div class="auth-brand"><i class="fas fa-book-bookmark"></i><span>KhataPro</span></div>
            <h1>Connect Firebase</h1>
            <p class="auth-sub">Your app data needs a free Firebase project (2 minutes). Website stays on GitHub/Vercel.</p>
            <ol class="auth-steps">
                <li>Open <a href="https://console.firebase.google.com/" target="_blank" rel="noopener">Firebase Console</a></li>
                <li>Create a project (or open an existing one)</li>
                <li><strong>Authentication</strong> → Sign-in method → enable <strong>Email/Password</strong> and <strong>Google</strong></li>
                <li><strong>Firestore Database</strong> → Create database</li>
                <li>Paste security rules from the file <code>firestore.rules</code></li>
                <li>Project settings ⚙️ → Your apps → Web app → copy the <code>firebaseConfig</code></li>
                <li>Paste that config into <code>site-config.js</code></li>
                <li>Authentication → Settings → Authorized domains → add <code>madadkhan11111.github.io</code> (and your Vercel domain)</li>
            </ol>
            <p class="auth-sub">Then tell Cursor <strong>“firebase config ready”</strong> or refresh after saving <code>site-config.js</code>.</p>
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
    },

    updateAccountWidgets() {
        const email = this.user?.email || '';
        const indicator = document.getElementById('backup-indicator-text');
        const status = document.getElementById('account-sync-status');
        const emailEl = document.getElementById('account-user-email');
        const profileStatus = document.querySelector('.profile-mini .status');

        if (indicator) indicator.textContent = this.user ? 'Firebase: Synced' : 'Firebase: Sign in';
        if (emailEl) emailEl.textContent = email || 'Not signed in';
        if (status) {
            status.textContent = this.user
                ? 'Your data saves automatically to Firebase Cloud.'
                : 'Sign in to sync with Firebase.';
        }
        if (profileStatus) profileStatus.textContent = email ? email.split('@')[0] : 'Guest';
    },

    setAuthMessage(msg, isError = true) {
        const el = document.getElementById('auth-message');
        if (!el) return;
        el.textContent = msg || '';
        el.style.color = isError ? 'var(--danger)' : 'var(--success)';
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
        if (!this.user) return null;
        return this.db.collection('users').doc(this.user.uid);
    },

    async loadFromCloud() {
        const ref = this.docRef();
        if (!ref) return;
        try {
            const snap = await ref.get();
            if (snap.exists) {
                const remote = snap.data()?.khataData;
                if (remote && remote.customers && remote.rooznamcha) {
                    db.data = remote;
                    if (!db.data.trash) db.data.trash = [];
                    localStorage.setItem('khata-data', JSON.stringify(db.data));
                    return;
                }
            }
            await this.pushToCloud();
        } catch (err) {
            console.error('Firebase load failed', err);
            if (typeof showToast === 'function') {
                showToast('Could not load Firebase data. Working offline until reconnect.', 'error');
            }
        }
    },

    queueSync() {
        if (!this.user || !this.ready) return;
        clearTimeout(this.syncTimer);
        this.syncTimer = setTimeout(() => this.pushToCloud(), 800);
    },

    async syncNow(showMsg = false) {
        clearTimeout(this.syncTimer);
        await this.pushToCloud(showMsg);
    },

    async pushToCloud(showMsg = false) {
        const ref = this.docRef();
        if (!ref || this.syncing) return;
        this.syncing = true;
        const indicator = document.getElementById('backup-indicator-text');
        if (indicator) indicator.textContent = 'Firebase: Saving…';
        try {
            await ref.set({
                email: this.user.email || '',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                khataData: db.data
            }, { merge: true });
            if (indicator) indicator.textContent = 'Firebase: Synced';
            if (showMsg && typeof showToast === 'function') showToast('Firebase sync complete', 'success');
            this.updateAccountWidgets();
        } catch (err) {
            console.error('Firebase save failed', err);
            if (indicator) indicator.textContent = 'Firebase: Offline';
            if (showMsg && typeof showToast === 'function') showToast('Firebase sync failed: ' + err.message, 'error');
        } finally {
            this.syncing = false;
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
