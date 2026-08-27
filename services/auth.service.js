const jwt = require("jsonwebtoken");
const authRepository = require("../repositories/auth.repository");

async function login({ user_no, password }) {
  if (!user_no || !password) {
    const error = new Error("User no and password are required");
    error.statusCode = 400;
    throw error;
  }

  const user = await authRepository.findUserByUserNoAndPassword({
    user_no: user_no.trim(),
    password,
  });

  if (!user) {
    const error = new Error("Invalid username or password");
    error.statusCode = 401;
    throw error;
  }

  // Update last login
  await authRepository.updateLastLogin(user.user_id);

  // Create JWT
  const token = jwt.sign(
    {
      user_no: user.user_no,
      username: user.username,
      can_edit: Boolean(user.can_edit),
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "8h",
    },
  );

  return {
    token,
    user: {
      user_no: user.user_no,
      username: user.username,
      can_edit: Boolean(user.can_edit),
    },
    expires_in: 28800,
  };
}

module.exports = {
  login,
};
