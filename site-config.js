/**
 * Site + cloud account configuration.
 * Website is hosted on GitHub Pages.
 * User ledgers are private in Firebase (each account only sees its own data).
 */
window.KHATA_CONFIG = {
  websiteUrl: "https://madadkhan11111.github.io/KHATA-/",
  desktopDownloadUrl: null,

  // Paste your Firebase web config here (Firebase Console → Project settings → Your apps)
  firebase: {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  }
};
