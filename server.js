const express = require("express");
const { exec } = require("child_process");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 3000;

// Garante que a pasta HLS existe
if (!fs.existsSync("hls")) {
  fs.mkdirSync("hls");
}

// Inicia o FFmpeg dentro do Railway
const ffmpegCommand = `
ffmpeg -i https://streaming.live365.com/a12345  \
  -c:a aac -b:a 128k \
  -f hls \
  -hls_time 2 \
  -hls_list_size 5 \
  -hls_flags delete_segments \
  hls/index.m3u8
`;

console.log("Iniciando FFmpeg...");
const ffmpeg = exec(ffmpegCommand);

ffmpeg.stdout?.on("data", (data) => console.log("FFmpeg:", data));
ffmpeg.stderr?.on("data", (data) => console.log("FFmpeg erro:", data));
ffmpeg.on("close", () => console.log("FFmpeg finalizado"));

// Servir os arquivos HLS
app.use("/radio", express.static("hls"));

// Rota principal
app.get("/", (req, res) => {
  res.send("Relay da Rádio Atlântida Chapecó está ativo! Acesse /radio/index.m3u8");
});

// In