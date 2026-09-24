// ===== Classroom Shared Utilities =====
// Auth info stored in localStorage by admin page

function getTeacherAccount() {
  return localStorage.getItem("admin_account");
}

function getSessionToken() {
  return localStorage.getItem("admin_session_token");
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

// Headers for Supabase REST/storage calls. RLS policies require the
// teacher and session-token headers (see supabase/schema.sql).
function teacherHeaders(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "x-teacher": getTeacherAccount(),
    "x-session-token": getSessionToken(),
    ...extra,
  };
}

// Student-facing: returns the active session for a room code, or null.
async function activeSessionByCode(code) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_active_session`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error(`get_active_session failed (${res.status})`);
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}