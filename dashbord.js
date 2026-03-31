// ========== AUTH CHECK + USER DATA LOAD ==========
firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    const page = window.location.pathname;
    window.location.href = page.includes("s-dashbord") ? "s-login.html" : "j-login.html";
    return;
  }

  try {
    const doc = await db.collection("users").doc(user.uid).get();
    if (!doc.exists) return;

    const data = doc.data();
    const fullName = data.fullName || user.displayName || "User";
    const firstName = fullName.split(" ")[0];
    const userRole = data.type || "";
    const interest = data.primaryInterest || data.expertise || "";

    // Sidebar naam
    const nameEl = document.querySelector(".user-details h4");
    if (nameEl) nameEl.textContent = fullName;

    // Sidebar role
    const roleEl = document.querySelector(".user-details p");
    if (roleEl && userRole) roleEl.textContent = capitalize(userRole);

    // Header welcome
    const headerTitle = document.querySelector(".header-left h1");
    if (headerTitle) headerTitle.textContent = `Welcome, ${firstName}!`;

    // Header subtitle
    const headerSub = document.querySelector(".header-left p");
    if (headerSub && interest) {
      headerSub.textContent = data.role === "senior"
        ? `Your expertise: ${capitalize(interest)}`
        : `Your focus: ${capitalize(interest)}`;
    }

    // Role ke hisaab se features load karo
    if (data.role === "junior") {
      loadJuniorDashboard(user, data);
    } else if (data.role === "senior") {
      loadSeniorDashboard(user, data);
    }

  } catch (err) {
    console.error("User data load error:", err);
  }
});

// ========== JUNIOR DASHBOARD ==========
async function loadJuniorDashboard(user, userData) {
  // Experts load karo (category match)
  loadMatchedExperts(userData.primaryInterest || "");

  // Upcoming sessions load karo
  loadJuniorSessions(user.uid);

  // Stats load karo
  loadJuniorStats(user.uid);
}

// ========== SENIOR DASHBOARD ==========
async function loadSeniorDashboard(user, userData) {
  // Session requests load karo
  loadSessionRequests(user.uid);

  // Today's schedule load karo
  loadTodaySchedule(user.uid);

  // Stats load karo
  loadSeniorStats(user.uid);

  // Recent sessions table
  loadRecentSessions(user.uid);
}

// ========== MATCHED EXPERTS (Junior ke liye) ==========
async function loadMatchedExperts(category) {
  const expertsGrid = document.querySelector(".experts-grid");
  if (!expertsGrid) return;

  expertsGrid.innerHTML = `<p style="color:#888;">Loading experts...</p>`;

  try {
    let query = db.collection("users").where("role", "==", "senior");
    if (category) {
      query = query.where("expertise", "==", category);
    }

    const snapshot = await query.limit(6).get();

    if (snapshot.empty) {
      // Category match nahi mila toh sab seniors dikhao
      const allSeniors = await db.collection("users")
        .where("role", "==", "senior")
        .limit(6).get();

      if (allSeniors.empty) {
        expertsGrid.innerHTML = `<p style="color:#888; padding:20px;">No experts available yet.</p>`;
        return;
      }
      renderExperts(allSeniors, expertsGrid);
    } else {
      renderExperts(snapshot, expertsGrid);
    }
  } catch (err) {
    console.error("Experts load error:", err);
    expertsGrid.innerHTML = `<p style="color:red;">Could not load experts.</p>`;
  }
}

function renderExperts(snapshot, container) {
  container.innerHTML = "";
  snapshot.forEach(doc => {
    const expert = doc.data();
    const card = document.createElement("div");
    card.className = "expert-card";
    card.innerHTML = `
      <div class="expert-avatar">
        <i class="fas fa-user-tie"></i>
      </div>
      <div class="expert-info">
        <h4>${expert.fullName || "Expert"}</h4>
        <p>${capitalize(expert.expertise || expert.primaryInterest || "Expert")}</p>
        <span class="expert-exp">${expert.experience || "10"}+ years exp</span>
        <div class="expert-rate">₹${expert.hourlyRate || "500"}/hr</div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="sendSessionRequest('${doc.id}', '${expert.fullName}')">
        <i class="fas fa-calendar-plus"></i> Book Session
      </button>
      <button class="btn btn-outline btn-sm" onclick="openChat('${doc.id}', '${expert.fullName}')">
        <i class="fas fa-comment"></i> Message
      </button>
    `;
    container.appendChild(card);
  });
}

