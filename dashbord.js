// ========== AUTH CHECK + USER DATA LOAD ==========
firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    // Kaunsa page hai uske hisaab se redirect karo
    const page = window.location.pathname;
    if (page.includes("s-dashbord")) {
      window.location.href = "s-login.html";
    } else {
      window.location.href = "j-login.html";
    }
    return;
  }

  try {
    const doc = await db.collection("users").doc(user.uid).get();

    if (!doc.exists) {
      console.error("No user data in Firestore!");
      return;
    }

    const data = doc.data();
    console.log("User data loaded:", data); // ← debug ke liye

    const fullName = data.fullName || user.displayName || "User";
    const firstName = fullName.split(" ")[0];
    const userRole = data.type || data.role || "";
    const interest = data.primaryInterest || data.expertise || "";

    // ===== SIDEBAR =====

    // Naam update karo
    const nameEl = document.querySelector(".user-details h4");
    if (nameEl) nameEl.textContent = fullName;

    // Role/type update karo
    const roleEl = document.querySelector(".user-details p");
    if (roleEl && userRole) roleEl.textContent = capitalize(userRole);

    // ===== HEADER =====

    // Welcome message
    const headerTitle = document.querySelector(".header-left h1");
    if (headerTitle) headerTitle.textContent = `Welcome, ${firstName}!`;

    // Subtitle
    const headerSub = document.querySelector(".header-left p");
    if (headerSub && interest) {
      headerSub.textContent = data.role === "senior"
        ? `Your expertise: ${capitalize(interest)}`
        : `Your focus: ${capitalize(interest)}`;
    }

  } catch (err) {
    console.error("User data load error:", err);
  }
});

// ========== LOGOUT ==========
document.querySelector(".logout")?.addEventListener("click", async (e) => {
  e.preventDefault();
  const page = window.location.pathname;
  await firebase.auth().signOut();
  if (page.includes("s-dashbord")) {
    window.location.href = "s-login.html";
  } else {
    window.location.href = "j-login.html";
  }
});

// ========== HELPER ==========
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}
