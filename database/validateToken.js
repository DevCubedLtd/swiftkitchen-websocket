const crypto = require("crypto");
const db = require("../database/database");

async function validateToken(parsedMessage, tokenArray) {
  const accessToken = parsedMessage?.accessToken;
  if (!accessToken) return false;

  const [tokenId, token] = accessToken.split("|");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  // Has token been validated before? Check local array
  if (tokenArray.includes(tokenHash)) return true;

  try {
    const results = await db.query(
      "SELECT id FROM personal_access_tokens WHERE id = ? AND token = ?",
      [tokenId, tokenHash]
    );

    if (results.length > 0) {
      // Valid hash, store in tokenArray
      tokenArray.push(tokenHash);
      return true;
    }
  } catch (error) {
    console.error("Database query failed:", error);
  }
  return false;
}

module.exports = { validateToken };
