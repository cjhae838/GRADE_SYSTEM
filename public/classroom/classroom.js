// ===== Classroom Shared Utilities =====
// Auth info stored in localStorage by admin page

const SESSION_TOKEN_KEY = "admin_session_token";

function getTeacherAccount() {
  return localStorage.getItem("admin_account");
}

function getSessionToken() {
  return localStorage.getItem(SESSION_TOKEN_KEY);
}

function requireAuth() {
  const account = getTeacherAccount();
  if (!account) {
    window.location.href = "../admin-a7x9k2.html";
    return null;
  }
  return account;
}

async function deleteSession(accountName) {
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/admin_sessions?account_name=eq.${encodeURIComponent(accountName)}`,
      {
        method: "DELETE",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
  } catch {
    // Ignore errors on logout
  }
}

async function endTeacherSessions(accountName) {
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/sessions?teacher_id=eq.${encodeURIComponent(accountName)}&status=eq.active`,
      {
        method: "PATCH",
        headers: teacherHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ status: "ended", ended_at: new Date().toISOString() }),
      }
    );
  } catch {
    // Ignore errors on logout
  }
}

function clearSession() {
  localStorage.removeItem("admin_account");
  localStorage.removeItem(SESSION_TOKEN_KEY);
}

async function logout() {
  const loggingOutModal = document.getElementById("loggingOutModal");
  if (loggingOutModal) loggingOutModal.classList.remove("hidden");
  const account = getTeacherAccount();
  if (account) {
    await deleteSession(account);
    await endTeacherSessions(account);
  }
  clearSession();
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

// Teacher: list the current teacher's presentations (newest first).
async function listPresentations() {
  const teacher = encodeURIComponent(getTeacherAccount());
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/presentations?teacher_id=eq.${teacher}&order=created_at.desc`,
    { headers: teacherHeaders() }
  );
  if (!res.ok) throw new Error(`Failed to load presentations (${res.status})`);
  return res.json();
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