// ========== SESSION REQUEST BHEJO (Junior → Senior) ==========
async function sendSessionRequest(seniorId, seniorName) {
  const user = firebase.auth().currentUser;
  if (!user) return;

  const topic = prompt(`Session topic for ${seniorName}:`);
  if (!topic) return;

  const date = prompt("Preferred date (DD/MM/YYYY):");
  if (!date) return;

  const time = prompt("Preferred time (HH:MM):");
  if (!time) return;

  try {
    await db.collection("sessionRequests").add({
      juniorId: user.uid,
      seniorId: seniorId,
      seniorName: seniorName,
      juniorName: (await db.collection("users").doc(user.uid).get()).data()?.fullName || "Junior",
      topic: topic,
      date: date,
      time: time,
      status: "pending",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert(`✅ Session request sent to ${seniorName}!`);
  } catch (err) {
    console.error("Session request error:", err);
    alert("❌ Could not send request. Try again.");
  }
}

// ========== CHAT / MESSAGE ==========
async function openChat(receiverId, receiverName) {
  const user = firebase.auth().currentUser;
  if (!user) return;

  // Chat ID — dono users ke UIDs combine karo
  const chatId = [user.uid, receiverId].sort().join("_");

  // Chat modal dikhao
  showChatModal(chatId, receiverId, receiverName, user.uid);
}

function showChatModal(chatId, receiverId, receiverName, senderId) {
  // Agar modal already hai toh remove karo
  document.getElementById("chatModal")?.remove();

  const modal = document.createElement("div");
  modal.id = "chatModal";
  modal.style.cssText = `
    position:fixed; bottom:20px; right:20px; width:350px; height:450px;
    background:#fff; border-radius:16px; box-shadow:0 8px 32px rgba(0,0,0,0.2);
    display:flex; flex-direction:column; z-index:9999; overflow:hidden;
  `;

  modal.innerHTML = `
    <div style="background:#1a73e8; color:#fff; padding:14px 16px; display:flex; justify-content:space-between; align-items:center;">
      <span><i class="fas fa-comment"></i> ${receiverName}</span>
      <button onclick="document.getElementById('chatModal').remove()" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;">✕</button>
    </div>
    <div id="chatMessages" style="flex:1; overflow-y:auto; padding:12px; background:#f5f5f5; display:flex; flex-direction:column; gap:8px;">
      <p style="text-align:center; color:#aaa; font-size:13px;">Loading messages...</p>
    </div>
    <div style="padding:10px; border-top:1px solid #eee; display:flex; gap:8px;">
      <input id="chatInput" type="text" placeholder="Type a message..." 
        style="flex:1; padding:8px 12px; border:1px solid #ddd; border-radius:20px; outline:none;"
        onkeypress="if(event.key==='Enter') sendMessage('${chatId}','${receiverId}','${senderId}')">
      <button onclick="sendMessage('${chatId}','${receiverId}','${senderId}')"
        style="background:#1a73e8; color:#fff; border:none; border-radius:50%; width:36px; height:36px; cursor:pointer;">
        <i class="fas fa-paper-plane"></i>
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  // Messages real-time load karo
  loadMessages(chatId, senderId);
}

function loadMessages(chatId, currentUserId) {
  const messagesDiv = document.getElementById("chatMessages");

  db.collection("chats").doc(chatId).collection("messages")
    .orderBy("timestamp", "asc")
    .onSnapshot(snapshot => {
      if (snapshot.empty) {
        messagesDiv.innerHTML = `<p style="text-align:center; color:#aaa; font-size:13px;">No messages yet. Say hello! 👋</p>`;
        return;
      }

      messagesDiv.innerHTML = "";
      snapshot.forEach(doc => {
        const msg = doc.data();
        const isMe = msg.senderId === currentUserId;
        const div = document.createElement("div");
        div.style.cssText = `
          max-width:75%; padding:8px 12px; border-radius:12px; font-size:13px;
          align-self:${isMe ? "flex-end" : "flex-start"};
          background:${isMe ? "#1a73e8" : "#fff"};
          color:${isMe ? "#fff" : "#333"};
          box-shadow: 0 1px 4px rgba(0,0,0,0.1);
        `;
        div.textContent = msg.text;
        messagesDiv.appendChild(div);
      });

      // Scroll to bottom
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
}

async function sendMessage(chatId, receiverId, senderId) {
  const input = document.getElementById("chatInput");
  const text = input?.value?.trim();
  if (!text) return;

  input.value = "";

  try {
    await db.collection("chats").doc(chatId).collection("messages").add({
      text: text,
      senderId: senderId,
      receiverId: receiverId,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Chat metadata update karo
    await db.collection("chats").doc(chatId).set({
      participants: [senderId, receiverId],
      lastMessage: text,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

  } catch (err) {
    console.error("Message send error:", err);
  }
}

// ========== SESSION REQUESTS (Senior ke liye) ==========
async function loadSessionRequests(seniorId) {
  const requestsGrid = document.querySelector(".requests-grid");
  if (!requestsGrid) return;

  db.collection("sessionRequests")
    .where("seniorId", "==", seniorId)
    .where("status", "==", "pending")
    .orderBy("createdAt", "desc")
    .onSnapshot(snapshot => {
      if (snapshot.empty) {
        requestsGrid.innerHTML = `<p style="color:#888; padding:20px;">No new requests yet.</p>`;
        return;
      }

      requestsGrid.innerHTML = "";
      snapshot.forEach(doc => {
        const req = doc.data();
        const card = document.createElement("div");
        card.className = "request-card";
        card.style.cssText = `
          background:#fff; border-radius:12px; padding:16px;
          box-shadow:0 2px 8px rgba(0,0,0,0.08); margin-bottom:12px;
        `;
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:10px;">
            <div>
              <h4 style="margin:0; color:#333;">${req.juniorName}</h4>
              <p style="margin:4px 0; color:#666; font-size:13px;">📅 ${req.date} at ${req.time}</p>
              <p style="margin:4px 0; color:#888; font-size:13px;">📌 ${req.topic}</p>
            </div>
            <span style="background:#fff3e0; color:#f57c00; padding:4px 10px; border-radius:20px; font-size:12px;">Pending</span>
          </div>
          <div style="display:flex; gap:8px;">
            <button onclick="handleRequest('${doc.id}', 'accepted', '${req.juniorId}')"
              style="flex:1; padding:8px; background:#4caf50; color:#fff; border:none; border-radius:8px; cursor:pointer;">
              ✅ Accept
            </button>
            <button onclick="handleRequest('${doc.id}', 'rejected', '${req.juniorId}')"
              style="flex:1; padding:8px; background:#f44336; color:#fff; border:none; border-radius:8px; cursor:pointer;">
              ❌ Decline
            </button>
            <button onclick="openChat('${req.juniorId}', '${req.juniorName}')"
              style="flex:1; padding:8px; background:#1a73e8; color:#fff; border:none; border-radius:8px; cursor:pointer;">
              💬 Chat
            </button>
          </div>
        `;
        requestsGrid.appendChild(card);
      });
    });
}

