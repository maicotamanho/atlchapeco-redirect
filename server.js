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

// ---------------- FFmpeg Relay SEMPRE LIGADO ----------------

let ffmpegRelay = spawn("ffmpeg", [
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
  `${HLS_DIR}/index.m3u8`
], {
  detached: true,
  stdio: ["ignore", "ignore", "ignore"]
});

ffmpegRelay.unref();

console.log("FFmpeg Relay iniciado e sempre ativo.");

// ---------------- SERVE HLS (SEM ESPERAR SEGMENTO) ----------------

app.get("/radio/:file", (req, res) => {
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

  if (!fs.existsSync(fullPath)) {
    // Se o segmento não existe, retornar o último disponível
    const files = fs.readdirSync(HLS_DIR).filter(f => f.endsWith(".ts"));
    if (files.length > 0) {
      const ultimo = files.sort().reverse()[0];
      return res.sendFile(path.join(HLS_DIR, ultimo));
    }
    return res.status(204).end();
  }

  res.sendFile(fullPath);
});

// ---------------- OUVINTES ----------------

let ouvintes = new Map();

app.use("/radio", (req, res, next) => {
  const ua = req.headers["user-agent"] || "desconhecido";
  ouvintes.set(ua, Date.now());
  next();
});

// Remove ouvintes inativos
setInterval(() => {
  const agora = Date.now();
  for (const [ua, last] of ouvintes.entries()) {
    if (agora - last > 15000) ouvintes.delete(ua);
  }
}, 5000);

// ---------------- GRAVAÇÃO AUTOMÁTICA ----------------

let gravando = false;
let ffmpegRecord = null;

function iniciarGravacao() {
  if (gravando) return;

  console.log("Iniciando gravação (há ouvintes)...");

  const filename = `${RECORD_DIR}/gravacao_${Date.now()}.aac`;

  ffmpegRecord = spawn("ffmpeg", [
    "-i", STREAM_URL,
    "-c:a", "copy",
    filename
  ], {
    detached: true,
    stdio: ["ignore", "ignore", "ignore"]
  });

  ffmpegRecord.unref();
  gravando = true;
}

function pararGravacao() {
  if (!gravando) return;

  console.log("Parando gravação (sem ouvintes)...");

  try { ffmpegRecord.kill("SIGKILL"); } catch {}
  gravando = false;
}

setInterval(() => {
  if (ouvintes.size > 0) iniciarGravacao();
  else pararGravacao();
}, 5000);

// ---------------- SERVIDOR ----------------

app.listen(port, () => {
  console.log("Servidor rodando na porta", port);
});
