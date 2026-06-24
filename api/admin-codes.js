module.exports = async (req, res) => {
  const raw = process.env.UNLOCK_CODES || "";
  const used = process.env.USED_CODES || "";
  const usedSet = new Set(used.split(",").map(c => c.trim()).filter(Boolean));
  const codes = raw.split(",").map(c => c.trim()).filter(Boolean);

  const list = codes.map(code => ({
    code,
    used: usedSet.has(code),
  }));

  res.json({ codes: list });
};
