// ===== DOM Elements =====
const passwordModal = document.getElementById("passwordModal");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const passwordError = document.getElementById("passwordError");
const adminDashboard = document.getElementById("adminDashboard");
const csvFileInput = document.getElementById("csvFileInput");
const uploadArea = document.getElementById("uploadArea");
const fileName = document.getElementById("fileName");
const uploadBtn = document.getElementById("uploadBtn");
const uploadStatus = document.getElementById("uploadStatus");
const sectionFilter = document.getElementById("sectionFilter");
const loadGradesBtn = document.getElementById("loadGradesBtn");
const gradesStatus = document.getElementById("gradesStatus");
const gradesTableWrapper = document.getElementById("gradesTableWrapper");
const gradesTableBody = document.getElementById("gradesTableBody");

// ===== Auth =====
function checkAuth() {
  if (sessionStorage.getItem("admin_auth") === "true") {
    showDashboard();
  }
}

function attemptLogin() {
  const pw = passwordInput.value;
  if (pw === ADMIN_PASSWORD) {
    sessionStorage.setItem("admin_auth", "true");
    showDashboard();
  } else {
    passwordError.classList.remove("hidden");
    passwordInput.value = "";
    passwordInput.focus();
  }
}

function showDashboard() {
  passwordModal.classList.add("hidden");
  adminDashboard.classList.remove("hidden");
  loadSections();
}

// Enter key on password input
passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") attemptLogin();
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

// Drag and drop
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

    // Validate columns - match case-insensitively, handle whitespace
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

    // Build index map: normalized header → original index
    const headerIndex = {};
    headers.forEach((h, i) => {
      headerIndex[normalizeHeader(h)] = i;
    });

    // Map CSV rows to database format and encrypt sensitive fields
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

      // Encrypt sensitive fields
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

    // Insert in batches of 50
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
    loadSections(); // Refresh sections
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

  // Auto-detect delimiter from first line
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

// Normalize header for matching (uppercase, collapse spaces)
function normalizeHeader(h) {
  return h.toUpperCase().replace(/\s+/g, " ").trim();
}
function showUploadStatus(msg, type) {
  uploadStatus.textContent = msg;
  uploadStatus.className = `upload-status ${type}`;
}

// ===== Grade Viewer =====
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

    // Decrypt and deduplicate sections
    const decryptedSections = await Promise.all(
      data.map((row) => CryptoModule.decrypt(row.section))
    );
    const unique = [...new Set(decryptedSections)].sort();

    sectionFilter.innerHTML = '<option value="">Select a section</option>';
    unique.forEach((sec) => {
      const opt = document.createElement("option");
      opt.value = sec;
      opt.textContent = sec;
      sectionFilter.appendChild(opt);
    });
  } catch (err) {
    console.error("Error loading sections:", err);
    sectionFilter.innerHTML = '<option value="">Error loading sections</option>';
  }
}

async function loadGrades() {
  const section = sectionFilter.value;
  if (!section) {
    showGradesStatus("Please select a section.", "error");
    return;
  }

  loadGradesBtn.disabled = true;
  loadGradesBtn.textContent = "Loading...";
  showGradesStatus("", "");
  gradesTableWrapper.classList.add("hidden");

  try {
    // Fetch all grades (we filter client-side after decrypting)
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/grades?select=period,subject_code,section,student_no,student_name,grade&order=student_no`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (!response.ok) {
      console.error("Failed to load grades:", await response.text());
      showGradesStatus("Failed to load grades.", "error");
      return;
    }

    const data = await response.json();

    // Decrypt all rows and filter by section
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
      showGradesStatus("No grades found for this section.", "error");
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

    // Render table
    gradesTableBody.innerHTML = "";
    Object.values(gradesMap).forEach((g) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(g.student_no)}</td>
        <td>${escapeHtml(g.student_name)}</td>
        <td>${escapeHtml(g.subject_code)}</td>
        <td class="grade-cell ${getGradeClass(g.prelim)}">${g.prelim ?? "N/A"}</td>
        <td class="grade-cell ${getGradeClass(g.midterm)}">${g.midterm ?? "N/A"}</td>
        <td class="grade-cell ${getGradeClass(g.final)}">${g.final ?? "N/A"}</td>
      `;
      gradesTableBody.appendChild(tr);
    });

    showGradesStatus(`${Object.keys(gradesMap).length} records found.`, "success");
    gradesTableWrapper.classList.remove("hidden");
  } catch (err) {
    console.error("Error loading grades:", err);
    showGradesStatus("An error occurred while loading grades.", "error");
  } finally {
    loadGradesBtn.disabled = false;
    loadGradesBtn.textContent = "Load Grades";
  }
}

function showGradesStatus(msg, type) {
  if (!msg) {
    gradesStatus.classList.add("hidden");
    return;
  }
  gradesStatus.textContent = msg;
  gradesStatus.className = `upload-status ${type}`;
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
