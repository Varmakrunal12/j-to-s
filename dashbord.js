// dashboard.js - Firebase Integration
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        currentUser = user;
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) {
            await auth.signOut();
            window.location.href = 'index.html';
            return;
        }
        const userData = userDoc.data();
        const isSenior = userData.userType === 'senior';
        const expectedPage = isSenior ? 's-dashbord.html' : 'j-dashbord.html';
        if (!window.location.pathname.includes(expectedPage)) {
            window.location.href = expectedPage;
            return;
        }
        updateUserUI(userData);
        if (isSenior) {
            initSeniorDashboard(user.uid);
        } else {
            initJuniorDashboard(user.uid);
        }
        initCommonFeatures();
    });
});

function updateUserUI(userData) {
    const welcomeH1 = document.querySelector('.header-left h1');
    if (welcomeH1) {
        const firstName = userData.fullName.split(' ')[0];
        welcomeH1.innerHTML = `Welcome, ${firstName}!`;
    }
    const userNameElements = document.querySelectorAll('.user-details h4');
    userNameElements.forEach(el => el.textContent = userData.fullName);
    const userTypeElements = document.querySelectorAll('.user-details p:first-child');
    if (userTypeElements.length) {
        userTypeElements[0].textContent = userData.userType === 'senior' ? 
            (userData.specialization || 'Senior Expert') : 
            (userData.role || 'Junior Member');
    }
    if (userData.userType === 'senior') {
        const statusSpan = document.querySelector('.status');
        if (statusSpan) {
            const isAvailable = userData.availability !== false;
            statusSpan.textContent = isAvailable ? '● Available' : '● Busy';
            statusSpan.className = `status ${isAvailable ? 'active' : 'busy'}`;
        }
        const toggleSwitch = document.querySelector('.switch input');
        if (toggleSwitch) {
            toggleSwitch.checked = userData.availability !== false;
        }
    }
}

// ==================== JUNIOR DASHBOARD ====================
async function initJuniorDashboard(userId) {
    loadUpcomingSessions(userId, 'junior');
    loadRecommendedExperts();
    const findExpertBtn = document.getElementById('findExpertBtn');
    if (findExpertBtn) findExpertBtn.onclick = () => showExpertSearchModal();
    window.searchCategory = (category) => {
        showAlert(`Searching for experts in ${category}...`, 'info');
        showExpertSearchModal(category);
    };
    loadJuniorStats(userId);
    db.collection('sessions').where('juniorId', '==', userId)
        .onSnapshot(() => {
            loadUpcomingSessions(userId, 'junior');
            loadJuniorStats(userId);
        });
}

async function loadJuniorStats(userId) {
    const sessionsSnapshot = await db.collection('sessions')
        .where('juniorId', '==', userId)
        .get();
    const totalSessions = sessionsSnapshot.size;
    let totalSpent = 0;
    sessionsSnapshot.forEach(doc => {
        totalSpent += doc.data().amount || 0;
    });
    const upcoming = await db.collection('sessions')
        .where('juniorId', '==', userId)
        .where('status', '==', 'scheduled')
        .get();
    const upcomingCount = upcoming.size;
    const stats = document.querySelectorAll('.stat-card');
    if (stats.length >= 4) {
        stats[0].querySelector('.stat-info h3').textContent = totalSessions;
        stats[1].querySelector('.stat-info h3').textContent = '4.8';
        stats[2].querySelector('.stat-info h3').textContent = `₹${totalSpent}`;
        stats[3].querySelector('.stat-info h3').textContent = upcomingCount;
    }
}

async function loadUpcomingSessions(userId, userType) {
    const sessionsList = document.querySelector('.sessions-list');
    if (!sessionsList) return;
    const sessionsSnapshot = await db.collection('sessions')
        .where(userType === 'junior' ? 'juniorId' : 'seniorId', '==', userId)
        .where('status', '==', 'scheduled')
        .orderBy('dateTime', 'asc')
        .get();
    if (sessionsSnapshot.empty) {
        sessionsList.innerHTML = '<p style="text-align: center; padding: 40px;">No upcoming sessions</p>';
        return;
    }
    sessionsList.innerHTML = '';
    sessionsSnapshot.forEach(doc => {
        const data = doc.data();
        const sessionCard = createSessionCard(data, userType, doc.id);
        sessionsList.appendChild(sessionCard);
    });
}

