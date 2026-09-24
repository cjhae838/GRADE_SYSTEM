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

async function checkConnection() {
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    console.error("Supabase config missing — run `node build.js` first.");
    return false;
  }
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/presentations?select=id&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}
