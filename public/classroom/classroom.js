// ===== Classroom Shared Utilities =====
// Reuses auth from admin page via sessionStorage

function getTeacherAccount() {
  return sessionStorage.getItem("admin_account") || localStorage.getItem("admin_account");
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
  sessionStorage.removeItem("admin_account");
  localStorage.removeItem("admin_account");
  localStorage.removeItem("admin_session_token");
  window.location.href = "../admin-a7x9k2.html";
}
