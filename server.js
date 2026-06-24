const fs = require("fs"), http = require("http"), path = require("path");
try { const e = fs.readFileSync(path.join(__dirname, ".env"), "utf-8"); e.split("\n").forEach(l => { const m = l.match(/^\s*([^#\s][^=]*?)\s*=\s*(.*?)\s*$/); if (m) process.env[m[1]] = m[2]; }); } catch(_) {}

const PORT = 3000;
const MIME = { ".html":"text/html", ".js":"application/javascript", ".css":"text/css", ".jpg":"image/jpeg", ".png":"image/png", ".json":"application/json", ".ico":"image/x-icon" };

const SYSTEM = [
  "你是副业规划师。给出详细、具体、能落地的完整方案。",
  "",
  "【3个方向，你挑】",
  "表格列出3个方向(方向名/启动成本/预计月收入/上手难度)。每个方向下面加一句简短说明为什么适合这个人。",
  "",
  "【最推荐你搞这个】",
  "推荐1个方向+详细理由+具体操作步骤。6-8步，每步写清楚：打开什么APP、搜什么关键词、花多少钱、预计花多久。具体到今天下班打开手机就能干的程度。",
  "",
  "【这行的坑】",
  "3条坑，每条2-3句话把坑说透，附上怎么躲。",
  "",
  "【钱的事】",
  "启动金额(精确到元)/几天能见第一笔钱/稳定月入要多久。",
  "",
  "铁规矩：不写以下是/第一步第二步/不是而是/真正重要的是/说白了/划重点。叫兄弟。段落长短不一。多写细节少写空话。直接出方案别追问。"
].join("\n");

async function handlePlan(req, res) {
  let body = ""; req.on("data", c => body += c);
  req.on("end", async () => {
    try {
      const { identity, hours, skills } = JSON.parse(body);
      const key = process.env.GROQ_API_KEY || process.env.DEEPSEEK_API_KEY;
      const isGroq = !!process.env.GROQ_API_KEY;
      const r = await fetch(isGroq ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.deepseek.com/v1/chat/completions", {
        method: "POST", headers: { "Content-Type":"application/json", "Authorization":"Bearer "+key },
        body: JSON.stringify({ model: isGroq?"llama-3.3-70b-versatile":"deepseek-chat", messages:[{role:"system",content:SYSTEM},{role:"user",content:"身份："+identity+"\n每天可用时间："+hours+"小时\n已有技能："+(skills||"无")+"\n\n给详细的方案，每个操作步骤写具体。"}], temperature:0.7, max_tokens:4096 }),
        signal: AbortSignal.timeout(30000)
      });
      const d = await r.json();
      if (!d.choices) { res.writeHead(500,{"Content-Type":"application/json"}); res.end(JSON.stringify({error:"AI出错"})); return; }
      res.writeHead(200,{"Content-Type":"application/json;charset=utf-8"});
      res.end(JSON.stringify({content:d.choices[0].message.content}));
    } catch(e) { res.writeHead(500,{"Content-Type":"application/json"}); res.end(JSON.stringify({error:e.message})); }
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && new URL(req.url,"http://x").pathname === "/api/plan") return handlePlan(req, res);
  let fp = new URL(req.url,"http://x").pathname; if (fp === "/") fp = "/index.html";
  fp = path.join(__dirname, "." + fp);
  const ext = path.extname(fp);
  fs.readFile(fp, (err, data) => { if (err) { res.writeHead(404); res.end("404"); return; } res.writeHead(200,{"Content-Type":MIME[ext]||"text/plain"}); res.end(data); });
});

server.listen(PORT, () => { console.log("http://localhost:"+PORT); try { const n = require("os").networkInterfaces(); for (const k of Object.keys(n)) for (const a of n[k]) if (a.family==="IPv4"&&!a.internal) console.log("手机: http://"+a.address+":"+PORT); } catch(_){} });
