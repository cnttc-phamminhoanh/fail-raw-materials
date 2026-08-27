const { getBIPool, sql } = require("../config/sql_db");

// Find user by user_no + password
async function findUserByUserNoAndPassword({ user_no, password }) {
  const pool = await getBIPool();

  const result = await pool
    .request()
    .input("user_no", sql.VarChar(50), user_no)
    .input("password", sql.VarChar(255), password)
    .query(`
      SELECT
        id, user_no, username, password, can_edit,
        created_at, updated_at, last_login_at, created_by
      FROM fail_material_users
      WHERE user_no = @user_no AND password = @password
    `);

  return result.recordset[0] || null;
}

// Update last login time
async function updateLastLogin(user_no) {
  const pool = await getBIPool();

  await pool.request().input("user_no", sql.Int, user_no)
  .query(`
    UPDATE fail_material_users
    SET last_login_at = GETDATE()
    WHERE user_no = @user_no
  `);
}

module.exports = {
  findUserByUserNoAndPassword,
  updateLastLogin,
};
