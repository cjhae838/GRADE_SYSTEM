// DOM elements
const studentNumberInput = document.getElementById("studentNumber");
const checkBtn = document.getElementById("checkBtn");
const resultsSection = document.getElementById("resultsSection");
const messageArea = document.getElementById("messageArea");
const studentNameEl = document.getElementById("studentName");
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

  setLoading(true);

  try {
    const { data, error } = await supabase
      .from("grades")
      .select("period, subject_code, section, student_name, grade")
      .eq("student_no", studentNumber);

    if (error) {
      console.error("Supabase query error:", error.message, error.details);
      showMessage("Something went wrong. Please try again later.", "error");
      hideResults();
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      showMessage(
        `Student number "${studentNumber}" was not found. Please check and try again.`,
        "error"
      );
      hideResults();
      setLoading(false);
      return;
    }

    // Transform flat rows into grouped subjects
    const student = transformGrades(data);
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
        prelim: null,
        midterm: null,
        final: null,
      };
    }

    if (row.period === "P") subjectsMap[key].prelim = row.grade;
    else if (row.period === "M") subjectsMap[key].midterm = row.grade;
    else if (row.period === "F") subjectsMap[key].final = row.grade;
  });

  return {
    name: studentName,
    subjects: Object.values(subjectsMap),
  };
}

// Display student results
function displayResults(student, studentNumber) {
  studentNameEl.textContent = student.name;
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
        ${createTermColumn("Prelim", subject.prelim)}
        ${createTermColumn("Midterm", subject.midterm)}
        ${createTermColumn("Final", subject.final)}
      </div>
    `;

    gradesBody.appendChild(card);
  });

  resultsSection.classList.remove("hidden");
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Create a term column
function createTermColumn(termName, grade) {
  const isNone = grade === null;
  let gradeClass = "none";
  if (!isNone) {
    if (grade >= 90) gradeClass = "pass";
    else if (grade >= 75) gradeClass = "warn";
    else gradeClass = "fail";
  }

  return `
    <div class="term-column">
      <div class="term-label">${termName}</div>
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
  if (isLoading) {
    checkBtn.classList.add("loading");
    checkBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
      Searching...
    `;
  } else {
    checkBtn.classList.remove("loading");
    checkBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
      Check Grades
    `;
  }
}
