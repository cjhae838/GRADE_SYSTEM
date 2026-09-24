// ===== Teacher Dashboard: Presentation Management =====
// Depends on classroom.js (auth utils + teacherHeaders).

let presentations = [];
let pendingDeleteId = null;

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function storageObjectUrl(teacherFolder, filename) {
  return `${SUPABASE_URL}/storage/v1/object/presentations/${teacherFolder}/${filename}`;
}

async function listPresentations() {
  const teacher = encodeURIComponent(getTeacherAccount());
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/presentations?teacher_id=eq.${teacher}&order=created_at.desc`,
    { headers: teacherHeaders() }
  );
  if (!res.ok) throw new Error(`Failed to load presentations (${res.status})`);
  return res.json();
}

async function createPresentation(title, pdfFile, pyFile) {
  const teacher = getTeacherAccount();
  const id = crypto.randomUUID();
  const teacherFolder = `${encodeURIComponent(teacher)}/${id}`;
  const pdfPath = `${teacherFolder}/documentation.pdf`;
  const pyPath = `${teacherFolder}/main.py`;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/presentations`, {
    method: "POST",
    headers: teacherHeaders({
      "Content-Type": "application/json",
      Prefer: "return=representation",
    }),
    body: JSON.stringify({
      id,
      teacher_id: teacher,
      title,
      pdf_path: pdfPath,
      python_path: pyPath,
    }),
  });
  if (!res.ok) throw new Error(`Failed to create presentation (${res.status})`);

  try {
    await uploadObject(storageObjectUrl(teacherFolder, "documentation.pdf"), pdfFile);
    await uploadObject(storageObjectUrl(teacherFolder, "main.py"), pyFile);
  } catch (err) {
    // revert the DB row so no dangling entry
    await fetch(`${SUPABASE_URL}/rest/v1/presentations?id=eq.${id}`, {
      method: "DELETE",
      headers: teacherHeaders(),
    }).catch(() => {});
    throw err;
  }
}

async function uploadObject(url, file) {
  const res = await fetch(url, {
    method: "POST",
    headers: teacherHeaders({
      "Content-Type": file.type || "application/octet-stream",
    }),
    body: file,
  });
  if (!res.ok) throw new Error(`File upload failed (${res.status})`);
}

async function deletePresentation(p) {
  // orphan files on failure but still delete the row
  const results = await Promise.allSettled([
    fetch(`${SUPABASE_URL}/storage/v1/object/presentations/${p.pdf_path}`, {
      method: "DELETE",
      headers: teacherHeaders(),
    }),
    fetch(`${SUPABASE_URL}/storage/v1/object/presentations/${p.python_path}`, {
      method: "DELETE",
      headers: teacherHeaders(),
    }),
  ]);
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error("Failed to delete storage file:", r.reason);
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/presentations?id=eq.${p.id}`, {
    method: "DELETE",
    headers: teacherHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete presentation (${res.status})`);
}

// ===== Rendering =====

function renderList() {
  const container = document.getElementById("presentationList");
  if (!presentations.length) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <p>No presentations yet</p>
        <p class="hint">Click "Add Presentation" to upload your first project</p>
      </div>`;
    return;
  }
  container.innerHTML = presentations
    .map(
      (p) => `
      <div class="presentation-card">
        <div class="presentation-info">
          <h3>${escapeHtml(p.title)}</h3>
          <p>${new Date(p.created_at).toLocaleString()} · ${p.pdf_path.split("/").pop()} · ${p.python_path.split("/").pop()}</p>
        </div>
        <div class="presentation-actions">
          <button class="btn btn-danger btn-sm" onclick="openDeletePresentation('${p.id}')">Delete</button>
        </div>
      </div>`
    )
    .join("");
}

// ===== Add Presentation Modal =====

function openAddPresentationModal() {
  document.getElementById("presentationTitle").value = "";
  document.getElementById("pdfFileInput").value = "";
  document.getElementById("pythonFileInput").value = "";
  setAddStatus("", true);
  document.getElementById("addPresentationModal").classList.remove("hidden");
  setTimeout(() => document.getElementById("presentationTitle").focus(), 100);
}

function closeAddPresentationModal() {
  document.getElementById("addPresentationModal").classList.add("hidden");
}

function setAddStatus(msg, hide) {
  const el = document.getElementById("addPresentationStatus");
  el.textContent = msg;
  el.classList.toggle("hidden", hide);
}

async function savePresentation() {
  const title = document.getElementById("presentationTitle").value.trim();
  const pdfFile = document.getElementById("pdfFileInput").files[0];
  const pyFile = document.getElementById("pythonFileInput").files[0];
  const saveBtn = document.getElementById("addPresentationSaveBtn");

  if (!title) return setAddStatus("Enter a title.", false);
  if (!pdfFile) return setAddStatus("Choose a PDF file.", false);
  if (!pyFile) return setAddStatus("Choose a Python file.", false);

  saveBtn.disabled = true;
  setAddStatus("Uploading…", false);
  try {
    await createPresentation(title, pdfFile, pyFile);
    closeAddPresentationModal();
    document.getElementById("presentationList").innerHTML = `<div class="empty-state"><p>Loading…</p></div>`;
    presentations = await listPresentations();
    renderList();
  } catch (err) {
    console.error("Add failed:", err);
    setAddStatus("Upload failed — try again.", false);
  } finally {
    saveBtn.disabled = false;
  }
}

// ===== Delete Presentation Modal =====

function openDeletePresentation(id) {
  const p = presentations.find((x) => x.id === id);
  if (!p) return;
  pendingDeleteId = id;
  document.getElementById("deletePresentationMsg").textContent =
    `Delete "${p.title}"? This also removes its PDF and Python file.`;
  document.getElementById("deletePresentationModal").classList.remove("hidden");
}

function closeDeletePresentationModal() {
  document.getElementById("deletePresentationModal").classList.add("hidden");
  pendingDeleteId = null;
}

async function confirmDeletePresentation() {
  const p = presentations.find((x) => x.id === pendingDeleteId);
  if (!p) return;
  closeDeletePresentationModal();
  try {
    await deletePresentation(p);
    presentations = await listPresentations();
    renderList();
  } catch (err) {
    console.error("Delete failed:", err);
    alert("Delete failed — try again."); // ponytail: native alert, replace with modal error if it recurs
  }
}