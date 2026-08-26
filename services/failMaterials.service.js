const failMaterialsRepository = require("../repositories/failMaterials.repository");

// Transform dữ liệu từ database sang format frontend
function transformRow(row) {
  return {
    supplier: row.supplier || "",
    poNo: row.po_no || "",
    poId: row.po_id ? String(row.po_id) : "",
    orderQty: row.order_qty || 0,
    tempReceiptNo: row.temp_no || "",
    tempReceiptId: row.temp_id ? String(row.temp_id) : "",
    lotNo: row.lot_no || "",
    materialCode: row.mat_code || "",
    materialName: row.mat_name || "",
    tempReceiptQty: row.temp_qty || 0,
    focQty: row.foc_qty || 0,
    rejectQty: row.reject_qty || 0,
    failPercent: row.fail_percent ? `${(row.fail_percent * 100).toFixed(0)}%` : "0%",
    orderPrice: row.unit_no || "",
    solution: row.solution || "",
    solutionUpdater: row.solution_updater || "",
    updateTime: row.update_time || null,
    returnedInternal: row.returned_internal || null,
    returnedCustoms: row.returned_customs || null,
    destroyedInternal: row.destroyed_internal || null,
    destroyedCustoms: row.destroyed_customs || null,
    remainQty: row.remain_qty || 0,
    replacementQty: row.replacement_qty || null,
    newLotNo: row.new_lot_no || ""
  };
}

// Lấy danh sách FAIL materials
async function getFailMaterials() {
  try {
    const data = await failMaterialsRepository.getFailMaterials();

    return data.map(transformRow);
  } catch (error) {
    console.error("Error in getFailMaterials:", error);
    throw error;
  }
}

//Lấy danh sách FAIL materials với phân trang
async function getFailMaterialsPaginated({ page = 1, limit = 50, search = "", date = "" }) {
  try {
    const [data, total] = await Promise.all([
      failMaterialsRepository.getFailMaterialsPaginated({ page, limit, search, date }),
      failMaterialsRepository.getTotalCount({ search, date }),
    ]);

    return {
      data: data.map(transformRow),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("Error in getFailMaterialsPaginated:", error);
    throw error;
  }
}

// Cập nhật solution
async function updateSolution({ tempReceiptNo, tempReceiptId, solution, updater }) {
  try {
    return await failMaterialsRepository.upsertSolution({
      tempReceiptNo,
      tempReceiptId,
      solution,
      updater,
    });
  } catch (error) {
    console.error("Error in updateSolution:", error);
    throw error;
  }
}

async function cancelSolution({ tempReceiptNo, tempReceiptId }) {
  try {
    return await failMaterialsRepository.cancelSolution({
      tempReceiptNo,
      tempReceiptId,
    });
  } catch (error) {
    console.error("Error in cancelSolution:", error);
    throw error;
  }
}

module.exports = {
  getFailMaterials,
  getFailMaterialsPaginated,
  updateSolution,
  cancelSolution,
};
