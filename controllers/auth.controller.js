const authService = require("../services/auth.service");

// POST /api/auth/login
async function login(req, res) {
  try {
    const { user_no, password } = req.body;

    const result = await authService.login({
      user_no,
      password,
    });

    return res.json({
      success: true,
      message: "Login successful",
      ...result,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Login failed",
    });
  }
}

module.exports = {
  login,
};
