// Your Firebase configuration
// Replace with your own project's config
const firebaseConfig = {
  apiKey: "AIzaSyAtGGnQBptMwGJ74S0qzm8WZDotoPUDqaA",
  authDomain: "sinior-to-junior.firebaseapp.com",
  projectId: "sinior-to-junior",
  storageBucket: "sinior-to-junior.firebasestorage.app",
  messagingSenderId: "984394391505",
  appId: "1:984394391505:web:fa4e0e0f836aac3128caf0",
  measurementId: "G-84GE37REHY"
};;

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
