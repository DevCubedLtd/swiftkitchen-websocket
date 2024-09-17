const mysql = require("mysql2/promise");
require("dotenv").config();

let pool;

if (process.env.DB_HOST) {
  try {
    pool = mysql.createPool({
      connectionLimit: 20,
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      queueLimit: 0,
    });

    console.log("Connected to the database successfully.");

    module.exports = {
      query: async (sql, params) => {
        try {
          const [results] = await pool.query(sql, params);
          return results;
        } catch (error) {
          console.error("Database query error:", error);
          throw error;
        }
      },
      pool: pool,
    };
  } catch (error) {
    console.error("Error creating database pool:", error);
    process.exit(1);
  }
} else {
  // console.error(`Database connection failed. Please check your configuration`);
  // process.exit(1);
  console.log(
    "No DBHost found. Either we are doing local development or your environment variables are misconfigured",
  );
}
