// ===== Presentation Viewer / Session Control =====
// Depends on classroom.js.
// Teacher mode: requires an active session (loads or redirects to dashboard).
// Student mode: uses Supabase Realtime for instant presentation updates.

// Initialize Supabase client for Realtime
const supabaseClient = window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let realtimeChannel = null;

let activeSession = null;

// PDF.js state
let pdfDoc = null;
let pdfScale = 1.0; // 1.0 = fit-width, >1 = zoom in, <1 = zoom out
let pdfIsFullscreen = false;

function isTeacher() {
  return !!localStorage.getItem("admin_account");
}

function showSessionEnded() {
  if (realtimeChannel) { realtimeChannel.unsubscribe(); realtimeChannel = null; }
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
  pdfScale = 1.0;
  // Hide all PDF-related elements and clear canvases
  document.getElementById("pdfViewer").classList.add("hidden");
  document.getElementById("pdfToolbar").classList.add("hidden");
  document.getElementById("pdfLoading").classList.add("hidden");
  document.getElementById("pdfError").classList.add("hidden");
  const container = document.getElementById("pdfContentArea");
  if (container) container.innerHTML = "";
  updatePdfToolbar();
}

async function loadPdfBlob(publicUrl) {
  console.log(`[PDF] Fetching PDF blob from public URL`);
  const res = await fetch(publicUrl);
  if (!res.ok) throw new Error(`PDF fetch failed (${res.status})`);
  return res.arrayBuffer();
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
  
  loading.classList.remove("hidden");
  viewer.classList.add("hidden");
  error.classList.add("hidden");
  
  // Reset PDF state
  if (pdfDoc) {
    pdfDoc.destroy();
    pdfDoc = null;
  }
  pdfScale = 1.0; // reset to fit-width
  
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
    
    // Initialize fit-width scale
    await initializeFitWidth();
    
    // Render all pages at fit-width
    await renderAllPages();
    
    // Show viewer
    loading.classList.add("hidden");
    viewer.classList.remove("hidden");
    document.getElementById("pdfToolbar").classList.remove("hidden");
    updatePdfToolbar();
    
  } catch (err) {
    console.error(`[PDF] showPdf error:`, err);
    loading.classList.add("hidden");
    error.classList.remove("hidden");
  }
}

// Calculate exact fit-width scale based on container width
async function calculateFitWidthScale() {
  if (!pdfDoc) return 1.0;
  const container = document.getElementById("pdfContentArea");
  if (!container) return 1.0;
  
  const page = await pdfDoc.getPage(1);
  const viewport = page.getViewport({ scale: 1.0 });
  const containerWidth = container.clientWidth;
  return containerWidth / viewport.width;
}

// Calculate and set initial fit-width scale
async function initializeFitWidth() {
  if (!pdfDoc) return;
  const fitWidthScale = await calculateFitWidthScale();
  pdfScale = fitWidthScale;
  updatePdfToolbar();
}

async function renderAllPages() {
  if (!pdfDoc) return;
  
  // Use pdfScale directly (no fit-width multiplication)
  const scale = pdfScale;
  
  console.log(`[PDF] Rendering ${pdfDoc.numPages} pages at scale ${scale.toFixed(3)} (zoom: ${pdfScale.toFixed(2)})`);
  
  // Clear existing canvases
  const containerEl = document.getElementById("pdfContentArea");
  if (!containerEl) return;
  containerEl.innerHTML = "";
  
  // Get all page viewports at current scale
  const viewports = [];
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: pdfScale });
    viewports.push(viewport);
  }
  
  // Create canvas for each page at exact scale with high-DPI support
  const dpr = window.devicePixelRatio || 1;
  
  for (let i = 0; i < viewports.length; i++) {
    const page = await pdfDoc.getPage(i + 1);
    const viewport = await pdfDoc.getPage(i + 1).then(p => p.getViewport({ scale: pdfScale }));
    
    // Create canvas for this page
    const canvas = document.createElement("canvas");
    canvas.className = "pdf-page-canvas";
    const context = canvas.getContext("2d");
    
    // Set canvas size for high-DPI rendering
    canvas.width = viewport.width * dpr;
    canvas.height = viewport.height * dpr;
    canvas.style.width = viewport.width + "px";
    canvas.style.height = viewport.height + "px";
    
    // Scale context for high-DPI
    context.scale(dpr, dpr);
    
    // Render page to canvas
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    document.getElementById("pdfContentArea").appendChild(canvas);
  }
  
  console.log(`[PDF] Rendered ${pdfDoc.numPages} canvases at scale ${pdfScale.toFixed(3)}`);
  updatePdfToolbar();
}

async function reRenderAllPages() {
  // Destroy existing canvases and re-render at new scale
  document.getElementById("pdfContentArea").innerHTML = "";
  await renderAllPages();
}