async function handleRequest(requestId, status, juniorId) {
  try {
    await db.collection("sessionRequests").doc(requestId).update({ status });
    alert(status === "accepted" ? "✅ Session accepted!" : "❌ Session declined.");
  } catch (err) {
    console.error("Request update error:", err);
  }
}

// ========== TODAY'S SCHEDULE (Senior ke liye) ==========
async function loadTodaySchedule(seniorId) {
  const scheduleList = document.querySelector(".schedule-list");
  if (!scheduleList) return;

  const today = new Date().toLocaleDateString("en-GB"); // DD/MM/YYYY

  db.collection("sessionRequests")
    .where("seniorId", "==", seniorId)
    .where("status", "==", "accepted")
    .where("date", "==", today)
    .onSnapshot(snapshot => {
      if (snapshot.empty) {
        scheduleList.innerHTML = `<p style="color:#888; padding:20px;">No sessions scheduled for today.</p>`;
        return;
      }

      scheduleList.innerHTML = "";
      snapshot.forEach(doc => {
        const session = doc.data();
        const item = document.createElement("div");
        item.style.cssText = `
          background:#fff; border-radius:10px; padding:14px 16px;
          display:flex; justify-content:space-between; align-items:center;
          box-shadow:0 2px 6px rgba(0,0,0,0.06); margin-bottom:10px;
          border-left:4px solid #1a73e8;
        `;
        item.innerHTML = `
          <div>
            <h4 style="margin:0; color:#333;">${session.juniorName}</h4>
            <p style="margin:4px 0; color:#666; font-size:13px;">⏰ ${session.time} • ${session.topic}</p>
          </div>
          <span style="background:#e3f2fd; color:#1976d2; padding:4px 12px; border-radius:20px; font-size:12px;">Today</span>
        `;
        scheduleList.appendChild(item);
      });
    });
}

