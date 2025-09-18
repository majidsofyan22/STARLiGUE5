
// Firebase config - using CDN globals
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyANQbFWRlw7qnt44aLgY6OlYSeJTc_Y-9o",
  authDomain: "newproject-3bd37.firebaseapp.com",
  databaseURL: "https://newproject-3bd37-default-rtdb.firebaseio.com",
  projectId: "newproject-3bd37",
  storageBucket: "newproject-3bd37.appspot.com",
  messagingSenderId: "390568221455",
  appId: "1:390568221455:web:a5ce39d5c50059b58afc7a"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database().ref();
const storage = firebase.storage().ref();
const auth = firebase.auth();

// Expose to window for classic scripts (loaded after this file)
window.firebaseApp = app;
window.firebaseDB = database;
window.firebaseStorage = storage;
window.firebaseAuth = auth;

// Database helpers
window.dbRef = (path) => firebase.database().ref(path);
window.dbPush = (path, data) => firebase.database().ref(path).push(data);
window.dbSet = (path, data) => firebase.database().ref(path).set(data);
window.dbGet = (path) => firebase.database().ref(path).once('value');
window.dbOnValue = (path, cb) => firebase.database().ref(path).on('value', cb);
window.dbUpdate = (path, values) => firebase.database().ref(path).update(values);
window.dbRemove = (path) => firebase.database().ref(path).remove();

// Storage helpers
window.storageRef = (path) => firebase.storage().ref(path);
window.dataURLToBlob = (dataUrl) => {
  const parts = String(dataUrl || '').split(',');
  const header = parts[0] || '';
  const base64 = parts[1] || '';
  const m = /^data:(.*?);base64$/i.exec(header);
  const mime = m ? m[1] : 'application/octet-stream';
  const bin = atob(base64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for(let i=0;i<len;i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};
window.uploadDataURL = async (path, dataUrl, metadata={}) => {
  const blob = window.dataURLToBlob(dataUrl);
  await firebase.storage().ref(path).put(blob, metadata);
  return await firebase.storage().ref(path).getDownloadURL();
};
window.uploadFile = async (path, file, metadata={}) => {
  await firebase.storage().ref(path).put(file, metadata);
  return await firebase.storage().ref(path).getDownloadURL();
};
window.deleteFromStorage = async (path) => firebase.storage().ref(path).delete();

// Auth helpers
window.authSignIn = (email, password) => firebase.auth().signInWithEmailAndPassword(email, password);
window.authSignOut = () => firebase.auth().signOut();
window.onAuthChanged = (cb) => firebase.auth().onAuthStateChanged(cb);
window.authCreateUser = (email, password) => firebase.auth().createUserWithEmailAndPassword(email, password);

// Global license generator (shared across all sources)
window.generateLicenseNumber = async function(teamId){
  const year = new Date().getFullYear();
  const teamPart = String(teamId||'').padStart(3,'0').slice(-3);
  async function exists(code){
    try{
      if(window.dbGet){
        const snap = await window.dbGet('licenseIndex/' + encodeURIComponent(String(code)));
        if(snap && snap.exists()) return true;
      }
    }catch{}
    try{
      const idx = JSON.parse(localStorage.getItem('sl_license_index')||'{}');
      if(idx && Object.prototype.hasOwnProperty.call(idx, String(code))) return true;
    }catch{}
    try{
      const arr = JSON.parse(localStorage.getItem('sl_players')||'[]');
      if(Array.isArray(arr) && arr.some(p=> String(p?.licenseNumber||'') === String(code))) return true;
    }catch{}
    return false;
  }
  let attempts = 0;
  while(attempts < 120){
    const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(2,7);
    const code = `LIC-${year}-${teamPart}-${rand}`;
    if(!(await exists(code))) return code;
    attempts++;
  }
  // Fallback if all attempts failed
  return `LIC-${year}-${teamPart}-${Date.now().toString(36).toUpperCase().slice(-5)}`;
};

// Signal readiness for classic scripts
window.firebaseReady = true;
document.dispatchEvent(new Event('firebase-ready'));

// Public base URL for QR links (prefer explicit override; otherwise auto-detect current host/app path)
// Tip: to force QR links to your production host, uncomment and set the line below, e.g.:
// window.PUBLIC_BASE_URL_OVERRIDE = 'https://your-domain.com/app/';
(function(){
  try{
    const override = (window.PUBLIC_BASE_URL_OVERRIDE || '').trim();
    if(override){
      const normalized = override.endsWith('/') ? override : (override + '/');
      window.PUBLIC_BASE_URL = normalized;
      return;
    }
    const loc = window.location;
    const path = String(loc.pathname || '');
    // Attempt to detect '/app/' subfolder; if not found, use current folder as base
    const idx = path.toLowerCase().lastIndexOf('/app/');
    const base = (idx !== -1)
      ? (loc.origin + path.slice(0, idx + 5))
      : (new URL('./', loc.href).toString());
    window.PUBLIC_BASE_URL = base.endsWith('/') ? base : (base + '/');
  }catch{
    // Fallback: let pages compute relative URL if detection fails
    window.PUBLIC_BASE_URL = '';
  }
})();

// After Firebase is ready, try to load site.publicBaseUrl from DB and apply as override
(async function(){
  try{
    if(window.dbGet){
      const snap = await window.dbGet('site');
      if(snap && snap.exists()){
        const site = snap.val() || {};
        const raw = String(site.publicBaseUrl || '').trim();
        if(raw){
          const normalized = raw.endsWith('/') ? raw : (raw + '/');
          window.PUBLIC_BASE_URL_OVERRIDE = normalized;
          window.PUBLIC_BASE_URL = normalized;
        }
      }
    }
  }catch{}
})();

// EmailJS client config (fill these to enable auto emails from admin decisions)
// You can get these from https://dashboard.emailjs.com/
window.emailjsConfig = {
  serviceId: 'service_kmg5ssx',
  templateId: 'template_mjb9bo6',
  publicKey: 'V0AeThrEZLu_VvIpG',
  fromEmail: 'championnatstarsleague@gmail.com' // used as CC for admin notifications
};