function createSessionCard(session, userType, sessionId) {
    const div = document.createElement('div');
    div.className = 'session-card';
    const otherPerson = userType === 'junior' ? session.seniorName : session.juniorName;
    div.innerHTML = `
        <div class="session-info">
            <div class="expert-avatar">
                <i class="fas fa-${userType === 'junior' ? 'user-tie' : 'user-graduate'}"></i>
            </div>
            <div>
                <h4>${session.topic}</h4>
                <p>With ${otherPerson}</p>
                <span class="badge badge-primary">${session.category || 'General'}</span>
            </div>
        </div>
        <div class="session-time">
            <p><i class="fas fa-calendar"></i> ${new Date(session.dateTime).toLocaleString()}</p>
            <p><i class="fas fa-clock"></i> ${session.duration} minutes</p>
        </div>
        <div class="session-actions">
            <button class="btn btn-outline reschedule">Reschedule</button>
            <button class="btn btn-primary join">Join Now</button>
        </div>
    `;
    const joinBtn = div.querySelector('.join');
    joinBtn.addEventListener('click', () => {
        showAlert('Opening video call...', 'info');
    });
    const rescheduleBtn = div.querySelector('.reschedule');
    rescheduleBtn.addEventListener('click', () => {
        const newTime = prompt('Enter new date and time (YYYY-MM-DD HH:MM):');
        if (newTime) {
            const newDateTime = new Date(newTime);
            if (isNaN(newDateTime)) {
                showAlert('Invalid date format', 'error');
                return;
            }
            db.collection('sessions').doc(sessionId).update({
                dateTime: newDateTime.toISOString()
            }).then(() => showAlert('Session rescheduled', 'success'))
              .catch(err => showAlert('Error: ' + err.message, 'error'));
        }
    });
    return div;
}

async function loadRecommendedExperts(category = null) {
    const expertsGrid = document.querySelector('.experts-grid');
    if (!expertsGrid) return;
    const snapshot = await db.collection('users').where('userType', '==', 'senior').get();
    let experts = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        if (category && data.specialization && !data.specialization.toLowerCase().includes(category.toLowerCase())) {
            return;
        }
        experts.push({ id: doc.id, ...data });
    });
    if (experts.length === 0) {
        expertsGrid.innerHTML = '<p style="text-align: center; padding: 40px;">No experts found</p>';
        return;
    }
    expertsGrid.innerHTML = '';
    experts.forEach(expert => {
        const card = createExpertCard(expert);
        expertsGrid.appendChild(card);
    });
}

function createExpertCard(expert) {
    const div = document.createElement('div');
    div.className = 'expert-card';
    div.innerHTML = `
        <div class="expert-header">
            <div class="expert-avatar">
                <i class="fas fa-user-tie"></i>
            </div>
            <div>
                <h4>${expert.fullName}</h4>
                <p>${expert.specialization || 'Expert'}</p>
                <div class="rating">
                    <i class="fas fa-star"></i> 4.9 (${expert.ratingCount || 0} reviews)
                </div>
            </div>
        </div>
        <div class="expert-info">
            <p><i class="fas fa-briefcase"></i> ${expert.experience || 'N/A'} years experience</p>
            <p><i class="fas fa-rupee-sign"></i> ₹${expert.hourlyRate || '0'}/hour</p>
            <p><i class="fas fa-tags"></i> ${expert.industry || 'General'}</p>
        </div>
        <button class="btn btn-primary btn-block book-session" data-expert-id="${expert.id}" data-expert-name="${expert.fullName}">Book Session</button>
    `;
    const bookBtn = div.querySelector('.book-session');
    bookBtn.addEventListener('click', () => showBookingModal(expert.id, expert.fullName));
    return div;
}

