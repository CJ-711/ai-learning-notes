const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ffmpeg = require("@ffmpeg-installer/ffmpeg").path;

const root = path.resolve(__dirname, "..");
const assets = path.join(root, "assets");
const renders = path.join(root, "renders");
const segmentsDir = path.join(renders, "_segments", "brand-use-cut");
const audioDir = path.join(renders, "audio");
const micro = path.join(assets, "stock-video", "micro-use");
const productUse = path.join(assets, "generated-product", "product-use", "2026-06-23");
const brand = path.join(assets, "brand");

const fontDisplay = "C\\:/Windows/Fonts/bahnschrift.ttf";
const fontBody = "C\\:/Windows/Fonts/segoeui.ttf";

fs.mkdirSync(renders, { recursive: true });
fs.mkdirSync(segmentsDir, { recursive: true });
fs.mkdirSync(audioDir, { recursive: true });

function q(filePath) {
  return path.resolve(filePath);
}

function run(cmd, args, label, options = {}) {
  console.log(`\n${label}`);
  const result = spawnSync(cmd, args, {
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    windowsHide: true,
    encoding: options.capture ? "utf8" : undefined,
  });
  if (result.status !== 0) {
    if (options.capture) {
      process.stdout.write(result.stdout || "");
      process.stderr.write(result.stderr || "");
    }
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
  return result;
}

function ff(args, label, options) {
  return run(ffmpeg, ["-hide_banner", ...args], label, options);
}

function ps(script, label) {
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  run("powershell.exe", ["-NoProfile", "-EncodedCommand", encoded], label);
}

function escText(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%");
}

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing input asset: ${filePath}`);
  }
}

function mediaDuration(filePath) {
  const result = spawnSync(ffmpeg, ["-hide_banner", "-i", q(filePath)], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    encoding: "utf8",
  });
  const text = `${result.stdout || ""}\n${result.stderr || ""}`;
  const match = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) throw new Error(`Could not read duration for ${filePath}`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function captionLayer(scene) {
  const title = escText(scene.title);
  const subtitle = escText(scene.subtitle || "");
  const top = scene.top ?? 1280;
  const titleSize = scene.titleSize ?? 70;
  const subtitleSize = scene.subtitleSize ?? 33;
  const end = Math.max(0.2, scene.duration - 0.18).toFixed(2);
  const filters = [
    "drawbox=x=0:y=0:w=iw:h=ih:color=0x050605@0.08:t=fill",
    "drawtext=fontfile='" + fontBody + "':text='CJ SPORT LAB':fontsize=24:fontcolor=0xC9FF00:x=58:y=70:borderw=1:bordercolor=0x050605@0.55",
    "drawbox=x=58:y=116:w=104:h=5:color=0xC9FF00@0.92:t=fill",
    `drawtext=fontfile='${fontDisplay}':text='${title}':fontsize=${titleSize}:fontcolor=0xF5F7EF:x=58:y=${top}:line_spacing=6:borderw=4:bordercolor=0x050605@0.88`,
  ];

  if (subtitle) {
    filters.push(
      `drawtext=fontfile='${fontBody}':text='${subtitle}':fontsize=${subtitleSize}:fontcolor=0xC9FF00:x=62:y=${top + titleSize + 34}:borderw=3:bordercolor=0x050605@0.86`
    );
  }

  filters.push(
    "drawbox=x=58:y=1780:w=82:h=6:color=0xC9FF00@0.92:t=fill",
    "drawbox=x=150:y=1780:w=46:h=6:color=0xF5F7EF@0.65:t=fill",
    "fade=t=in:st=0:d=0.08",
    `fade=t=out:st=${end}:d=0.16`,
    "format=yuv420p"
  );
  return filters.join(",");
}

function videoSegment(scene, index) {
  const input = path.join(micro, scene.input);
  ensureFile(input);
  const output = path.join(segmentsDir, `${String(index + 1).padStart(2, "0")}-${scene.id}.mp4`);
  const vf = [
    "scale=1180:2098:force_original_aspect_ratio=increase",
    "crop=1080:1920",
    "setsar=1",
    "eq=contrast=1.13:saturation=1.04:brightness=-0.04",
    captionLayer(scene),
  ].join(",");

  ff(
    [
      "-y",
      "-ss",
      String(scene.start ?? 0),
      "-t",
      String(scene.duration),
      "-i",
      q(input),
      "-vf",
      vf,
      "-r",
      "30",
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-movflags",
      "+faststart",
      q(output),
    ],
    `video segment ${scene.id}`
  );
  return output;
}

function productSegment(scene, index) {
  const input = path.join(productUse, scene.input);
  ensureFile(input);
  const output = path.join(segmentsDir, `${String(index + 1).padStart(2, "0")}-${scene.id}.mp4`);
  const frames = Math.round(scene.duration * 30);
  const zStart = scene.zoomStart ?? 1.035;
  const zEnd = scene.zoomEnd ?? 1.1;
  const zDelta = zEnd - zStart;
  const x =
    scene.anchor === "left"
      ? "(iw-iw/zoom)*0.28"
      : scene.anchor === "right"
        ? "(iw-iw/zoom)*0.72"
        : "iw/2-(iw/zoom/2)";
  const y =
    scene.anchor === "high"
      ? "(ih-ih/zoom)*0.34"
      : scene.anchor === "low"
        ? "(ih-ih/zoom)*0.62"
        : "ih/2-(ih/zoom/2)";

  const vf = [
    "scale=1380:2454:force_original_aspect_ratio=increase",
    "crop=1380:2454",
    `zoompan=z='${zStart.toFixed(3)}+${zDelta.toFixed(3)}*on/${frames}':x='${x}':y='${y}':d=${frames}:s=1080x1920:fps=30`,
    "setsar=1",
    "eq=contrast=1.10:saturation=1.06:brightness=-0.025",
    "drawbox=x=44:y=44:w=992:h=1832:color=0xC9FF00@0.10:t=2",
    captionLayer(scene),
  ].join(",");

  ff(
    [
      "-y",
      "-loop",
      "1",
      "-i",
      q(input),
      "-vf",
      vf,
      "-frames:v",
      String(frames),
      "-r",
      "30",
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "19",
      "-movflags",
      "+faststart",
      q(output),
    ],
    `product segment ${scene.id}`
  );
  return output;
}

function logoSegment(scene, index) {
  const input = path.join(brand, "cj-sport-lab-logo.png");
  ensureFile(input);
  const output = path.join(segmentsDir, `${String(index + 1).padStart(2, "0")}-${scene.id}.mp4`);
  const frames = Math.round(scene.duration * 30);
  const filters = [
    "[0:v]scale=1300:2310:force_original_aspect_ratio=increase,crop=1300:2310,boxblur=34:1,eq=brightness=-0.31:saturation=0.85[bg]",
    "[0:v]scale=820:820:force_original_aspect_ratio=decrease[fg]",
    `[bg][fg]overlay=(W-w)/2:(H-h)/2-135,zoompan=z='1.018+0.032*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30,setsar=1`,
    captionLayer(scene),
  ].join(",");

  ff(
    [
      "-y",
      "-loop",
      "1",
      "-i",
      q(input),
      "-filter_complex",
      filters,
      "-frames:v",
      String(frames),
      "-r",
      "30",
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "19",
      "-movflags",
      "+faststart",
      q(output),
    ],
    `logo segment ${scene.id}`
  );
  return output;
}

