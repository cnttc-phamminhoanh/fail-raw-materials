const failMaterialsRepository = require("../repositories/failMaterials.repository");
const SOLUTION_CODES = new Map([
  ["AOD / 选用", "a"],
  ["Suppliers paid rework cost on site / 供应商支付返工费", "b"],
  [
    "Replaced Material by Vendor / 供应商补料 (Using original PO 用回原PO号)",
    "c",
  ],
  ["Return to Vendor / 退回供应商 (Y/N)", "d"],
  ["Scrap / 报废", "e"],
]);


const SOLUTION_LABELS = new Map(
  [...SOLUTION_CODES].map(([label, code]) => [code, label])
);

// Transform dữ liệu từ database sang format frontend
function transformRow(row) {
  return {
    entryDate: row.entry_date || null,
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
    totalAmount: row.amt_return ?? null,
    currency: (row.currency || "").trim().toUpperCase(),
    exchangeRate: row.exchange_rate ?? null,
    amountUsd: row.amount_usd ?? null,
    solution: SOLUTION_LABELS.get(String(row.solution_code || "").trim()) || "",
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
async function updateSolution({
  tempReceiptNo,
  tempReceiptId,
  solution,
  updater,
}) {
  const solutionCode = SOLUTION_CODES.get(solution);

  if (!solutionCode) {
    const error = new Error("Invalid solution");
    error.statusCode = 400;
    throw error;
  }

  return failMaterialsRepository.upsertSolution({
    tempReceiptNo,
    tempReceiptId,
    solutionCode,
    updater,
  });
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

// Export rework
async function exportRework({ tempReceiptNo, tempReceiptId, handlingType, quantity, updater }) {
  try {
    return await failMaterialsRepository.exportRework({
      tempReceiptNo,
      tempReceiptId,
      handlingType,
      quantity,
      updater,
    });
  } catch (error) {
    console.error("Error in exportRework:", error);
    throw error;
  }
}

module.exports = {
  getFailMaterials,
  getFailMaterialsPaginated,
  updateSolution,
  cancelSolution,
  exportRework
};
