const mysql = require("mysql");
require("dotenv").config();

let connection;
if (process.env.DB_HOST) {
  // Replace the values with your database connection details
  try {
    connection = mysql.createPool({
      connectionLimit: 20,
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    console.log("Connected to the database successfully.");
  } catch (error) {
    console.error("Error connecting to the database:", error);
    return;
  }
} else {
  connection = null;
  console.error(`Database connection failed. Please check your configuration`);
}

module.exports = connection;
