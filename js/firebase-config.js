/**
 * FORMCRAFT - Firebase Configuration
 * Firebase Configuration File
 * Fixed cloud configuration for formGenerator-IskakFatoni.
 */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCJAcQeuI1XznZm7KVceD_PsQSWHTrs83c",
  authDomain: "form-iskakfatoni.firebaseapp.com",
  projectId: "form-iskakfatoni",
  storageBucket: "form-iskakfatoni.firebasestorage.app",
  messagingSenderId: "197414743539",
  appId: "1:197414743539:web:280506f8c468306c40f686",
  measurementId: "G-PYNCN6Y2H5"
};

class FirebaseManager {
  constructor() {
    this.db = null;
    this.app = null;
    this.auth = null;
    this.config = FIREBASE_CONFIG;
    this.isConfigured = false;
    this.initFirebase();
  }

  initFirebase() {
    try {
      if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) {
          this.app = firebase.initializeApp(this.config);
        } else {
          this.app = firebase.app();
        }
        this.db = firebase.firestore();
        if (typeof firebase.auth === 'function') {
          this.auth = firebase.auth();
        }
        if (typeof firebase.storage === 'function') {
          this.storage = firebase.storage();
        }
        this.isConfigured = true;
        this.updateStatusUI(true);
        console.log('Firebase Cloud Firestore, Auth & Storage aktif untuk project:', this.config.projectId);
        return true;
      }
    } catch (error) {
      console.error('Inisialisasi Firebase gagal:', error);
      this.isConfigured = false;
      this.updateStatusUI(false);
      return false;
    }
    return false;
  }

  updateStatusUI(isOnline) {
    const badge = document.getElementById('btn-db-status');
    const text = document.getElementById('db-status-text');
    if (!badge || !text) return;

    if (isOnline) {
      badge.className = 'status-badge status-firebase';
      text.textContent = 'Cloud Terhubung';
      badge.title = `Terkoneksi ke Cloud Database Aktif`;
    } else {
      badge.className = 'status-badge status-local';
      text.textContent = 'Offline';
      badge.title = 'Koneksi database offline';
    }
  }
}

// Global instance
window.firebaseManager = new FirebaseManager();
