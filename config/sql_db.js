const sql = require("mssql");

const biConfig = {
  user: process.env.BI_MSSQL_USER,
  password: process.env.BI_MSSQL_PASSWORD,
  server: process.env.BI_MSSQL_HOST,
  database: process.env.BI_MSSQL_DB,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let biPool;

async function CONNECT_BI_DB() {
  biPool = await new sql.ConnectionPool(biConfig).connect();

  biPool.on("error", (err) => {
    console.error("BI Pool Error:", err);
    biPool = null;
  });

  return biPool;
}

async function getBIPool() {
  if (!biPool?.connected) {
    throw new Error("Must connect to BI Database first!");
  }

  return biPool;
}

module.exports = {
  sql,
  CONNECT_BI_DB,
  getBIPool,
};
