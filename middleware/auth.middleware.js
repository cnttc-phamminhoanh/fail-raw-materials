const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not configured");
}

/*
  Verify JWT token
  Header: Authorization: Bearer <token>
*/
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
      code: "AUTH_REQUIRED",
    });
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      success: false,
      message: "Invalid authorization header",
      code: "INVALID_TOKEN",
    });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired",
        code: "TOKEN_EXPIRED",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid token",
      code: "INVALID_TOKEN",
    });
  }
}

// Only users with can_edit = 1
function requireEditPermission(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
      code: "AUTH_REQUIRED",
    });
  }

  if (!req.user.can_edit) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to edit",
      code: "EDIT_PERMISSION_REQUIRED",
    });
  }

  next();
}

module.exports = {
  authenticateToken,
  requireEditPermission,
};
