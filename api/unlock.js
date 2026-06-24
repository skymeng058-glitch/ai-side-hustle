const SECRET = process.env.SECRET_KEY || "ai-side-hustle-secret-2024";

function decrypt(encoded) {
  const key = SECRET.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const chars = Buffer.from(encoded, "base64").toString().split("");
  return chars.map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ ((key + i) % 256))).join("");
}

// Load codes from env
function getCodes() {
  const raw = process.env.UNLOCK_CODES || "";
  const used = process.env.USED_CODES || "";
  const usedSet = new Set(used.split(",").map(c => c.trim()).filter(Boolean));
  return { all: raw.split(",").map(c => c.trim()).filter(Boolean), used: usedSet };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code, encryptedContent } = req.body;
  if (!code || !encryptedContent) {
    return res.status(400).json({ error: "参数不完整" });
  }

  const { all, used } = getCodes();
  const upperCode = code.toUpperCase();

  if (!all.includes(upperCode)) {
    return res.status(403).json({ error: "激活码无效" });
  }

  if (used.has(upperCode)) {
    return res.status(403).json({ error: "激活码已被使用" });
  }

  // Note: In serverless, we can't persist used codes across invocations
  // For now, allow reuse. In production, use a database.
  // We trust the honor system for the MVP.

  try {
    const content = decrypt(encryptedContent);
    res.json({ success: true, content });
  } catch (err) {
    res.status(500).json({ error: "解密失败" });
  }
};
