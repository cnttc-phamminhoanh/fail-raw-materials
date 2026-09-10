const { getBIPool, sql } = require("../config/sql_db");

// ===== HELPER: Kiểm tra có actual handling chưa =====
async function checkHasActualHandling(pool, tempReceiptNo, tempReceiptId) {
  const query = `
    SELECT 
      ISNULL(SUM(CASE WHEN ow.def16 = '01' THEN ow.sheet_qty ELSE 0 END), 0) AS returned_internal,
      ISNULL(SUM(CASE WHEN ow.def16 = '02' THEN ow.sheet_qty ELSE 0 END), 0) AS returned_customs,
      ISNULL(SUM(CASE WHEN ow.def16 = '03' THEN ow.sheet_qty ELSE 0 END), 0) AS destroyed_internal,
      ISNULL(SUM(CASE WHEN ow.def16 = '04' THEN ow.sheet_qty ELSE 0 END), 0) AS destroyed_customs
    FROM RDS.erp_t8_gi.dbo.v_pur_notice_detail n WITH (NOLOCK)
    LEFT JOIN RDS.erp_t8_gi.dbo.scm_other_out2 ow 
      ON ow.made_lot = n.made_lot AND ow.goods_no = n.goods_no
    WHERE n.sheet_no = @noticeNo AND n.sheet_id = @noticeId
  `;

  const result = await pool.request()
    .input("noticeNo", sql.VarChar(20), tempReceiptNo)
    .input("noticeId", sql.Int, parseInt(tempReceiptId, 10))
    .query(query);

  if (result.recordset.length === 0) {
    return false;
  }

  const row = result.recordset[0];
  return (
    Number(row.returned_internal) > 0 ||
    Number(row.returned_customs) > 0 ||
    Number(row.destroyed_internal) > 0 ||
    Number(row.destroyed_customs) > 0
  );
}

async function getFailMaterials() {
  try {
    const pool = await getBIPool();

    const query = `
      SELECT
        n.def15 AS supplier,
        n.pur_no AS po_no,
        n.pur_id AS po_id,
        o.sheet_qty AS order_qty,
        n.sheet_no AS temp_no,
        n.sheet_id AS temp_id,
        n.made_lot AS lot_no,
        n.goods_no AS mat_code,
        n.goods_name AS mat_name,
        n.sheet_qty AS temp_qty,
        n.sheet_qty1 AS foc_qty,
        ISNULL(n.return_qty, 0) + ISNULL(n.return_qty1, 0) AS reject_qty,
        (ISNULL(n.return_qty, 0) + ISNULL(n.return_qty1, 0)) / NULLIF((ISNULL(n.sheet_qty, 0) + ISNULL(n.sheet_qty1, 0)), 0) AS fail_percent,
        CONCAT(FORMAT(o.sheet_pri, '0.00'), CONCAT(' / ', o.unit_no)) AS unit_no,
        o.sheet_pri * (ISNULL(n.return_qty, 0) + ISNULL(n.return_qty1, 0)) AS amt_return,
        sl.solution AS solution,
        sl.modified_user AS solution_updater,
        sl.modified_at AS update_time,
        SUM(CASE WHEN ow.def16 = '01' THEN ow.sheet_qty ELSE 0 END) AS returned_internal,
        SUM(CASE WHEN ow.def16 = '02' THEN ow.sheet_qty ELSE 0 END) AS returned_customs,
        SUM(CASE WHEN ow.def16 = '03' THEN ow.sheet_qty ELSE 0 END) AS destroyed_internal,
        SUM(CASE WHEN ow.def16 = '04' THEN ow.sheet_qty ELSE 0 END) AS destroyed_customs,
        ISNULL(n.return_qty, 0)
          - ISNULL(SUM(CASE WHEN ow.def16 = '01' THEN ow.sheet_qty ELSE 0 END), 0)
          - ISNULL(SUM(CASE WHEN ow.def16 = '02' THEN ow.sheet_qty ELSE 0 END), 0)
          - ISNULL(SUM(CASE WHEN ow.def16 = '03' THEN ow.sheet_qty ELSE 0 END), 0)
          - ISNULL(SUM(CASE WHEN ow.def16 = '04' THEN ow.sheet_qty ELSE 0 END), 0)
        AS remain_qty,
        0 AS replacement_qty,
        '' AS new_lot_no
      FROM RDS.erp_t8_gi.dbo.v_pur_notice_detail n WITH (NOLOCK)
      INNER JOIN RDS.erp_t8_gi.dbo.pur_notice1 n1 WITH (NOLOCK) ON n1.sheet_no = n.sheet_no
      INNER JOIN RDS.erp_t8_gi.dbo.pur_notice_sol sl WITH (NOLOCK) ON sl.notice_no = n.sheet_no AND sl.notice_id = n.sheet_id
      LEFT JOIN RDS.erp_t8_gi.dbo.pur_order2 o ON o.sheet_no = n.pur_no AND o.sheet_id = n.pur_id
      LEFT JOIN RDS.erp_t8_gi.dbo.scm_other_out2 ow ON ow.made_lot = n.made_lot AND ow.goods_no = n.goods_no
      LEFT JOIN RDS.erp_t8_gi.dbo.scm_other_out1 ow1 ON ow1.sheet_no = ow.sheet_no AND ow1.sheet_type = 'WECGI'
      WHERE
        n.return_qty + n.return_qty1 > 0
        AND n.pro_result <> 2
      GROUP BY
        n.def15, n.pur_no, n.pur_id, o.sheet_qty, n.sheet_no, n.sheet_id, n.made_lot,
        n.goods_no, n.goods_name, n.sheet_qty, n.sheet_qty1, n.return_qty, n.return_qty1,
        n.unit_no, sl.solution, sl.modified_user, sl.modified_at, o.sheet_pri, o.unit_no
    `;

    const result = await pool.request().query(query);
    return result.recordset;
  } catch (error) {
    console.error("Error in getFailMaterials:", error);
    throw error;
  }
}

