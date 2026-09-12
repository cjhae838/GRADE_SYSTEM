// ===== DOM Elements =====
const passwordModal = document.getElementById("passwordModal");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const passwordError = document.getElementById("passwordError");
const adminDashboard = document.getElementById("adminDashboard");
const accountBadge = document.getElementById("accountBadge");
const uploadModal = document.getElementById("uploadModal");
const csvFileInput = document.getElementById("csvFileInput");
const uploadArea = document.getElementById("uploadArea");
const fileName = document.getElementById("fileName");
const uploadBtn = document.getElementById("uploadBtn");
const uploadStatus = document.getElementById("uploadStatus");
const sectionFilter = document.getElementById("sectionFilter");
const gradesCount = document.getElementById("gradesCount");
const gradesTableWrapper = document.getElementById("gradesTableWrapper");
const gradesTable = document.getElementById("gradesTable");
const gradesTableBody = document.getElementById("gradesTableBody");
const gradesEmptyState = document.getElementById("gradesEmptyState");
const gradesLoading = document.getElementById("gradesLoading");
const loggingInModal = document.getElementById("loggingInModal");
const loggingOutModal = document.getElementById("loggingOutModal");

const SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const MIN_MODAL_DISPLAY_MS = 2000; // 2 seconds minimum display time

// ===== Helpers =====
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ===== Auth Helpers =====
function findAccountByPassword(password) {
  return ADMIN_ACCOUNTS.find((a) => a.password === password);
}

function showError(msg) {
  passwordError.textContent = msg;
  passwordError.classList.remove("hidden");
}

function hideError() {
  passwordError.classList.add("hidden");
}

// ===== Session Management =====
async function recordActivity(accountName) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/admin_sessions`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        account_name: accountName,
        last_activity: new Date().toISOString(),
      }),
    });
  } catch {
    // Non-critical — ignore errors
  }
}

async function isSessionActive(accountName) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_sessions?account_name=eq.${encodeURIComponent(accountName)}&select=last_activity`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    if (!response.ok) return false;
    const data = await response.json();
    if (data.length === 0) return false;
    const lastActive = new Date(data[0].last_activity);
    const now = new Date();
    return now - lastActive < SESSION_TIMEOUT_MS;
  } catch {
    return false;
  }
}

