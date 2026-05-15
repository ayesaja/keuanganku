const https = require("https");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.ANTHROPIC_KEY;
  if (!apiKey) {
    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        content: [{ type: "text", text: JSON.stringify({
          reply: "⚠️ API key tidak ditemukan. Cek environment variable ANTHROPIC_KEY di Netlify.",
          transactions: [], actions: []
        })}]
      })
    };
  }

  try {
    const requestBody = event.body;

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(requestBody),
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      });

      req.on("error", reject);
      req.write(requestBody);
      req.end();
    });

    return { statusCode: result.status, headers, body: result.body };

  } catch (error) {
    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        content: [{ type: "text", text: JSON.stringify({
          reply: "Gagal terhubung ke server. Error: " + error.message,
          transactions: [], actions: []
        })}]
      })
    };
  }
};