// Lấy danh sách FAIL materials với phân trang và tìm kiếm
async function getFailMaterialsPaginated({
  page = 1,
  limit = 50,
  search = "",
  date = "",
}) {
  try {
    const pool = await getBIPool();
    const offset = (page - 1) * limit;

    let whereClause = "n.return_qty + n.return_qty1 > 0 AND n.pro_result <> 2";
    const params = [];

    if (search) {
      whereClause += ` AND (
        n.def15 LIKE @search OR
        n.pur_no LIKE @search OR
        n.pur_id LIKE @search OR
        n.sheet_no LIKE @search OR
        n.sheet_id LIKE @search OR
        n.made_lot LIKE @search OR
        n.goods_no LIKE @search OR
        n.goods_name LIKE @search
      )`;
      params.push({ name: "search", value: `%${search}%`, type: sql.NVarChar });
    }

    if (date) {
      whereClause += ` AND sl.modified_at >= @date AND sl.modified_at < DATEADD(DAY, 1, @date)`;
      params.push({ name: "date", value: date, type: sql.Date });
    }

    const query = `
      WITH CTE AS (
        SELECT
          n.def15 AS supplier,
          n.pur_no AS po_no,
          n.pur_id AS po_id,
          o.sheet_qty AS order_qty,
          n.sheet_no AS temp_no,
          n.sheet_id AS temp_id,
          n.made_lot AS lot_no,
          n.goods_no AS mat_code,
          n.goods_name AS mat_name,
          n.sheet_qty AS temp_qty,
          n.sheet_qty1 AS foc_qty,
          ISNULL(n.return_qty, 0) + ISNULL(n.return_qty1, 0) AS reject_qty,
          (ISNULL(n.return_qty, 0) + ISNULL(n.return_qty1, 0)) / NULLIF((ISNULL(n.sheet_qty, 0) + ISNULL(n.sheet_qty1, 0)), 0) AS fail_percent,
          CONCAT(FORMAT(o.sheet_pri, '0.00'), CONCAT(' / ', o.unit_no)) AS unit_no,
          o.sheet_pri * (ISNULL(n.return_qty, 0) + ISNULL(n.return_qty1, 0)) AS amt_return,
          sl.solution AS solution,
          sl.modified_user AS solution_updater,
          sl.modified_at AS update_time,
          SUM(CASE WHEN ow.def16 = '01' THEN ow.sheet_qty ELSE 0 END) AS returned_internal,
          SUM(CASE WHEN ow.def16 = '02' THEN ow.sheet_qty ELSE 0 END) AS returned_customs,
          SUM(CASE WHEN ow.def16 = '03' THEN ow.sheet_qty ELSE 0 END) AS destroyed_internal,
          SUM(CASE WHEN ow.def16 = '04' THEN ow.sheet_qty ELSE 0 END) AS destroyed_customs,
          ISNULL(n.return_qty, 0)
            - ISNULL(SUM(CASE WHEN ow.def16 = '01' THEN ow.sheet_qty ELSE 0 END), 0)
            - ISNULL(SUM(CASE WHEN ow.def16 = '02' THEN ow.sheet_qty ELSE 0 END), 0)
            - ISNULL(SUM(CASE WHEN ow.def16 = '03' THEN ow.sheet_qty ELSE 0 END), 0)
            - ISNULL(SUM(CASE WHEN ow.def16 = '04' THEN ow.sheet_qty ELSE 0 END), 0)
          AS remain_qty,
          0 AS replacement_qty,
          '' AS new_lot_no,
          ROW_NUMBER() OVER (ORDER BY n.sheet_no DESC) AS row_num
        FROM RDS.erp_t8_gi.dbo.v_pur_notice_detail n WITH (NOLOCK)
        INNER JOIN RDS.erp_t8_gi.dbo.pur_notice1 n1 WITH (NOLOCK) ON n1.sheet_no = n.sheet_no
        INNER JOIN RDS.erp_t8_gi.dbo.pur_notice_sol sl WITH (NOLOCK) ON sl.notice_no = n.sheet_no AND sl.notice_id = n.sheet_id
        LEFT JOIN RDS.erp_t8_gi.dbo.pur_order2 o ON o.sheet_no = n.pur_no AND o.sheet_id = n.pur_id
        LEFT JOIN RDS.erp_t8_gi.dbo.scm_other_out2 ow ON ow.made_lot = n.made_lot AND ow.goods_no = n.goods_no
        LEFT JOIN RDS.erp_t8_gi.dbo.scm_other_out1 ow1 ON ow1.sheet_no = ow.sheet_no AND ow1.sheet_type = 'WECGI'
        WHERE ${whereClause}
        GROUP BY
          n.def15, n.pur_no, n.pur_id, o.sheet_qty, n.sheet_no, n.sheet_id, n.made_lot,
          n.goods_no, n.goods_name, n.sheet_qty, n.sheet_qty1, n.return_qty, n.return_qty1,
          n.unit_no, sl.solution, sl.modified_user, sl.modified_at, o.sheet_pri, o.unit_no
      )
      SELECT * FROM CTE
      WHERE row_num BETWEEN @offset + 1 AND @offset + @limit
    `;

    const request = pool.request();

    params.forEach((p) => {
      request.input(p.name, p.type, p.value);
    });

    request.input("offset", sql.Int, offset);
    request.input("limit", sql.Int, limit);

    const result = await request.query(query);

    return result.recordset;
  } catch (error) {
    console.error("Error in getFailMaterialsPaginated:", error);
    throw error;
  }
}

