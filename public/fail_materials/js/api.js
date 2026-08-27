// API sẽ tự động gửi JWT.
(() => {
  "use strict";

  const TOKEN_KEY = "fail_auth_token";

  async function request(url, options = {}) {
    const token = localStorage.getItem(TOKEN_KEY);

    const headers = {
      ...(options.headers || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      const result = await response.json().catch(() => ({}));

      if (result.code === "TOKEN_EXPIRED") {
        window.location.replace("/login/login.html");

        return null;
      }

      window.location.replace("/login/login.html");

      return null;
    }

    if (response.status === 403) {
      const result = await response.json().catch(() => ({}));

      throw new Error(result.message || "Permission denied");
    }

    return response;
  }

  window.API = {
    request,
  };
})();
