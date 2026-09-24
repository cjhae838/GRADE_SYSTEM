// ===== Shared Admin Auth Module =====
// Provides auth helpers for both login and grades pages

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const MIN_MODAL_DISPLAY_MS = 2000; // 2 seconds minimum display time
const SESSION_TOKEN_KEY = "admin_session_token";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findAccountByPassword(password) {
  return ADMIN_ACCOUNTS.find((a) => a.password === password);
}

async function recordActivity(accountName) {
  try {
    const token = localStorage.getItem(SESSION_TOKEN_KEY) || "";
    await fetch(`${SUPABASE_URL}/rest/v1/admin_sessions`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        account_name: accountName,
        last_activity: new Date().toISOString(),
        session_token: token,
      }),
    });
  } catch {
    // Non-critical — ignore errors
  }
}

async function isSessionActive(accountName) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_sessions?account_name=eq.${encodeURIComponent(accountName)}&select=last_activity`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    if (!response.ok) return false;
    const data = await response.json();
    if (data.length === 0) return false;

    const lastActive = new Date(data[0].last_activity);
    const now = new Date();

    if (now - lastActive >= SESSION_TIMEOUT_MS) {
      await deleteSession(accountName);
      return false;
    }

    return true;
  } catch {
    return false;
  }
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

function clearSession() {
  localStorage.removeItem("admin_account");
  localStorage.removeItem(SESSION_TOKEN_KEY);
}