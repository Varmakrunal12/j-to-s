// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCIqumBlbeRHFAWc6NtEFgVhnAMrr6X80c",
  authDomain: "j-to-s-51c86.firebaseapp.com",
  projectId: "j-to-s-51c86",                          // ✅ comma add kiya
  storageBucket: "j-to-s-51c86.firebasestorage.app",
  messagingSenderId: "376438283237",
  appId: "1:376438283237:web:11ca777eec9a1747936d0c",
  measurementId: "G-1MQCVVTS6P"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();                          // ✅ pehle define karo
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider(); // ✅ Google login ke liye

console.log("Firebase initialized!", auth);            // ✅ ab use karo