// ========== JUNIOR SESSIONS ==========
async function loadJuniorSessions(juniorId) {
  const sessionsList = document.querySelector(".sessions-list");
  if (!sessionsList) return;

  db.collection("sessionRequests")
    .where("juniorId", "==", juniorId)
    .orderBy("createdAt", "desc")
    .limit(5)
    .onSnapshot(snapshot => {
      if (snapshot.empty) {
        sessionsList.innerHTML = `<p style="color:#888; padding:20px;">No sessions yet. Book your first session!</p>`;
        return;
      }

      sessionsList.innerHTML = "";
      snapshot.forEach(doc => {
        const session = doc.data();
        const statusColor = session.status === "accepted" ? "#4caf50" : session.status === "rejected" ? "#f44336" : "#f57c00";
        const item = document.createElement("div");
        item.style.cssText = `
          background:#fff; border-radius:10px; padding:14px 16px;
          display:flex; justify-content:space-between; align-items:center;
          box-shadow:0 2px 6px rgba(0,0,0,0.06); margin-bottom:10px;
          border-left:4px solid ${statusColor};
        `;
        item.innerHTML = `
          <div>
            <h4 style="margin:0; color:#333;">${session.seniorName}</h4>
            <p style="margin:4px 0; color:#666; font-size:13px;">📅 ${session.date} at ${session.time}</p>
            <p style="margin:4px 0; color:#888; font-size:13px;">📌 ${session.topic}</p>
          </div>
          <span style="background:${statusColor}20; color:${statusColor}; padding:4px 12px; border-radius:20px; font-size:12px; text-transform:capitalize;">
            ${session.status}
          </span>
        `;
        sessionsList.appendChild(item);
      });
    });
}

// ========== STATS ==========
async function loadJuniorStats(juniorId) {
  const snapshot = await db.collection("sessionRequests")
    .where("juniorId", "==", juniorId).get();

  const total = snapshot.size;
  const upcoming = snapshot.docs.filter(d => d.data().status === "accepted").length;

  const statCards = document.querySelectorAll(".stat-info h3");
  if (statCards[0]) statCards[0].textContent = total;
  if (statCards[3]) statCards[3].textContent = upcoming;
}

async function loadSeniorStats(seniorId) {
  const snapshot = await db.collection("sessionRequests")
    .where("seniorId", "==", seniorId).get();

  const total = snapshot.size;
  const accepted = snapshot.docs.filter(d => d.data().status === "accepted").length;

  const statCards = document.querySelectorAll(".stat-info h3");
  if (statCards[0]) statCards[0].textContent = total;
  if (statCards[3]) statCards[3].textContent = accepted;
}

async function loadRecentSessions(seniorId) {
  const tbody = document.querySelector(".data-table tbody");
  if (!tbody) return;

  const snapshot = await db.collection("sessionRequests")
    .where("seniorId", "==", seniorId)
    .where("status", "==", "accepted")
    .orderBy("createdAt", "desc")
    .limit(5).get();

  if (snapshot.empty) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#888; padding:20px;">No sessions yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  snapshot.forEach(doc => {
    const s = doc.data();
    tbody.innerHTML += `
      <tr>
        <td>${s.date}</td>
        <td>${s.juniorName}</td>
        <td>${s.topic}</td>
        <td>60 min</td>
        <td>₹${s.earnings || 0}</td>
        <td>⭐ ${s.rating || "N/A"}</td>
      </tr>
    `;
  });
}

// ========== LOGOUT ==========
document.querySelector(".logout")?.addEventListener("click", async (e) => {
  e.preventDefault();
  const page = window.location.pathname;
  await firebase.auth().signOut();
  window.location.href = page.includes("s-dashbord") ? "s-login.html" : "j-login.html";
});

// ========== FIND EXPERT BUTTON (Junior) ==========
document.getElementById("findExpertBtn")?.addEventListener("click", () => {
  document.querySelector(".experts-grid")?.scrollIntoView({ behavior: "smooth" });
});

// ========== HELPER ==========
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function searchCategory(category) {
  loadMatchedExperts(category);
  document.querySelector(".experts-grid")?.scrollIntoView({ behavior: "smooth" });
}