function showBookingModal(expertId, expertName) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content animate-slide-up" style="max-width: 500px;">
            <span class="close-modal">&times;</span>
            <h2>Book Session with ${expertName}</h2>
            <form id="bookingForm">
                <div class="form-group">
                    <label>Topic</label>
                    <input type="text" id="topic" placeholder="What do you want to discuss?" required>
                </div>
                <div class="form-group">
                    <label>Date & Time</label>
                    <input type="datetime-local" id="datetime" required>
                </div>
                <div class="form-group">
                    <label>Duration (minutes)</label>
                    <select id="duration" required>
                        <option value="30">30</option>
                        <option value="60">60</option>
                        <option value="90">90</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary btn-block">Send Request</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    const close = modal.querySelector('.close-modal');
    close.onclick = () => {
        modal.remove();
        document.body.style.overflow = 'auto';
    };
    const form = modal.querySelector('#bookingForm');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const topic = document.getElementById('topic').value;
        const datetime = document.getElementById('datetime').value;
        const duration = document.getElementById('duration').value;
        if (!topic || !datetime || !duration) {
            showAlert('Please fill all fields', 'error');
            return;
        }
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        try {
            const seniorDoc = await db.collection('users').doc(expertId).get();
            if (!seniorDoc.exists) throw new Error('Expert not found');
            const seniorData = seniorDoc.data();
            await db.collection('session_requests').add({
                seniorId: expertId,
                seniorName: seniorData.fullName,
                juniorId: currentUser.uid,
                juniorName: localStorage.getItem('wisdomBridgeUserName'),
                topic: topic,
                dateTime: new Date(datetime).toISOString(),
                duration: parseInt(duration),
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showAlert('Request sent successfully!', 'success');
            modal.remove();
            document.body.style.overflow = 'auto';
        } catch (error) {
            showAlert('Error: ' + error.message, 'error');
        } finally {
            submitBtn.disabled = false;
        }
    };
    // Set min datetime to now
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('datetime').min = now.toISOString().slice(0, 16);
}

function showExpertSearchModal(category = null) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content animate-slide-up" style="max-width: 700px;">
            <span class="close-modal">&times;</span>
            <h2 style="margin-bottom: 25px;">Find Your Expert</h2>
            <div style="position: relative; margin-bottom: 30px;">
                <input type="text" id="expertSearchInput" 
                    placeholder="Search by skill, industry, or name..." 
                    style="width: 100%; padding: 18px 50px 18px 25px; 
                           border: 2px solid #e0e0e0; border-radius: 15px;
                           font-size: 1.1rem;">
                <i class="fas fa-search" style="position: absolute; right: 25px; 
                    top: 50%; transform: translateY(-50%); color: #666; font-size: 1.2rem;"></i>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); 
                 gap: 15px; margin: 25px 0;">
                <button class="btn btn-outline" data-category="business">Business</button>
                <button class="btn btn-outline" data-category="technology">Technology</button>
                <button class="btn btn-outline" data-category="finance">Finance</button>
                <button class="btn btn-outline" data-category="marketing">Marketing</button>
                <button class="btn btn-outline" data-category="career">Career</button>
            </div>
            <div id="searchResults" style="margin-top: 30px; max-height: 400px; overflow-y: auto;">
                <div style="text-align: center; padding: 40px;">Loading experts...</div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    const close = modal.querySelector('.close-modal');
    close.onclick = () => {
        modal.remove();
        document.body.style.overflow = 'auto';
    };
    window.onclick = (e) => {
        if (e.target === modal) {
            modal.remove();
            document.body.style.overflow = 'auto';
        }
    };
    async function loadExperts(categoryFilter = null) {
        const resultsDiv = modal.querySelector('#searchResults');
        resultsDiv.innerHTML = '<div style="text-align: center; padding: 40px;">Loading...</div>';
        const snapshot = await db.collection('users').where('userType', '==', 'senior').get();
        let experts = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (categoryFilter && data.specialization && !data.specialization.toLowerCase().includes(categoryFilter.toLowerCase())) {
                return;
            }
            experts.push({ id: doc.id, ...data });
        });
        if (experts.length === 0) {
            resultsDiv.innerHTML = '<p style="text-align: center; padding: 40px;">No experts found</p>';
            return;
        }
        resultsDiv.innerHTML = '';
        experts.forEach(expert => {
            const card = createExpertCard(expert);
            resultsDiv.appendChild(card);
        });
    }
    loadExperts(category);
    const searchInput = modal.querySelector('#expertSearchInput');
    searchInput.addEventListener('input', async () => {
        const searchTerm = searchInput.value.toLowerCase();
        const snapshot = await db.collection('users').where('userType', '==', 'senior').get();
        let experts = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.fullName.toLowerCase().includes(searchTerm) ||
                (data.specialization && data.specialization.toLowerCase().includes(searchTerm)) ||
                (data.industry && data.industry.toLowerCase().includes(searchTerm))) {
                experts.push({ id: doc.id, ...data });
            }
        });
        const resultsDiv = modal.querySelector('#searchResults');
        if (experts.length === 0) {
            resultsDiv.innerHTML = '<p style="text-align: center; padding: 40px;">No experts found</p>';
            return;
        }
        resultsDiv.innerHTML = '';
        experts.forEach(expert => {
            const card = createExpertCard(expert);
            resultsDiv.appendChild(card);
        });
    });
    const catButtons = modal.querySelectorAll('[data-category]');
    catButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const cat = btn.getAttribute('data-category');
            loadExperts(cat);
        });
    });
}

