const crypto = require("crypto");

const fallbackStart = 0;

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const key = process.env.RELO_WAITING_KEY || "relo:waiting:v2";

  if (!url || !token) {
    res.statusCode = 200;
    res.end(JSON.stringify({ count: null, mode: "fallback", persistent: false }));
    return;
  }

  const run = async parts => {
    const response = await fetch(`${url}/${parts.map(encodeURIComponent).join("/")}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.json();
  };

  try {
    let current = Number((await run(["GET", key])).result || 0);
    if (!current) {
      await run(["SET", key, String(fallbackStart)]);
      current = fallbackStart;
    }

    if (req.method === "POST") {
      const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
      const ua = String(req.headers["user-agent"] || "");
      const visitor = crypto.createHash("sha256").update(`${ip}|${ua}`).digest("hex").slice(0, 32);
      const visitorKey = `${key}:visitor:${visitor}`;
      const claimed = await run(["SET", visitorKey, "1", "EX", "31536000", "NX"]);

      if (claimed.result === "OK") {
        current = Number((await run(["INCR", key])).result || current + 1);
      }
    }

    res.statusCode = 200;
    res.end(JSON.stringify({ count: current, mode: "upstash", persistent: true }));
  } catch (error) {
    res.statusCode = 200;
    res.end(JSON.stringify({ count: null, mode: "error", persistent: false }));
  }
};
