/**
 * FORMCRAFT - Multi-User Firebase Authentication Manager
 * Supports Google Sign-In, Email/Password Login, User Registration, and Session Guard.
 */

const SUPER_ADMIN_EMAIL = "iskakfatoni@gmail.com";

class AuthManager {
  constructor() {
    this.SESSION_KEY = 'formcraft_auth_session';
    this.currentUser = this.loadStoredUser();
    this.authCheckDone = false;
    this.initFirebaseAuthState();
    this.bindEvents();
    this.updateAuthUI();
    this.checkRouteGuard();
    this.handleUrlParams();
  }

  get auth() {
    return window.firebaseManager && window.firebaseManager.auth ? window.firebaseManager.auth : null;
  }

  isLandingPage() {
    const path = window.location.pathname.toLowerCase();
    return !path.includes('form.html');
  }

  isFormPage() {
    const path = window.location.pathname.toLowerCase();
    return path.includes('form.html');
  }

  isAdmin(email) {
    if (!email) return false;
    return email.toLowerCase().trim() === SUPER_ADMIN_EMAIL.toLowerCase();
  }

  loadStoredUser() {
    try {
      const data = localStorage.getItem(this.SESSION_KEY);
      const user = data ? JSON.parse(data) : null;
      if (user && user.uid) {
        return user;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  saveStoredUser(user) {
    if (user && user.uid) {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
      this.currentUser = user;
    } else {
      localStorage.removeItem(this.SESSION_KEY);
      this.currentUser = null;
    }
    this.updateAuthUI();
    window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { user: this.currentUser } }));
  }

