// ===== Splash Screen =====
window.addEventListener("load", () => {
  const splash = document.getElementById("splashScreen");
  if (splash) {
    setTimeout(() => {
      splash.classList.add("splash-fade-out");
      setTimeout(() => splash.remove(), 600);
    }, 2500);
  }
});

// DOM elements
const studentNumberInput = document.getElementById("studentNumber");
const checkBtn = document.getElementById("checkBtn");
const resultsSection = document.getElementById("resultsSection");
const messageArea = document.getElementById("messageArea");
const studentNoEl = document.getElementById("studentNo");
const gradesBody = document.getElementById("gradesBody");

// Allow Enter key to trigger search
studentNumberInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    checkGrades();
  }
});

// Main function to check grades
async function checkGrades() {
  const studentNumber = studentNumberInput.value.trim();

  if (!studentNumber) {
    showMessage("Please enter a student number.", "error");
    hideResults();
    return;
  }

  if (!/^\d{10}$/.test(studentNumber)) {
    showMessage("Student number must be exactly 10 digits.", "error");
    hideResults();
    setLoading(false);
    return;
  }

  setLoading(true);

  try {
    // Encrypt student number for query
    const encryptedStudentNo = await CryptoModule.encrypt(studentNumber);

    const url = `${SUPABASE_URL}/rest/v1/grades?student_no=eq.${encodeURIComponent(encryptedStudentNo)}&select=period,subject_code,section,student_name,grade,exam_score,lab_pct,qar`;
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) {
      console.error("Supabase response error:", response.status, await response.text());
      showMessage("Something went wrong. Please try again later.", "error");
      hideResults();
      setLoading(false);
      return;
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      showMessage(
        `Student number "${studentNumber}" was not found. Please check and try again.`,
        "error"
      );
      hideResults();
      setLoading(false);
      return;
    }

    // Decrypt student_name and section in all rows
    const decryptedData = await Promise.all(
      data.map(async (row) => ({
        ...row,
        student_name: await CryptoModule.decrypt(row.student_name),
        section: await CryptoModule.decrypt(row.section),
      }))
    );

    // Transform flat rows into grouped subjects
    const student = transformGrades(decryptedData);
    hideMessage();
    displayResults(student, studentNumber);
  } catch (err) {
    console.error("Fetch error:", err);
    showMessage("Something went wrong. Please try again later.", "error");
    hideResults();
  } finally {
    setLoading(false);
  }
}

// Transform flat rows into grouped subject data
function transformGrades(rows) {
  const studentName = rows[0].student_name;
  const subjectsMap = {};

  rows.forEach((row) => {
    const key = row.subject_code;
    if (!subjectsMap[key]) {
      subjectsMap[key] = {
        name: row.subject_code,
        prelim: null, prelim_exam: null, prelim_lab: null, prelim_qar: null,
        midterm: null, midterm_exam: null, midterm_lab: null, midterm_qar: null,
        final: null, final_exam: null, final_lab: null, final_qar: null,
      };
    }

    if (row.period === "P") {
      subjectsMap[key].prelim = row.grade;
      subjectsMap[key].prelim_exam = row.exam_score;
      subjectsMap[key].prelim_lab = row.lab_pct;
      subjectsMap[key].prelim_qar = row.qar;
    } else if (row.period === "M") {
      subjectsMap[key].midterm = row.grade;
      subjectsMap[key].midterm_exam = row.exam_score;
      subjectsMap[key].midterm_lab = row.lab_pct;
      subjectsMap[key].midterm_qar = row.qar;
    } else if (row.period === "F") {
      subjectsMap[key].final = row.grade;
      subjectsMap[key].final_exam = row.exam_score;
      subjectsMap[key].final_lab = row.lab_pct;
      subjectsMap[key].final_qar = row.qar;
    }
  });

  return {
    name: studentName,
    subjects: Object.values(subjectsMap),
  };
}

// Display student results
function displayResults(student, studentNumber) {
  studentNoEl.textContent = studentNumber;

  gradesBody.innerHTML = "";

  student.subjects.forEach((subject) => {
    const card = document.createElement("div");
    card.className = "subject-card";

    card.innerHTML = `
      <div class="subject-card-header">
        <h4 class="subject-name">${subject.name}</h4>
      </div>
      <div class="terms-grid">
        ${createTermColumn("Prelim", subject.prelim, subject.prelim_exam, subject.prelim_lab, subject.prelim_qar)}
        ${createTermColumn("Midterm", subject.midterm, subject.midterm_exam, subject.midterm_lab, subject.midterm_qar)}
        ${createTermColumn("Final", subject.final, subject.final_exam, subject.final_lab, subject.final_qar)}
      </div>
    `;

    gradesBody.appendChild(card);
  });

  resultsSection.classList.remove("hidden");
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Create a term column
function createTermColumn(termName, grade, exam, lab, qar) {
  const isNone = grade === null;
  let gradeClass = "none";
  if (!isNone) {
    if (grade >= 75) gradeClass = "pass";
    else gradeClass = "fail";
  }

  const subItems = [];
  if (qar != null) subItems.push(`<div class="term-sub"><span>QAR</span><span>${qar}</span></div>`);
  if (lab != null) subItems.push(`<div class="term-sub"><span>Lab</span><span>${lab === 0 ? "N/A" : lab}</span></div>`);
  if (exam != null) subItems.push(`<div class="term-sub"><span>Exam</span><span>${exam}</span></div>`);

  return `
    <div class="term-column">
      <div class="term-label">${termName}</div>
      ${subItems.join("")}
      <div class="grade-number ${gradeClass}">${isNone ? "N/A" : grade}</div>
    </div>
  `;
}

// Show message
function showMessage(text, type) {
  const icon =
    type === "error"
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>`;

  messageArea.innerHTML = icon + text;
  messageArea.className = `message-area ${type}`;
}

function hideMessage() {
  messageArea.className = "message-area hidden";
}

function hideResults() {
  resultsSection.classList.add("hidden");
}

function setLoading(isLoading) {
  const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`;
  checkBtn.classList.toggle("loading", isLoading);
  checkBtn.innerHTML = icon + (isLoading ? " Searching..." : " Check Grades");
}
