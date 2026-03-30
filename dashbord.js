// ========== AUTH CHECK + USER DATA LOAD ==========
firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "j-login.html";
    return;
  }

  try {
    const doc = await db.collection("users").doc(user.uid).get();

    if (doc.exists) {
      const data = doc.data();

      const fullName = data.fullName || user.displayName || "User";
      const firstName = fullName.split(" ")[0];
      const role = data.type || data.role || "Junior";
      const interest = data.primaryInterest || "";

      // Sidebar — naam
      const nameEl = document.querySelector(".user-details h4");
      if (nameEl) nameEl.textContent = fullName;

      // Sidebar — role
      const roleEl = document.querySelector(".user-details p");
      if (roleEl) roleEl.textContent = capitalize(role);

      // Header — welcome
      const headerTitle = document.querySelector(".header-left h1");
      if (headerTitle) headerTitle.textContent = `Welcome, ${firstName}!`;

      // Header — subtitle
      const headerSub = document.querySelector(".header-left p");
      if (headerSub && interest) {
        headerSub.textContent = `Your focus: ${capitalize(interest)}`;
      }
    }
  } catch (err) {
    console.error("User data load error:", err);
  }
});

// ========== LOGOUT ==========
document.querySelector(".logout")?.addEventListener("click", async (e) => {
  e.preventDefault();
  await firebase.auth().signOut();
  window.location.href = "j-login.html";
});

// ========== HELPER ==========
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ========== FIND EXPERT BUTTON ==========
document.getElementById("findExpertBtn")?.addEventListener("click", () => {
  // Aap baad mein yahan expert search page ka link daal sakte ho
  alert("Expert search coming soon!");
});
