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

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: HEADERS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };

  const apiKey = process.env.ANTHROPIC_KEY;
  if (!apiKey) return chatReply("⚠️ ANTHROPIC_KEY tidak ada di server. Cek Environment Variables di Netlify.");

  let parsedBody;
  try { parsedBody = JSON.parse(event.body); }
  catch (e) { return chatReply("⚠️ Request tidak valid: " + e.message); }

  // Force model ke yang paling kompatibel
  parsedBody.model = "claude-haiku-4-5-20251001";
  const requestBody = JSON.stringify(parsedBody);

  try {
    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(requestBody),
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
      }, (res) => {
        let data = "";
        res.on("data", (c) => { data += c; });
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      });
      req.on("error", reject);
      req.write(requestBody);
      req.end();
    });

    if (result.status !== 200) {
      return chatReply(`⚠️ Anthropic error ${result.status}: ${result.body}`);
    }

    return { statusCode: 200, headers: HEADERS, body: result.body };

  } catch (err) {
    return chatReply("⚠️ Koneksi gagal: " + err.message);
  }
};
