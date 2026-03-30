// Wait for Firebase auth state
firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    // Logged in nahi hai → login page pe bhejo
    window.location.href = 'j-login.html';
    return;
  }

  // Firestore se user data fetch karo
  try {
    const doc = await firebase.firestore()
      .collection('users')
      .doc(user.uid)
      .get();

    if (doc.exists) {
      const data = doc.data();

      // Sidebar mein naam update karo
      const userNameEl = document.querySelector('.user-details h4');
      if (userNameEl) userNameEl.textContent = data.fullName || user.displayName || 'User';

      // Sidebar mein role update karo
      const userRoleEl = document.querySelector('.user-details p');
      if (userRoleEl) userRoleEl.textContent = data.role || 'Junior';

      // Header welcome message update karo
      const headerTitle = document.querySelector('.header-left h1');
      if (headerTitle) headerTitle.textContent = `Welcome, ${data.fullName?.split(' ')[0] || 'User'}!`;
    } else {
      // Firestore mein data nahi hai → auth name use karo
      const userNameEl = document.querySelector('.user-details h4');
      if (userNameEl) userNameEl.textContent = user.displayName || user.email;

      const headerTitle = document.querySelector('.header-left h1');
      if (headerTitle) headerTitle.textContent = `Welcome, ${user.displayName || 'User'}!`;
    }
  } catch (err) {
    console.error('Error loading user data:', err);
  }
});

// Logout button
document.querySelector('.logout')?.addEventListener('click', async (e) => {
  e.preventDefault();
  await firebase.auth().signOut();
  window.location.href = 'j-login.html';
});
