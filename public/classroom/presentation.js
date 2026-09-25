// ===== Presentation Viewer / Session Control =====
// Depends on classroom.js.
// Teacher mode: requires an active session (loads or redirects to dashboard).
// Student mode: ?room=CODE, polls get_active_session for the current presentation.

const POLL_INTERVAL_MS = 4000;

let activeSession = null;
let studentPoll = null;

// PDF.js state
let pdfDoc = null;
let pdfPageNum = 1;
let pdfScale = 1.0;
let pdfIsFullscreen = false;

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

function setPresentation(title, presentationId, pdfPath, pdfPublicUrl) {
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
    showPdf(presentationId, pdfPath, pdfPublicUrl);
  } else {
    hidePdf();
  }
}

function hidePdf() {
  // Clean up PDF.js state
  if (pdfDoc) {
    pdfDoc.destroy();
    pdfDoc = null;
  }
  pdfPageNum = 1;
  pdfScale = 1.0;
  // Hide all PDF-related elements
  document.getElementById("pdfViewer").classList.add("hidden");
  document.getElementById("pdfLoading").classList.add("hidden");
  document.getElementById("pdfError").classList.add("hidden");
  updatePdfToolbar();
}

async function loadPdfBlob(publicUrl) {
  console.log(`[PDF] Fetching PDF blob from public URL`);
  const res = await fetch(publicUrl);
  if (!res.ok) throw new Error(`PDF fetch failed (${res.status})`);
  return res.blob();
}

// Lazy-load PDF.js from CDN
let pdfjsLib = null;
async function loadPdfjs() {
  if (pdfjsLib) return pdfjsLib;
  console.log(`[PDF] Loading PDF.js from CDN`);
  await new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      pdfjsLib = window.pdfjsLib;
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
    script.type = 'module';
    script.onload = () => {
      pdfjsLib = window.pdfjsLib;
      if (pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
      }
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js'));
    document.head.appendChild(script);
  });
  return pdfjsLib;
}

async function showPdf(presentationId, pdfPath, pdfPublicUrl) {
  const loading = document.getElementById("pdfLoading");
  const error = document.getElementById("pdfError");
  const viewer = document.getElementById("pdfViewer");
  const canvas = document.getElementById("pdfCanvas");
  
  loading.classList.remove("hidden");
  viewer.classList.add("hidden");
  error.classList.add("hidden");
  
  // Reset PDF state
  pdfPageNum = 1;
  pdfScale = 1.0;
  if (pdfDoc) {
    pdfDoc.destroy();
    pdfDoc = null;
  }
  
  try {
    const url = pdfPublicUrl;
    if (!url) {
      throw new Error("No public PDF URL available");
    }
    
    console.log(`[PDF] Loading PDF with PDF.js: ${url}`);
    
    // Load PDF.js if not loaded
    await loadPdfjs();
    
    // Fetch PDF as blob
    const blob = await loadPdfBlob(url);
    
    // Load PDF document
    pdfDoc = await pdfjsLib.getDocument({ data: blob }).promise;
    console.log(`[PDF] PDF loaded, ${pdfDoc.numPages} pages`);
    
    // Render first page
    await renderPdfPage(pdfPageNum, canvas);
    
    // Show viewer
    loading.classList.add("hidden");
    viewer.classList.remove("hidden");
    updatePdfToolbar();
    
  } catch (err) {
    console.error(`[PDF] showPdf error:`, err);
    loading.classList.add("hidden");
    error.classList.remove("hidden");
  }
}

async function renderPdfPage(pageNum, canvas) {
  if (!pdfDoc) return;
  
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: pdfScale });
  
  // Set canvas size
  const context = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  // Render page
  await page.render({
    canvasContext: context,
    viewport: viewport
  }).promise;
  
  updatePdfToolbar();
}

function updatePdfToolbar() {
  const pageInfo = document.getElementById("pdfPageInfo");
  const zoomLevel = document.getElementById("pdfZoomLevel");
  const prevBtn = document.getElementById("pdfPrevBtn");
  const nextBtn = document.getElementById("pdfNextBtn");
  const zoomOutBtn = document.getElementById("pdfZoomOutBtn");
  const zoomInBtn = document.getElementById("pdfZoomInBtn");
  const fullscreenBtn = document.getElementById("pdfFullscreenBtn");
  
  if (pdfDoc) {
    pageInfo.textContent = `Page ${pdfPageNum} of ${pdfDoc.numPages}`;
    zoomLevel.textContent = `${Math.round(pdfScale * 100)}%`;
    prevBtn.disabled = pdfPageNum <= 1;
    nextBtn.disabled = pdfPageNum >= pdfDoc.numPages;
    zoomOutBtn.disabled = false;
    zoomInBtn.disabled = false;
    fullscreenBtn.disabled = false;
  } else {
    pageInfo.textContent = "Page 1 of 1";
    zoomLevel.textContent = "100%";
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    zoomOutBtn.disabled = true;
    zoomInBtn.disabled = true;
    fullscreenBtn.disabled = true;
  }
}

async function pdfPrevPage() {
  if (pdfPageNum > 1) {
    pdfPageNum--;
    await renderPdfPage(pdfPageNum, document.getElementById("pdfCanvas"));
  }
}

async function pdfNextPage() {
  if (pdfDoc && pdfPageNum < pdfDoc.numPages) {
    pdfPageNum++;
    await renderPdfPage(pdfPageNum, document.getElementById("pdfCanvas"));
  }
}

function pdfZoomIn() {
  if (pdfScale < 3.0) {
    pdfScale = Math.min(3.0, pdfScale + 0.25);
    renderPdfPage(pdfPageNum, document.getElementById("pdfCanvas"));
  }
}

function pdfZoomOut() {
  if (pdfScale > 0.5) {
    pdfScale = Math.max(0.5, pdfScale - 0.25);
    renderPdfPage(pdfPageNum, document.getElementById("pdfCanvas"));
  }
}

function pdfToggleFullscreen() {
  const container = document.querySelector(".pdf-canvas-container");
  if (!pdfIsFullscreen) {
    container.requestFullscreen().catch(() => {});
    pdfIsFullscreen = true;
  } else {
    document.exitFullscreen().catch(() => {});
    pdfIsFullscreen = false;
  }
}

function retryPdf() {
  if (activeSession?.current_presentation_id && activeSession?.pdf_path && activeSession?.pdf_public_url) {
    showPdf(activeSession.current_presentation_id, activeSession.pdf_path, activeSession.pdf_public_url);
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
    const pdfPublicUrl = current?.pdf_path
      ? `https://ruiikjyiqsfrzwqymixs.supabase.co/storage/v1/object/public/presentations/${current.pdf_path}`
      : null;
    setPresentation(current ? current.title : "", current ? current.id : null, current ? current.pdf_path : null, pdfPublicUrl);
    document.getElementById("pickerHint").textContent = "Switch presentation anytime.";
  } else {
    setPresentation("", null, null, null);
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
    setPresentation(session.presentation_title, session.current_presentation_id, session.pdf_path, session.pdf_public_url);
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