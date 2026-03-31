// ========== AUTH CHECK ==========
firebase.auth().onAuthStateChanged(async function(user) {
  if (!user) {
    var page = window.location.pathname;
    if (page.includes("s-dashbord")) {
      window.location.href = "s-login.html";
    } else {
      window.location.href = "j-login.html";
    }
    return;
  }

  try {
    var doc = await db.collection("users").doc(user.uid).get();
    if (!doc.exists) return;

    var data = doc.data();
    var fullName = data.fullName || user.displayName || "User";
    var firstName = fullName.split(" ")[0];

    // Sidebar naam
    var nameEl = document.querySelector(".user-details h4");
    if (nameEl) nameEl.textContent = fullName;

    // Sidebar role
    var roleEl = document.querySelector(".user-details p");
    if (roleEl) roleEl.textContent = capitalize(data.type || data.expertise || data.role || "");

    // Header welcome
    var h1 = document.querySelector(".header-left h1");
    if (h1) h1.textContent = "Welcome, " + firstName + "!";

    // Header subtitle
    var sub = document.querySelector(".header-left p");
    if (sub) {
      if (data.role === "senior") {
        sub.textContent = "Your wisdom is changing lives today!";
      } else {
        sub.textContent = "Ready to learn from the best minds?";
      }
    }

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
  listenForNewRequests(user.uid);

  var toggle = document.getElementById("availabilityToggle");
  if (toggle) {
    toggle.addEventListener("change", function() {
      db.collection("users").doc(user.uid).update({ available: toggle.checked });
    });
  }
}

// ========== REAL-TIME NOTIFICATIONS ==========
var prevRequestCount = -1;

function listenForNewRequests(seniorId) {
  db.collection("sessionRequests")
    .where("seniorId", "==", seniorId)
    .where("status", "==", "pending")
    .onSnapshot(function(snapshot) {
      var count = snapshot.size;

      var badge = document.getElementById("notifBadge");
      var sideBadge = document.getElementById("reqBadgeSide");

      if (count > 0) {
        if (badge) { badge.textContent = count; badge.style.display = "inline-block"; }
        if (sideBadge) { sideBadge.textContent = count; sideBadge.style.display = "inline-block"; }
      } else {
        if (badge) badge.style.display = "none";
        if (sideBadge) sideBadge.style.display = "none";
      }

      updateNotifDropdown(snapshot);

      if (prevRequestCount !== -1 && count > prevRequestCount) {
        var docs = snapshot.docs;
        var latest = docs[docs.length - 1].data();
        showNotifPopup(
          "New Session Request!",
          latest.juniorName + " wants a session on: " + latest.topic
        );
      }
      prevRequestCount = count;
    });
}

function updateNotifDropdown(snapshot) {
  var list = document.getElementById("notifList");
  if (!list) return;

  if (snapshot.empty) {
    list.innerHTML = "<p style='padding:16px; color:#aaa; text-align:center; font-size:13px;'>No notifications</p>";
    return;
  }

  list.innerHTML = "";
  snapshot.forEach(function(doc) {
    var r = doc.data();
    var item = document.createElement("div");
    item.className = "notif-item unread";
    item.innerHTML = "<h5>" + r.juniorName + "</h5><p>" + r.topic + " - " + r.date + " at " + r.time + "</p>";
    item.onclick = function() {
      document.getElementById("notifDropdown").classList.remove("open");
      showSection("requests");
    };
    list.appendChild(item);
  });
}

function showNotifPopup(title, message) {
  var container = document.getElementById("notifPopupContainer");
  if (!container) return;

  var popup = document.createElement("div");
  popup.className = "notif-popup";
  popup.innerHTML = "<div class='notif-icon'><i class='fas fa-bell'></i></div>"
    + "<div class='notif-text'><h4>" + title + "</h4><p>" + message + "</p></div>"
    + "<button class='notif-close' onclick='this.parentElement.remove()'>x</button>";

  container.appendChild(popup);
  setTimeout(function() { if (popup.parentElement) popup.remove(); }, 5000);
}

// ========== SESSION REQUESTS (Senior) ==========
function loadSessionRequests(seniorId) {
  var grid = document.getElementById("requestsGrid");
  if (!grid) return;

  db.collection("sessionRequests")
    .where("seniorId", "==", seniorId)
    .where("status", "==", "pending")
    .onSnapshot(function(snapshot) {
      if (snapshot.empty) {
        grid.innerHTML = "<div style='text-align:center; padding:40px; color:#aaa;'>"
          + "<i class='fas fa-inbox' style='font-size:48px; display:block; margin-bottom:12px; opacity:0.3;'></i>"
          + "<p>No pending requests.</p></div>";
        return;
      }

      grid.innerHTML = "";
      snapshot.forEach(function(doc) {
        var r = doc.data();
        var docId = doc.id;
        var card = document.createElement("div");
        card.className = "request-card";
        card.style.cssText = "background:#fff; border-radius:14px; padding:18px;"
          + "box-shadow:0 2px 12px rgba(0,0,0,0.08); margin-bottom:14px;"
          + "border-left:5px solid #1a73e8;";

        var msgHtml = r.message ? "<p style='margin:6px 0; color:#777; font-size:12px; font-style:italic;'>" + r.message + "</p>" : "";

        card.innerHTML = "<div style='display:flex; justify-content:space-between; align-items:start; margin-bottom:12px;'>"
          + "<div>"
          + "<h4 style='margin:0 0 6px; color:#333;'>" + r.juniorName + "</h4>"
          + "<p style='margin:3px 0; color:#555; font-size:13px;'>Topic: " + r.topic + "</p>"
          + "<p style='margin:3px 0; color:#555; font-size:13px;'>Date: " + r.date + " | Time: " + r.time + "</p>"
          + msgHtml
          + "</div>"
          + "<span style='background:#fff3e0; color:#f57c00; padding:5px 12px; border-radius:20px; font-size:12px;'>Pending</span>"
          + "</div>"
          + "<div style='display:flex; gap:10px; flex-wrap:wrap;'>"
          + "<button onclick=\"handleRequest('" + docId + "', 'accepted', '" + r.juniorId + "', '" + r.juniorName + "')\" "
          + "style='flex:1; min-width:80px; padding:10px; background:#4caf50; color:#fff; border:none; border-radius:10px; cursor:pointer; font-weight:600;'>Accept</button>"
          + "<button onclick=\"handleRequest('" + docId + "', 'rejected', '" + r.juniorId + "', '" + r.juniorName + "')\" "
          + "style='flex:1; min-width:80px; padding:10px; background:#f44336; color:#fff; border:none; border-radius:10px; cursor:pointer; font-weight:600;'>Decline</button>"
          + "<button onclick=\"openChat('" + r.juniorId + "', '" + r.juniorName + "')\" "
          + "style='flex:1; min-width:80px; padding:10px; background:#1a73e8; color:#fff; border:none; border-radius:10px; cursor:pointer; font-weight:600;'>Chat</button>"
          + "</div>";

        grid.appendChild(card);
      });
    });
}

async function handleRequest(requestId, status, juniorId, juniorName) {
  try {
    await db.collection("sessionRequests").doc(requestId).update({ status: status });
    if (status === "accepted") {
      showNotifPopup("Session Accepted!", "You accepted " + juniorName + "'s request.");
    } else {
      showNotifPopup("Session Declined", "You declined " + juniorName + "'s request.");
    }
  } catch (err) {
    console.error("Request update error:", err);
    alert("Error updating request.");
  }
}

// ========== TODAY SCHEDULE ==========
function loadTodaySchedule(seniorId) {
  var list = document.getElementById("scheduleList");
  if (!list) return;

  var today = new Date().toLocaleDateString("en-GB");

  db.collection("sessionRequests")
    .where("seniorId", "==", seniorId)
    .where("status", "==", "accepted")
    .onSnapshot(function(snapshot) {
      var todaySessions = snapshot.docs.filter(function(d) {
        return d.data().date === today;
      });

      if (todaySessions.length === 0) {
        list.innerHTML = "<p style='color:#aaa; padding:20px; text-align:center;'>No sessions today.</p>";
        return;
      }

      list.innerHTML = "";
      todaySessions.forEach(function(doc) {
        var s = doc.data();
        var item = document.createElement("div");
        item.style.cssText = "background:#fff; border-radius:10px; padding:14px 18px;"
          + "display:flex; justify-content:space-between; align-items:center;"
          + "box-shadow:0 2px 8px rgba(0,0,0,0.06); margin-bottom:10px;"
          + "border-left:4px solid #4caf50;";
        item.innerHTML = "<div>"
          + "<h4 style='margin:0; color:#333;'>" + s.juniorName + "</h4>"
          + "<p style='margin:4px 0; color:#666; font-size:13px;'>" + s.time + " - " + s.topic + "</p>"
          + "</div>"
          + "<button onclick=\"openChat('" + s.juniorId + "', '" + s.juniorName + "')\" "
          + "style='padding:6px 12px; background:#1a73e8; color:#fff; border:none; border-radius:8px; cursor:pointer;'>Chat</button>";
        list.appendChild(item);
      });
    });
}

// ========== FULL SCHEDULE ==========
function loadFullSchedule(seniorId) {
  var container = document.getElementById("fullSchedule");
  if (!container) return;

  db.collection("sessionRequests")
    .where("seniorId", "==", seniorId)
    .where("status", "==", "accepted")
    .onSnapshot(function(snapshot) {
      if (snapshot.empty) {
        container.innerHTML = "<p style='color:#aaa; padding:20px; text-align:center;'>No upcoming sessions.</p>";
        return;
      }

      container.innerHTML = "";
      snapshot.forEach(function(doc) {
        var s = doc.data();
        var item = document.createElement("div");
        item.style.cssText = "background:#fff; border-radius:10px; padding:14px 18px;"
          + "display:flex; justify-content:space-between; align-items:center;"
          + "box-shadow:0 2px 8px rgba(0,0,0,0.06); margin-bottom:10px;"
          + "border-left:4px solid #1a73e8;";
        item.innerHTML = "<div>"
          + "<h4 style='margin:0; color:#333;'>" + s.juniorName + "</h4>"
          + "<p style='margin:4px 0; color:#666; font-size:13px;'>" + s.date + " | " + s.time + " | " + s.topic + "</p>"
          + "</div>"
          + "<button onclick=\"openChat('" + s.juniorId + "', '" + s.juniorName + "')\" "
          + "style='padding:6px 12px; background:#1a73e8; color:#fff; border:none; border-radius:8px; cursor:pointer;'>Chat</button>";
        container.appendChild(item);
      });
    });
}

// ========== RECENT SESSIONS TABLE ==========
function loadRecentSessions(seniorId) {
  var tbody = document.getElementById("recentSessionsBody");
  if (!tbody) return;

  db.collection("sessionRequests")
    .where("seniorId", "==", seniorId)
    .where("status", "==", "accepted")
    .onSnapshot(function(snapshot) {
      if (snapshot.empty) {
        tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; color:#aaa; padding:20px;'>No sessions yet.</td></tr>";
        return;
      }

      tbody.innerHTML = "";
      snapshot.forEach(function(doc) {
        var s = doc.data();
        var tr = document.createElement("tr");
        tr.innerHTML = "<td>" + s.date + "</td>"
          + "<td>" + s.juniorName + "</td>"
          + "<td>" + s.topic + "</td>"
          + "<td>60 min</td>"
          + "<td>Rs. " + (s.earnings || 0) + "</td>"
          + "<td>" + (s.rating ? s.rating + " star" : "N/A") + "</td>";
        tbody.appendChild(tr);
      });
    });
}

// ========== SENIOR STATS ==========
function loadSeniorStats(seniorId) {
  db.collection("sessionRequests")
    .where("seniorId", "==", seniorId)
    .onSnapshot(function(snapshot) {
      var total = snapshot.size;
      var juniorIds = [];
      var totalEarnings = 0;

      snapshot.forEach(function(doc) {
        var d = doc.data();
        if (juniorIds.indexOf(d.juniorId) === -1) juniorIds.push(d.juniorId);
        totalEarnings += d.earnings || 0;
      });

      var elTotal = document.getElementById("statTotal");
      var elJuniors = document.getElementById("statJuniors");
      var elEarnings = document.getElementById("statEarnings");

      if (elTotal) elTotal.textContent = total;
      if (elJuniors) elJuniors.textContent = juniorIds.length;
      if (elEarnings) elEarnings.textContent = "Rs. " + totalEarnings;
    });
}

// ========== EARNINGS ==========
function loadEarnings(seniorId) {
  var container = document.getElementById("earningsList");
  if (!container) return;

  db.collection("sessionRequests")
    .where("seniorId", "==", seniorId)
    .where("status", "==", "accepted")
    .onSnapshot(function(snapshot) {
      var total = 0;
      snapshot.forEach(function(doc) { total += doc.data().earnings || 0; });

      var tableRows = "";
      if (snapshot.empty) {
        tableRows = "<tr><td colspan='4' style='text-align:center; color:#aaa; padding:20px;'>No earnings yet.</td></tr>";
      } else {
        snapshot.forEach(function(doc) {
          var s = doc.data();
          tableRows += "<tr><td>" + s.date + "</td><td>" + s.juniorName + "</td><td>" + s.topic + "</td><td>Rs. " + (s.earnings || 0) + "</td></tr>";
        });
      }

      container.innerHTML = "<div style='background:#e8f5e9; border-radius:12px; padding:20px; margin-bottom:20px; text-align:center;'>"
        + "<h2 style='margin:0; color:#388e3c; font-size:32px;'>Rs. " + total + "</h2>"
        + "<p style='margin:6px 0 0; color:#666;'>Total Earnings</p></div>"
        + "<div class='table-container'><table class='data-table' style='width:100%;'>"
        + "<thead><tr><th>Date</th><th>Junior</th><th>Topic</th><th>Amount</th></tr></thead>"
        + "<tbody>" + tableRows + "</tbody></table></div>";
    });
}

// ========== MY JUNIORS ==========
function loadJuniorsList(seniorId) {
  var container = document.getElementById("juniorsList");
  if (!container) return;

  db.collection("sessionRequests")
    .where("seniorId", "==", seniorId)
    .onSnapshot(function(snapshot) {
      if (snapshot.empty) {
        container.innerHTML = "<p style='color:#aaa; padding:20px; text-align:center;'>No juniors yet.</p>";
        return;
      }

      var juniorMap = {};
      snapshot.forEach(function(doc) {
        var d = doc.data();
        if (!juniorMap[d.juniorId]) {
          juniorMap[d.juniorId] = { name: d.juniorName, sessions: 0 };
        }
        juniorMap[d.juniorId].sessions++;
      });

      container.innerHTML = "";
      Object.keys(juniorMap).forEach(function(id) {
        var info = juniorMap[id];
        var card = document.createElement("div");
        card.style.cssText = "background:#fff; border-radius:12px; padding:16px;"
          + "display:flex; justify-content:space-between; align-items:center;"
          + "box-shadow:0 2px 8px rgba(0,0,0,0.06); margin-bottom:12px;";
        card.innerHTML = "<div style='display:flex; align-items:center; gap:14px;'>"
          + "<div style='width:44px; height:44px; background:#e3f2fd; border-radius:50%; display:flex; align-items:center; justify-content:center;'>"
          + "<i class='fas fa-user-graduate' style='color:#1a73e8;'></i></div>"
          + "<div><h4 style='margin:0; color:#333;'>" + info.name + "</h4>"
          + "<p style='margin:4px 0; color:#888; font-size:13px;'>" + info.sessions + " session(s)</p></div></div>"
          + "<button onclick=\"openChat('" + id + "', '" + info.name + "')\" "
          + "style='padding:8px 16px; background:#1a73e8; color:#fff; border:none; border-radius:8px; cursor:pointer;'>Chat</button>";
        container.appendChild(card);
      });
    });
}

// ========== MESSAGES LIST ==========
function loadMessagesList(seniorId) {
  var container = document.getElementById("messagesList");
  if (!container) return;

  db.collection("chats")
    .where("participants", "array-contains", seniorId)
    .onSnapshot(function(snapshot) {
      if (snapshot.empty) {
        container.innerHTML = "<p style='color:#aaa; padding:20px; text-align:center;'>No conversations yet.</p>";
        return;
      }

      container.innerHTML = "";
      snapshot.forEach(function(doc) {
        var chat = doc.data();
        var otherId = chat.participants.find(function(p) { return p !== seniorId; });
        var item = document.createElement("div");
        item.style.cssText = "background:#fff; border-radius:12px; padding:16px;"
          + "display:flex; justify-content:space-between; align-items:center;"
          + "box-shadow:0 2px 8px rgba(0,0,0,0.06); margin-bottom:12px; cursor:pointer;";
        item.innerHTML = "<div style='display:flex; align-items:center; gap:14px;'>"
          + "<div style='width:44px; height:44px; background:#f3e5f5; border-radius:50%; display:flex; align-items:center; justify-content:center;'>"
          + "<i class='fas fa-user' style='color:#7b1fa2;'></i></div>"
          + "<div><h4 style='margin:0; color:#333;'>Junior</h4>"
          + "<p style='margin:4px 0; color:#888; font-size:13px;'>" + (chat.lastMessage || "No messages") + "</p></div></div>"
          + "<i class='fas fa-chevron-right' style='color:#aaa;'></i>";
        item.onclick = function() { openChat(otherId, "Junior"); };
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
  var expertsGrid = document.querySelector(".experts-grid");
  if (!expertsGrid) return;

  expertsGrid.innerHTML = "<p style='color:#888; padding:20px;'>Loading experts...</p>";

  try {
    var snapshot;

    if (category) {
      snapshot = await db.collection("users")
        .where("role", "==", "senior")
        .where("expertise", "==", category)
        .get();
    }

    if (!snapshot || snapshot.empty) {
      snapshot = await db.collection("users")
        .where("role", "==", "senior")
        .get();
    }

    if (snapshot.empty) {
      expertsGrid.innerHTML = "<div style='text-align:center; padding:40px; color:#888;'>"
        + "<i class='fas fa-user-tie' style='font-size:48px; margin-bottom:16px; opacity:0.3; display:block;'></i>"
        + "<p>No experts available yet.</p></div>";
      return;
    }

    renderExperts(snapshot, expertsGrid);

  } catch (err) {
    console.error("Experts load error:", err);
    expertsGrid.innerHTML = "<p style='color:red; padding:20px;'>Could not load experts. Please refresh.</p>";
  }
}

function renderExperts(snapshot, container) {
  container.innerHTML = "";
  snapshot.forEach(function(doc) {
    var e = doc.data();
    var docId = doc.id;
    var card = document.createElement("div");
    card.className = "expert-card";

    var nameStr = e.fullName || "Expert";
    var expertiseStr = capitalize(e.expertise || e.primaryInterest || "Expert");
    var expStr = (e.experience || "10") + "+ years exp";
    var rateStr = "Rs. " + (e.hourlyRate || "500") + "/hr";

    card.innerHTML = "<div class='expert-avatar'><i class='fas fa-user-tie'></i></div>"
      + "<div class='expert-info'>"
      + "<h4>" + nameStr + "</h4>"
      + "<p>" + expertiseStr + "</p>"
      + "<span>" + expStr + "</span>"
      + "<div>" + rateStr + "</div>"
      + "</div>"
      + "<div style='display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;'>"
      + "<button onclick=\"sendSessionRequest('" + docId + "', '" + nameStr + "')\" "
      + "class='btn btn-primary btn-sm' style='flex:1;'>Book Session</button>"
      + "<button onclick=\"openChat('" + docId + "', '" + nameStr + "')\" "
      + "class='btn btn-outline btn-sm' style='flex:1;'>Message</button>"
      + "</div>";

    container.appendChild(card);
  });
}

// ========== SEND SESSION REQUEST ==========
async function sendSessionRequest(seniorId, seniorName) {
  var user = firebase.auth().currentUser;
  if (!user) return;

  var topic = prompt("Session topic for " + seniorName + ":");
  if (!topic) return;

  var date = prompt("Preferred date (DD/MM/YYYY):");
  if (!date) return;

  var time = prompt("Preferred time (e.g. 10:00 AM):");
  if (!time) return;

  var message = prompt("Short message (optional - press Cancel to skip):") || "";

  try {
    var juniorDoc = await db.collection("users").doc(user.uid).get();
    var juniorName = juniorDoc.data().fullName || "Junior";

    await db.collection("sessionRequests").add({
      juniorId: user.uid,
      juniorName: juniorName,
      seniorId: seniorId,
      seniorName: seniorName,
      topic: topic,
      date: date,
      time: time,
      message: message,
      status: "pending",
      earnings: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert("Session request sent to " + seniorName + "! Wait for their response.");

  } catch (err) {
    console.error("Session request error:", err);
    alert("Could not send request. Please try again.");
  }
}

// ========== JUNIOR SESSIONS ==========
function loadJuniorSessions(juniorId) {
  var list = document.querySelector(".sessions-list");
  if (!list) return;

  db.collection("sessionRequests")
    .where("juniorId", "==", juniorId)
    .onSnapshot(function(snapshot) {
      if (snapshot.empty) {
        list.innerHTML = "<div style='text-align:center; padding:40px; color:#aaa;'>"
          + "<i class='fas fa-calendar-plus' style='font-size:48px; margin-bottom:16px; opacity:0.3; display:block;'></i>"
          + "<p>No sessions yet. Book your first session!</p></div>";
        return;
      }

      list.innerHTML = "";
      snapshot.forEach(function(doc) {
        var s = doc.data();
        var color = s.status === "accepted" ? "#4caf50" : s.status === "rejected" ? "#f44336" : "#f57c00";
        var item = document.createElement("div");
        item.className = "session-card";
        item.style.borderLeft = "4px solid " + color;
        item.innerHTML = "<div class='session-info'>"
          + "<div class='expert-avatar'><i class='fas fa-user-tie'></i></div>"
          + "<div class='session-time'>"
          + "<h4 style='margin:0 0 8px;'>" + s.seniorName + "</h4>"
          + "<p>Date: " + s.date + "</p>"
          + "<p>Time: " + s.time + "</p>"
          + "<p>Topic: " + s.topic + "</p>"
          + "</div></div>"
          + "<div class='session-actions'>"
          + "<span style='background:" + color + "20; color:" + color + "; padding:6px 14px; border-radius:20px; font-size:13px; font-weight:600; text-transform:capitalize;'>"
          + s.status + "</span>"
          + "<button onclick=\"openChat('" + s.seniorId + "', '" + s.seniorName + "')\" "
          + "class='btn btn-primary btn-sm'>Chat</button>"
          + "</div>";
        list.appendChild(item);
      });
    });
}

// ========== JUNIOR STATS ==========
function loadJuniorStats(juniorId) {
  db.collection("sessionRequests")
    .where("juniorId", "==", juniorId)
    .onSnapshot(function(snapshot) {
      var total = snapshot.size;
      var upcoming = 0;
      var spent = 0;

      snapshot.forEach(function(doc) {
        var d = doc.data();
        if (d.status === "accepted") upcoming++;
        spent += d.earnings || 0;
      });

      var cards = document.querySelectorAll(".stat-info h3");
      if (cards[0]) cards[0].textContent = total;
      if (cards[2]) cards[2].textContent = "Rs. " + spent;
      if (cards[3]) cards[3].textContent = upcoming;
    });
}

// ========== CHAT ==========
function openChat(receiverId, receiverName) {
  var user = firebase.auth().currentUser;
  if (!user) return;
  var chatId = [user.uid, receiverId].sort().join("_");
  showChatModal(chatId, receiverId, receiverName, user.uid);
}

function showChatModal(chatId, receiverId, receiverName, senderId) {
  var existing = document.getElementById("chatModal");
  if (existing) existing.remove();

  var modal = document.createElement("div");
  modal.id = "chatModal";
  modal.style.cssText = "position:fixed; bottom:20px; right:20px; width:320px; height:450px;"
    + "background:#fff; border-radius:18px; box-shadow:0 8px 32px rgba(0,0,0,0.2);"
    + "display:flex; flex-direction:column; z-index:99999; overflow:hidden;";

  modal.innerHTML = "<div style='background:#1a73e8; color:#fff; padding:14px 16px; display:flex; justify-content:space-between; align-items:center;'>"
    + "<span><i class='fas fa-comment-dots'></i>  " + receiverName + "</span>"
    + "<button onclick=\"document.getElementById('chatModal').remove()\" "
    + "style='background:none; border:none; color:#fff; font-size:20px; cursor:pointer;'>x</button>"
    + "</div>"
    + "<div id='chatMessages' style='flex:1; overflow-y:auto; padding:12px; background:#f5f7ff; display:flex; flex-direction:column; gap:8px;'>"
    + "<p style='text-align:center; color:#aaa; font-size:13px;'>Loading...</p>"
    + "</div>"
    + "<div style='padding:10px; border-top:1px solid #eee; display:flex; gap:8px;'>"
    + "<input id='chatInput' type='text' placeholder='Type a message...' "
    + "style='flex:1; padding:9px 14px; border:1px solid #ddd; border-radius:22px; outline:none; font-size:13px;'>"
    + "<button onclick=\"doSendMessage('" + chatId + "', '" + receiverId + "', '" + senderId + "')\" "
    + "style='background:#1a73e8; color:#fff; border:none; border-radius:50%; width:38px; height:38px; cursor:pointer;'>"
    + "<i class='fas fa-paper-plane'></i></button>"
    + "</div>";

  document.body.appendChild(modal);

  // Enter key support
  var input = document.getElementById("chatInput");
  if (input) {
    input.addEventListener("keypress", function(e) {
      if (e.key === "Enter") doSendMessage(chatId, receiverId, senderId);
    });
  }

  loadMessages(chatId, senderId);
}

function loadMessages(chatId, currentUserId) {
  var div = document.getElementById("chatMessages");
  if (!div) return;

  db.collection("chats").doc(chatId).collection("messages")
    .orderBy("timestamp", "asc")
    .onSnapshot(function(snapshot) {
      if (snapshot.empty) {
        div.innerHTML = "<p style='text-align:center; color:#aaa; font-size:13px; margin-top:20px;'>No messages yet. Say hi!</p>";
        return;
      }
      div.innerHTML = "";
      snapshot.forEach(function(doc) {
        var m = doc.data();
        var isMe = m.senderId === currentUserId;
        var bubble = document.createElement("div");
        bubble.style.cssText = "max-width:78%; padding:9px 13px; border-radius:14px; font-size:13px;"
          + "align-self:" + (isMe ? "flex-end" : "flex-start") + ";"
          + "background:" + (isMe ? "#1a73e8" : "#fff") + ";"
          + "color:" + (isMe ? "#fff" : "#333") + ";"
          + "box-shadow:0 1px 4px rgba(0,0,0,0.1);";
        bubble.textContent = m.text;
        div.appendChild(bubble);
      });
      div.scrollTop = div.scrollHeight;
    });
}

async function doSendMessage(chatId, receiverId, senderId) {
  var input = document.getElementById("chatInput");
  if (!input) return;
  var text = input.value.trim();
  if (!text) return;
  input.value = "";

  try {
    await db.collection("chats").doc(chatId).collection("messages").add({
      text: text,
      senderId: senderId,
      receiverId: receiverId,
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
document.addEventListener("DOMContentLoaded", function() {
  var logoutBtn = document.querySelector(".logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async function(e) {
      e.preventDefault();
      try {
        await firebase.auth().signOut();
        var page = window.location.pathname;
        if (page.includes("s-dashbord")) {
          window.location.href = "s-login.html";
        } else {
          window.location.href = "j-login.html";
        }
      } catch (err) {
        console.error("Logout error:", err);
        alert("Logout failed. Try again.");
      }
    });
  }
});

// ========== SECTION SWITCHER (Senior) ==========
function showSection(name) {
  var allSections = document.querySelectorAll('[id^="section-"]');
  allSections.forEach(function(s) { s.style.display = "none"; });
  var target = document.getElementById("section-" + name);
  if (target) target.style.display = "block";
}

// ========== CATEGORY SEARCH (Junior) ==========
function searchCategory(category) {
  loadMatchedExperts(category);
  var grid = document.querySelector(".experts-grid");
  if (grid) grid.scrollIntoView({ behavior: "smooth" });
}

// ========== MOBILE SIDEBAR TOGGLE ==========
document.addEventListener("DOMContentLoaded", function() {
  var toggleBtn = document.getElementById("sidebarToggle");
  var sidebar = document.querySelector(".sidebar");
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", function() {
      sidebar.classList.toggle("active");
    });
    // Bahar click karne pe band karo
    document.addEventListener("click", function(e) {
      if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
        sidebar.classList.remove("active");
      }
    });
  }
});

// ========== HELPER ==========
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}
