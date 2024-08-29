const mysql = require("mysql2");
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

    // Convert pool to use promises
    const promisePool = pool.promise();

    console.log("Connected to the database successfully.");

    module.exports = promisePool;
  } catch (error) {
    console.error("Error creating database pool:", error);
    process.exit(1);
  }
} else {
  console.error(`Database connection failed. Please check your configuration`);
  process.exit(1);
}

module.exports = pool;
