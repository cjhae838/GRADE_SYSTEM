// ===== Presentation Viewer / Session Control =====
// Depends on classroom.js.
// Teacher mode: requires an active session (loads or redirects to dashboard).
// Student mode: ?room=CODE, polls get_active_session for the current presentation.

const POLL_INTERVAL_MS = 4000;
const PDF_URL_TTL_MS = 55 * 60 * 1000; // 55 min buffer before 1hr signed URL expiry

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

function setPresentation(title, presentationId, pdfPath) {
  if (title) {
    document.getElementById("viewerTitle").textContent = title;
  } else {
    document.getElementById("viewerTitle").textContent = "Waiting for the teacher to select a project...";
  }
  // initial view is the Documentation (PDF) tab
  const docsTab = document.querySelector(".viewer-tab[data-tab='docs']");
  if (docsTab) switchTab("docs", docsTab);
  // Load PDF if we have a presentation ID and path
  if (presentationId && pdfPath) {
    showPdf(presentationId, pdfPath);
  } else {
    hidePdf();
  }
}

function hidePdf() {
  document.getElementById("pdfFrame").classList.add("hidden");
  document.getElementById("pdfLoading").classList.add("hidden");
  document.getElementById("pdfError").classList.add("hidden");
}

async function loadPdfUrl(presentationId, pdfPath) {
  const cacheKey = `pdf_url_${presentationId}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    const { url, expires } = JSON.parse(cached);
    if (Date.now() < expires) {
      console.log(`[PDF] Cache hit for ${presentationId}`);
      return url;
    }
  }
  if (!pdfPath) throw new Error("No PDF path available");
  console.log(`[PDF] Generating signed URL for: ${pdfPath}`);
  // Don't encode the full path - Supabase expects literal '/' separators
  const signUrl = `${SUPABASE_URL}/storage/v1/object/sign/presentations/${pdfPath}`;
  console.log(`[PDF] POST ${signUrl}`);
  const res = await fetch(signUrl, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: 3600 }),
  });
  console.log(`[PDF] Response status: ${res.status}`);
  if (!res.ok) {
    const errText = await res.text();
    console.error(`[PDF] Signed URL fetch failed (${res.status}):`, errText);
    throw new Error(`Signed URL fetch failed (${res.status}): ${errText}`);
  }
  const data = await res.json();
  console.log(`[PDF] Response data:`, data);
  // data.signedURL is like "/storage/v1/object/sign/..." - DO NOT prepend /storage/v1
  const url = `${SUPABASE_URL}${data.signedURL}`;
  console.log(`[PDF] Final signed URL: ${url}`);
  sessionStorage.setItem(cacheKey, JSON.stringify({ url, expires: Date.now() + PDF_URL_TTL_MS }));
  return url;
}

async function showPdf(presentationId, pdfPath) {
  const frame = document.getElementById("pdfFrame");
  const loading = document.getElementById("pdfLoading");
  const error = document.getElementById("pdfError");
  loading.classList.remove("hidden");
  frame.classList.add("hidden");
  error.classList.add("hidden");
  try {
    console.log(`[PDF] Loading PDF for presentation: ${presentationId}, path: ${pdfPath}`);
    const url = await loadPdfUrl(presentationId, pdfPath);
    console.log(`[PDF] Setting iframe src`);
    frame.src = url;
    frame.onload = () => {
      console.log(`[PDF] iframe loaded successfully`);
      loading.classList.add("hidden");
      frame.classList.remove("hidden");
    };
    frame.onerror = (e) => {
      console.error(`[PDF] iframe onerror:`, e);
      loading.classList.add("hidden");
      error.classList.remove("hidden");
    };
  } catch (err) {
    console.error(`[PDF] showPdf error:`, err);
    loading.classList.add("hidden");
    error.classList.remove("hidden");
  }
}

function retryPdf() {
  if (activeSession?.current_presentation_id && activeSession?.pdf_path) {
    showPdf(activeSession.current_presentation_id, activeSession.pdf_path);
  }
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
    setPresentation(current ? current.title : "", current ? current.id : null, current ? current.pdf_path : null);
    document.getElementById("pickerHint").textContent = "Switch presentation anytime.";
  } else {
    setPresentation("", null, null);
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
    const changed = session.current_presentation_id !== activeSession.current_presentation_id ||
                    session.presentation_title !== activeSession.presentation_title;
    activeSession = session;
    setPresentation(session.presentation_title, session.current_presentation_id, session.pdf_path);
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
  // Initial poll to load presentation and PDF immediately
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