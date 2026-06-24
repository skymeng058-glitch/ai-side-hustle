require("dotenv").config();
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || "your-api-key-here",
  baseURL: "https://api.deepseek.com",
});

// 激活码管理
const CODES_FILE = path.join(__dirname, "unlock_codes.json");

function loadCodes() {
  try {
    if (fs.existsSync(CODES_FILE)) {
      return JSON.parse(fs.readFileSync(CODES_FILE, "utf-8"));
    }
  } catch (e) { /* ignore */ }
  const envCodes = (process.env.UNLOCK_CODES || "").split(",").map(c => c.trim()).filter(Boolean);
  const codes = {};
  envCodes.forEach(c => { codes[c] = { used: false, createdAt: Date.now() }; });
  fs.writeFileSync(CODES_FILE, JSON.stringify(codes, null, 2));
  return codes;
}

function saveCodes(codes) {
  fs.writeFileSync(CODES_FILE, JSON.stringify(codes, null, 2));
}

const sessions = {};

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

const IDENTITY_MAP = {
  工厂打工人: "兄弟",
  办公室文员: "姐妹/兄弟",
  宝妈: "姐妹",
  大学生: "同学",
  自由职业者: "朋友",
};

app.post("/api/plan", async (req, res) => {
  try {
    const { identity, hours, skills } = req.body;

    if (!identity || !hours || skills === undefined) {
      return res.status(400).json({ error: "请填写完整信息" });
    }

    const greeting = IDENTITY_MAP[identity] || "朋友";
    const sessionId = crypto.randomUUID();
    let fullContent = "";

    const stream = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `身份：${identity}\n每天可用时间：${hours}小时\n已有技能/资源：${skills || "无"}\n\n直接给方案，别问问题，别让补充信息。叫我"${greeting}"。`,
        },
      ],
      stream: true,
    });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullContent += content;
        res.write(content);
      }
    }

    sessions[sessionId] = { content: fullContent, createdAt: Date.now() };
    res.write("\n---SESSION:" + sessionId);
    res.end();
  } catch (err) {
    console.error("API Error:", err.message);
    res.status(500).json({ error: "生成出错，请稍后重试" });
  }
});

app.post("/api/unlock", (req, res) => {
  const { code, sessionId } = req.body;

  if (!code || !sessionId) {
    return res.status(400).json({ error: "参数不完整" });
  }

  const codes = loadCodes();
  const entry = codes[code];

  if (!entry) return res.status(403).json({ error: "激活码无效" });
  if (entry.used) return res.status(403).json({ error: "激活码已被使用" });

  entry.used = true;
  entry.usedAt = Date.now();
  entry.sessionId = sessionId;
  saveCodes(codes);

  const session = sessions[sessionId];
  if (!session) return res.status(404).json({ error: "会话已过期，请重新生成方案" });

  const parts = session.content.split("---PAYWALL---");
  const premiumContent = parts.length > 1 ? parts[1].trim() : session.content;

  res.json({ success: true, content: premiumContent });
});

app.post("/api/admin/generate-codes", (req, res) => {
  const { count = 10, prefix = "" } = req.body;
  const codes = loadCodes();
  const newCodes = [];

  for (let i = 0; i < count; i++) {
    const code = prefix + crypto.randomBytes(3).toString("hex").toUpperCase();
    if (!codes[code]) {
      codes[code] = { used: false, createdAt: Date.now() };
      newCodes.push(code);
    }
  }

  saveCodes(codes);
  res.json({ generated: newCodes, total: Object.keys(codes).length });
});

app.get("/api/admin/codes", (req, res) => {
  const codes = loadCodes();
  const list = Object.entries(codes).map(([code, info]) => ({
    code, used: info.used,
    createdAt: new Date(info.createdAt).toISOString(),
    usedAt: info.usedAt ? new Date(info.usedAt).toISOString() : null,
  }));
  res.json({ codes: list });
});

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of Object.entries(sessions)) {
    if (now - session.createdAt > 3600000) delete sessions[id];
  }
}, 3600000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AI副业导航已启动：http://localhost:${PORT}`);
  console.log(`管理页面：http://localhost:${PORT}/admin.html`);
});
