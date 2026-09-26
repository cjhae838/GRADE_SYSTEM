// ===== Admin Grades Page Logic =====
// Handles session validation and grade management

import { startInactivityTimer } from './inactivity-timer.js';

// ===== DOM Elements =====
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
const deleteGradeModal = document.getElementById("deleteGradeModal");
const deleteGradeMsg = document.getElementById("deleteGradeMsg");
const deleteGradeCancelBtn = document.getElementById("deleteGradeCancelBtn");
const deleteGradeConfirmBtn = document.getElementById("deleteGradeConfirmBtn");
const addSectionModal = document.getElementById("addSectionModal");
const newSectionInput = document.getElementById("newSectionInput");
const addSectionStatus = document.getElementById("addSectionStatus");
const loggingOutModal = document.getElementById("loggingOutModal");
const sessionTimeoutModal = document.getElementById("sessionTimeoutModal");
const sessionTimeoutConfirmBtn = document.getElementById("sessionTimeoutConfirmBtn");

// Session timeout handler
function showSessionTimeoutModal() {
  sessionTimeoutModal.classList.remove("hidden");
  // Auto-logout after 5 seconds
  setTimeout(() => {
    logout();
  }, 5000);
}

// ===== Auth =====
async function checkAuth() {
  const account = localStorage.getItem("admin_account");
  const token = localStorage.getItem(SESSION_TOKEN_KEY);

  if (!account || !token) {
    window.location.href = "admin-a7x9k2.html";
    return;
  }

  await recordActivity(account);
  showDashboard(account);

  // Start 15-minute inactivity timer (clicks and scroll only)
  if (!window.inactivityTimer) {
    window.inactivityTimer = startInactivityTimer({
      timeoutMs: 15 * 60 * 1000,  // 15 minutes exactly
      onTimeout: showSessionTimeoutModal,
      events: ['click', 'scroll']  // Only clicks and scroll
    });
  }
}

async function logout() {
  if (window.inactivityTimer) {
    window.inactivityTimer.destroy();
    window.inactivityTimer = null;
  }
  loggingOutModal.classList.remove("hidden");
  const startTime = Date.now();
  const account = localStorage.getItem("admin_account");
  if (account) {
    await deleteSession(account);
    await endTeacherSessions(account);
  }
  clearSession();
  const elapsed = Date.now() - startTime;
  if (elapsed < MIN_MODAL_DISPLAY_MS) {
    await wait(MIN_MODAL_DISPLAY_MS - elapsed);
  }
  window.location.href = "admin-a7x9k2.html";
}

function showDashboard(accountName) {
  adminDashboard.classList.remove("hidden");
  accountBadge.textContent = accountName;
  loadSections();
}

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

