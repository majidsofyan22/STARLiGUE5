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

// Signal readiness for classic scripts
window.firebaseReady = true;
document.dispatchEvent(new Event('firebase-ready'));