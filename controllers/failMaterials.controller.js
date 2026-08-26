const failMaterialsService = require("../services/failMaterials.service");

//Lấy danh sách FAIL materials
async function getFailMaterials(req, res) {
  try {
    const data = await failMaterialsService.getFailMaterials();

    res.json({
      success: true,
      data,
      total: data.length,
    });
  } catch (error) {
    console.error("Error in getFailMaterials:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch FAIL materials",
      error: error.message,
    });
  }
}

/*
  GET /api/fail-materials/paginated
  Lấy danh sách FAIL materials với phân trang
  Query params: page, limit, search, date
*/
async function getFailMaterialsPaginated(req, res) {
  try {
    const { page = 1, limit = 50, search = "", date = "" } = req.query;

    const result = await failMaterialsService.getFailMaterialsPaginated({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      date,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error in getFailMaterialsPaginated:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch FAIL materials",
      error: error.message,
    });
  }
}

/*
  POST /api/fail-materials/solution
  Cập nhật hoặc tạo mới solution
*/
async function upsertSolution(req, res) {
  try {
    const { tempReceiptNo, tempReceiptId, solution, updater } = req.body;

    if (!tempReceiptNo || !tempReceiptId || !solution) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: tempReceiptNo, tempReceiptId, solution",
      });
    }

    const result = await failMaterialsService.updateSolution({
      tempReceiptNo,
      tempReceiptId,
      solution,
      updater: updater || 'ADMIN',
    });

    res.json({
      success: true,
      message: `Solution ${result.action} successfully`,
      ...result,
    });
  } catch (error) {
    console.error("Error in upsertSolution:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save solution",
      error: error.message,
    });
  }
}

/*
  DELETE /api/fail-materials/solution
  Xóa solution
*/
async function deleteSolution(req, res) {
  try {
    const { tempReceiptNo, tempReceiptId } = req.body;

    if (!tempReceiptNo || !tempReceiptId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: tempReceiptNo, tempReceiptId",
      });
    }

    await failMaterialsService.cancelSolution({
      tempReceiptNo,
      tempReceiptId,
    });

    res.json({
      success: true,
      message: "Solution deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteSolution:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete solution",
      error: error.message,
    });
  }
}

/*
 * GET /api/fail-materials/health
 * Kiểm tra kết nối database
*/
async function healthCheck(req, res) {
  try {
    const { getBIPool } = require("../config/sql_db");
    const pool = await getBIPool();

    if (pool && pool.connected) {
      res.json({
        success: true,
        message: "Database connection is healthy",
        connected: true,
      });
    } else {
      res.json({
        success: false,
        message: "Database connection is not healthy",
        connected: false,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: error.message,
    });
  }
}

module.exports = {
  getFailMaterials,
  getFailMaterialsPaginated,
  upsertSolution,
  deleteSolution,
  healthCheck,
};
