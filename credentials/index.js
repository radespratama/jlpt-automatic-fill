const fs = require("fs");
const path = require("path");

const PRIVATE_DIR = path.join(__dirname, "private");

async function loadCredential(filename) {
  const filePath = path.join(PRIVATE_DIR, filename);
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  console.log(`✅ Loaded credentials: ${filename}`);
  return data;
}

module.exports = { loadCredential };
