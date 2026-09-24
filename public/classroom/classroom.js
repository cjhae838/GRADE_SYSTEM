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
  const status = document.getElementById("connStatus");
  if (typeof SUPABASE_URL === "undefined" || typeof SUPABASE_ANON_KEY === "undefined") {
    console.error("Supabase config missing — run `node build.js` first.");
    if (status) { status.textContent = "Supabase config missing"; status.classList.remove("hidden"); }
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
    if (status) { status.textContent = res.ok ? "Connected to Supabase" : "Supabase connection failed"; status.classList.remove("hidden"); }
    return res.ok;
  } catch {
    if (status) { status.textContent = "Supabase connection failed"; status.classList.remove("hidden"); }
    return false;
  }
}
