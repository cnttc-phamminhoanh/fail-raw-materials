(() => {
  "use strict";

  // Storage keys
  const TOKEN_KEY = "fail_auth_token";
  const USER_KEY = "fail_auth_user";
  const REMEMBER_KEY = "fail_remember_password";
  const REMEMBER_USER_NO_KEY = "fail_remember_user_no";
  const REMEMBER_PASSWORD_KEY = "fail_remember_password_value";

  const token = localStorage.getItem(TOKEN_KEY);
  const user = localStorage.getItem(USER_KEY);

  if (token && user) {
    window.location.replace("/fail_materials");
    return;
  }

  // Elements
  const form = document.getElementById("loginForm");
  const userNoInput = document.getElementById("user_no");
  const passwordInput = document.getElementById("password");
  const rememberCheckbox = document.getElementById("rememberPassword");
  const togglePassword = document.getElementById("togglePassword");
  const loginButton = document.getElementById("loginButton");
  const loginError = document.getElementById("loginError");

  // Load remembered login
  function loadRememberedLogin() {
    const remember = localStorage.getItem(REMEMBER_KEY);

    if (remember !== "true") {
      return;
    }

    const user_no = localStorage.getItem(REMEMBER_USER_NO_KEY);
    const password = localStorage.getItem(REMEMBER_PASSWORD_KEY);

    if (user_no) {
      userNoInput.value = user_no;
    }

    if (password) {
      passwordInput.value = password;
    }

    rememberCheckbox.checked = true;
  }

  // Save remembered login
  function saveRememberedLogin(user_no, password) {
    if (!rememberCheckbox.checked) {
      localStorage.removeItem(REMEMBER_KEY);
      localStorage.removeItem(REMEMBER_USER_NO_KEY);
      localStorage.removeItem(REMEMBER_PASSWORD_KEY);

      return;
    }

    localStorage.setItem(REMEMBER_KEY, "true");
    localStorage.setItem(REMEMBER_USER_NO_KEY, user_no);
    localStorage.setItem(REMEMBER_PASSWORD_KEY, password);
  }

  // Login
  async function login(user_no, password) {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_no,
        password,
      }),
    });

    const result = await response.json().catch(() => ({
      success: false,
      message: "Invalid server response",
    }));

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Login failed");
    }

    return result;
  }

  // Loading
  function setLoading(loading) {
    if (loading) {
      loginButton.classList.add("loading");
    } else {
      loginButton.classList.remove("loading");
    }
  }

  // Error

  function showError(message) {
    loginError.textContent = message;
    loginError.classList.remove("shake");
    void loginError.offsetWidth;
    loginError.classList.add("shake");
  }

  // Show / hide password
  togglePassword.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    togglePassword.textContent = isPassword ? "Hide" : "Show";
  });

  // Submit
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.textContent = "";
    const user_no = userNoInput.value.trim();
    const password = passwordInput.value;

    if (!user_no || !password) {
      showError("Please enter user_no and password.");
      return;
    }

    try {
      setLoading(true);

      const result = await login(user_no, password);

      // Save token
      localStorage.setItem(TOKEN_KEY, result.token);

      // Save user
      localStorage.setItem(USER_KEY, JSON.stringify(result.user));

      // Remember password
      saveRememberedLogin(user_no, password);

      // Go to application
      window.location.replace("/fail_materials");
    } catch (error) {
      console.error("Login error:", error);

      showError(error.message);
    } finally {
      setLoading(false);
    }
  });

  // Init
  loadRememberedLogin();
})();
