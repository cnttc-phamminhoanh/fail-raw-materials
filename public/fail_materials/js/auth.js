// kiểm tra khi user mở trang.
(() => {
  "use strict";

  const TOKEN_KEY = "fail_auth_token";
  const USER_KEY = "fail_auth_user";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch {
      return null;
    }
  }

  function isTokenExpired(token) {
    try {
      const parts = token.split(".");

      if (parts.length !== 3) {
        return true;
      }

      const payload = JSON.parse(atob(parts[1]));

      if (!payload.exp) {
        return true;
      }

      return Date.now() >= payload.exp * 1000;
    } catch {
      return true;
    }
  }

  const token = getToken();
  const user = getUser();

  if (!token || !user || isTokenExpired(token)) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    window.location.replace("/login");

    return;
  }

  window.Auth = {
    getToken,
    getUser,
  };
})();
