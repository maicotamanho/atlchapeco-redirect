const express = require("express");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const port = 3000;

const HLS_DIR = "/app/hls";
const RECORD_DIR = "/app/record";
const STREAM_URL = "https://24403.live.streamtheworld.com/ATL_CHAAAC.aac";

if (!fs.existsSync(HLS_DIR)) fs.mkdirSync(HLS_DIR, { recursive: true });
if (!fs.existsSync(RECORD_DIR)) fs.mkdirSync(RECORD_DIR, { recursive: true });

// ---------------- SERVE HLS COM ANTI-CACHE + MIME CORRETO ----------------

app.get("/radio/:file", async (req, res) => {
  const file = req.params.file;
  const fullPath = path.join(HLS_DIR, file);

  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (file.endsWith(".m3u8")) {
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
  } else if (file.endsWith(".ts")) {
    res.setHeader("Content-Type", "video/mp2t");
  }

  // Se o arquivo não existe ainda, esperar até existir
  if (!fs.existsSync(fullPath)) {
    console.log("Aguardando segmento:", file);

    let tentativas = 0;
    while (!fs.existsSync(fullPath) && tentativas < 50) {
      await new Promise(r => setTimeout(r, 100));
      tentativas++;
    }
  }

  if (!fs.existsSync(fullPath)) {
    return res.status(204).end(); // nunca retornar 404
  }

  fs.createReadStream(fullPath).pipe(res);
});

// ---------------- PLACEHOLDER ----------------

function criarPlaceholder() {
  const placeholder = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    "#EXT-X-TARGETDURATION:4",
    "#EXT-X-MEDIA-SEQUENCE:0",
    "#EXT-X-ENDLIST"
  ].join("\n");

  fs.writeFileSync(`${HLS_DIR}/index.m3u8`, placeholder);
}

// ---------------- LIMPAR HLS ----------------

function limparHLS() {
  fs.readdirSync(HLS_DIR).forEach(f => {
    fs.unlinkSync(`${HLS_DIR}/${f}`);
  });
}

// ---------------- OUVINTES ----------------

let ouvintes = new Map();

app.use("/radio", (req, res, next) => {
  const ua = req.headers["user-agent"] || "desconhecido";
  ouvintes.set(ua, Date.now());
  next();
});

setInterval(() => {
  const agora = Date.now();
  for (const [ua, last] of ouvintes.entries()) {
    if (agora - last > 15000) ouvintes.delete(ua);
  }
  controlarRelay();
}, 5000);

// ---------------- RELAY ----------------

let ffmpegRelay = null;
let relayLigado = false;

function ligarRelay() {
  if (relayLigado) return;

  limparHLS();
  criarPlaceholder();

  ffmpegRelay = spawn("ffmpeg", [
    "-probesize", "10000000",
    "-analyzeduration", "10000000",
    "-fflags", "+discardcorrupt",
    "-flush_packets", "1",
    "-reconnect", "1",
    "-reconnect_streamed", "1",
    "-reconnect_delay_max", "5",
    "-timeout", "5000000",
    "-i", STREAM_URL,
    "-c:a", "aac",
    "-b:a", "128k",
    "-f", "hls",
    "-hls_time", "4",
    "-hls_list_size", "10",
    "-hls_flags", "delete_segments+independent_segments",
    "-max_reload", "1",
    `${HLS_DIR}/index.m3u8`
  ], {
    detached: true,
    stdio: ["ignore", "ignore", "ignore"]
  });

  ffmpegRelay.unref();
  relayLigado = true;
}

function desligarRelay() {
  if (!relayLigado) return;
  try { ffmpegRelay.kill("SIGKILL"); } catch {}
  relayLigado = false;
}

function controlarRelay() {
  if (ouvintes.size > 0) ligarRelay();
  else desligarRelay();
}

// ---------------- SERVIDOR ----------------

app.listen(port, () => {
  console.log("Servidor rodando na porta", port);
});
