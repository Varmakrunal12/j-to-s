// Your Firebase configuration
console.log("Firebase initialized!", auth);
// Replace with your own project's config
const firebaseConfig = {
  apiKey:"AIzaSyCIqumBlbeRHFAWc6NtEFgVhnAMrr6X80c",
  authDomain:  "j-to-s-51c86.firebaseapp.com",
  projectId: "j-to-s-51c86"
  storageBucket: "j-to-s-51c86.firebasestorage.app",
  messagingSenderId: "376438283237",
  appId: "1:376438283237:web:11ca777eec9a1747936d0c",
  measurementId: "G-1MQCVVTS6P"
};;

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