function updatePdfToolbar() {
  const zoomLevel = document.getElementById("pdfZoomLevel");
  const zoomOutBtn = document.getElementById("pdfZoomOutBtn");
  const zoomInBtn = document.getElementById("pdfZoomInBtn");
  const fitWidthBtn = document.getElementById("pdfFitWidthBtn");
  const fullscreenBtn = document.getElementById("pdfFullscreenBtn");
  
  if (pdfDoc) {
    zoomLevel.textContent = `${Math.round(pdfScale * 100)}%`;
    zoomOutBtn.disabled = pdfScale <= 0.25;
    zoomInBtn.disabled = pdfScale >= 2.0;
    fitWidthBtn.disabled = false;
    fullscreenBtn.disabled = false;
  } else {
    zoomLevel.textContent = "100%";
    zoomOutBtn.disabled = true;
    zoomInBtn.disabled = true;
    fitWidthBtn.disabled = true;
    fullscreenBtn.disabled = true;
  }
}

function pdfZoomIn() {
  if (pdfScale < 2.0) {
    pdfScale = Math.min(2.0, pdfScale * 1.25);
    reRenderAllPages();
  }
}

function pdfZoomOut() {
  if (pdfScale > 0.25) {
    pdfScale = Math.max(0.25, pdfScale / 1.25);
    reRenderAllPages();
  }
}

function pdfFitWidth() {
  if (pdfDoc) {
    initializeFitWidth().then(() => {
      reRenderAllPages();
    });
  }
}

function pdfToggleFullscreen() {
  const viewer = document.getElementById("pdfViewer");
  if (!pdfIsFullscreen) {
    viewer.requestFullscreen().catch(() => {});
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

// Fetch initial session data on join
async function fetchInitialSession(room) {
  try {
    const session = await activeSessionByCode(room);
    if (!session) { showSessionEnded(); return; }
    activeSession = session;
    setPresentation(session.presentation_title, session.current_presentation_id, session.pdf_path, session.pdf_public_url);
  } catch { showSessionEnded(); }
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
  
  // Realtime subscription with reconnection logic
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000; // 1s
  const maxReconnectDelay = 30000; // 30s max
  
  function subscribeToSession(room) {
    // Channel topic matches database trigger: room:<room_code>:sessions
    realtimeChannel = supabaseClient
      .channel(`room:${room}:sessions`, {
        config: { broadcast: { self: false } }
      })
      // Listen for database-triggered broadcasts
      .on('broadcast', { event: '*' }, payload => {
        // Database trigger sends: { new, old, op, ... }
        const session = payload.payload?.new;
        const op = payload.payload?.op; // 'INSERT', 'UPDATE', 'DELETE'
        
        if (!session || session.status === 'ended') {
          showSessionEnded();
          return;
        }
        
        const changed = session.current_presentation_id !== activeSession.current_presentation_id ||
                        session.presentation_title !== activeSession.presentation_title;
        activeSession = session;
        
        // Get presentation details for PDF
        if (session.current_presentation_id) {
          listPresentations().then(rows => {
            const current = rows.find(p => p.id === session.current_presentation_id);
            if (current) {
              const pdfPublicUrl = current.pdf_path
                ? `https://ruiikjyiqsfrzwqymixs.supabase.co/storage/v1/object/public/presentations/${current.pdf_path}`
                : null;
              setPresentation(session.presentation_title, session.current_presentation_id, session.pdf_path, pdfPublicUrl);
            }
          });
        } else {
          setPresentation(session.presentation_title, session.current_presentation_id, session.pdf_path, session.pdf_public_url);
        }
      })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Subscribed to room ${room}:sessions`);
          reconnectAttempts = 0; // Reset on success
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`[Realtime] Subscription error: ${status}`, err);
          handleReconnect(room);
        }
      });
  }
  
  function handleReconnect(room) {
    if (reconnectAttempts >= 10) {
      console.error('[Realtime] Max reconnect attempts reached');
      showSessionEnded();
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    reconnectAttempts++;
    console.log(`[Realtime] Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/10)`);
    setTimeout(() => subscribeToSession(room), delay);
  }
  
  // Initial subscription
  subscribeToSession(room);
  
  // Also fetch initial session data
  fetchInitialSession(room);
}

function leaveRoom() {
  if (realtimeChannel) { realtimeChannel.unsubscribe(); realtimeChannel = null; }
  window.location.href = "join.html";
}

function showSessionEnded() {
  if (realtimeChannel) { realtimeChannel.unsubscribe(); realtimeChannel = null; }
  document.getElementById("sessionEnded").classList.remove("hidden");
}

function leaveRoom() {
  if (realtimeChannel) { realtimeChannel.unsubscribe(); realtimeChannel = null; }
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

let resizeTimeout = null;
function debouncedReRender() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (pdfDoc) {
      reRenderAllPages();
    }
  }, 150);
}

(async function init() {
  window.addEventListener("resize", debouncedReRender);
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