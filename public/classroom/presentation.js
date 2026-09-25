// ===== Presentation Viewer / Session Control =====
// Depends on classroom.js.
// Teacher mode: requires an active session (loads or redirects to dashboard).
// Student mode: ?room=CODE, polls get_active_session for the current presentation.

const POLL_INTERVAL_MS = 4000;

let activeSession = null;
let studentPoll = null;

function isTeacher() {
  return !!localStorage.getItem("admin_account");
}

function showSessionEnded() {
  if (studentPoll) { clearInterval(studentPoll); studentPoll = null; }
  document.getElementById("sessionEnded").classList.remove("hidden");
}

function switchTab(tab, btn) {
  document.querySelectorAll(".viewer-tab").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".viewer-content").forEach((p) => p.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("panel-" + tab).classList.add("active");
}

function setPresentation(title) {
  if (title) {
    document.getElementById("viewerTitle").textContent = title;
  } else {
    document.getElementById("viewerTitle").textContent = "Waiting for the teacher to select a project...";
  }
  // initial view is the Documentation (PDF) tab
  const docsTab = document.querySelector(".viewer-tab[data-tab='docs']");
  if (docsTab) switchTab("docs", docsTab);
}

// ===== Teacher mode =====

async function loadTeacherSession() {
  const teacher = encodeURIComponent(getTeacherAccount());
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/sessions?teacher_id=eq.${teacher}&status=eq.active&limit=1&order=created_at.desc`,
    { headers: teacherHeaders() }
  );
  if (!res.ok) throw new Error(`Failed to load session (${res.status})`);
  const rows = await res.json();
  return rows[0] || null;
}

async function renderTeacherSession() {
  document.getElementById("teacherBar").classList.remove("hidden");
  document.getElementById("roomCode").textContent = activeSession.room_code;

  const picker = document.getElementById("presentationPicker");
  picker.value = "";
  picker.innerHTML = '<option value="">Choose a presentation…</option>';

  const rows = await listPresentations();
  for (const p of rows) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.title;
    picker.appendChild(opt);
  }
  if (activeSession.current_presentation_id) {
    picker.value = activeSession.current_presentation_id;
    const current = rows.find((p) => p.id === activeSession.current_presentation_id);
    setPresentation(current ? current.title : "");
    document.getElementById("pickerHint").textContent = "Switch presentation anytime.";
  } else {
    setPresentation("");
    document.getElementById("pickerHint").textContent =
      "Choose a presentation to display to students.";
  }
}

async function switchPresentation(id) {
  const teacher = encodeURIComponent(getTeacherAccount());
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/sessions?id=eq.${activeSession.id}&teacher_id=eq.${teacher}`,
    {
      method: "PATCH",
      headers: teacherHeaders({
        "Content-Type": "application/json",
        Prefer: "return=representation",
      }),
      body: JSON.stringify({ current_presentation_id: id || null }),
    }
  );
  if (!res.ok) throw new Error(`Failed to switch presentation (${res.status})`);
  activeSession = (await res.json())[0];
  await renderTeacherSession();
}

async function endSession() {
  const btn = document.getElementById("endSessionBtn");
  btn.disabled = true;
  const teacher = encodeURIComponent(getTeacherAccount());
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/sessions?id=eq.${activeSession.id}&teacher_id=eq.${teacher}`,
      {
        method: "PATCH",
        headers: teacherHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ status: "ended", ended_at: new Date().toISOString() }),
      }
    );
    if (!res.ok) throw new Error(`Failed to end session (${res.status})`);
    window.location.href = "teacher-dashboard.html";
  } catch (err) {
    console.error("End session failed:", err);
    alert("Could not end the session — try again."); // ponytail: native alert, polish later
    btn.disabled = false;
  }
}

// ===== Student mode =====

async function pollActiveSession() {
  try {
    const session = await activeSessionByCode(activeSession.room_code);
    if (!session) {
      showSessionEnded();
      return;
    }
    if (session.current_presentation_id !== activeSession.current_presentation_id || session.presentation_title !== activeSession.presentation_title) {
      activeSession = session;
      setPresentation(session.presentation_title);
    }
  } catch {
    // transient network error, keep polling
  }
}

function initStudent() {
  const params = new URLSearchParams(window.location.search);
  const room = (params.get("room") || "").trim().toUpperCase();
  if (!room) {
    window.location.href = "join.html";
    return;
  }
  // Ensure teacher bar is hidden for students (CSS specificity fix)
  document.getElementById("teacherBar").classList.add("hidden");
  // Show room code and leave button in viewer header
  document.getElementById("viewerRoomCode").textContent = "Room: " + room;
  document.getElementById("viewerRoomCode").classList.remove("hidden");
  document.getElementById("leaveRoomBtn").classList.remove("hidden");
  activeSession = { room_code: room, current_presentation_id: null, presentation_title: null };
  setPresentation("");
  studentPoll = setInterval(pollActiveSession, POLL_INTERVAL_MS);
  pollActiveSession();
}

function leaveRoom() {
  if (studentPoll) { clearInterval(studentPoll); studentPoll = null; }
  window.location.href = "join.html";
}

async function initTeacher() {
  activeSession = await loadTeacherSession();
  if (!activeSession) {
    window.location.href = "teacher-dashboard.html";
    return;
  }
  await renderTeacherSession();
}

// ===== Boot =====

(async function init() {
  if (isTeacher()) {
    try {
      await initTeacher();
    } catch (err) {
      console.error("Teacher init failed:", err);
      window.location.href = "teacher-dashboard.html";
    }
  } else {
    initStudent();
  }
})();