// ==================== SENIOR DASHBOARD ====================
async function initSeniorDashboard(userId) {
    loadSeniorSchedule(userId);
    loadRecentSessions(userId);
    loadPendingRequests(userId);
    loadSeniorStats(userId);
    db.collection('session_requests').where('seniorId', '==', userId)
        .where('status', '==', 'pending')
        .onSnapshot(() => loadPendingRequests(userId));
    db.collection('sessions').where('seniorId', '==', userId)
        .onSnapshot(() => {
            loadSeniorSchedule(userId);
            loadRecentSessions(userId);
            loadSeniorStats(userId);
        });
    const toggle = document.querySelector('.switch input');
    if (toggle) {
        toggle.addEventListener('change', async (e) => {
            const availability = e.target.checked;
            await db.collection('users').doc(userId).update({ availability });
            const statusSpan = document.querySelector('.status');
            if (statusSpan) {
                statusSpan.textContent = availability ? '● Available' : '● Busy';
                statusSpan.className = `status ${availability ? 'active' : 'busy'}`;
            }
        });
    }
}

async function loadSeniorSchedule(userId) {
    const scheduleList = document.querySelector('.schedule-list');
    if (!scheduleList) return;
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const snapshot = await db.collection('sessions')
        .where('seniorId', '==', userId)
        .where('dateTime', '>=', today)
        .where('dateTime', '<', tomorrow)
        .where('status', '==', 'scheduled')
        .orderBy('dateTime', 'asc')
        .get();
    if (snapshot.empty) {
        scheduleList.innerHTML = '<p style="text-align: center; padding: 40px;">No sessions today</p>';
        return;
    }
    scheduleList.innerHTML = '';
    snapshot.forEach(doc => {
        const session = doc.data();
        const item = createScheduleItem(session, doc.id);
        scheduleList.appendChild(item);
    });
}

function createScheduleItem(session, sessionId) {
    const div = document.createElement('div');
    div.className = 'schedule-item';
    const time = new Date(session.dateTime);
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `
        <div class="schedule-time">
            <h3>${timeStr}</h3>
            <p>${session.duration} mins</p>
        </div>
        <div class="schedule-details">
            <h4>${session.topic}</h4>
            <p>With ${session.juniorName}</p>
            <span class="badge badge-primary">${session.category || 'General'}</span>
        </div>
        <div class="schedule-actions">
            <button class="btn btn-outline details">Details</button>
            <button class="btn btn-secondary start">Start</button>
        </div>
    `;
    const detailsBtn = div.querySelector('.details');
    detailsBtn.onclick = () => showAlert(`Session: ${session.topic}\nWith: ${session.juniorName}\nTime: ${time.toLocaleString()}`, 'info');
    const startBtn = div.querySelector('.start');
    startBtn.onclick = () => {
        showAlert('Starting video session...', 'success');
    };
    return div;
}

