// Mock student data - will be replaced with Supabase later
const students = {
  "2601010213": {
    name: "Juan Dela Cruz",
    subjects: [
      {
        name: "Computer Programming 1",
        prelim: { exam: 82, lab: 88, qar: 85, grade: 87 },
        midterm: { exam: 88, lab: 92, qar: 90, grade: 90 },
        final: { exam: 90, lab: 95, qar: 91, grade: 92 }
      },
      {
        name: "Mathematics 1",
        prelim: { exam: 80, lab: null, qar: 85, grade: 85 },
        midterm: { exam: 85, lab: null, qar: 88, grade: 88 },
        final: { exam: null, lab: null, qar: null, grade: null }
      },
      {
        name: "English Communication",
        prelim: { exam: 88, lab: null, qar: 91, grade: 91 },
        midterm: { exam: null, lab: null, qar: null, grade: null },
        final: { exam: null, lab: null, qar: null, grade: null }
      }
    ]
  },
  "2601010214": {
    name: "Maria Santos",
    subjects: [
      {
        name: "Computer Programming 1",
        prelim: { exam: 90, lab: 94, qar: 92, grade: 92 },
        midterm: { exam: 93, lab: 96, qar: 95, grade: 95 },
        final: { exam: 92, lab: 95, qar: 94, grade: 94 }
      },
      {
        name: "Mathematics 1",
        prelim: { exam: 75, lab: null, qar: 78, grade: 78 },
        midterm: { exam: 80, lab: null, qar: 82, grade: 82 },
        final: { exam: 83, lab: null, qar: 85, grade: 85 }
      },
      {
        name: "English Communication",
        prelim: { exam: 85, lab: null, qar: 88, grade: 88 },
        midterm: { exam: 88, lab: null, qar: 90, grade: 90 },
        final: { exam: 85, lab: null, qar: 87, grade: 87 }
      },
      {
        name: "Physical Education 1",
        prelim: { exam: 93, lab: null, qar: 95, grade: 95 },
        midterm: { exam: 94, lab: null, qar: 96, grade: 96 },
        final: { exam: 96, lab: null, qar: 98, grade: 98 }
      }
    ]
  },
  "2601010215": {
    name: "Jose Reyes",
    subjects: [
      {
        name: "Computer Programming 1",
        prelim: { exam: 72, lab: 76, qar: 74, grade: 75 },
        midterm: { exam: 75, lab: 80, qar: 78, grade: 78 },
        final: { exam: null, lab: null, qar: null, grade: null }
      },
      {
        name: "Mathematics 1",
        prelim: { exam: 68, lab: null, qar: 70, grade: 70 },
        midterm: { exam: null, lab: null, qar: null, grade: null },
        final: { exam: null, lab: null, qar: null, grade: null }
      }
    ]
  }
};

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
function checkGrades() {
  const studentNumber = studentNumberInput.value.trim();

  if (!studentNumber) {
    showMessage("Please enter a student number.", "error");
    hideResults();
    return;
  }

  setLoading(true);

  setTimeout(() => {
    const student = students[studentNumber];

    if (!student) {
      showMessage(
        `Student number "${studentNumber}" was not found. Please check and try again.`,
        "error"
      );
      hideResults();
      setLoading(false);
      return;
    }

    hideMessage();
    displayResults(student, studentNumber);
    setLoading(false);
  }, 600);
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

// Create a term column (Prelim / Midterm / Final)
function createTermColumn(termName, termData) {
  const isNone = termData.grade === null;

  return `
    <div class="term-column">
      <div class="term-label">${termName}</div>
      <div class="term-details">
        <div class="detail-row">
          <span class="detail-label">Exam Score</span>
          <span class="detail-value ${getValueClass(termData.exam)}">${formatValue(termData.exam)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Lab %</span>
          <span class="detail-value ${getValueClass(termData.lab)}">${formatValue(termData.lab, true)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">QAR</span>
          <span class="detail-value ${getValueClass(termData.qar)}">${formatValue(termData.qar)}</span>
        </div>
      </div>
      <div class="term-grade">
        <span class="grade-label">Grade</span>
        <span class="grade-number ${isNone ? 'none' : getGradeClass(termData.grade)}">${isNone ? 'N/A' : termData.grade}</span>
      </div>
    </div>
  `;
}

// Format a value for display
function formatValue(value, isLab = false) {
  if (value === null || value === undefined) return "N/A";
  return value;
}

// Get CSS class for a value
function getValueClass(value) {
  if (value === null || value === undefined) return "none";
  return "";
}

// Get CSS class based on grade
function getGradeClass(grade) {
  if (grade === null) return "none";
  if (grade >= 90) return "pass";
  if (grade >= 75) return "warn";
  return "fail";
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
