const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 4173;
const HOST = "0.0.0.0";
const ROOT = __dirname;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8"
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "ForsakenUpdateTracker/1.0" }
  });
  if (!response.ok) {
    throw new Error(`Roblox returned ${response.status}`);
  }
  return response.json();
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const placeId = url.searchParams.get("placeId") || "18687417158";
  const universeId = url.searchParams.get("universeId");
  let resolvedUniverseId = universeId;

  if (!resolvedUniverseId) {
    if (placeId === "18687417158") {
      resolvedUniverseId = "6331902150";
    } else {
      const universe = await fetchJson(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
      resolvedUniverseId = String(universe.universeId);
    }
  }

  const gameData = await fetchJson(`https://games.roblox.com/v1/games?universeIds=${resolvedUniverseId}`);
  const game = gameData.data && gameData.data[0];
  if (!game) {
    send(res, 404, JSON.stringify({ error: "No Roblox game found." }));
    return;
  }

  send(res, 200, JSON.stringify({ placeId, universeId: resolvedUniverseId, game }));
}

function handleStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(ROOT, requested));

  if (!filePath.startsWith(ROOT)) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      send(res, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }
    send(res, 200, content, MIME[path.extname(filePath)] || "text/plain; charset=utf-8");
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/game")) {
    handleApi(req, res).catch((error) => {
      send(res, 502, JSON.stringify({ error: error.message }));
    });
    return;
  }
  handleStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Forsaken update tracker running on ${HOST}:${PORT}`);
});