function makeTts(name, text, targetDuration) {
  const rates = [1, 0, 2, -1];
  const candidates = [];
  for (const rate of rates) {
    const out = path.join(audioDir, `${name}-rate${String(rate).replace("-", "m")}.wav`);
    const escapedText = text.replace(/`/g, "``").replace(/"/g, '`"');
    const escapedOut = out.replace(/'/g, "''");
    ps(
      `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice('Microsoft Zira Desktop')
$s.Rate = ${rate}
$s.Volume = 96
$s.SetOutputToWaveFile('${escapedOut}')
$s.Speak("${escapedText}")
$s.Dispose()
`,
      `tts ${name} rate ${rate}`
    );
    candidates.push({ out, rate, duration: mediaDuration(out) });
  }

  candidates.sort((a, b) => {
    const ap = Math.abs(a.duration - targetDuration) + (a.duration < targetDuration - 0.25 ? 3 : 0);
    const bp = Math.abs(b.duration - targetDuration) + (b.duration < targetDuration - 0.25 ? 3 : 0);
    return ap - bp;
  });
  const chosen = candidates[0];
  console.log(`selected tts ${name}: rate ${chosen.rate}, ${chosen.duration.toFixed(2)}s for ${targetDuration.toFixed(2)}s video`);
  return chosen;
}

function concatSegments(name, files, narration) {
  const list = path.join(segmentsDir, `${name}.txt`);
  fs.writeFileSync(list, files.map((file) => `file '${q(file).replace(/\\/g, "/")}'`).join("\n"), "utf8");
  const silent = path.join(renders, `${name}.silent.mp4`);
  const final = path.join(renders, `${name}.mp4`);

  ff(["-y", "-f", "concat", "-safe", "0", "-i", q(list), "-c", "copy", q(silent)], `concat ${name}`);
  const videoDuration = mediaDuration(silent);
  const audio = makeTts(name, narration, videoDuration);

  ff(
    [
      "-y",
      "-i",
      q(silent),
      "-i",
      q(audio.out),
      "-filter_complex",
      "[1:a]apad[a]",
      "-map",
      "0:v:0",
      "-map",
      "[a]",
      "-t",
      videoDuration.toFixed(2),
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      q(final),
    ],
    `mux ${name}`
  );
  fs.unlinkSync(silent);
  return { final, videoDuration, audioDuration: audio.duration, ttsRate: audio.rate };
}

function contactSheet(videoPath) {
  const out = videoPath.replace(/\.mp4$/i, "-contact-sheet.jpg");
  ff(
    [
      "-y",
      "-i",
      q(videoPath),
      "-vf",
      "fps=1/2,scale=270:-1,tile=4x4",
      "-frames:v",
      "1",
      "-q:v",
      "3",
      q(out),
    ],
    `contact sheet ${path.basename(out)}`
  );
  return out;
}

const cut = {
  name: "cj-sport-lab-v11-real-use-brand-cut",
  narration:
    "Your training window is already there. Between emails. Before the commute. While the day is moving. Pick one compact tool. Squeeze with control. Open the hand back up. Pack it small, and keep going. CJ Sport Lab makes training gear for real schedules, real breaks, and repeatable daily movement. Move small. Train smart.",
  scenes: [
    { type: "video", id: "office-arrive", input: "office-sitting-down-desk.mp4", start: 0.55, duration: 2.35, title: "THE SMALL WINDOW", subtitle: "between emails", top: 1210, titleSize: 62 },
    { type: "product", id: "pick-tool", input: "desk-kit-layout-hand-select.png", duration: 2.45, title: "PICK ONE TOOL", subtitle: "no setup ritual", top: 1240, titleSize: 70, zoomStart: 1.035, zoomEnd: 1.085, anchor: "center" },
    { type: "product", id: "grip-use", input: "office-desk-grip-trainer-use.png", duration: 2.75, title: "SQUEEZE WITH CONTROL", subtitle: "short, clean reps", top: 1220, titleSize: 58, zoomStart: 1.04, zoomEnd: 1.105, anchor: "high" },
    { type: "product", id: "macro-grip", input: "office-grip-closeup-vertical.png", duration: 2.2, title: "FEEL THE REP", subtitle: "not the rush", top: 1255, titleSize: 70, zoomStart: 1.05, zoomEnd: 1.14, anchor: "center" },
    { type: "product", id: "finger-open", input: "office-finger-extensor-vertical.png", duration: 2.65, title: "OPEN IT BACK UP", subtitle: "balance the movement", top: 1228, titleSize: 62, zoomStart: 1.035, zoomEnd: 1.095, anchor: "center" },
    { type: "product", id: "return-work", input: "office-break-grip-trainer-use.png", duration: 2.25, title: "BACK TO THE DAY", subtitle: "keep the rhythm", top: 1240, titleSize: 68, zoomStart: 1.04, zoomEnd: 1.09, anchor: "high" },
    { type: "video", id: "bag-close", input: "bag-zipping-backpack.mp4", start: 1.0, duration: 2.15, title: "PACK IT SMALL", subtitle: "carry the habit", top: 1245, titleSize: 72 },
    { type: "product", id: "kit-carry", input: "backpack-kit-carry-closeup.png", duration: 2.45, title: "READY WHEN YOU ARE", subtitle: "desk. commute. warmup.", top: 1225, titleSize: 57, zoomStart: 1.04, zoomEnd: 1.105, anchor: "center" },
    { type: "logo", id: "logo", duration: 4.85, title: "CJ SPORT LAB", subtitle: "Move Small. Train Smart.", top: 1315, titleSize: 76 },
  ],
};

const files = cut.scenes.map((scene, index) => {
  if (scene.type === "video") return videoSegment(scene, index);
  if (scene.type === "product") return productSegment(scene, index);
  if (scene.type === "logo") return logoSegment(scene, index);
  throw new Error(`Unknown scene type ${scene.type}`);
});

const result = concatSegments(cut.name, files, cut.narration);
const sheet = contactSheet(result.final);

console.log("\nBrand-use render");
console.table([
  {
    file: path.relative(root, result.final).replace(/\\/g, "/"),
    duration: result.videoDuration.toFixed(2),
    narrationDuration: result.audioDuration.toFixed(2),
    ttsRate: result.ttsRate,
    contactSheet: path.relative(root, sheet).replace(/\\/g, "/"),
  },
]);