uploadModal.addEventListener("click", (e) => {
  if (e.target === uploadModal) closeUploadModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!uploadModal.classList.contains("hidden")) closeUploadModal();
    else if (!addSectionModal.classList.contains("hidden")) closeAddSectionModal();
    else if (!deleteGradeModal.classList.contains("hidden")) {
      deleteGradeModal.classList.add("hidden");
      pendingDelete = null;
    }
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
      return;
    }

    const requiredCols = ["P/M/F", "SUBJECT", "SECTION", "STUDENT NO.", "STUDENT NAME"];
    const normalizedHeaders = headers.map(normalizeHeader);
    const normalizedRequired = requiredCols.map(normalizeHeader);
    const missingCols = normalizedRequired.filter((col) => !normalizedHeaders.includes(col));

    if (missingCols.length > 0) {
      showUploadStatus(`Missing columns: ${missingCols.join(", ")}. Found: ${headers.join(", ")}`, "error");
      return;
    }

    const headerIndex = {};
    headers.forEach((h, i) => {
      headerIndex[normalizeHeader(h)] = i;
    });

    const periodGradeCol = { P: "PRELIM", M: "MIDTERM", F: "FINAL" };

    const gradeRows = [];
    const validationErrors = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const period = row[headerIndex["P/M/F"]]?.trim().toUpperCase();
      if (!["P", "M", "F"].includes(period)) {
        const periodVal = row[headerIndex["P/M/F"]]?.trim() || "(empty)";
        validationErrors.push({ row: rowNum, reason: "Invalid period \"" + periodVal + "\"" });
        continue;
      }

      const subjectCode = row[headerIndex["SUBJECT"]]?.trim();
      if (!subjectCode) {
        validationErrors.push({ row: rowNum, reason: "Empty subject code" });
        continue;
      }

      const section = row[headerIndex["SECTION"]]?.trim();
      if (!section) {
        validationErrors.push({ row: rowNum, reason: "Empty section" });
        continue;
      }

      const studentNo = row[headerIndex["STUDENT NO."]]?.trim();
      if (!studentNo) {
        validationErrors.push({ row: rowNum, reason: "Empty student number" });
        continue;
      }

      if (!/^\d{10}$/.test(studentNo)) {
        validationErrors.push({ row: rowNum, reason: "Invalid student number \"" + studentNo + "\" (must be 10 digits)" });
        continue;
      }

      const studentName = row[headerIndex["STUDENT NAME"]]?.trim();
      if (!studentName) {
        validationErrors.push({ row: rowNum, reason: "Empty student name" });
        continue;
      }

      const gradeColName = periodGradeCol[period];
      const gradeVal = row[headerIndex[gradeColName]]?.trim();
      const grade = parseFloat(gradeVal);
      if (isNaN(grade)) {
        const gradeDisplay = gradeVal || "(empty)";
        validationErrors.push({ row: rowNum, reason: "Invalid grade \"" + gradeDisplay + "\"" });
        continue;
      }

      const examScoreVal = row[headerIndex["EXAM SCORE"]]?.trim();
      const examScore = examScoreVal ? parseFloat(examScoreVal) : null;

      const labPctVal = row[headerIndex["LAB %"]]?.trim();
      const labPct = labPctVal ? parseFloat(labPctVal) : null;

      const qarVal = row[headerIndex["QAR"]]?.trim();
      const qar = qarVal ? parseFloat(qarVal) : null;

      const encryptedStudentNo = await CryptoModule.encrypt(studentNo);
      const encryptedStudentName = await CryptoModule.encrypt(studentName);

      gradeRows.push({
        period,
        subject_code: subjectCode,
        section: section,
        student_no: encryptedStudentNo,
        student_name: encryptedStudentName,
        grade,
        exam_score: examScore,
        lab_pct: labPct,
        qar: qar,
        _studentNo: studentNo,
        _studentName: studentName,
        _subjectCode: subjectCode,
      });
    }

    if (gradeRows.length === 0 && validationErrors.length > 0) {
      const details = validationErrors.slice(0, 10).map((e) => `Row ${e.row}: ${e.reason}`).join("<br>");
      const more = validationErrors.length > 10 ? `<br>...and ${validationErrors.length - 10} more errors` : "";
      showUploadStatus(
        `<strong>No valid rows found.</strong><br>${details}${more}`,
        "error"
      );
      return;
    }

    if (gradeRows.length === 0) {
      showUploadStatus("No valid rows found in CSV.", "error");
      return;
    }

    const account = localStorage.getItem("admin_account");
    if (account) await recordActivity(account);

    showUploadStatus("Checking for duplicates...", "info");
    const existingKeys = new Set();
    try {
      const existingResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/grades?select=student_no,subject_code,period,section&range=0-9999`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );
      if (existingResponse.ok) {
        const existingData = await existingResponse.json();
        for (const row of existingData) {
          const decryptedStudentNo = await CryptoModule.decrypt(row.student_no);
          existingKeys.add(`${decryptedStudentNo}|${row.subject_code}|${row.period}|${row.section}`);
        }
      }
    } catch (err) {
      console.error("Error fetching existing grades:", err);
    }

    const newRows = [];
    const duplicateRows = [];
    for (const row of gradeRows) {
      const key = `${row._studentNo}|${row.subject_code}|${row.period}|${row.section}`;
      if (existingKeys.has(key)) {
        duplicateRows.push(row);
      } else {
        newRows.push(row);
      }
    }

    if (newRows.length === 0) {
      const details = duplicateRows.slice(0, 10).map((r) =>
        `${r._studentNo} — ${r._studentName} (${r.subject_code} ${r.period})`
      ).join("<br>");
      const more = duplicateRows.length > 10 ? `<br>...and ${duplicateRows.length - 10} more duplicates` : "";
      showUploadStatus(
        `<strong>All ${duplicateRows.length} rows are duplicates. No new data to upload.</strong><br><br>Duplicate entries:<br>${details}${more}`,
        "error"
      );
      uploadBtn.disabled = false;
      resetUploadBtn();
      return;
    }

    let inserted = 0;
    const failedBatches = [];
    for (let i = 0; i < newRows.length; i += 50) {
      const batch = newRows.slice(i, i + 50).map(({ _studentNo, _studentName, _subjectCode, ...rest }) => rest);
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
        console.error("Batch insert error:", err);
        failedBatches.push({ start: i + 1, end: Math.min(i + 50, newRows.length), error: err });
      } else {
        inserted += batch.length;
      }
    }

    buildUploadReport(inserted, duplicateRows, validationErrors, failedBatches, newRows.length);

    loadSections();
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

function buildUploadReport(inserted, duplicateRows, validationErrors, failedBatches, totalNew) {
  const sections = [];

  const summaryParts = [];
  if (inserted > 0) summaryParts.push(`<span class="report-success">${inserted} uploaded</span>`);
  if (duplicateRows.length > 0) summaryParts.push(`<span class="report-warn">${duplicateRows.length} duplicates skipped</span>`);
  if (validationErrors.length > 0) summaryParts.push(`<span class="report-error">${validationErrors.length} invalid rows</span>`);
  if (failedBatches.length > 0) summaryParts.push(`<span class="report-error">${failedBatches.reduce((s, b) => s + b.end - b.start + 1, 0)} failed</span>`);
  sections.push(`<div class="report-summary">${summaryParts.join(" &middot; ")}</div>`);

  if (duplicateRows.length > 0) {
    const show = duplicateRows.slice(0, 15);
    const list = show.map((r) =>
      `<li>${escapeHtml(r._studentNo)} &mdash; ${escapeHtml(r._studentName)} | ${escapeHtml(r.subject_code)} ${r.period}</li>`
    ).join("");
    const more = duplicateRows.length > 15 ? `<li class="report-more">...and ${duplicateRows.length - 15} more</li>` : "";
    sections.push(`<div class="report-section"><strong>Duplicates skipped:</strong><ul class="report-list">${list}${more}</ul></div>`);
  }

  if (validationErrors.length > 0) {
    const show = validationErrors.slice(0, 15);
    const list = show.map((e) =>
      `<li>Row ${e.row}: ${escapeHtml(e.reason)}</li>`
    ).join("");
    const more = validationErrors.length > 15 ? `<li class="report-more">...and ${validationErrors.length - 15} more</li>` : "";
    sections.push(`<div class="report-section"><strong>Invalid rows skipped:</strong><ul class="report-list">${list}${more}</ul></div>`);
  }

  if (failedBatches.length > 0) {
    const list = failedBatches.map((b) =>
      `<li>Rows ${b.start}–${b.end}: ${escapeHtml(b.error).substring(0, 100)}</li>`
    ).join("");
    sections.push(`<div class="report-section"><strong>Insert errors:</strong><ul class="report-list">${list}</ul></div>`);
  }

  const html = sections.join("");
  const hasErrors = failedBatches.length > 0 || validationErrors.length > 0;
  showUploadStatus(html, hasErrors ? "error" : "success");
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

function showUploadStatus(html, type) {
  uploadStatus.innerHTML = html;
  uploadStatus.className = `upload-status ${type}`;
}

// ===== Sections =====
async function loadSections() {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/sections?select=name&order=name`,
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
    const sectionNames = data.map((row) => row.name);

    const currentVal = sectionFilter.value;
    sectionFilter.innerHTML = '<option value="">Select a section</option>';
    sectionNames.forEach((sec) => {
      const opt = document.createElement("option");
      opt.value = sec;
      opt.textContent = sec;
      sectionFilter.appendChild(opt);
    });

    if (currentVal && sectionNames.includes(currentVal)) {
      sectionFilter.value = currentVal;
    }
  } catch (err) {
    console.error("Error loading sections:", err);
    sectionFilter.innerHTML = '<option value="">Error loading sections</option>';
  }
}