async function deleteSession(accountName) {
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/admin_sessions?account_name=eq.${encodeURIComponent(accountName)}`,
      {
        method: "DELETE",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
  } catch {
    // Ignore errors on logout
  }
}

// ===== Auth =====
async function checkAuth() {
  const auth = sessionStorage.getItem("admin_auth");
  const account = sessionStorage.getItem("admin_account");

  if (auth === "true" && account) {
    loggingInModal.classList.remove("hidden");
    const startTime = Date.now();
    const active = await isSessionActive(account);
    if (active) {
      // Session still active — auto-login
      await recordActivity(account);
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_MODAL_DISPLAY_MS) {
        await wait(MIN_MODAL_DISPLAY_MS - elapsed);
      }
      loggingInModal.classList.add("hidden");
      showDashboard(account);
      return;
    } else {
      // Session expired — clear and show login
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_MODAL_DISPLAY_MS) {
        await wait(MIN_MODAL_DISPLAY_MS - elapsed);
      }
      loggingInModal.classList.add("hidden");
      clearSession();
    }
  }
}

async function attemptLogin() {
  const pw = passwordInput.value;
  hideError();

  if (!pw) {
    showError("Please enter a password.");
    return;
  }

  const account = findAccountByPassword(pw);
  if (!account) {
    showError("Incorrect password. Try again.");
    passwordInput.value = "";
    passwordInput.focus();
    return;
  }

  // Show loading modal
  loggingInModal.classList.remove("hidden");
  const startTime = Date.now();

  // Check if account already has an active session
  const active = await isSessionActive(account.name);
  if (active) {
    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_MODAL_DISPLAY_MS) {
      await wait(MIN_MODAL_DISPLAY_MS - elapsed);
    }
    loggingInModal.classList.add("hidden");
    showError("This account is already active. Log out from the other session first.");
    passwordInput.value = "";
    passwordInput.focus();
    return;
  }

  // Create session — record activity
  await recordActivity(account.name);

  // Store session in sessionStorage
  sessionStorage.setItem("admin_auth", "true");
  sessionStorage.setItem("admin_account", account.name);

  const elapsed = Date.now() - startTime;
  if (elapsed < MIN_MODAL_DISPLAY_MS) {
    await wait(MIN_MODAL_DISPLAY_MS - elapsed);
  }
  loggingInModal.classList.add("hidden");
  showDashboard(account.name);
}

async function logout() {
  loggingOutModal.classList.remove("hidden");
  const startTime = Date.now();
  const account = sessionStorage.getItem("admin_account");
  if (account) {
    await deleteSession(account);
  }
  clearSession();
  const elapsed = Date.now() - startTime;
  if (elapsed < MIN_MODAL_DISPLAY_MS) {
    await wait(MIN_MODAL_DISPLAY_MS - elapsed);
  }
  loggingOutModal.classList.add("hidden");
  passwordModal.classList.remove("hidden");
  adminDashboard.classList.add("hidden");
  passwordInput.value = "";
  hideError();
}

function clearSession() {
  sessionStorage.removeItem("admin_auth");
  sessionStorage.removeItem("admin_account");
}

function showDashboard(accountName) {
  passwordModal.classList.add("hidden");
  adminDashboard.classList.remove("hidden");
  accountBadge.textContent = accountName;
  loadSections();
}

passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") attemptLogin();
});

// ===== Upload Modal =====
function openUploadModal() {
  uploadModal.classList.remove("hidden");
  resetUploadForm();
}

function closeUploadModal() {
  uploadModal.classList.add("hidden");
  resetUploadForm();
}

function resetUploadForm() {
  csvFileInput.value = "";
  fileName.classList.add("hidden");
  uploadBtn.classList.add("hidden");
  uploadStatus.classList.add("hidden");
  uploadArea.classList.remove("dragover");
}

// Close modal on backdrop click
uploadModal.addEventListener("click", (e) => {
  if (e.target === uploadModal) closeUploadModal();
});

// Close modal on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !uploadModal.classList.contains("hidden")) {
    closeUploadModal();
  }
});

// ===== CSV File Handling =====
csvFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    fileName.textContent = file.name;
    fileName.classList.remove("hidden");
    uploadBtn.classList.remove("hidden");
    uploadStatus.classList.add("hidden");
  }
});

uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadArea.classList.add("dragover");
});

uploadArea.addEventListener("dragleave", () => {
  uploadArea.classList.remove("dragover");
});

uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadArea.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith(".csv")) {
    csvFileInput.files = e.dataTransfer.files;
    fileName.textContent = file.name;
    fileName.classList.remove("hidden");
    uploadBtn.classList.remove("hidden");
    uploadStatus.classList.add("hidden");
  }
});

// ===== CSV Upload =====
async function uploadCSV() {
  const file = csvFileInput.files[0];
  if (!file) {
    showUploadStatus("Please select a CSV file.", "error");
    return;
  }

  uploadBtn.disabled = true;
  uploadBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
      <line x1="12" y1="2" x2="12" y2="6"/>
      <line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
      <line x1="2" y1="12" x2="6" y2="12"/>
      <line x1="18" y1="12" x2="22" y2="12"/>
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
    </svg>
    Uploading...
  `;

  try {
    const text = await file.text();
    const { headers, rows } = parseCSV(text);

    if (rows.length === 0) {
      showUploadStatus("CSV file is empty or has no valid rows.", "error");
      uploadBtn.disabled = false;
      resetUploadBtn();
      return;
    }

    const requiredCols = ["P/M/F", "SUBJECT", "SECTION", "STUDENT NO.", "STUDENT NAME", "PRELIM"];
    const normalizedHeaders = headers.map(normalizeHeader);
    const normalizedRequired = requiredCols.map(normalizeHeader);
    const missingCols = normalizedRequired.filter((col) => !normalizedHeaders.includes(col));

    if (missingCols.length > 0) {
      showUploadStatus(`Missing columns: ${missingCols.join(", ")}. Found: ${headers.join(", ")}`, "error");
      uploadBtn.disabled = false;
      resetUploadBtn();
      return;
    }

    const headerIndex = {};
    headers.forEach((h, i) => {
      headerIndex[normalizeHeader(h)] = i;
    });

    const gradeRows = [];
    for (const row of rows) {
      const period = row[headerIndex["P/M/F"]]?.trim().toUpperCase();
      if (!["P", "M", "F"].includes(period)) continue;

      const subjectCode = row[headerIndex["SUBJECT"]]?.trim();
      if (!subjectCode) continue;

      const section = row[headerIndex["SECTION"]]?.trim();
      if (!section) continue;

      const studentNo = row[headerIndex["STUDENT NO."]]?.trim();
      if (!studentNo) continue;

      const studentName = row[headerIndex["STUDENT NAME"]]?.trim();
      if (!studentName) continue;

      const grade = parseFloat(row[headerIndex["PRELIM"]]);
      if (isNaN(grade)) continue;

      const encryptedStudentNo = await CryptoModule.encrypt(studentNo);
      const encryptedStudentName = await CryptoModule.encrypt(studentName);
      const encryptedSection = await CryptoModule.encrypt(section);

      gradeRows.push({
        period,
        subject_code: subjectCode,
        section: encryptedSection,
        student_no: encryptedStudentNo,
        student_name: encryptedStudentName,
        grade,
      });
    }

    if (gradeRows.length === 0) {
      showUploadStatus("No valid rows found in CSV.", "error");
      uploadBtn.disabled = false;
      resetUploadBtn();
      return;
    }

    // Record activity before upload
    const account = sessionStorage.getItem("admin_account");
    if (account) await recordActivity(account);

    let inserted = 0;
    for (let i = 0; i < gradeRows.length; i += 50) {
      const batch = gradeRows.slice(i, i + 50);
      const response = await fetch(`${SUPABASE_URL}/rest/v1/grades`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error("Insert error:", err);
        showUploadStatus(`Error inserting rows: ${err}`, "error");
        uploadBtn.disabled = false;
        resetUploadBtn();
        return;
      }
      inserted += batch.length;
    }

    showUploadStatus(`Successfully uploaded ${inserted} rows.`, "success");
    loadSections();

    // Auto-load if a section is selected
    if (sectionFilter.value) {
      loadGrades();
    }
  } catch (err) {
    console.error("Upload error:", err);
    showUploadStatus("An error occurred during upload.", "error");
  } finally {
    uploadBtn.disabled = false;
    resetUploadBtn();
  }
}

