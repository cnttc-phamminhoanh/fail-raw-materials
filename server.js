require("dotenv").config({
  quiet: true,
  debug: false
});
const express = require("express");
const cors = require("cors");
const path = require("path");
const { CONNECT_BI_DB } = require("./config/sql_db");
const failMaterialsRoutes = require("./routes/failMaterials.routes");
const authRoutes = require("./routes/auth.routes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// API
app.use("/api/auth", authRoutes);
app.use("/api/fail-materials", failMaterialsRoutes);
app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "FAIL Raw Materials API is running" });
});

// PAGES
app.get("/fail_materials", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "fail_materials", "fail_materials.html"));
});

app.get("/login", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "login", "login.html"));
});

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      success: false,
      message: "API not found",
    });
  }

  return res.status(404).sendFile(path.join(__dirname, "public", "404", "404.html"));
});

async function startServer() {
  try {
    await CONNECT_BI_DB();

    app.listen(PORT, () => {
      console.log(`🚀 FAIL Raw Materials UI: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to connect to database:", error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
