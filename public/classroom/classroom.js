// ===== Classroom Shared Utilities =====
// Auth info stored in localStorage by admin page

function getTeacherAccount() {
  return localStorage.getItem("admin_account");
}

function requireAuth() {
  const account = getTeacherAccount();
  if (!account) {
    window.location.href = "../admin-a7x9k2.html";
    return null;
  }
  return account;
}

function logout() {
  localStorage.removeItem("admin_account");
  localStorage.removeItem("admin_session_token");
  window.location.href = "../admin-a7x9k2.html";
}
