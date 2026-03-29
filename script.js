// Common Firebase functions for login/register pages

// Check authentication state for protected pages
function checkAuth(redirectIfNotLoggedIn = true, expectedUserType = null) {
    return new Promise((resolve) => {
        auth.onAuthStateChanged(user => {
            if (user) {
                // User is signed in
                db.collection('users').doc(user.uid).get().then(doc => {
                    if (doc.exists) {
                        const userData = doc.data();
                        localStorage.setItem('wisdomBridgeUserType', userData.userType);
                        localStorage.setItem('wisdomBridgeUserName', userData.fullName);
                        localStorage.setItem('wisdomBridgeUserId', user.uid);
                        if (expectedUserType && userData.userType !== expectedUserType) {
                            // Redirect to correct dashboard
                            const redirectUrl = userData.userType === 'senior' ? 's-dashbord.html' : 'j-dashbord.html';
                            window.location.href = redirectUrl;
                        } else {
                            resolve(user);
                        }
                    } else {
                        // Should not happen, but sign out
                        auth.signOut();
                        if (redirectIfNotLoggedIn) window.location.href = 'index.html';
                        resolve(null);
                    }
                });
            } else {
                if (redirectIfNotLoggedIn) window.location.href = 'index.html';
                resolve(null);
            }
        });
    });
}

// Common function to show alerts (used across pages)
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `custom-alert alert-${type}`;
    alertDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px;">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
            <button class="alert-close" style="margin-left: auto; background: none; border: none; cursor: pointer;"><i class="fas fa-times"></i></button>
        </div>
    `;
    alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#2ecc71' : type === 'error' ? '#e74c3c' : '#3498db'};
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        z-index: 10000;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        animation: slideInRight 0.3s ease;
    `;
    document.body.appendChild(alertDiv);
    const closeBtn = alertDiv.querySelector('.alert-close');
    closeBtn.onclick = () => alertDiv.remove();
    setTimeout(() => alertDiv.remove(), 5000);
}

// Login form handler (for both junior and senior)
async function handleLogin(email, password, userType) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        // Get user data from Firestore
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) {
            throw new Error('User data not found');
        }
        const userData = userDoc.data();
        if (userData.userType !== userType) {
            throw new Error(`You are registered as ${userData.userType}. Please login from the correct portal.`);
        }
        localStorage.setItem('wisdomBridgeUserType', userData.userType);
        localStorage.setItem('wisdomBridgeUserName', userData.fullName);
        localStorage.setItem('wisdomBridgeUserId', user.uid);
        showAlert('Login successful!', 'success');
        // Redirect to appropriate dashboard
        const redirectUrl = userData.userType === 'senior' ? 's-dashbord.html' : 'j-dashbord.html';
        setTimeout(() => {
            window.location.href = redirectUrl;
        }, 1500);
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Registration handler (for both junior and senior)
async function handleRegister(userData, userType) {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(userData.email, userData.password);
        const user = userCredential.user;
        // Store additional user info in Firestore
        const userDoc = {
            uid: user.uid,
            email: userData.email,
            fullName: userData.fullName,
            userType: userType,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        if (userType === 'junior') {
            userDoc.role = userData.role; // e.g., startup, student
            userDoc.primaryInterest = userData.primaryInterest;
        } else if (userType === 'senior') {
            userDoc.experience = userData.experience;
            userDoc.industry = userData.industry;
            userDoc.specialization = userData.specialization;
            userDoc.hourlyRate = userData.hourlyRate;
            userDoc.bio = userData.bio;
            userDoc.availability = true; // available by default
        }
        await db.collection('users').doc(user.uid).set(userDoc);
        localStorage.setItem('wisdomBridgeUserType', userType);
        localStorage.setItem('wisdomBridgeUserName', userData.fullName);
        localStorage.setItem('wisdomBridgeUserId', user.uid);
        showAlert('Registration successful! Redirecting...', 'success');
        const redirectUrl = userType === 'senior' ? 's-dashbord.html' : 'j-dashbord.html';
        setTimeout(() => {
            window.location.href = redirectUrl;
        }, 1500);
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Logout function
function logout() {
    auth.signOut().then(() => {
        localStorage.clear();
        window.location.href = 'index.html';
    }).catch(error => {
        showAlert('Error logging out: ' + error.message, 'error');
    });
}