async function addSection() {
  const name = newSectionInput.value.trim();
  if (!name) {
    addSectionStatus.innerHTML = "Please enter a section name";
    addSectionStatus.className = "upload-status error";
    return;
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/sections`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const err = await response.text();
      if (err.includes("duplicate") || err.includes("unique")) {
        addSectionStatus.innerHTML = "Section \"" + name + "\" already exists";
      } else {
        addSectionStatus.innerHTML = "Failed to add section";
      }
      addSectionStatus.className = "upload-status error";
      return;
    }

    await loadSections();
    sectionFilter.value = name;
    sectionFilter.dispatchEvent(new Event("change"));
    closeAddSectionModal();
  } catch (err) {
    console.error("Error adding section:", err);
    addSectionStatus.innerHTML = "Error adding section";
    addSectionStatus.className = "upload-status error";
  }
}

async function deleteSection() {
  const section = sectionFilter.value;
  if (!section) {
    showUploadStatus("Select a section to delete", "error");
    return;
  }

  if (!confirm("Delete section \"" + section + "\"?\nThis will NOT delete the grade records, only the section from the dropdown.")) {
    return;
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/sections?name=eq.${encodeURIComponent(section)}`,
      {
        method: "DELETE",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (!response.ok) {
      showUploadStatus("Failed to delete section", "error");
      return;
    }

    showUploadStatus("Section \"" + section + "\" deleted", "success");
    await loadSections();
  } catch (err) {
    console.error("Error deleting section:", err);
    showUploadStatus("Error deleting section", "error");
  }
}

sectionFilter.addEventListener("change", async () => {
  if (sectionFilter.value) {
    const account = localStorage.getItem("admin_account");
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
      `${SUPABASE_URL}/rest/v1/grades?section=eq.${encodeURIComponent(section)}&select=period,subject_code,student_no,student_name,grade,exam_score,lab_pct,qar&order=student_name,subject_code`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Range: "0-9999",
        },
      }
    );

    if (!response.ok) {
      console.error("Failed to load grades:", await response.text());
      showEmptyState();
      return;
    }

    const data = await response.json();

    const decryptedRows = [];
    for (const row of data) {
      decryptedRows.push({
        encrypted_student_no: row.student_no,
        student_no: await CryptoModule.decrypt(row.student_no),
        student_name: await CryptoModule.decrypt(row.student_name),
        subject_code: row.subject_code,
        period: row.period,
        grade: row.grade,
        exam_score: row.exam_score,
        lab_pct: row.lab_pct,
        qar: row.qar,
      });
    }

    decryptedRows.sort((a, b) => a.student_name.localeCompare(b.student_name));

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

    const gradesMap = {};
    decryptedRows.forEach((row) => {
      const key = `${row.student_no}|${row.subject_code}`;
  if (!gradesMap[key]) {
    gradesMap[key] = {
      encrypted_student_no: row.encrypted_student_no,
      student_no: row.student_no,
      student_name: row.student_name,
      subject_code: row.subject_code,
      prelim: null, prelim_exam: null, prelim_lab: null, prelim_qar: null,
      midterm: null, midterm_exam: null, midterm_lab: null, midterm_qar: null,
      final: null, final_exam: null, final_lab: null, final_qar: null,
    };
      }
      if (row.period === "P") {
        gradesMap[key].prelim = row.grade;
        gradesMap[key].prelim_exam = row.exam_score;
        gradesMap[key].prelim_lab = row.lab_pct;
        gradesMap[key].prelim_qar = row.qar;
      } else if (row.period === "M") {
        gradesMap[key].midterm = row.grade;
        gradesMap[key].midterm_exam = row.exam_score;
        gradesMap[key].midterm_lab = row.lab_pct;
        gradesMap[key].midterm_qar = row.qar;
      } else if (row.period === "F") {
        gradesMap[key].final = row.grade;
        gradesMap[key].final_exam = row.exam_score;
        gradesMap[key].final_lab = row.lab_pct;
        gradesMap[key].final_qar = row.qar;
      }
    });

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
        <td class="grade-cell ${getGradeClass(g.prelim)}">
          <div class="grade-main">${g.prelim ?? "N/A"}</div>
          ${g.prelim_exam != null || g.prelim_lab != null || g.prelim_qar != null ? `<div class="grade-detail">E:${g.prelim_exam ?? "-"} L:${g.prelim_lab != null ? (g.prelim_lab === 0 ? "N/A" : g.prelim_lab) : "-"} Q:${g.prelim_qar ?? "-"}</div>` : ""}
        </td>
        <td class="grade-cell ${getGradeClass(g.midterm)}">
          <div class="grade-main">${g.midterm ?? "N/A"}</div>
          ${g.midterm_exam != null || g.midterm_lab != null || g.midterm_qar != null ? `<div class="grade-detail">E:${g.midterm_exam ?? "-"} L:${g.midterm_lab != null ? (g.midterm_lab === 0 ? "N/A" : g.midterm_lab) : "-"} Q:${g.midterm_qar ?? "-"}</div>` : ""}
        </td>
        <td class="grade-cell ${getGradeClass(g.final)}">
          <div class="grade-main">${g.final ?? "N/A"}</div>
          ${g.final_exam != null || g.final_lab != null || g.final_qar != null ? `<div class="grade-detail">E:${g.final_exam ?? "-"} L:${g.final_lab != null ? (g.final_lab === 0 ? "N/A" : g.final_lab) : "-"} Q:${g.final_qar ?? "-"}</div>` : ""}
        </td>
        <td class="col-action">
          <button class="delete-grade-btn" onclick="deleteGrade('${escapeHtml(g.encrypted_student_no)}','${escapeHtml(g.student_no)}','${escapeHtml(g.subject_code)}')" title="Delete this subject record">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </td>
      `;
      gradesTableBody.appendChild(tr);
    });

    gradesEmptyState.classList.add("hidden");
    gradesLoading.classList.add("hidden");
    gradesTable.classList.remove("hidden");

    const uniqueStudents = new Set(entries.map((g) => g.student_no)).size;
    gradesCount.textContent = `${entries.length} records \u00B7 ${uniqueStudents} students`;
  } catch (err) {
    console.error("Error loading grades:", err);
    showEmptyState();
  }
}

// ===== Delete Grade Per Subject =====
let pendingDelete = null;

function deleteGrade(encryptedStudentNo, studentNo, subjectCode) {
  const section = sectionFilter.value;
  if (!section) return;
  pendingDelete = { encryptedStudentNo, subjectCode, section };
  deleteGradeMsg.textContent = `Delete all ${subjectCode} grade records for ${studentNo}?`;
  deleteGradeModal.classList.remove("hidden");
}

deleteGradeCancelBtn.addEventListener("click", () => {
  deleteGradeModal.classList.add("hidden");
  pendingDelete = null;
});

deleteGradeConfirmBtn.addEventListener("click", async () => {
  if (!pendingDelete) return;
  const { encryptedStudentNo, subjectCode, section } = pendingDelete;
  deleteGradeModal.classList.add("hidden");

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/grades?student_no=eq.${encodeURIComponent(encryptedStudentNo)}&subject_code=eq.${encodeURIComponent(subjectCode)}&section=eq.${encodeURIComponent(section)}`,
      {
        method: "DELETE",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    if (!res.ok) {
      console.error("Delete failed:", await res.text());
      return;
    }
    await loadGrades();
  } catch (err) {
    console.error("Error deleting grade:", err);
  } finally {
    pendingDelete = null;
  }
});

// ===== Add Section Modal =====
function openAddSectionModal() {
  newSectionInput.value = "";
  addSectionStatus.classList.add("hidden");
  addSectionModal.classList.remove("hidden");
  setTimeout(() => newSectionInput.focus(), 100);
}

function closeAddSectionModal() {
  addSectionModal.classList.add("hidden");
  newSectionInput.value = "";
  addSectionStatus.classList.add("hidden");
}

addSectionModal.addEventListener("click", (e) => {
  if (e.target === addSectionModal) closeAddSectionModal();
});

newSectionInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addSection();
});

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
  if (grade >= 75) return "pass";
  return "fail";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Session timeout modal confirm handler
sessionTimeoutConfirmBtn.addEventListener("click", () => {
  logout();
});

// ===== Init =====
checkAuth();