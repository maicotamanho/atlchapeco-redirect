const express = require("express");
const { spawn } = require("child_process");
const fs = require("fs");

const app = express();
const port = 3000; // usando Dockerfile, porta fixa

const HLS_DIR = "/app/hls";
const STREAM_URL = "https://24403.live.streamtheworld.com/ATL_CHAAAC.aac";

// Garante que a pasta HLS existe
if (!fs.existsSync(HLS_DIR)) {
  fs.mkdirSync(HLS_DIR, { recursive: true });
  console.log("Pasta /app/hls criada");
}

// Servir HLS
app.use("/radio", express.static(HLS_DIR));

app.get("/", (req, res) => {
  res.send("Relay da Rádio Atlântida Chapecó está ativo! Acesse /radio/index.m3u8");
});

app.listen(port, () => {
  console.log("Servidor rodando na porta", port);
  iniciarFFmpeg();
  iniciarMonitoramento();
});

// ---------------- FFmpeg ----------------

function iniciarFFmpeg() {
  console.log("Iniciando FFmpeg em background...");

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

// ---------------- Monitoramento ----------------

let lastUpdate = Date.now();

function iniciarMonitoramento() {
  setInterval(() => {
    fs.stat(`${HLS_DIR}/index.m3u8`, (err, stats) => {
      if (err) return;

      const modified = new Date(stats.mtime).getTime();

      if (modified > lastUpdate) {
        lastUpdate = modified;
      } else {
        console.log("HLS parece travado, reiniciando FFmpeg...");
        iniciarFFmpeg();
      }
    });
  }, 10000);
}
