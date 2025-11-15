import express from "express";
import fetch from "node-fetch";
import FormData from "form-data";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import fs from "fs";

const app = express();
app.use(express.json());
ffmpeg.setFfmpegPath(ffmpegPath);

const BOT_TOKEN = "8582123760:AAGmQo-gIi70ob9xTX8SGMmvpin40e7cpsw";
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const YT_APIS = [
  "https://piped.video/streams/{id}",
  "https://piped.mha.fi/streams/{id}",
  "https://piped.tokhmi.xyz/streams/{id}"
];

app.post("/api/download", async (req, res) => {
  const { chatId, url, quality } = req.body;

  try {
    if (url.includes("youtu")) {
      const file = await handleYouTube(url, quality);
      await sendVideo(chatId, file);
    }

    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: e.toString() });
  }
});

async function handleYouTube(url, quality) {
  const id = url.match(/(?:v=|youtu\.be\/)([^&]+)/)[1];
  let streams;

  for (const api of YT_APIS) {
    try {
      const json = await fetch(api.replace("{id}", id)).then(r => r.json());
      if (json.video) {
        streams = json.video;
        break;
      }
    } catch {}
  }

  const filtered = streams.filter(s => s.quality === quality);
  const selected = filtered[0] || streams[0];

  return await mergeVideoAudio(selected.video, selected.audio);
}

async function mergeVideoAudio(videoUrl, audioUrl) {
  return new Promise(resolve => {
    const out = "/tmp/out.mp4";
    ffmpeg()
      .addInput(videoUrl)
      .addInput(audioUrl)
      .outputOptions("-c:v copy")
      .outputOptions("-c:a aac")
      .save(out)
      .on("end", () => resolve(out));
  });
}

async function sendVideo(chatId, file) {
  const fd = new FormData();
  fd.append("chat_id", chatId);
  fd.append("video", fs.createReadStream(file));
  return fetch(`${TG_API}/sendVideo`, { method: "POST", body: fd });
}

app.listen(3000, () => console.log("Render server running"));
