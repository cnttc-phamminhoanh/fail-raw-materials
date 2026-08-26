const express = require("express");
const router = express.Router();
const {
  getFailMaterials,
  getFailMaterialsPaginated,
  upsertSolution,
  deleteSolution,
  healthCheck,
} = require("../controllers/failMaterials.controller");

// GET /api/fail-materials - Lấy danh sách FAIL materials
router.get("/", getFailMaterials);

// GET /api/fail-materials/paginated - Lấy danh sách với phân trang
router.get("/paginated", getFailMaterialsPaginated);

// POST /api/fail-materials/solution - Cập nhật hoặc tạo mới solution
router.post("/solution", upsertSolution);

// DELETE /api/fail-materials/solution - Xóa solution
router.delete("/solution", deleteSolution);

// GET /api/fail-materials/health - Kiểm tra kết nối DB
router.get("/health", healthCheck);

module.exports = router;