// Lấy tổng số lượng FAIL materials
async function getTotalCount({ search = "", date = "" }) {
  try {
    const pool = await getBIPool();

    let whereClause = "n.adj_result = 2 AND n.pro_result = 0";
    const params = [];

    if (search) {
      whereClause += ` AND (
        n.def15 LIKE @search OR
        n.pur_no LIKE @search OR
        n.pur_id LIKE @search OR
        n.sheet_no LIKE @search OR
        n.sheet_id LIKE @search OR
        n.made_lot LIKE @search OR
        n.goods_no LIKE @search OR
        n.goods_name LIKE @search
      )`;
      params.push({ name: "search", value: `%${search}%`, type: sql.NVarChar });
    }

    if (date) {
      whereClause += ` AND sl.modified_at >= @date AND sl.modified_at < DATEADD(DAY, 1, @date)`;
      params.push({ name: "date", value: date, type: sql.Date });
    }

    const query = `
      SELECT COUNT(DISTINCT n.sheet_no + '_' + CAST(n.sheet_id AS VARCHAR)) AS total
      FROM RDS.erp_t8_gi.dbo.v_pur_notice_detail n WITH (NOLOCK)
      INNER JOIN RDS.erp_t8_gi.dbo.pur_notice1 n1 WITH (NOLOCK) ON n1.sheet_no = n.sheet_no
      INNER JOIN RDS.erp_t8_gi.dbo.pur_notice_sol sl WITH (NOLOCK) ON sl.notice_no = n.sheet_no AND sl.notice_id = n.sheet_id
      WHERE ${whereClause}
    `;

    const request = pool.request();

    params.forEach((p) => {
      request.input(p.name, p.type, p.value);
    });

    const result = await request.query(query);
    return result.recordset[0]?.total || 0;
  } catch (error) {
    console.error("Error in getTotalCount:", error);
    throw error;
  }
}

