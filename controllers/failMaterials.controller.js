const failMaterialsService = require("../services/failMaterials.service");

// Lấy danh sách FAIL materials
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
  Query params: page, limit, search, date (legacy), startDate, endDate, solution
*/
async function getFailMaterialsPaginated(req, res) {
  try {
    const { page = 1, limit = 50, search = "", date = "", solution = "" } = req.query;
    const startDate = req.query.startDate || date;
    const endDate = req.query.endDate || startDate;
    const isValidDate = (value) => {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const parsed = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
        && value >= "0001-01-01" && value < "9999-12-31";
    };
    if ((startDate && !isValidDate(startDate)) || (endDate && !isValidDate(endDate))
      || (!startDate && endDate) || (startDate && endDate < startDate)) {
      return res.status(400).json({ success: false, message: "Invalid date range" });
    }

    if (!["", "pending", "has_solution", "a", "b", "c", "d", "e"].includes(solution)) {
      return res.status(400).json({
        success: false,
        message: "Invalid solution filter",
      });
    }

    const result = await failMaterialsService.getFailMaterialsPaginated({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      date,
      startDate,
      endDate,
      solution,
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
    const { tempReceiptNo, tempReceiptId, solution } = req.body;

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
      updater: req.user.user_no,
    });

    res.json({
      success: true,
      message: `Solution ${result.action} successfully`,
      ...result,
    });
  } catch (error) {
    console.error("Error in upsertSolution:", error);

    const statusCode = error.statusCode || 500;

    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to save solution",
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

    const statusCode = error.statusCode || 500;

    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to delete solution",
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

const HANDLING_TYPE_MAP = {
  'returnedInternal': 'Returned Internal',
  'returnedCustoms': 'Returned Customs',
  'destroyedInternal': 'Destroyed Internal',
  'destroyedCustoms': 'Destroyed Customs'
};

async function exportRework(req, res) {
  try {
    const {
      tempReceiptNo,
      tempReceiptId,
      handlingType,
      quantity
    } = req.body;

    const userNo = req.user.user_no;

    // ===== VALIDATION =====
    if (!tempReceiptNo || !tempReceiptId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: tempReceiptNo, tempReceiptId",
      });
    }

    if (!handlingType || !HANDLING_TYPE_MAP[handlingType]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid handling type'
      });
    }

    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be greater than 0'
      });
    }

    if (!userNo) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const actualSol = HANDLING_TYPE_MAP[handlingType];

    await failMaterialsService.exportRework({
      tempReceiptNo,
      tempReceiptId,
      handlingType: actualSol,
      quantity,
      updater: userNo,
    });

    res.json({
      success: true,
      message: 'Export successful',
      data: {
        tempReceiptNo,
        tempReceiptId,
        handlingType: actualSol,
        quantity,
        exportedAt: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error("Error in exportRework:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to export rework",
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
  exportRework
};