async function loadRecentSessions(userId) {
    const tableBody = document.querySelector('.data-table tbody');
    if (!tableBody) return;
    const snapshot = await db.collection('sessions')
        .where('seniorId', '==', userId)
        .orderBy('dateTime', 'desc')
        .limit(5)
        .get();
    tableBody.innerHTML = '';
    snapshot.forEach(doc => {
        const session = doc.data();
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${new Date(session.dateTime).toLocaleDateString()}</td>
            <td>${session.juniorName}</td>
            <td>${session.topic}</td>
            <td>${session.duration} mins</td>
            <td>₹${session.amount || 0}</td>
            <td><span class="rating-badge">${session.rating || 'N/A'}</span></td>
        `;
        tableBody.appendChild(row);
    });
}

async function loadPendingRequests(userId) {
    const requestsGrid = document.querySelector('.requests-grid');
    if (!requestsGrid) return;
    const snapshot = await db.collection('session_requests')
        .where('seniorId', '==', userId)
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .get();
    if (snapshot.empty) {
        requestsGrid.innerHTML = '<p style="text-align: center; padding: 40px;">No pending requests</p>';
        return;
    }
    requestsGrid.innerHTML = '';
    snapshot.forEach(doc => {
        const request = doc.data();
        const card = createRequestCard(request, doc.id);
        requestsGrid.appendChild(card);
    });
}

function createRequestCard(request, requestId) {
    const div = document.createElement('div');
    div.className = 'request-card';
    const dateTime = new Date(request.dateTime);
    div.innerHTML = `
        <div class="request-header">
            <div class="junior-avatar">
                <i class="fas fa-user-graduate"></i>
            </div>
            <div>
                <h4>${request.juniorName}</h4>
                <p>${request.juniorRole || 'Junior'}</p>
            </div>
        </div>
        <div class="request-details">
            <p><i class="fas fa-file-alt"></i> ${request.topic}</p>
            <p><i class="fas fa-clock"></i> ${request.duration} mins</p>
            <p><i class="fas fa-calendar"></i> ${dateTime.toLocaleString()}</p>
        </div>
        <div class="request-actions">
            <button class="btn btn-outline decline">Decline</button>
            <button class="btn btn-secondary accept">Accept</button>
        </div>
    `;
    const declineBtn = div.querySelector('.decline');
    declineBtn.onclick = async () => {
        if (confirm('Decline this request?')) {
            await db.collection('session_requests').doc(requestId).update({ status: 'declined' });
            showAlert('Request declined', 'info');
        }
    };
    const acceptBtn = div.querySelector('.accept');
    acceptBtn.onclick = async () => {
        const sessionData = {
            seniorId: request.seniorId,
            seniorName: request.seniorName,
            juniorId: request.juniorId,
            juniorName: request.juniorName,
            topic: request.topic,
            dateTime: request.dateTime,
            duration: request.duration,
            status: 'scheduled',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            amount: 0
        };
        const seniorDoc = await db.collection('users').doc(request.seniorId).get();
        if (seniorDoc.exists) {
            const rate = seniorDoc.data().hourlyRate || 0;
            sessionData.amount = rate * (request.duration / 60);
        }
        await db.collection('sessions').add(sessionData);
        await db.collection('session_requests').doc(requestId).update({ status: 'accepted' });
        showAlert('Session accepted!', 'success');
    };
    return div;
}

async function loadSeniorStats(userId) {
    const sessionsSnapshot = await db.collection('sessions')
        .where('seniorId', '==', userId)
        .get();
    const totalSessions = sessionsSnapshot.size;
    let totalEarnings = 0;
    sessionsSnapshot.forEach(doc => {
        totalEarnings += doc.data().amount || 0;
    });
    const juniorsSnapshot = await db.collection('sessions')
        .where('seniorId', '==', userId)
        .select('juniorId')
        .get();
    const uniqueJuniors = new Set(juniorsSnapshot.docs.map(doc => doc.data().juniorId));
    const activeJuniors = uniqueJuniors.size;
    const stats = document.querySelectorAll('.stat-card');
    if (stats.length >= 4) {
        stats[0].querySelector('.stat-info h3').textContent = totalSessions;
        stats[1].querySelector('.stat-info h3').textContent = '4.9';
        stats[2].querySelector('.stat-info h3').textContent = `₹${totalEarnings}`;
        stats[3].querySelector('.stat-info h3').textContent = activeJuniors;
    }
}

// ==================== COMMON FEATURES ====================
function initCommonFeatures() {
    const logoutLinks = document.querySelectorAll('.logout');
    logoutLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
                logout();
            }
        });
    });
    const menuToggle = document.querySelector('.dashboard-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            menuToggle.innerHTML = sidebar.classList.contains('active') ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
        });
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && !sidebar.contains(e.target) && !menuToggle.contains(e.target) && sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
                menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
            }
        });
    }
    const notificationBell = document.querySelector('.notification');
    if (notificationBell) {
        notificationBell.addEventListener('click', () => {
            showAlert('You have new notifications (coming soon)', 'info');
        });
    }
}
