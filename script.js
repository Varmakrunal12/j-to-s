// ========== FIREBASE INIT CHECK ==========
// (firebase-config.js mein already init ho chuka hai)
// auth, db, googleProvider wahan se aa rahe hain

// ========== EMAIL LOGIN ==========
async function handleLogin(email, password, role) {
  try {
    const result = await auth.signInWithEmailAndPassword(email, password);
    const user = result.user;

    const doc = await db.collection("users").doc(user.uid).get();

    if (!doc.exists) {
      alert("User not found in database. Please register first.");
      await auth.signOut();
      return;
    }

    const userData = doc.data();

    // ✅ Role check - case insensitive fix
    const userRole = userData.role?.toLowerCase().trim();
    const expectedRole = role?.toLowerCase().trim();

    if (userRole !== expectedRole) {
      alert(`⚠️ This account is registered as '${userRole}'. Please use the correct login page.`);
      await auth.signOut();
      return;
    }

    // ✅ Redirect
    if (userRole === "junior") {
      window.location.href = "j-dashbord.html";
    } else {
      window.location.href = "s-dashbord.html";
    }

  } catch (error) {
    console.error("Login error:", error);
    console.log("Error code:", error.code); // ← yeh console mein dikhega

    if (
      error.code === "auth/user-not-found" ||
      error.code === "auth/invalid-credential" ||
      error.code === "auth/invalid-login-credentials" ||
      error.message?.includes("INVALID_LOGIN_CREDENTIALS")
    ) {
      alert("❌ Invalid email or password. Please check and try again.");
    } else if (error.code === "auth/wrong-password") {
      alert("❌ Wrong password. Please try again.");
    } else if (error.code === "auth/invalid-email") {
      alert("❌ Invalid email format.");
    } else if (error.code === "auth/too-many-requests") {
      alert("⚠️ Too many failed attempts. Please wait and try again.");
    } else {
      // ✅ Ab raw JSON nahi dikhega — clean message
      alert("❌ Login failed. Please check your email and password.");
    }
  }
}

// ========== EMAIL REGISTER ==========
async function handleRegister(userData, role) {
  try {
    const result = await auth.createUserWithEmailAndPassword(userData.email, userData.password);
    const user = result.user;

    // Firestore mein save karo
    await db.collection("users").doc(user.uid).set({
      fullName: userData.fullName,
      email: userData.email,
      role: role,
      type: userData.role || "",
      primaryInterest: userData.primaryInterest || "",
      expertise: userData.expertise || "",
      experience: userData.experience || "",
      bio: userData.bio || "",
      hourlyRate: userData.hourlyRate || "",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert("✅ Account created successfully! Please login.");

    // ✅ Login tab pe le jao aur email pre-fill karo
    const loginTab = document.querySelector('[data-tab="login"]');
    if (loginTab) loginTab.click();

    // Email field fill karo
    const loginEmailField =
      document.getElementById("loginEmail") ||
      document.getElementById("sLoginEmail");
    if (loginEmailField) loginEmailField.value = userData.email;

  } catch (error) {
    console.error("Register error:", error);

    if (error.code === "auth/email-already-in-use") {
      alert("⚠️ This email is already registered. Please login instead.");

      // ✅ Auto login tab pe bhejo + email fill karo
      const loginTab = document.querySelector('[data-tab="login"]');
      if (loginTab) loginTab.click();

      const loginEmailField =
        document.getElementById("loginEmail") ||
        document.getElementById("sLoginEmail");
      if (loginEmailField) loginEmailField.value = userData.email;

    } else if (error.code === "auth/weak-password") {
      alert("⚠️ Password must be at least 6 characters.");
    } else if (error.code === "auth/invalid-email") {
      alert("❌ Invalid email format.");
    } else {
      alert("❌ Registration failed: " + error.message);
    }
  }
}

// ========== GOOGLE LOGIN ==========
async function signInWithGoogle(role) {
  try {
    const result = await auth.signInWithPopup(googleProvider);
    const user = result.user;

    // Check karo user already hai ya naya hai
    const doc = await db.collection("users").doc(user.uid).get();

    if (!doc.exists) {
      // ✅ Naya user — Firestore mein save karo
      await db.collection("users").doc(user.uid).set({
        fullName: user.displayName || "",
        email: user.email,
        role: role,
        type: "",
        primaryInterest: "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      // ✅ Existing user — role check karo
      const userData = doc.data();
      if (userData.role !== role) {
        alert(`⚠️ This Google account is registered as '${userData.role}'. Please use the correct login page.`);
        await auth.signOut();
        return;
      }
    }

    // ✅ Redirect
    if (role === "junior") {
      window.location.href = "j-dashbord.html";
    } else {
      window.location.href = "s-dashbord.html";
    }

  } catch (error) {
    console.error("Google login error:", error);

    if (error.code === "auth/popup-closed-by-user") {
      // User ne popup band kiya — koi alert nahi
    } else if (error.code === "auth/popup-blocked") {
      alert("⚠️ Popup blocked by browser. Please allow popups and try again.");
    } else if (error.code === "auth/cancelled-popup-request") {
      // Multiple popup request — ignore
    } else {
      alert("❌ Google login failed. Please try again.");
    }
  }
}

// ========== AUTH STATE OBSERVER ==========
// Agar user already logged in hai toh seedha dashboard pe bhejo
auth.onAuthStateChanged(async (user) => {
  if (!user) return;

  const currentPage = window.location.pathname;

  // Sirf login pages pe redirect karo — dashboard pe nahi
  const isLoginPage =
    currentPage.includes("j-login") ||
    currentPage.includes("s-login") ||
    currentPage === "/" ||
    currentPage.includes("index");

  if (!isLoginPage) return;

  try {
    const doc = await db.collection("users").doc(user.uid).get();
    if (!doc.exists) return;

    const userData = doc.data();

    if (userData.role === "junior") {
      window.location.href = "j-dashbord.html";
    } else if (userData.role === "senior") {
      window.location.href = "s-dashbord.html";
    }
  } catch (err) {
    console.error("Auth state check error:", err);
  }
});
