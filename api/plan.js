const OpenAI = require("openai");

// Simple encrypt/decrypt using base64 + secret
const SECRET = process.env.SECRET_KEY || "ai-side-hustle-secret-2024";

function encrypt(text) {
  const key = SECRET.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const chars = text.split("").map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ ((key + i) % 256)));
  return Buffer.from(chars.join("")).toString("base64");
}

function decrypt(encoded) {
  const key = SECRET.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const chars = Buffer.from(encoded, "base64").toString().split("");
  return chars.map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ ((key + i) % 256))).join("");
}

const SYSTEM_PROMPT = `你是副业规划师，专帮打工人找副业。用户给的信息哪怕再少，你也要直接给方案，不要反问、不要让他补充信息、不要拒绝回答。

按以下结构输出（用【】做标题，不要用#号）。注意：在"【3个方向，你挑】"和"【我建议你先搞这个】"之间，必须插入独立一行"---PAYWALL---"。

【3个方向，你挑】

用表格列出3个方向：方向名、启动成本、预计月收入、上手难度。

---PAYWALL---

【我建议你先搞这个】

推荐一个方向，说为什么。然后给操作步骤——别写"第一步第二步"，用自然段说，每步落到"今天下班就能干"。6-8步。

【这行的坑】

列3条，每条一句话。

【钱的事】

启动多少钱、多久见第一笔钱、多久稳定月入XX。

铁规矩：
- 不说"以下是"、"接下来"、"值得注意的是"、"说白了"、"划重点"、"总的来说"。
- 不写"不是A而是B"、"先A再B"、"真正重要的是"、"核心在于"、"底层逻辑"。
- 段落长短不一。结尾不问问题。不写"如果你有XX告诉我"。
- 用"兄弟"称呼。像产线歇烟聊天。`;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { identity, hours, skills } = req.body;
  if (!identity || !hours || skills === undefined) {
    return res.status(400).json({ error: "请填写完整信息" });
  }

  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
  });

  try {
    const completion = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `身份：${identity}\n每天可用时间：${hours}小时\n已有技能/资源：${skills || "无"}\n\n直接给方案，别问问题，别让补充信息。叫我"兄弟"。` },
      ],
    });

    const fullContent = completion.choices[0].message.content;
    const parts = fullContent.split("---PAYWALL---");
    const freeContent = parts[0]?.trim() || "";
    const premiumContent = parts.length > 1 ? parts[1].trim() : "";

    res.json({
      freeContent,
      premiumEncrypted: premiumContent ? encrypt(premiumContent) : "",
    });
  } catch (err) {
    console.error("API Error:", err.message);
    res.status(500).json({ error: "生成出错，请稍后重试" });
  }
};
