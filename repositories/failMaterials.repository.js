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
        CONVERT(char(10), n1.sheet_date, 23) AS entry_date,
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
        CONCAT(FORMAT(o.sheet_pri, '0.00'), ' ', n.cur_no, ' / ', o.unit_no) AS unit_no,
        o.sheet_pri * (ISNULL(n.return_qty, 0) + ISNULL(n.return_qty1, 0)) AS amt_return,
          n.cur_no AS currency,
        CASE
    WHEN fx.cur_rate > 0
        THEN fx.cur_rate
    ELSE NULL
END AS exchange_rate,

CASE
    WHEN UPPER(LTRIM(RTRIM(n.cur_no))) = 'USD'
        THEN o.sheet_pri * (
            ISNULL(n.return_qty, 0)
            + ISNULL(n.return_qty1, 0)
        )

    WHEN UPPER(LTRIM(RTRIM(n.cur_no))) = 'VND'
        AND fx.cur_rate > 0
        THEN (
            o.sheet_pri * (
                ISNULL(n.return_qty, 0)
                + ISNULL(n.return_qty1, 0)
            )
        ) / NULLIF(fx.cur_rate, 0)

    ELSE NULL
END AS amount_usd,
        p.def39 AS solution_code,
        p.def38 AS solution_updater,
        p.def25 AS update_time,
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
      INNER JOIN RDS.erp_t8_gi.dbo.pur_notice2 p WITH (NOLOCK) ON p.sheet_no = n.sheet_no AND p.sheet_id = n.sheet_id
      LEFT JOIN RDS.erp_t8_gi.dbo.pur_order2 o ON o.sheet_no = n.pur_no AND o.sheet_id = n.pur_id
      LEFT JOIN RDS.erp_t8_gi.dbo.bas_cur_acc fx
      ON fx.acc_period = CONVERT(char(6), n1.sheet_date, 112)
      AND fx.cur_code = 'USD'
      LEFT JOIN RDS.erp_t8_gi.dbo.scm_other_out2 ow ON ow.made_lot = n.made_lot AND ow.goods_no = n.goods_no
      LEFT JOIN RDS.erp_t8_gi.dbo.scm_other_out1 ow1 ON ow1.sheet_no = ow.sheet_no AND ow1.sheet_type = 'WECGI'
      WHERE
        n.return_qty + n.return_qty1 > 0
        AND n.pro_result <> 2
        AND n.sheet_sta1 = '1'
        AND n1.sheet_date >= '20260826'

      GROUP BY
        n1.sheet_date,
        n.def15, n.pur_no, n.pur_id, o.sheet_qty, n.sheet_no, n.sheet_id, n.made_lot,
        n.goods_no, n.goods_name, n.sheet_qty, n.sheet_qty1, n.return_qty, n.return_qty1,
        fx.cur_rate, n.cur_no, n.unit_no, p.def39, p.def38, p.def25, o.sheet_pri, o.unit_no
        ORDER BY
    n.pur_no DESC,
    n.pur_id ASC,
    n1.sheet_date ASC,
    n.sheet_no ASC,
    n.sheet_id ASC
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

    let whereClause = "n.return_qty + n.return_qty1 > 0 AND n.pro_result <> 2 AND n1.sheet_date >= '20260826' AND n.sheet_sta1 = '1'";
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
      whereClause += ` AND p.def25 >= @date AND p.def25 < DATEADD(DAY, 1, @date)`;
      params.push({ name: "date", value: date, type: sql.Date });
    }

    const query = `
      WITH CTE AS (
        SELECT
          CONVERT(char(10), n1.sheet_date, 23) AS entry_date,
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
          CONCAT(FORMAT(o.sheet_pri, '0.00'), ' ', n.cur_no, ' / ', o.unit_no) AS unit_no,
          o.sheet_pri * (ISNULL(n.return_qty, 0) + ISNULL(n.return_qty1, 0)) AS amt_return,
          n.cur_no AS currency,
        CASE
    WHEN fx.cur_rate > 0
        THEN fx.cur_rate
    ELSE NULL
END AS exchange_rate,

CASE
    WHEN UPPER(LTRIM(RTRIM(n.cur_no))) = 'USD'
        THEN o.sheet_pri * (
            ISNULL(n.return_qty, 0)
            + ISNULL(n.return_qty1, 0)
        )

    WHEN UPPER(LTRIM(RTRIM(n.cur_no))) = 'VND'
         AND fx.cur_rate > 0
        THEN (
            o.sheet_pri * (
                ISNULL(n.return_qty, 0)
                + ISNULL(n.return_qty1, 0)
            )
        ) / NULLIF(fx.cur_rate, 0)

    ELSE NULL
END AS amount_usd,
          p.def39 AS solution_code,
          p.def38 AS solution_updater,
          p.def25 AS update_time,
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
        ROW_NUMBER() OVER (ORDER BY
        n.pur_no DESC,
        n.pur_id ASC,
        n1.sheet_date ASC,
        n.sheet_no ASC,
        n.sheet_id ASC) AS row_num
        FROM RDS.erp_t8_gi.dbo.v_pur_notice_detail n WITH (NOLOCK)
        INNER JOIN RDS.erp_t8_gi.dbo.pur_notice1 n1 WITH (NOLOCK) ON n1.sheet_no = n.sheet_no
        INNER JOIN RDS.erp_t8_gi.dbo.pur_notice2 p WITH (NOLOCK) ON p.sheet_no = n.sheet_no AND p.sheet_id = n.sheet_id
        LEFT JOIN RDS.erp_t8_gi.dbo.pur_order2 o ON o.sheet_no = n.pur_no AND o.sheet_id = n.pur_id
        LEFT JOIN RDS.erp_t8_gi.dbo.bas_cur_acc fx
        ON fx.acc_period = CONVERT(char(6), n1.sheet_date, 112)
        AND fx.cur_code = 'USD'
        LEFT JOIN RDS.erp_t8_gi.dbo.scm_other_out2 ow ON ow.made_lot = n.made_lot AND ow.goods_no = n.goods_no
        LEFT JOIN RDS.erp_t8_gi.dbo.scm_other_out1 ow1 ON ow1.sheet_no = ow.sheet_no AND ow1.sheet_type = 'WECGI'
        WHERE ${whereClause}
        GROUP BY
          n1.sheet_date,
          n.def15, n.pur_no, n.pur_id, o.sheet_qty, n.sheet_no, n.sheet_id, n.made_lot,
          n.goods_no, n.goods_name, n.sheet_qty, n.sheet_qty1, n.return_qty, n.return_qty1,
          fx.cur_rate, n.cur_no, n.unit_no, p.def39, p.def38, p.def25, o.sheet_pri, o.unit_no
      )
     SELECT * FROM CTE
      WHERE row_num BETWEEN @offset + 1 AND @offset + @limit
      ORDER BY row_num;
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

    let whereClause = "n.return_qty + n.return_qty1 > 0 AND n.pro_result <> 2 AND n1.sheet_date >= '20260826' AND n.sheet_sta1 = '1'";
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
            whereClause += ` AND p.def25 >= @date AND p.def25 < DATEADD(DAY, 1, @date)`;
      params.push({ name: "date", value: date, type: sql.Date });
    }

    const query = `
      SELECT COUNT(DISTINCT n.sheet_no + '_' + CAST(n.sheet_id AS VARCHAR)) AS total
      FROM RDS.erp_t8_gi.dbo.v_pur_notice_detail n WITH (NOLOCK)
      INNER JOIN RDS.erp_t8_gi.dbo.pur_notice1 n1 WITH (NOLOCK) ON n1.sheet_no = n.sheet_no
      INNER JOIN RDS.erp_t8_gi.dbo.pur_notice2 p WITH (NOLOCK) ON p.sheet_no = n.sheet_no AND p.sheet_id = n.sheet_id
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
async function upsertSolution({
  tempReceiptNo,
  tempReceiptId,
  solutionCode,
  updater,
}) {
  const logContext = { tempReceiptNo, tempReceiptId };
  let stage = "getBIPool";
  let stageStart = Date.now();
  try {
    const pool = await getBIPool();

    stage = "checkHasActualHandling";
    stageStart = Date.now();
    console.log("[Save Solution] Bắt đầu kiểm tra actual handling", logContext);
    const hasActual = await checkHasActualHandling(
      pool,
      tempReceiptNo,
      tempReceiptId
    );
    console.log("[Save Solution] Kiểm tra actual handling xong", {
      ...logContext,
      elapsedMs: Date.now() - stageStart,
      hasActual,
    });
    stage = "validateActualHandling";
    stageStart = Date.now();

    if (hasActual) {
      const error = new Error(
        "Cannot update solution: this record already has actual handling data (exported)."
      );
      error.statusCode = 403;
      throw error;
    }

    const modifiedAt = new Date();

    // Cập nhật mã solution, người cập nhật và thời gian.
    stage = "UPDATE pur_notice2";
    stageStart = Date.now();
    console.log("[Save Solution] Bắt đầu UPDATE pur_notice2", logContext);
    const result = await pool.request()
      .input("noticeNo", sql.VarChar(20), tempReceiptNo)
      .input("noticeId", sql.Int, parseInt(tempReceiptId, 10))
      .input("solutionCode", sql.NVarChar(255), solutionCode)
      .input("modifiedUser", sql.NVarChar(255), String(updater || "ADMIN"))
      .input("modifiedAt", sql.DateTime, modifiedAt)
      .query(`
        UPDATE RDS.erp_t8_gi.dbo.pur_notice2
        SET def39 = @solutionCode,
            def25 = @modifiedAt,
            def38 = @modifiedUser
        WHERE sheet_no = @noticeNo
          AND sheet_id = @noticeId;

        SELECT @@ROWCOUNT AS affected;
      `);
    console.log("[Save Solution] UPDATE xong", {
      ...logContext,
      elapsedMs: Date.now() - stageStart,
    });
    stage = "validateAffectedRows";
    stageStart = Date.now();

    if (result.recordset[0].affected !== 1) {
      const error = new Error(
        "Temporary receipt not found or not eligible for solution update."
      );
      error.statusCode = 400;
      throw error;
    }

    return { success: true, action: "updated" };
  } catch (error) {
    console.error("[Save Solution] Thất bại", {
      ...logContext,
      stage,
      elapsedMs: Date.now() - stageStart,
      code: error.code,
      message: error.message,
    });
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
      UPDATE RDS.erp_t8_gi.dbo.pur_notice2
      SET def39 = NULL,
          def38 = NULL,
          def25 = NULL
      WHERE sheet_no = @noticeNo
        AND sheet_id = @noticeId;

      IF @@ROWCOUNT <> 1
        THROW 50001, 'Expected exactly one temporary receipt row', 1;

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
