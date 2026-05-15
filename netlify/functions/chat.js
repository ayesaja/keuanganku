const https = require("https");

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function chatReply(text) {
  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({
      content: [{ type: "text", text: JSON.stringify({ reply: text, transactions: [], actions: [] }) }]
    })
  };
}

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: "POST", headers }, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function sendToSheets(webhookUrl, transactions) {
  if (!webhookUrl || !transactions || transactions.length === 0) return;
  try {
    const url = new URL(webhookUrl);
    const body = JSON.stringify({ transactions });
    await httpsPost(url.hostname, url.pathname + url.search, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    }, body);
  } catch (e) {
    console.log("Sheets error (non-fatal):", e.message);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: HEADERS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };

  const apiKey = process.env.ANTHROPIC_KEY;
  if (!apiKey) return chatReply("⚠️ ANTHROPIC_KEY tidak ada di server.");

  let parsedBody;
  try { parsedBody = JSON.parse(event.body); }
  catch (e) { return chatReply("⚠️ Request tidak valid."); }

  parsedBody.model = "claude-haiku-4-5-20251001";
  const requestBody = JSON.stringify(parsedBody);

  try {
    const result = await httpsPost("api.anthropic.com", "/v1/messages", {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(requestBody),
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    }, requestBody);

    if (result.status !== 200) {
      return chatReply(`⚠️ Anthropic error ${result.status}: ${result.body}`);
    }

    // Kirim transaksi baru ke Google Sheets (non-blocking)
    try {
      const responseData = JSON.parse(result.body);
      const text = responseData.content?.[0]?.text || "";
      const clean = text.replace(/```[a-z]*/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(clean);
      const transactions = parsed.transactions || [];
      if (transactions.length > 0) {
        await sendToSheets(process.env.SHEETS_WEBHOOK_URL, transactions);
      }
    } catch (e) {
      console.log("Parse/sheets error (non-fatal):", e.message);
    }

    return { statusCode: 200, headers: HEADERS, body: result.body };

  } catch (err) {
    return chatReply("⚠️ Koneksi gagal: " + err.message);
  }
};
