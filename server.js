require("dotenv").config();
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

app.use("/api/auth", authRoutes);

app.use("/api/fail-materials", failMaterialsRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "FAIL Raw Materials API is running" });
});

app.get("/fail_materials", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "fail_materials", "fail_materials.html"));
});

app.get("*splat", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "login", "login.html"));
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