// Cập nhật solution
async function upsertSolution({ tempReceiptNo, tempReceiptId, solution, updater }) {
  try {
    const pool = await getBIPool();

    const hasActual = await checkHasActualHandling(pool, tempReceiptNo, tempReceiptId);

    if (hasActual) {
      const error = new Error('Cannot update solution: this record already has actual handling data (exported).');
      error.statusCode = 403;
      throw error;
    }

    // Kiểm tra xem record đã tồn tại chưa
    const checkQuery = `
      SELECT COUNT(*) AS count 
      FROM RDS.erp_t8_gi.dbo.pur_notice_sol 
      WHERE notice_no = @noticeNo AND notice_id = @noticeId
    `;

    const checkResult = await pool.request()
      .input("noticeNo", sql.VarChar, tempReceiptNo)
      .input("noticeId", sql.Int, parseInt(tempReceiptId, 10))
      .query(checkQuery);

    const exists = checkResult.recordset[0].count > 0;

    const now = new Date();

    if (exists) {
      // Update existing record
      const updateQuery = `
        UPDATE RDS.erp_t8_gi.dbo.pur_notice_sol 
        SET 
          solution = @solution,
          modified_at = @modifiedAt,
          modified_user = @modifiedUser
        WHERE notice_no = @noticeNo AND notice_id = @noticeId
      `;

      await pool.request()
        .input("noticeNo", sql.VarChar, tempReceiptNo)
        .input("noticeId", sql.Int, parseInt(tempReceiptId, 10))
        .input("solution", sql.NVarChar, solution)
        .input("modifiedAt", sql.DateTime, now)
        .input("modifiedUser", sql.VarChar, updater || 'ADMIN')
        .query(updateQuery);

      return { success: true, action: 'updated' };
    }
  } catch (error) {
    console.error("Error in upsertSolution:", error);
    throw error;
  }
}

async function cancelSolution({ tempReceiptNo, tempReceiptId }) {
  try {
    const pool = await getBIPool();

    const hasActual = await checkHasActualHandling(pool, tempReceiptNo, tempReceiptId);

    if (hasActual) {
      const error = new Error('Cannot cancel solution: this record already has actual handling data (exported).');
      error.statusCode = 403;
      throw error;
    }

    const cancelQuery = `
      UPDATE RDS.erp_t8_gi.dbo.pur_notice_sol set solution = null
      WHERE notice_no = @noticeNo AND notice_id = @noticeId
    `;

    await pool.request()
      .input("noticeNo", sql.VarChar, tempReceiptNo)
      .input("noticeId", sql.Int, parseInt(tempReceiptId, 10))
      .query(cancelQuery);

    return { success: true };
  } catch (error) {
    console.error("Error in cancelSolution:", error);
    throw error;
  }
}

// Export rework - gọi stored procedure pro_issue_rework_whs_gi
async function exportRework({ tempReceiptNo, tempReceiptId, handlingType, quantity, updater }) {
  try {
    const pool = await getBIPool();

    const query = `
      EXEC RDS.erp_t8_gi.dbo.pro_issue_rework_whs_gi
        @notice_no = @noticeNo,
        @notice_id = @noticeId,
        @actural_sol = @acturalSol,
        @qty = @qty,
        @user_no = @userNo
    `;

    await pool.request()
      .input("noticeNo", sql.VarChar(20), tempReceiptNo)
      .input("noticeId", sql.Int, parseInt(tempReceiptId, 10))
      .input("acturalSol", sql.VarChar(50), handlingType)
      .input("qty", sql.Numeric(18, 8), quantity)
      .input("userNo", sql.VarChar(20), updater || 'ADMIN')
      .query(query);

    return { success: true };
  } catch (error) {
    console.error("Error in exportRework:", error);
    throw error;
  }
}

module.exports = {
  getFailMaterials,
  getFailMaterialsPaginated,
  getTotalCount,
  upsertSolution,
  cancelSolution,
  exportRework,
};
