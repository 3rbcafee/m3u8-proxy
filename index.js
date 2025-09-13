const express = require("express");
const fetch = require("node-fetch");
const app = express();

// Only allow requests from your website
const allowedSites = ["https://tv.qanwatlive.com"];

app.use((req, res, next) => {
  const origin = req.headers.origin || "";
  const referer = req.headers.referer || "";

  if (!allowedSites.some(site => origin.startsWith(site) || referer.startsWith(site))) {
    return res.status(403).send("Access Denied");
  }

  res.setHeader("access-control-allow-origin", allowedSites[0]);
  res.setHeader("access-control-allow-headers", "*");
  res.setHeader("access-control-allow-methods", "GET,HEAD,OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  next();
});

app.get("/", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send("Missing url parameter");

  try {
    const response = await fetch(targetUrl, {
      redirect: "follow",
      headers: {
        "user-agent": req.headers["user-agent"] || ""
      }
    });

    const contentType = response.headers.get("content-type") || "";
    res.setHeader("content-type", contentType);
    res.setHeader("access-control-allow-origin", allowedSites[0]);
    res.setHeader("access-control-allow-headers", "*");
    res.setHeader("access-control-allow-methods", "GET,HEAD,OPTIONS");

    // If it's an m3u8 playlist, rewrite internal links
    if (contentType.includes("application/vnd.apple.mpegurl") || targetUrl.endsWith(".m3u8")) {
      let text = await response.text();
      const base = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);

      text = text.replace(/^(?!#)(.*)$/gm, (line) => {
        line = line.trim();
        if (!line) return line;
        if (line.startsWith("http")) {
          return `/?url=${encodeURIComponent(line)}`;
        } else {
          return `/?url=${encodeURIComponent(base + line)}`;
        }
      });

      return res.status(response.status).send(text);
    }

    // For other files (e.g. .ts segments), stream as-is
    const buffer = await response.arrayBuffer();
    return res.status(response.status).send(Buffer.from(buffer));
  } catch (err) {
    console.error("Fetch error:", err.message);
    return res.status(500).send("Error fetching target URL: " + err.message);
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Proxy server running on port ${port}`);
});
