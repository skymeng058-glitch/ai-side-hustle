const crypto = require("crypto");

module.exports = async (req, res) => {
  // Serverless can't modify env vars. Return generated codes for manual addition.
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { count = 10, prefix = "" } = req.body;
  const newCodes = [];

  for (let i = 0; i < count; i++) {
    newCodes.push(prefix + crypto.randomBytes(3).toString("hex").toUpperCase());
  }

  res.json({
    generated: newCodes,
    note: "请手动将以上激活码添加到 Vercel 环境变量 UNLOCK_CODES 中（逗号分隔追加）",
  });
};