  isLoggedIn() {
    return !!this.currentUser && !!this.currentUser.uid;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  initFirebaseAuthState() {
    if (this.auth) {
      this.auth.onAuthStateChanged(firebaseUser => {
        this.authCheckDone = true;
        if (firebaseUser) {
          const userObj = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'User'),
            email: firebaseUser.email || '',
            photoUrl: firebaseUser.photoURL || null,
            provider: firebaseUser.providerData && firebaseUser.providerData[0] ? firebaseUser.providerData[0].providerId : 'firebase',
            role: this.isAdmin(firebaseUser.email) ? 'admin' : 'user'
          };
          this.saveStoredUser(userObj);
        } else {
          this.saveStoredUser(null);
        }
        this.checkRouteGuard();
      });
    } else {
      this.authCheckDone = true;
      setTimeout(() => this.checkRouteGuard(), 100);
    }
  }

  /**
   * Protects form.html so only authenticated users can access Dashboard & Builder.
   * Public responder views (#/view/ or #/form/) remain completely open to respondents.
   */
  checkRouteGuard() {
    if (!this.isFormPage()) return;

    const hash = window.location.hash || '';
    const isPublicView = hash.startsWith('#/view/') || hash.startsWith('#/form/');

    // Public respondent view is always allowed
    if (isPublicView) return;

    // Check if user is logged in
    if (!this.isLoggedIn()) {
      if (!this.authCheckDone) {
        setTimeout(() => this.checkRouteGuard(), 400);
        return;
      }

      console.warn('Akses memerlukan login untuk mengelola dan membuat formulir.');
      window.location.replace('index.html?auth=required');
    }
  }

  handleUrlParams() {
    if (this.isLandingPage()) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('auth') === 'required') {
        setTimeout(() => {
          this.notify('Silakan masuk atau daftar akun untuk membuat formulir.', 'info');
          const heroAuth = document.getElementById('hero-auth-container');
          if (heroAuth) {
            heroAuth.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 500);
      }
    }
  }

  notify(message, type = 'info') {
    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast(message, type);
    } else {
      const container = document.getElementById('toast-container');
      if (container) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        let iconName = type === 'success' ? 'check-circle' : (type === 'error' ? 'alert-triangle' : 'info');
        toast.innerHTML = `<i data-lucide="${iconName}"></i><span>${message}</span>`;
        container.appendChild(toast);
        if (window.lucide) window.lucide.createIcons();
        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.transform = 'translateY(10px)';
          setTimeout(() => toast.remove(), 300);
        }, 4000);
      } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
      }
    }
  }

  async loginWithGoogle() {
    if (!this.auth) {
      this.notify('Firebase Auth belum siap. Pastikan koneksi online.', 'error');
      return null;
    }

    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await this.auth.signInWithPopup(provider);
      const u = result.user;

      const userObj = {
        uid: u.uid,
        name: u.displayName || (u.email ? u.email.split('@')[0] : 'User'),
        email: u.email,
        photoUrl: u.photoURL,
        provider: 'google.com',
        role: this.isAdmin(u.email) ? 'admin' : 'user'
      };
      this.saveStoredUser(userObj);
      this.notify(`Selamat datang, ${userObj.name}! Mengalihkan ke Workspace...`, 'success');

      if (this.isLandingPage()) {
        setTimeout(() => {
          window.location.href = 'form.html#/dashboard';
        }, 600);
      }
      return userObj;
    } catch (err) {
      console.warn('Google Popup Auth error:', err);
      this.handleAuthError(err);
      throw err;
    }
  }

  async handleEmailAuth(email, password) {
    if (!this.auth) {
      this.notify('Firebase Auth belum siap di browser.', 'error');
      return false;
    }

    const inputEmail = email.trim().toLowerCase();
    const btnSubmit = document.getElementById('btn-auth-submit');
    const labelSpan = document.getElementById('auth-submit-label');
    const origText = labelSpan ? labelSpan.textContent : '';

    if (btnSubmit) {
      btnSubmit.disabled = true;
      if (labelSpan) labelSpan.textContent = 'Memverifikasi...';
    }

    try {
      const cred = await this.auth.signInWithEmailAndPassword(inputEmail, password);
      const u = cred.user;
      const userObj = {
        uid: u.uid,
        name: u.displayName || inputEmail.split('@')[0],
        email: u.email,
        photoUrl: u.photoURL || null,
        provider: 'password',
        role: this.isAdmin(u.email) ? 'admin' : 'user'
      };
      this.saveStoredUser(userObj);
      this.notify(`Berhasil masuk sebagai ${userObj.name}! Mengalihkan...`, 'success');

      if (this.isLandingPage()) {
        setTimeout(() => {
          window.location.href = 'form.html#/dashboard';
        }, 600);
      }
      return true;
    } catch (err) {
      console.error('Email Auth error:', err);
      this.handleAuthError(err);
      return false;
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        if (labelSpan) labelSpan.textContent = origText;
      }
    }
  }

  async handleEmailRegister(name, email, password) {
    if (!this.auth) {
      this.notify('Firebase Auth belum siap di browser.', 'error');
      return false;
    }

    const inputEmail = email.trim().toLowerCase();
    const inputName = name.trim();
    const btnRegister = document.getElementById('btn-register-submit');
    const labelSpan = document.getElementById('register-submit-label');
    const origText = labelSpan ? labelSpan.textContent : '';

    if (btnRegister) {
      btnRegister.disabled = true;
      if (labelSpan) labelSpan.textContent = 'Mendaftarkan...';
    }

    try {
      const cred = await this.auth.createUserWithEmailAndPassword(inputEmail, password);
      const u = cred.user;

      if (inputName) {
        try {
          await u.updateProfile({ displayName: inputName });
        } catch (profileErr) {
          console.warn('Profile update error:', profileErr);
        }
      }

      const userObj = {
        uid: u.uid,
        name: inputName || inputEmail.split('@')[0],
        email: u.email,
        photoUrl: null,
        provider: 'password',
        role: this.isAdmin(u.email) ? 'admin' : 'user'
      };
      this.saveStoredUser(userObj);
      this.notify(`Pendaftaran berhasil! Selamat datang, ${userObj.name}!`, 'success');

      if (this.isLandingPage()) {
        setTimeout(() => {
          window.location.href = 'form.html#/dashboard';
        }, 700);
      }
      return true;
    } catch (err) {
      console.error('Register error:', err);
      this.handleAuthError(err);
      return false;
    } finally {
      if (btnRegister) {
        btnRegister.disabled = false;
        if (labelSpan) labelSpan.textContent = origText;
      }
    }
  }

  handleAuthError(err) {
    let msg = 'Terjadi kesalahan autentikasi.';
    switch (err.code) {
      case 'auth/email-already-in-use':
        msg = 'Alamat email ini sudah terdaftar. Silakan gunakan tab Masuk (Login).';
        break;
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        msg = 'Email atau kata sandi tidak cocok. Silakan periksa kembali.';
        break;
      case 'auth/weak-password':
        msg = 'Kata sandi terlalu pendek. Gunakan minimal 6 karakter.';
        break;
      case 'auth/invalid-email':
        msg = 'Format alamat email tidak valid.';
        break;
      case 'auth/popup-closed-by-user':
        msg = 'Jendela login Google ditutup sebelum proses selesai.';
        break;
      case 'auth/unauthorized-domain':
        msg = 'Domain ini belum diotorisasi di Firebase Authentication settings.';
        break;
      case 'auth/network-request-failed':
        msg = 'Koneksi jaringan gagal. Periksa koneksi internet Anda.';
        break;
      default:
        msg = err.message || msg;
    }
    this.notify(msg, 'error');
  }

  async logout() {
    // Auto-save form if currently open in builder before logging out
    if (window.app && window.app.builder && window.app.builder.currentForm) {
      try {
        await window.app.builder.saveCurrentForm(true);
      } catch (e) {
        console.warn('Auto-save on logout warning:', e);
      }
    }

    if (this.auth) {
      try {
        await this.auth.signOut();
      } catch (e) {
        console.warn('Logout warning:', e);
      }
    }
    this.saveStoredUser(null);
    this.notify('Anda telah berhasil keluar (Logout)', 'info');

    if (this.isFormPage()) {
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 500);
    }
  }

  bindEvents() {
    // Google Login Button
    const btnGoogleLogin = document.getElementById('btn-hero-google-login');
    if (btnGoogleLogin) {
      btnGoogleLogin.addEventListener('click', async () => {
        try {
          await this.loginWithGoogle();
        } catch (e) {
          // Handled inside
        }
      });
    }

    // Email Login Form
    const emailLoginForm = document.getElementById('hero-email-login-form');
    if (emailLoginForm) {
      emailLoginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('auth-email-input');
        const passInput = document.getElementById('auth-password-input');
        if (emailInput && passInput) {
          const email = emailInput.value.trim();
          const pass = passInput.value;
          if (email && pass) {
            this.handleEmailAuth(email, pass);
          }
        }
      });
    }

    // Email Register Form
    const emailRegisterForm = document.getElementById('hero-email-register-form');
    if (emailRegisterForm) {
      emailRegisterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('reg-name-input');
        const emailInput = document.getElementById('reg-email-input');
        const passInput = document.getElementById('reg-password-input');
        if (emailInput && passInput) {
          const name = nameInput ? nameInput.value.trim() : '';
          const email = emailInput.value.trim();
          const pass = passInput.value;
          if (email && pass) {
            this.handleEmailRegister(name, email, pass);
          }
        }
      });
    }

    // Tab Switcher between Login and Register
    const tabLogin = document.getElementById('tab-auth-login');
    const tabRegister = document.getElementById('tab-auth-register');
    const formLogin = document.getElementById('hero-email-login-form');
    const formRegister = document.getElementById('hero-email-register-form');

    if (tabLogin && tabRegister) {
      tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        if (formLogin) formLogin.classList.remove('hidden');
        if (formRegister) formRegister.classList.add('hidden');
      });

      tabRegister.addEventListener('click', () => {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        if (formLogin) formLogin.classList.add('hidden');
        if (formRegister) formRegister.classList.remove('hidden');
      });
    }

    // Logout Button
    const btnHeroLogout = document.getElementById('btn-hero-logout');
    if (btnHeroLogout) {
      btnHeroLogout.addEventListener('click', () => {
        this.logout();
      });
    }

    // Navbar Login/Logout Pill Action
    const navAuthPill = document.getElementById('nav-user-auth-pill');
    if (navAuthPill) {
      navAuthPill.addEventListener('click', () => {
        if (this.isLoggedIn()) {
          const displayName = this.currentUser.name || this.currentUser.email || 'Pengguna';
          if (confirm(`Apakah Anda ingin keluar (logout) dari akun "${displayName}"?`)) {
            this.logout();
          }
        } else {
          if (this.isFormPage()) {
            window.location.href = 'index.html?auth=required';
          } else {
            const authCard = document.getElementById('hero-auth-container');
            if (authCard) {
              authCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
              const emailInput = document.getElementById('auth-email-input');
              if (emailInput) emailInput.focus();
            }
          }
        }
      });
    }

    // Hash change guard for form.html
    window.addEventListener('hashchange', () => {
      this.checkRouteGuard();
    });
  }

  updateAuthUI() {
    const user = this.currentUser;
    const isLogged = this.isLoggedIn();

    // 1. Navbar Auth Pill
    const navAuthPill = document.getElementById('nav-user-auth-pill');
    const navAuthText = document.getElementById('nav-user-auth-name');
    const navAuthAvatar = document.getElementById('nav-user-auth-avatar');

    if (navAuthPill && navAuthText) {
      if (isLogged) {
        navAuthPill.classList.remove('logged-out');
        navAuthPill.classList.add('logged-in');
        navAuthText.textContent = user.name || (user.email ? user.email.split('@')[0] : 'Akun Saya');
        if (user.photoUrl && navAuthAvatar) {
          navAuthAvatar.innerHTML = `<img src="${user.photoUrl}" alt="Avatar" class="user-avatar-img" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover;">`;
        } else if (navAuthAvatar) {
          navAuthAvatar.innerHTML = `<i data-lucide="user-check"></i>`;
        }
      } else {
        navAuthPill.classList.remove('logged-in');
        navAuthPill.classList.add('logged-out');
        navAuthText.textContent = 'Masuk / Daftar';
        if (navAuthAvatar) {
          navAuthAvatar.innerHTML = `<i data-lucide="log-in"></i>`;
        }
      }
    }

    // 2. Hero Auth Card (Landing Page)
    const loggedOutCard = document.getElementById('hero-auth-logged-out');
    const loggedInCard = document.getElementById('hero-auth-logged-in');
    const heroUserName = document.getElementById('hero-user-name');
    const heroUserEmail = document.getElementById('hero-user-email');
    const heroUserAvatar = document.getElementById('hero-user-avatar');
    const heroUserRole = document.getElementById('hero-user-role');

    if (loggedOutCard && loggedInCard) {
      if (isLogged) {
        loggedOutCard.classList.add('hidden');
        loggedInCard.classList.remove('hidden');
        if (heroUserName) heroUserName.textContent = user.name || 'Pengguna';
        if (heroUserEmail) heroUserEmail.textContent = user.email || '';
        if (heroUserRole) heroUserRole.textContent = user.role === 'admin' ? 'Admin / Pemilik' : 'Kreator Terverifikasi';
        if (heroUserAvatar) {
          if (user.photoUrl) {
            heroUserAvatar.innerHTML = `<img src="${user.photoUrl}" alt="Avatar" class="hero-avatar-img" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;">`;
          } else {
            heroUserAvatar.innerHTML = `<i data-lucide="user"></i>`;
          }
        }
      } else {
        loggedOutCard.classList.remove('hidden');
        loggedInCard.classList.add('hidden');
      }
    }

    // 3. Landing page CTA button state
    const heroCtaBtn = document.getElementById('landing-main-cta');
    if (heroCtaBtn) {
      if (isLogged) {
        heroCtaBtn.innerHTML = `<i data-lucide="layout-dashboard"></i><span>Buka Form Builder</span>`;
        heroCtaBtn.onclick = () => { window.location.href = 'form.html#/dashboard'; };
      } else {
        heroCtaBtn.innerHTML = `<i data-lucide="arrow-right"></i><span>Mulai Buat Form Sekarang</span>`;
        heroCtaBtn.onclick = () => {
          const el = document.getElementById('hero-auth-container');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };
      }
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
}

// Global instance
window.authManager = new AuthManager();
