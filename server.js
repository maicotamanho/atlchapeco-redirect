const STREAM_URL = "https://24403.live.streamtheworld.com/ATL_CHAAAC.aac";
const express = require("express");
const { spawn } = require("child_process");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 3000;

const HLS_DIR = "/app/hls";

if (!fs.existsSync(HLS_DIR)) {
  fs.mkdirSync(HLS_DIR, { recursive: true });
}

console.log("Iniciando FFmpeg em background...");

const ffmpeg = spawn("ffmpeg", [
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
  stdio: "ignore"
});

ffmpeg.unref();

app.use("/radio", express.static(HLS_DIR));

app.get("/", (req, res) => {
  res.send("Relay da Rádio Atlântida Chapecó está ativo! Acesse /radio/index.m3u8");
});

app.listen(port, () => {
  console.log("Servidor rodando na porta", port);
});
