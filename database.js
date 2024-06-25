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
  } catch (error) {
    console.error("Error connecting to the database:", error);
    return;
  }

  // connection.connect((error) => {
  //   if (error) {
  //     console.error("Error connecting to the database:", error);
  //     return;
  //   }
  //   console.log("Connected to the database successfully.");
  // });
} else {
  connection = null;
  console.error(
    `No database connection details provided.
    This usually meants we are running locally on a dev machine`
  );
}

module.exports = connection;
