// ========== AUTH CHECK ==========
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

    // Sidebar naam
    const nameEl = document.querySelector(".user-details h4");
    if (nameEl) nameEl.textContent = fullName;

    // Sidebar role
    const roleEl = document.querySelector(".user-details p");
    if (roleEl) roleEl.textContent = capitalize(data.type || data.expertise || data.role || "");

    // Header welcome
    const h1 = document.querySelector(".header-left h1");
    if (h1) h1.textContent = `Welcome, ${firstName}!`;

    // Header subtitle
    const sub = document.querySelector(".header-left p");
    if (sub) sub.textContent = data.role === "senior"
      ? "Your wisdom is changing lives today!"
      : "Ready to learn from the best minds?";

    // Role ke hisaab se load
    if (data.role === "junior") {
      loadJuniorDashboard(user, data);
    } else if (data.role === "senior") {
      loadSeniorDashboard(user, data);
    }

  } catch (err) {
    console.error("Auth load error:", err);
  }
});

// ========== SENIOR DASHBOARD ==========
function loadSeniorDashboard(user, userData) {
  loadSeniorStats(user.uid);
  loadTodaySchedule(user.uid);
  loadRecentSessions(user.uid);
  loadSessionRequests(user.uid);
  loadFullSchedule(user.uid);
  loadJuniorsList(user.uid);
  loadEarnings(user.uid);
  loadMessagesList(user.uid);
  listenForNewRequests(user.uid); // 🔔 Real-time notifications

  // Availability toggle
  const toggle = document.getElementById("availabilityToggle");
  if (toggle) {
    toggle.addEventListener("change", async () => {
      await db.collection("users").doc(user.uid).update({
        available: toggle.checked
      });
    });
  }
}

// ========== 🔔 REAL-TIME NOTIFICATIONS ==========
let prevRequestCount = -1;

function listenForNewRequests(seniorId) {
  db.collection("sessionRequests")
    .where("seniorId", "==", seniorId)
    .where("status", "==", "pending")
    .onSnapshot(snapshot => {
      const count = snapshot.size;

      // Badge update
      const badge = document.getElementById("notifBadge");
      const sideBadge = document.getElementById("reqBadgeSide");

      if (count > 0) {
        if (badge) { badge.textContent = count; badge.style.display = "inline-block"; }
        if (sideBadge) { sideBadge.textContent = count; sideBadge.style.display = "inline-block"; }
      } else {
        if (badge) badge.style.display = "none";
        if (sideBadge) sideBadge.style.display = "none";
      }

      // Notification dropdown update
      updateNotifDropdown(snapshot);

      // Popup — sirf naya request aane pe
      if (prevRequestCount !== -1 && count > prevRequestCount) {
        const latest = snapshot.docs[snapshot.docs.length - 1].data();
        showNotifPopup(
          "📩 New Session Request!",
          `${latest.juniorName} wants a session on "${latest.topic}"`
        );
      }
      prevRequestCount = count;
    });
}

function updateNotifDropdown(snapshot) {
  const list = document.getElementById("notifList");
  if (!list) return;

  if (snapshot.empty) {
    list.innerHTML = `<p style="padding:16px; color:#aaa; text-align:center; font-size:13px;">No notifications</p>`;
    return;
  }

  list.innerHTML = "";
  snapshot.forEach(doc => {
    const r = doc.data();
    const item = document.createElement("div");
    item.className = "notif-item unread";
    item.innerHTML = `
      <h5>📩 ${r.juniorName}</h5>
      <p>${r.topic} • ${r.date} at ${r.time}</p>
    `;
    item.onclick = () => {
      document.getElementById("notifDropdown").classList.remove("open");
      showSection("requests");
    };
    list.appendChild(item);
  });
}

function showNotifPopup(title, message) {
  const container = document.getElementById("notifPopupContainer");
  if (!container) return;

  const popup = document.createElement("div");
  popup.className = "notif-popup";
  popup.innerHTML = `
    <div class="notif-icon"><i class="fas fa-bell"></i></div>
    <div class="notif-text">
      <h4>${title}</h4>
      <p>${message}</p>
    </div>
    <button class="notif-close" onclick="this.parentElement.remove()">✕</button>
  `;

  container.appendChild(popup);

  // 5 second baad auto remove
  setTimeout(() => popup.remove(), 5000);
}

