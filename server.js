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

// ---------------- LIMPAR HLS AO LIGAR ----------------

function limparHLS() {
  try {
    fs.readdirSync(HLS_DIR).forEach(file => {
      fs.unlinkSync(`${HLS_DIR}/${file}`);
    });
    console.log("HLS limpo antes de ligar o relay.");
  } catch (e) {
    console.log("Erro ao limpar HLS:", e);
  }
}

// ---------------- OUVINTES POR USER-AGENT ----------------

let ouvintes = new Map(); // userAgent -> timestamp

app.use("/radio", (req, res, next) => {
  const ua = req.headers["user-agent"] || "desconhecido";
  ouvintes.set(ua, Date.now());
  next();
});

// Remove ouvintes inativos
setInterval(() => {
  const agora = Date.now();

  for (const [ua, last] of ouvintes.entries()) {
    if (agora - last > 15000) { // 15s sem pedir ts = saiu
      ouvintes.delete(ua);
    }
  }

  console.log("Ouvintes reais:", ouvintes.size);

  controlarRelay(); // liga/desliga automaticamente
}, 5000);

// ---------------- SERVE HLS ----------------

app.use("/radio", express.static(HLS_DIR));

app.get("/", (req, res) => {
  res.send("Relay da Rádio Atlântida Chapecó ativo! Acesse /radio/index.m3u8");
});

// ---------------- FFmpeg Relay ----------------

let ffmpegRelay = null;
let relayLigado = false;

function ligarRelay() {
  if (relayLigado) return;

  limparHLS(); // <<< ESSENCIAL PARA NÃO TOCAR ÁUDIO ANTIGO

  console.log("Ligando FFmpeg Relay (há ouvintes)...");

  ffmpegRelay = spawn("ffmpeg", [
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

  ffmpegRelay.unref();
  relayLigado = true;
}

function desligarRelay() {
  if (!relayLigado) return;

  console.log("Desligando FFmpeg Relay (sem ouvintes)...");

  try {
    ffmpegRelay.kill("SIGKILL");
  } catch (e) {}

  relayLigado = false;
}

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

  try {
    ffmpegRecord.kill("SIGKILL");
  } catch (e) {}

  gravando = false;
}

// ---------------- CONTROLE AUTOMÁTICO ----------------

function controlarRelay() {
  if (ouvintes.size > 0) {
    ligarRelay();
    iniciarGravacao();
  } else {
    desligarRelay();
    pararGravacao();
  }
}

// ---------------- MONITORAMENTO DO RELAY ----------------

let lastUpdate = Date.now();

setInterval(() => {
  if (!relayLigado) return; // só monitora se estiver ligado

  fs.stat(`${HLS_DIR}/index.m3u8`, (err, stats) => {
    if (err) return;

    const modified = new Date(stats.mtime).getTime();

    if (modified > lastUpdate) {
      lastUpdate = modified;
    } else {
      console.log("HLS travado, reiniciando FFmpeg Relay...");
      ligarRelay();
    }
  });
}, 10000);

// ---------------- INICIAR SERVIDOR ----------------

app.listen(port, () => {
  console.log("Servidor rodando na porta", port);
});
