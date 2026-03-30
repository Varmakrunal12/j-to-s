// ========== EMAIL LOGIN ==========
async function handleLogin(email, password, role) {
  try {
    const result = await auth.signInWithEmailAndPassword(email, password);
    const user = result.user;

    // Firestore se user ka role check karo
    const doc = await db.collection("users").doc(user.uid).get();

    if (!doc.exists) {
      alert("User not found in database. Please register first.");
      await auth.signOut();
      return;
    }

    const userData = doc.data();

    if (userData.role !== role) {
      alert(`This account is registered as '${userData.role}', not '${role}'. Please use the correct login page.`);
      await auth.signOut();
      return;
    }

    // Redirect
    if (role === "junior") {
      window.location.href = "j-dashbord.html";
    } else {
      window.location.href = "s-dashbord.html";
    }

  } catch (error) {
    console.error("Login error:", error);
    if (error.code === "auth/user-not-found") {
      alert("No account found with this email. Please register first.");
    } else if (error.code === "auth/wrong-password") {
      alert("Wrong password. Please try again.");
    } else if (error.code === "auth/invalid-email") {
      alert("Invalid email format.");
    } else {
      alert("Login failed: " + error.message);
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
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert("Account created successfully! Please login.");

    // Register ke baad login tab pe le jao
    document.querySelector('[data-tab="login"]').click();

  } catch (error) {
    console.error("Register error:", error);
    if (error.code === "auth/email-already-in-use") {
      alert("This email is already registered. Please login instead.");
    } else if (error.code === "auth/weak-password") {
      alert("Password must be at least 6 characters.");
    } else if (error.code === "auth/invalid-email") {
      alert("Invalid email format.");
    } else {
      alert("Registration failed: " + error.message);
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
      // Naya user — Firestore mein save karo
      await db.collection("users").doc(user.uid).set({
        fullName: user.displayName,
        email: user.email,
        role: role,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    // Redirect
    if (role === "junior") {
      window.location.href = "j-dashbord.html";
    } else {
      window.location.href = "s-dashbord.html";
    }

  } catch (error) {
    console.error("Google login error:", error);
    if (error.code === "auth/popup-closed-by-user") {
      // User ne popup band kiya — koi alert nahi
    } else {
      alert("Google login failed: " + error.message);
    }
  }
}