// ========== SESSION REQUESTS ==========
function loadSessionRequests(seniorId) {
  const grid = document.getElementById("requestsGrid");
  if (!grid) return;

  db.collection("sessionRequests")
    .where("seniorId", "==", seniorId)
    .where("status", "==", "pending")
    .onSnapshot(snapshot => {
      if (snapshot.empty) {
        grid.innerHTML = `<p style="color:#aaa; padding:40px; text-align:center;">
          <i class="fas fa-inbox" style="font-size:48px; display:block; margin-bottom:12px; opacity:0.3;"></i>
          No pending requests.
        </p>`;
        return;
      }

      grid.innerHTML = "";
      snapshot.forEach(doc => {
        const r = doc.data();
        const card = document.createElement("div");
        card.style.cssText = `
          background:#fff; border-radius:14px; padding:18px;
          box-shadow:0 2px 12px rgba(0,0,0,0.08); margin-bottom:14px;
          border-left:5px solid #1a73e8;
        `;
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:12px;">
            <div>
              <h4 style="margin:0 0 6px; color:#333; font-size:16px;">
                <i class="fas fa-user-graduate" style="color:#1a73e8;"></i> ${r.juniorName}
              </h4>
              <p style="margin:3px 0; color:#555; font-size:13px;">📌 <b>Topic:</b> ${r.topic}</p>
              <p style="margin:3px 0; color:#555; font-size:13px;">📅 <b>Date:</b> ${r.date} &nbsp;⏰ <b>Time:</b> ${r.time}</p>
              ${r.message ? `<p style="margin:6px 0; color:#777; font-size:12px; font-style:italic;">"${r.message}"</p>` : ""}
            </div>
            <span style="background:#fff3e0; color:#f57c00; padding:5px 12px; border-radius:20px; font-size:12px; white-space:nowrap;">
              ⏳ Pending
            </span>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button onclick="handleRequest('${doc.id}', 'accepted', '${r.juniorId}', '${r.juniorName}')"
              style="flex:1; min-width:100px; padding:10px; background:#4caf50; color:#fff; border:none; border-radius:10px; cursor:pointer; font-weight:600;">
              ✅ Accept
            </button>
            <button onclick="handleRequest('${doc.id}', 'rejected', '${r.juniorId}', '${r.juniorName}')"
              style="flex:1; min-width:100px; padding:10px; background:#f44336; color:#fff; border:none; border-radius:10px; cursor:pointer; font-weight:600;">
              ❌ Decline
            </button>
            <button onclick="openChat('${r.juniorId}', '${r.juniorName}')"
              style="flex:1; min-width:100px; padding:10px; background:#1a73e8; color:#fff; border:none; border-radius:10px; cursor:pointer; font-weight:600;">
              💬 Chat
            </button>
          </div>
        `;
        grid.appendChild(card);
      });
    });
}

async function handleRequest(requestId, status, juniorId, juniorName) {
  try {
    await db.collection("sessionRequests").doc(requestId).update({ status });
    if (status === "accepted") {
      showNotifPopup("✅ Session Accepted!", `You accepted ${juniorName}'s request.`);
    } else {
      showNotifPopup("❌ Session Declined", `You declined ${juniorName}'s request.`);
    }
  } catch (err) {
    console.error("Request update error:", err);
    alert("Error updating request.");
  }
}

// ========== TODAY'S SCHEDULE ==========
function loadTodaySchedule(seniorId) {
  const list = document.getElementById("scheduleList");
  if (!list) return;

  const today = new Date().toLocaleDateString("en-GB");

  db.collection("sessionRequests")
    .where("seniorId", "==", seniorId)
    .where("status", "==", "accepted")
    .onSnapshot(snapshot => {
      const todaySessions = snapshot.docs.filter(d => d.data().date === today);

      if (todaySessions.length === 0) {
        list.innerHTML = `<p style="color:#aaa; padding:20px; text-align:center;">No sessions today. Enjoy your day! 😊</p>`;
        return;
      }

      list.innerHTML = "";
      todaySessions.forEach(doc => {
        const s = doc.data();
        const item = document.createElement("div");
        item.style.cssText = `
          background:#fff; border-radius:10px; padding:14px 18px;
          display:flex; justify-content:space-between; align-items:center;
          box-shadow:0 2px 8px rgba(0,0,0,0.06); margin-bottom:10px;
          border-left:4px solid #4caf50;
        `;
        item.innerHTML = `
          <div>
            <h4 style="margin:0; color:#333;">${s.juniorName}</h4>
            <p style="margin:4px 0; color:#666; font-size:13px;">⏰ ${s.time} &nbsp;•&nbsp; 📌 ${s.topic}</p>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <span style="background:#e8f5e9; color:#388e3c; padding:4px 12px; border-radius:20px; font-size:12px;">Today</span>
            <button onclick="openChat('${s.juniorId}', '${s.juniorName}')"
              style="padding:6px 12px; background:#1a73e8; color:#fff; border:none; border-radius:8px; cursor:pointer; font-size:12px;">
              💬 Chat
            </button>
          </div>
        `;
        list.appendChild(item);
      });
    });
}

// ========== FULL SCHEDULE ==========
function loadFullSchedule(seniorId) {
  const container = document.getElementById("fullSchedule");
  if (!container) return;

  db.collection("sessionRequests")
    .where("seniorId", "==", seniorId)
    .where("status", "==", "accepted")
    .onSnapshot(snapshot => {
      if (snapshot.empty) {
        container.innerHTML = `<p style="color:#aaa; padding:20px; text-align:center;">No upcoming sessions.</p>`;
        return;
      }

      container.innerHTML = "";
      snapshot.forEach(doc => {
        const s = doc.data();
        const item = document.createElement("div");
        item.style.cssText = `
          background:#fff; border-radius:10px; padding:14px 18px;
          display:flex; justify-content:space-between; align-items:center;
          box-shadow:0 2px 8px rgba(0,0,0,0.06); margin-bottom:10px;
          border-left:4px solid #1a73e8;
        `;
        item.innerHTML = `
          <div>
            <h4 style="margin:0; color:#333;">${s.juniorName}</h4>
            <p style="margin:4px 0; color:#666; font-size:13px;">📅 ${s.date} &nbsp;⏰ ${s.time} &nbsp;•&nbsp; 📌 ${s.topic}</p>
          </div>
          <button onclick="openChat('${s.juniorId}', '${s.juniorName}')"
            style="padding:6px 12px; background:#1a73e8; color:#fff; border:none; border-radius:8px; cursor:pointer; font-size:12px;">
            💬 Chat
          </button>
        `;
        container.appendChild(item);
      });
    });
}

// ========== RECENT SESSIONS TABLE ==========
function loadRecentSessions(seniorId) {
  const tbody = document.getElementById("recentSessionsBody");
  if (!tbody) return;

  db.collection("sessionRequests")
    .where("seniorId", "==", seniorId)
    .where("status", "==", "accepted")
    .onSnapshot(snapshot => {
      if (snapshot.empty) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#aaa; padding:20px;">No sessions yet.</td></tr>`;
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
            <td>${s.rating ? "⭐ " + s.rating : "N/A"}</td>
          </tr>
        `;
      });
    });
}

// ========== STATS ==========
function loadSeniorStats(seniorId) {
  db.collection("sessionRequests")
    .where("seniorId", "==", seniorId)
    .onSnapshot(snapshot => {
      const total = snapshot.size;
      const accepted = snapshot.docs.filter(d => d.data().status === "accepted").length;
      const juniorIds = [...new Set(snapshot.docs.map(d => d.data().juniorId))];
      const totalEarnings = snapshot.docs.reduce((sum, d) => sum + (d.data().earnings || 0), 0);

      const el = (id) => document.getElementById(id);
      if (el("statTotal"))    el("statTotal").textContent    = total;
      if (el("statJuniors"))  el("statJuniors").textContent  = juniorIds.length;
      if (el("statEarnings")) el("statEarnings").textContent = `₹${totalEarnings}`;
    });
}

// ========== EARNINGS ==========
function loadEarnings(seniorId) {
  const container = document.getElementById("earningsList");
  if (!container) return;

  db.collection("sessionRequests")
    .where("seniorId", "==", seniorId)
    .where("status", "==", "accepted")
    .onSnapshot(snapshot => {
      let total = 0;
      let html = `
        <div style="background:#e8f5e9; border-radius:12px; padding:20px; margin-bottom:20px; text-align:center;">
          <h2 style="margin:0; color:#388e3c; font-size:32px;">₹${total}</h2>
          <p style="margin:6px 0 0; color:#666;">Total Earnings</p>
        </div>
        <table class="data-table" style="width:100%;">
          <thead><tr><th>Date</th><th>Junior</th><th>Topic</th><th>Amount</th></tr></thead>
          <tbody>
      `;

      if (snapshot.empty) {
        html += `<tr><td colspan="4" style="text-align:center; color:#aaa; padding:20px;">No earnings yet.</td></tr>`;
      } else {
        snapshot.forEach(doc => {
          const s = doc.data();
          total += s.earnings || 0;
          html += `<tr>
            <td>${s.date}</td>
            <td>${s.juniorName}</td>
            <td>${s.topic}</td>
            <td>₹${s.earnings || 0}</td>
          </tr>`;
        });
      }

      html += `</tbody></table>`;
      container.innerHTML = html;

      // Total update karo
      const totalEl = container.querySelector("h2");
      if (totalEl) totalEl.textContent = `₹${total}`;
    });
}

// ========== MY JUNIORS ==========
function loadJuniorsList(seniorId) {
  const container = document.getElementById("juniorsList");
  if (!container) return;

  db.collection("sessionRequests")
    .where("seniorId", "==", seniorId)
    .onSnapshot(async snapshot => {
      if (snapshot.empty) {
        container.innerHTML = `<p style="color:#aaa; padding:20px; text-align:center;">No juniors yet.</p>`;
        return;
      }

      // Unique juniors
      const juniorMap = {};
      snapshot.forEach(doc => {
        const d = doc.data();
        if (!juniorMap[d.juniorId]) {
          juniorMap[d.juniorId] = { name: d.juniorName, sessions: 0 };
        }
        juniorMap[d.juniorId].sessions++;
      });

      container.innerHTML = "";
      Object.entries(juniorMap).forEach(([id, info]) => {
        const card = document.createElement("div");
        card.style.cssText = `
          background:#fff; border-radius:12px; padding:16px;
          display:flex; justify-content:space-between; align-items:center;
          box-shadow:0 2px 8px rgba(0,0,0,0.06); margin-bottom:12px;
        `;
        card.innerHTML = `
          <div style="display:flex; align-items:center; gap:14px;">
            <div style="width:44px; height:44px; background:#e3f2fd; border-radius:50%; display:flex; align-items:center; justify-content:center;">
              <i class="fas fa-user-graduate" style="color:#1a73e8;"></i>
            </div>
            <div>
              <h4 style="margin:0; color:#333;">${info.name}</h4>
              <p style="margin:4px 0; color:#888; font-size:13px;">${info.sessions} session(s)</p>
            </div>
          </div>
          <button onclick="openChat('${id}', '${info.name}')"
            style="padding:8px 16px; background:#1a73e8; color:#fff; border:none; border-radius:8px; cursor:pointer;">
            💬 Chat
          </button>
        `;
        container.appendChild(card);
      });
    });
}

// ========== MESSAGES LIST ==========
function loadMessagesList(seniorId) {
  const container = document.getElementById("messagesList");
  if (!container) return;

  db.collection("chats")
    .where("participants", "array-contains", seniorId)
    .onSnapshot(snapshot => {
      if (snapshot.empty) {
        container.innerHTML = `<p style="color:#aaa; padding:20px; text-align:center;">No conversations yet.</p>`;
        return;
      }

      container.innerHTML = "";
      snapshot.forEach(doc => {
        const chat = doc.data();
        const otherId = chat.participants.find(p => p !== seniorId);
        const item = document.createElement("div");
        item.style.cssText = `
          background:#fff; border-radius:12px; padding:16px;
          display:flex; justify-content:space-between; align-items:center;
          box-shadow:0 2px 8px rgba(0,0,0,0.06); margin-bottom:12px;
          cursor:pointer;
        `;
        item.innerHTML = `
          <div style="display:flex; align-items:center; gap:14px;">
            <div style="width:44px; height:44px; background:#f3e5f5; border-radius:50%; display:flex; align-items:center; justify-content:center;">
              <i class="fas fa-user" style="color:#7b1fa2;"></i>
            </div>
            <div>
              <h4 style="margin:0; color:#333;">Junior</h4>
              <p style="margin:4px 0; color:#888; font-size:13px;">${chat.lastMessage || "No messages"}</p>
            </div>
          </div>
          <i class="fas fa-chevron-right" style="color:#aaa;"></i>
        `;
        item.onclick = () => openChat(otherId, "Junior");
        container.appendChild(item);
      });
    });
}

// ========== JUNIOR DASHBOARD ==========
function loadJuniorDashboard(user, userData) {
  loadMatchedExperts(userData.primaryInterest || "");
  loadJuniorSessions(user.uid);
  loadJuniorStats(user.uid);
}

async function loadMatchedExperts(category) {
  const expertsGrid = document.querySelector(".experts-grid");
  if (!expertsGrid) return;

  expertsGrid.innerHTML = `<p style="color:#888; padding:20px;">Loading experts...</p>`;

  try {
    let snapshot = await db.collection("users")
      .where("role", "==", "senior")
      .where("expertise", "==", category)
      .get();

    if (snapshot.empty) {
      snapshot = await db.collection("users")
        .where("role", "==", "senior").get();
    }

    if (snapshot.empty) {
      expertsGrid.innerHTML = `
        <div style="text-align:center; padding:40px; color:#888;">
          <i class="fas fa-user-tie" style="font-size:48px; margin-bottom:16px; opacity:0.3; display:block;"></i>
          <p>No experts available yet.</p>
        </div>`;
      return;
    }
    renderExperts(snapshot, expertsGrid);
  } catch (err) {
    console.error("Experts load error:", err);
  }
}

function renderExperts(snapshot, container) {
  container.innerHTML = "";
  snapshot.forEach(doc => {
    const e = doc.data();
    const card = document.createElement("div");
    card.className = "expert-card";
    card.innerHTML = `
      <div class="expert-avatar"><i class="fas fa-user-tie"></i></div>
      <div class="expert-info">
        <h4>${e.fullName || "Expert"}</h4>
        <p>${capitalize(e.expertise || e.primaryInterest || "Expert")}</p>
        <span class="expert-exp">${e.experience || "10"}+ years exp</span>
        <div class="expert-rate">₹${e.hourlyRate || "500"}/hr</div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="sendSessionRequest('${doc.id}', '${e.fullName}')">
        <i class="fas fa-calendar-plus"></i> Book Session
      </button>
      <button class="btn btn-outline btn-sm" onclick="openChat('${doc.id}', '${e.fullName}')">
        <i class="fas fa-comment"></i> Message
      </button>
    `;
    container.appendChild(card);
  });
}

async function sendSessionRequest(seniorId, seniorName) {
  const user = firebase.auth().currentUser;
  if (!user) return;

  const topic   = prompt(`Session topic for ${seniorName}:`);
  if (!topic) return;
  const date    = prompt("Preferred date (DD/MM/YYYY):");
  if (!date) return;
  const time    = prompt("Preferred time (e.g. 10:00 AM):");
  if (!time) return;
  const message = prompt("Short message (optional):") || "";

  try {
    const juniorDoc = await db.collection("users").doc(user.uid).get();
    const juniorName = juniorDoc.data()?.fullName || "Junior";

    await db.collection("sessionRequests").add({
      juniorId:   user.uid,
      juniorName: juniorName,
      seniorId:   seniorId,
      seniorName: seniorName,
      topic:      topic,
      date:       date,
      time:       time,
      message:    message,
      status:     "pending",
      earnings:   0,
      createdAt:  firebase.firestore.FieldValue.serverTimestamp()
    });

    alert(`✅ Session request sent to ${seniorName}! Wait for their response.`);
  } catch (err) {
    console.error("Session request error:", err);
    alert("❌ Could not send request. Try again.");
  }
}

function loadJuniorSessions(juniorId) {
  const list = document.querySelector(".sessions-list");
  if (!list) return;

  db.collection("sessionRequests")
    .where("juniorId", "==", juniorId)
    .onSnapshot(snapshot => {
      if (snapshot.empty) {
        list.innerHTML = `
          <div style="text-align:center; padding:40px; color:#888;">
            <i class="fas fa-calendar-plus" style="font-size:48px; margin-bottom:16px; opacity:0.3; display:block;"></i>
            <p>No sessions yet. Book your first session!</p>
          </div>`;
        return;
      }

      list.innerHTML = "";
      snapshot.forEach(doc => {
        const s = doc.data();
        const color = s.status === "accepted" ? "#4caf50" : s.status === "rejected" ? "#f44336" : "#f57c00";
        const item = document.createElement("div");
        item.style.cssText = `
          background:#fff; border-radius:10px; padding:14px 16px;
          display:flex; justify-content:space-between; align-items:center;
          box-shadow:0 2px 6px rgba(0,0,0,0.06); margin-bottom:10px;
          border-left:4px solid ${color};
        `;
        item.innerHTML = `
          <div>
            <h4 style="margin:0; color:#333;">${s.seniorName}</h4>
            <p style="margin:4px 0; color:#666; font-size:13px;">📅 ${s.date} &nbsp;⏰ ${s.time}</p>
            <p style="margin:4px 0; color:#888; font-size:13px;">📌 ${s.topic}</p>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
            <span style="background:${color}20; color:${color}; padding:4px 12px; border-radius:20px; font-size:12px; text-transform:capitalize;">
              ${s.status}
            </span>
            <button onclick="openChat('${s.seniorId}', '${s.seniorName}')"
              style="padding:4px 10px; background:#1a73e8; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:12px;">
              💬 Chat
            </button>
          </div>
        `;
        list.appendChild(item);
      });
    });
}

function loadJuniorStats(juniorId) {
  db.collection("sessionRequests")
    .where("juniorId", "==", juniorId)
    .onSnapshot(snapshot => {
      const total    = snapshot.size;
      const upcoming = snapshot.docs.filter(d => d.data().status === "accepted").length;
      const spent    = snapshot.docs.reduce((s, d) => s + (d.data().earnings || 0), 0);

      const cards = document.querySelectorAll(".stat-info h3");
      if (cards[0]) cards[0].textContent = total;
      if (cards[2]) cards[2].textContent = `₹${spent}`;
      if (cards[3]) cards[3].textContent = upcoming;
    });
}

// ========== CHAT ==========
function openChat(receiverId, receiverName) {
  const user = firebase.auth().currentUser;
  if (!user) return;
  const chatId = [user.uid, receiverId].sort().join("_");
  showChatModal(chatId, receiverId, receiverName, user.uid);
}

function showChatModal(chatId, receiverId, receiverName, senderId) {
  document.getElementById("chatModal")?.remove();

  const modal = document.createElement("div");
  modal.id = "chatModal";
  modal.style.cssText = `
    position:fixed; bottom:20px; right:20px; width:340px; height:460px;
    background:#fff; border-radius:18px; box-shadow:0 8px 32px rgba(0,0,0,0.2);
    display:flex; flex-direction:column; z-index:99999; overflow:hidden;
  `;
  modal.innerHTML = `
    <div style="background:#1a73e8; color:#fff; padding:14px 16px; display:flex; justify-content:space-between; align-items:center;">
      <span><i class="fas fa-comment-dots"></i> &nbsp;${receiverName}</span>
      <button onclick="document.getElementById('chatModal').remove()"
        style="background:none; border:none; color:#fff; font-size:20px; cursor:pointer;">✕</button>
    </div>
    <div id="chatMessages" style="flex:1; overflow-y:auto; padding:12px; background:#f5f7ff; display:flex; flex-direction:column; gap:8px;">
      <p style="text-align:center; color:#aaa; font-size:13px;">Loading...</p>
    </div>
    <div style="padding:10px; border-top:1px solid #eee; display:flex; gap:8px;">
      <input id="chatInput" type="text" placeholder="Type a message..."
        style="flex:1; padding:9px 14px; border:1px solid #ddd; border-radius:22px; outline:none; font-size:13px;"
        onkeypress="if(event.key==='Enter') sendMessage('${chatId}','${receiverId}','${senderId}')">
      <button onclick="sendMessage('${chatId}','${receiverId}','${senderId}')"
        style="background:#1a73e8; color:#fff; border:none; border-radius:50%; width:38px; height:38px; cursor:pointer;">
        <i class="fas fa-paper-plane"></i>
      </button>
    </div>
  `;
  document.body.appendChild(modal);
  loadMessages(chatId, senderId);
}

function loadMessages(chatId, currentUserId) {
  const div = document.getElementById("chatMessages");
  db.collection("chats").doc(chatId).collection("messages")
    .orderBy("timestamp", "asc")
    .onSnapshot(snapshot => {
      if (snapshot.empty) {
        div.innerHTML = `<p style="text-align:center; color:#aaa; font-size:13px; margin-top:20px;">No messages yet. Say hi! 👋</p>`;
        return;
      }
      div.innerHTML = "";
      snapshot.forEach(doc => {
        const m = doc.data();
        const isMe = m.senderId === currentUserId;
        const bubble = document.createElement("div");
        bubble.style.cssText = `
          max-width:78%; padding:9px 13px; border-radius:14px; font-size:13px;
          align-self:${isMe ? "flex-end" : "flex-start"};
          background:${isMe ? "#1a73e8" : "#fff"};
          color:${isMe ? "#fff" : "#333"};
          box-shadow:0 1px 4px rgba(0,0,0,0.1);
        `;
        bubble.textContent = m.text;
        div.appendChild(bubble);
      });
      div.scrollTop = div.scrollHeight;
    });
}

async function sendMessage(chatId, receiverId, senderId) {
  const input = document.getElementById("chatInput");
  const text  = input?.value?.trim();
  if (!text) return;
  input.value = "";
  try {
    await db.collection("chats").doc(chatId).collection("messages").add({
      text, senderId, receiverId,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection("chats").doc(chatId).set({
      participants: [senderId, receiverId],
      lastMessage: text,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.error("Send message error:", err);
  }
}

// ========== LOGOUT ==========
document.querySelector(".logout")?.addEventListener("click", async (e) => {
  e.preventDefault();
  await firebase.auth().signOut();
  const page = window.location.pathname;
  window.location.href = page.includes("s-dashbord") ? "s-login.html" : "j-login.html";
});

// ========== HELPERS ==========
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function searchCategory(category) {
  loadMatchedExperts(category);
  document.querySelector(".experts-grid")?.scrollIntoView({ behavior: "smooth" });
}

function showSection(name) {
  document.querySelectorAll('[id^="section-"]').forEach(s => s.style.display = "none");
  const target = document.getElementById("section-" + name);
  if (target) target.style.display = "block";
}
```

---

## ✅ Poora Flow Ab Kuch Aisa Hoga
```
Junior "Book Session" kare
        ↓
Firestore mein request save hoti hai
        ↓
Senior dashboard pe 🔔 POPUP aata hai
"📩 New Session Request! XYZ wants a session"
        ↓
Bell icon pe click karo → dropdown mein request dikhti hai
        ↓
"Session Requests" section mein ✅ Accept / ❌ Decline / 💬 Chat
        ↓
Accept karne pe Junior ko status update dikhta hai
        ↓
Dono chat kar sakte hain real-time mein 💬