function resetUploadBtn() {
  uploadBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
    Upload to Database
  `;
}

// CSV parser - auto-detects delimiter (comma or tab), handles quoted values
function parseCSV(text) {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const firstLine = lines[0];
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = tabCount > commaCount ? "\t" : ",";

  function splitLine(line) {
    const row = [];
    let current = "";
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        row.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    row.push(current.trim());
    return row;
  }

  const headerLine = splitLine(lines[0]);
  const headers = headerLine.map((h) => h.trim());

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    rows.push(splitLine(lines[i]));
  }
  return { headers, rows };
}

function normalizeHeader(h) {
  return h.toUpperCase().replace(/\s+/g, " ").trim();
}

function showUploadStatus(msg, type) {
  uploadStatus.textContent = msg;
  uploadStatus.className = `upload-status ${type}`;
}

// ===== Sections =====
async function loadSections() {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/grades?select=section&order=section`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (!response.ok) {
      console.error("Failed to load sections:", await response.text());
      return;
    }

    const data = await response.json();
    const decryptedSections = await Promise.all(
      data.map((row) => CryptoModule.decrypt(row.section))
    );
    const unique = [...new Set(decryptedSections)].sort();

    const currentVal = sectionFilter.value;
    sectionFilter.innerHTML = '<option value="">Select a section</option>';
    unique.forEach((sec) => {
      const opt = document.createElement("option");
      opt.value = sec;
      opt.textContent = sec;
      sectionFilter.appendChild(opt);
    });

    // Restore previous selection if still valid
    if (currentVal && unique.includes(currentVal)) {
      sectionFilter.value = currentVal;
    }
  } catch (err) {
    console.error("Error loading sections:", err);
    sectionFilter.innerHTML = '<option value="">Error loading sections</option>';
  }
}

