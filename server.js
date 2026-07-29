const express = require("express");
const app = express();
const { exec } = require("child_process");

app.use("/radio", express.static("hls"));

exec("bash server.sh");

app.get("/", (req, res) => {
  res.send("Relay da Rádio Atlântida Chapecó está ativo! Acesse /radio/index.m3u8");
});

app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});
