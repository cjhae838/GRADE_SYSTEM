// ===== Admin Login Page Logic =====
// Handles password authentication and redirects to chooser on success

// ===== DOM Elements =====
const passwordModal = document.getElementById("passwordModal");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const passwordError = document.getElementById("passwordError");
const loggingInModal = document.getElementById("loggingInModal");
const loggingOutModal = document.getElementById("loggingOutModal");

// ===== Helpers =====
function showError(msg) {
  passwordError.textContent = msg;
  passwordError.classList.remove("hidden");
}

function hideError() {
  passwordError.classList.add("hidden");
}

// ===== Auth =====
async function checkAuth() {
  const account = localStorage.getItem("admin_account");
  const token = localStorage.getItem(SESSION_TOKEN_KEY);

  if (account && token) {
    const active = await isSessionActive(account);
    if (active) {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/admin_sessions?account_name=eq.${encodeURIComponent(account)}&select=session_token`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0 && data[0].session_token === token) {
          await recordActivity(account);
          passwordModal.classList.add("hidden");
          window.location.href = "chooser.html";
          return;
        }
      }
    }
    // Session expired or token mismatch — clear and show login
    clearSession();
  }
  // No session or invalid — show password modal
  passwordModal.classList.remove("hidden");
}

async function attemptLogin() {
  const pw = passwordInput.value;
  hideError();

  if (!pw) {
    showError("Please enter a password.");
    return;
  }

  const account = findAccountByPassword(pw);
  if (!account) {
    showError("Incorrect password. Try again.");
    passwordInput.value = "";
    passwordInput.focus();
    return;
  }

  loggingInModal.classList.remove("hidden");
  const startTime = Date.now();

  const active = await isSessionActive(account.name);
  if (active) {
    // Take over: delete the existing session and proceed
    await deleteSession(account.name);
  }

  const token = crypto.randomUUID();
  localStorage.setItem(SESSION_TOKEN_KEY, token);
  localStorage.setItem("admin_account", account.name);
  await recordActivity(account.name);

  const elapsed = Date.now() - startTime;
  if (elapsed < MIN_MODAL_DISPLAY_MS) {
    await wait(MIN_MODAL_DISPLAY_MS - elapsed);
  }
  loggingInModal.classList.add("hidden");
  window.location.href = "chooser.html";
}

async function logout() {
  loggingOutModal.classList.remove("hidden");
  const startTime = Date.now();
  const account = localStorage.getItem("admin_account");
  if (account) {
    await deleteSession(account);
  }
  clearSession();
  const elapsed = Date.now() - startTime;
  if (elapsed < MIN_MODAL_DISPLAY_MS) {
    await wait(MIN_MODAL_DISPLAY_MS - elapsed);
  }
  loggingOutModal.classList.add("hidden");
  passwordModal.classList.remove("hidden");
  passwordInput.value = "";
  hideError();
}

// ===== Init =====
passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") attemptLogin();
});

checkAuth();