// Auto-load grades when section changes
sectionFilter.addEventListener("change", async () => {
  if (sectionFilter.value) {
    const account = sessionStorage.getItem("admin_account");
    if (account) await recordActivity(account);
    loadGrades();
  } else {
    showEmptyState();
  }
});

// ===== Grade Viewer =====
async function loadGrades() {
  const section = sectionFilter.value;
  if (!section) {
    showEmptyState();
    return;
  }

  showLoading();
  gradesCount.textContent = "";

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/grades?select=period,subject_code,section,student_no,student_name,grade&order=student_no,subject_code`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (!response.ok) {
      console.error("Failed to load grades:", await response.text());
      showEmptyState();
      return;
    }

    const data = await response.json();

    // Decrypt and filter by section
    const decryptedRows = [];
    for (const row of data) {
      const decryptedSection = await CryptoModule.decrypt(row.section);
      if (decryptedSection === section) {
        decryptedRows.push({
          student_no: await CryptoModule.decrypt(row.student_no),
          student_name: await CryptoModule.decrypt(row.student_name),
          subject_code: row.subject_code,
          period: row.period,
          grade: row.grade,
        });
      }
    }

    if (decryptedRows.length === 0) {
      gradesEmptyState.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="40" height="40">
          <circle cx="12" cy="12" r="10"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        <p>No grades found for this section</p>
      `;
      gradesEmptyState.classList.remove("hidden");
      gradesLoading.classList.add("hidden");
      gradesTable.classList.add("hidden");
      gradesCount.textContent = "";
      return;
    }

    // Group by student_no + subject_code
    const gradesMap = {};
    decryptedRows.forEach((row) => {
      const key = `${row.student_no}|${row.subject_code}`;
      if (!gradesMap[key]) {
        gradesMap[key] = {
          student_no: row.student_no,
          student_name: row.student_name,
          subject_code: row.subject_code,
          prelim: null,
          midterm: null,
          final: null,
        };
      }
      if (row.period === "P") gradesMap[key].prelim = row.grade;
      else if (row.period === "M") gradesMap[key].midterm = row.grade;
      else if (row.period === "F") gradesMap[key].final = row.grade;
    });

    // Render grouped table
    const entries = Object.values(gradesMap);
    gradesTableBody.innerHTML = "";
    let prevStudentNo = "";

    entries.forEach((g) => {
      const isNewStudent = g.student_no !== prevStudentNo;
      prevStudentNo = g.student_no;

      const tr = document.createElement("tr");
      if (isNewStudent) tr.classList.add("student-first-row");

      tr.innerHTML = `
        <td>${isNewStudent ? escapeHtml(g.student_no) : ""}</td>
        <td>${isNewStudent ? escapeHtml(g.student_name) : ""}</td>
        <td>${escapeHtml(g.subject_code)}</td>
        <td class="grade-cell ${getGradeClass(g.prelim)}">${g.prelim ?? "N/A"}</td>
        <td class="grade-cell ${getGradeClass(g.midterm)}">${g.midterm ?? "N/A"}</td>
        <td class="grade-cell ${getGradeClass(g.final)}">${g.final ?? "N/A"}</td>
      `;
      gradesTableBody.appendChild(tr);
    });

    gradesEmptyState.classList.add("hidden");
    gradesLoading.classList.add("hidden");
    gradesTable.classList.remove("hidden");

    // Count unique students
    const uniqueStudents = new Set(entries.map((g) => g.student_no)).size;
    gradesCount.textContent = `${entries.length} records \u00B7 ${uniqueStudents} students`;
  } catch (err) {
    console.error("Error loading grades:", err);
    showEmptyState();
  }
}

function showEmptyState() {
  gradesEmptyState.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="40" height="40">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
    <p>Select a section to view grades</p>
  `;
  gradesEmptyState.classList.remove("hidden");
  gradesLoading.classList.add("hidden");
  gradesTable.classList.add("hidden");
  gradesCount.textContent = "";
}

function showLoading() {
  gradesEmptyState.classList.add("hidden");
  gradesLoading.classList.remove("hidden");
  gradesTable.classList.add("hidden");
}

function getGradeClass(grade) {
  if (grade === null || grade === undefined) return "none";
  if (grade >= 90) return "pass";
  if (grade >= 75) return "warn";
  return "fail";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ===== Init =====
checkAuth();
