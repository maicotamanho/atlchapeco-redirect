const express = require("express");
const { spawn } = require("child_process");
const fs = require("fs");

const app = express();
const port = 3000;

const HLS_DIR = "/app/hls";
const RECORD_DIR = "/app/record";
const STREAM_URL = "https://24403.live.streamtheworld.com/ATL_CHAAAC.aac";

if (!fs.existsSync(HLS_DIR)) fs.mkdirSync(HLS_DIR, { recursive: true });
if (!fs.existsSync(RECORD_DIR)) fs.mkdirSync(RECORD_DIR, { recursive: true });

// ---------------- OUVINTES ----------------

let ouvintes = 0;
let gravando = false;
let ffmpegRecord = null;

// Detecta acessos ao HLS
app.use("/radio", (req, res, next) => {
  ouvintes++;
  console.log("Novo ouvinte conectado. Total:", ouvintes);

  res.on("close", () => {
    ouvintes--;
    if (ouvintes < 0) ouvintes = 0;
    console.log("Ouvinte saiu. Total:", ouvintes);
  });

  next();
});

// ---------------- SERVE HLS ----------------

app.use("/radio", express.static(HLS_DIR));

app.get("/", (req, res) => {
  res.send("Relay da Rádio Atlântida Chapecó ativo! /radio/index.m3u8");
});

// ---------------- FFmpeg Relay ----------------

function iniciarFFmpegRelay() {
  console.log("Iniciando FFmpeg Relay...");

  const ffmpeg = spawn("ffmpeg", [
    "-reconnect", "1",
    "-reconnect_streamed", "1",
    "-reconnect_delay_max", "5",
    "-timeout", "5000000",
    "-i", STREAM_URL,
    "-c:a", "aac",
    "-b:a", "128k",
    "-f", "hls",
    "-hls_time", "2",
    "-hls_list_size", "5",
    "-hls_flags", "delete_segments",
    `${HLS_DIR}/index.m3u8`
  ], {
    detached: true,
    stdio: ["ignore", "ignore", "ignore"]
  });

  ffmpeg.unref();
}

// ---------------- GRAVAÇÃO AUTOMÁTICA ----------------

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

  try {
    ffmpegRecord.kill("SIGKILL");
  } catch (e) {}

  gravando = false;
}

// Checa ouvintes a cada 10s
setInterval(() => {
  if (ouvintes > 0) {
    iniciarGravacao();
  } else {
    pararGravacao();
  }
}, 10000);

// ---------------- MONITORAMENTO DO RELAY ----------------

let lastUpdate = Date.now();

function monitorarHLS() {
  setInterval(() => {
    fs.stat(`${HLS_DIR}/index.m3u8`, (err, stats) => {
      if (err) return;

      const modified = new Date(stats.mtime).getTime();

      if (modified > lastUpdate) {
        lastUpdate = modified;
      } else {
        console.log("HLS travado, reiniciando FFmpeg Relay...");
        iniciarFFmpegRelay();
      }
    });
  }, 10000);
}

// ---------------- INICIAR SERVIDOR ----------------

app.listen(port, () => {
  console.log("Servidor rodando na porta", port);
  iniciarFFmpegRelay();
  monitorarHLS();
});
