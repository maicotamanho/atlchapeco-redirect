const express = require("express");
const { exec } = require("child_process");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 3000;

// Caminho ABSOLUTO no Railway
const HLS_DIR = "/app/hls";

// Garante que a pasta HLS existe
if (!fs.existsSync(HLS_DIR)) {
  fs.mkdirSync(HLS_DIR, { recursive: true });
  console.log("Pasta /app/hls criada");
}

// URL REAL da Atlântida Chapecó (StreamTheWorld)
const STREAM_URL = "https://24403.live.streamtheworld.com/ATL_CHAAAC.aac";

// Comando FFmpeg com caminho ABSOLUTO
const ffmpegCommand = `
ffmpeg -i "${STREAM_URL}" \
  -c:a aac -b:a 128k \
  -f hls \
  -hls_time 2 \
  -hls_list_size 5 \
  -hls_flags delete_segments \
  ${HLS_DIR}/index.m3u8
`;

console.log("Iniciando FFmpeg...");
const ffmpeg = exec(ffmpegCommand);

// Logs do FFmpeg (não são erros, apenas stderr)
ffmpeg.stdout?.on("data", (data) => console.log("FFmpeg:", data));
ffmpeg.stderr?.on("data", (data) => console.log("FFmpeg:", data));
ffmpeg.on("close", () => console.log("FFmpeg finalizado"));

// Servir os arquivos HLS
app.use("/radio", express.static(HLS_DIR));

// Rota principal
app.get("/", (req, res) => {
  res.send("Relay da Rádio Atlântida Chapecó está ativo! Acesse /radio/index.m3u8");
});

// Iniciar servidor
app.listen(port, () => {
  console.log("Servidor rodando na porta", port);
});
