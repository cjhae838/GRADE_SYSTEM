// Mock student data - will be replaced with Supabase later
const students = {
  "2601010213": {
    name: "Juan Dela Cruz",
    subjects: [
      { name: "Computer Programming 1", prelim: 87, midterm: 90, final: 92 },
      { name: "Mathematics 1", prelim: 85, midterm: 88, final: null },
      { name: "English Communication", prelim: 91, midterm: null, final: null }
    ]
  },
  "2601010214": {
    name: "Maria Santos",
    subjects: [
      { name: "Computer Programming 1", prelim: 92, midterm: 95, final: 94 },
      { name: "Mathematics 1", prelim: 78, midterm: 82, final: 85 },
      { name: "English Communication", prelim: 88, midterm: 90, final: 87 },
      { name: "Physical Education 1", prelim: 95, midterm: 96, final: 98 }
    ]
  },
  "2601010215": {
    name: "Jose Reyes",
    subjects: [
      { name: "Computer Programming 1", prelim: 75, midterm: 78, final: null },
      { name: "Mathematics 1", prelim: 70, midterm: null, final: null }
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
