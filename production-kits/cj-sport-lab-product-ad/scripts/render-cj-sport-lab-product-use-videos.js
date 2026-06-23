const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ffmpeg = require("@ffmpeg-installer/ffmpeg").path;

const root = path.resolve(__dirname, "..");
const assets = path.join(root, "assets");
const renders = path.join(root, "renders");
const segmentsDir = path.join(renders, "_segments", "product-use");
const audioDir = path.join(renders, "audio");
const stock = path.join(assets, "stock-video");
const micro = path.join(stock, "micro-use");
const productUse = path.join(assets, "generated-product", "product-use", "2026-06-23");
const brand = path.join(assets, "brand");

const fontDisplay = "C\\:/Windows/Fonts/bahnschrift.ttf";
const fontBody = "C\\:/Windows/Fonts/segoeui.ttf";

fs.mkdirSync(renders, { recursive: true });
fs.mkdirSync(segmentsDir, { recursive: true });
fs.mkdirSync(audioDir, { recursive: true });

function run(cmd, args, label) {
  console.log(`\n${label}`);
  const result = spawnSync(cmd, args, { stdio: "inherit", windowsHide: true });
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}`);
}

function ff(args, label) {
  run(ffmpeg, ["-hide_banner", ...args], label);
}

function ps(script, label) {
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  run("powershell.exe", ["-NoProfile", "-EncodedCommand", encoded], label);
}

function q(filePath) {
  return path.resolve(filePath);
}

function escText(text) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%");
}

function captionLayer(title, subtitle, duration, opts = {}) {
  const top = opts.top ?? 1210;
  const titleSize = opts.titleSize ?? 72;
  const subSize = opts.subSize ?? 34;
  const titleText = escText(title);
  const subText = escText(subtitle || "");
  const outAt = Math.max(0.2, duration - 0.25).toFixed(2);
  const filters = [
    "drawbox=x=0:y=0:w=iw:h=ih:color=0x050605@0.14:t=fill",
    `drawbox=x=64:y=${top - 36}:w=150:h=7:color=0xC9FF00@0.95:t=fill`,
    `drawtext=fontfile='${fontDisplay}':text='${titleText}':fontsize=${titleSize}:fontcolor=0xF5F7EF:x=64:y=${top}:line_spacing=8:box=1:boxcolor=0x050605@0.52:boxborderw=22`,
  ];

  if (subtitle) {
    filters.push(
      `drawtext=fontfile='${fontBody}':text='${subText}':fontsize=${subSize}:fontcolor=0xC9FF00:x=68:y=${top + titleSize + 38}:box=1:boxcolor=0x050605@0.40:boxborderw=16`
    );
  }

  filters.push(
    "drawbox=x=64:y=1768:w=76:h=7:color=0xC9FF00@0.95:t=fill",
    "drawbox=x=150:y=1768:w=46:h=7:color=0xF5F7EF@0.70:t=fill",
    "fade=t=in:st=0:d=0.12",
    `fade=t=out:st=${outAt}:d=0.22`,
    "format=yuv420p"
  );
  return filters.join(",");
}

function videoSegment({ input, output, duration, start = 0, title, subtitle, top, titleSize, subSize, zoom = 1.04 }) {
  const vf = [
    "scale=1080:1920:force_original_aspect_ratio=increase",
    "crop=1080:1920",
    "setsar=1",
    "eq=contrast=1.12:saturation=1.04:brightness=-0.035",
    zoom !== 1 ? `scale=trunc(iw*${zoom}/2)*2:trunc(ih*${zoom}/2)*2,crop=1080:1920` : "null",
    captionLayer(title, subtitle, duration, { top, titleSize, subSize }),
  ].join(",");

  ff(
    [
      "-y",
      "-ss",
      String(start),
      "-t",
      String(duration),
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
    `video segment ${path.basename(output)}`
  );
}

function imageSegment({ input, output, duration, title, subtitle, top, titleSize, subSize, direction = "in" }) {
  const frames = Math.round(duration * 30);
  const zoomExpr =
    direction === "out"
      ? `1.075-0.045*on/${frames}`
      : `1.02+0.055*on/${frames}`;
  const vf = [
    `scale=1280:2276:force_original_aspect_ratio=increase,crop=1280:2276`,
    `zoompan=z='${zoomExpr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30`,
    "setsar=1",
    "eq=contrast=1.09:saturation=1.06:brightness=-0.025",
    captionLayer(title, subtitle, duration, { top, titleSize, subSize }),
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
    `image segment ${path.basename(output)}`
  );
}

function logoSegment({ output, duration, title, subtitle }) {
  const input = path.join(brand, "cj-sport-lab-logo.png");
  const vf = [
    "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=28:1,eq=brightness=-0.22:saturation=0.90[bg]",
    "[0:v]scale=860:860:force_original_aspect_ratio=decrease[fg]",
    `[bg][fg]overlay=(W-w)/2:(H-h)/2-96,setsar=1,${captionLayer(title, subtitle, duration, {
      top: 1310,
      titleSize: 76,
      subSize: 36,
    })}`,
  ].join(";");

  ff(
    [
      "-y",
      "-loop",
      "1",
      "-t",
      String(duration),
      "-i",
      q(input),
      "-filter_complex",
      vf,
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
    `logo segment ${path.basename(output)}`
  );
}

function resolveInput(scene) {
  if (scene.type === "micro") return path.join(micro, scene.input);
  if (scene.type === "stock") return path.join(stock, scene.input);
  if (scene.type === "use") return path.join(productUse, scene.input);
  throw new Error(`Unknown scene type ${scene.type}`);
}

function makeTts(name, text) {
  const out = path.join(audioDir, `${name}.wav`);
  const escapedText = text.replace(/`/g, "``").replace(/"/g, '`"');
  const escapedOut = out.replace(/'/g, "''");
  ps(
    `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice('Microsoft Zira Desktop')
$s.Rate = 3
$s.Volume = 94
$s.SetOutputToWaveFile('${escapedOut}')
$s.Speak("${escapedText}")
$s.Dispose()
`,
    `tts ${name}`
  );
  return out;
}

function concatSegments(name, files, duration, narration) {
  const list = path.join(segmentsDir, `${name}.txt`);
  fs.writeFileSync(list, files.map((file) => `file '${q(file).replace(/\\/g, "/")}'`).join("\n"), "utf8");

  const silent = path.join(renders, `${name}.silent.mp4`);
  const final = path.join(renders, `${name}.mp4`);
  ff(["-y", "-f", "concat", "-safe", "0", "-i", q(list), "-c", "copy", q(silent)], `concat ${name}`);
  const audio = makeTts(name, narration);
  ff(
    [
      "-y",
      "-i",
      q(silent),
      "-i",
      q(audio),
      "-filter_complex",
      "[1:a]apad[a]",
      "-map",
      "0:v:0",
      "-map",
      "[a]",
      "-t",
      String(duration),
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
  return final;
}

const videos = [
  {
    name: "cj-sport-lab-v7-office-product-use",
    duration: 24.5,
    narration:
      "Your day is packed. That doesn't mean training has to disappear. One call ends, one small reset starts. Grip a few reps at the desk. Open the fingers, shake out the hands, keep the rhythm moving. CJ Sport Lab makes compact tools for the gaps in real life. Small reps. Real consistency. Move small. Train smart.",
    scenes: [
      { type: "micro", input: "office-typing-keyboard-closeup.mp4", duration: 2.4, start: 1.0, title: "YOUR DAY IS PACKED", subtitle: "training can still fit", top: 1136, titleSize: 61 },
      { type: "use", input: "office-desk-grip-trainer-use.png", duration: 3.2, title: "ONE SMALL RESET", subtitle: "grip a few reps", top: 1210, titleSize: 68 },
      { type: "micro", input: "office-mouse-closeup.mp4", duration: 2.3, start: 0.8, title: "HANDS FEEL IT FIRST", subtitle: "before the next task", top: 1218, titleSize: 62 },
      { type: "use", input: "office-finger-extensor-vertical.png", duration: 3.2, title: "OPEN THE HAND", subtitle: "balance the squeeze", top: 1210, titleSize: 70, direction: "out" },
      { type: "use", input: "office-break-grip-trainer-use.png", duration: 3.0, title: "KEEP THE RHYTHM", subtitle: "small reps add up", top: 1230, titleSize: 68 },
      { type: "use", input: "desk-kit-layout-hand-select.png", duration: 3.0, title: "GRAB THE NEXT TOOL", subtitle: "simple, compact, repeatable", top: 1230, titleSize: 60, direction: "out" },
      { type: "use", input: "backpack-product-carry-closeup.png", duration: 2.7, title: "PACK THE KIT", subtitle: "desk to commute", top: 1225, titleSize: 72 },
      { type: "logo", duration: 4.7, title: "CJ SPORT LAB", subtitle: "Move Small. Train Smart." },
    ],
  },
  {
    name: "cj-sport-lab-v8-commute-pocket-training",
    duration: 23.6,
    narration:
      "You don't need a perfect workout window to start. Waiting for the train, walking out of the office, packing your bag. Those are the moments CJ Sport Lab is built for. Small tools, easy carry, quick hand work wherever the day takes you. Pack it. Use it. Repeat it. Move small. Train smart.",
    scenes: [
      { type: "micro", input: "commute-walking-phone.mp4", duration: 2.5, start: 1.0, title: "NO PERFECT WINDOW", subtitle: "just a useful one", top: 1128, titleSize: 66 },
      { type: "use", input: "commute-waist-pack-carry.png", duration: 3.0, title: "TRAIN IN THE GAPS", subtitle: "walking out, waiting, resetting", top: 1210, titleSize: 62 },
      { type: "use", input: "backpack-kit-carry-closeup.png", duration: 2.9, title: "PACK IT", subtitle: "small enough to come with you", top: 1230, titleSize: 78, direction: "out" },
      { type: "micro", input: "commute-subway-handle.mp4", duration: 2.4, start: 0.0, title: "GRIP SHOWS UP", subtitle: "outside the gym", top: 1215, titleSize: 70 },
      { type: "use", input: "backpack-product-carry-closeup.png", duration: 2.8, title: "READY WHEN YOU ARE", subtitle: "pull it out, get reps in", top: 1230, titleSize: 60 },
      { type: "use", input: "dark-kit-bag-hero.png", duration: 2.8, title: "SMALL TOOLS", subtitle: "real-life movement", top: 1240, titleSize: 72, direction: "out" },
      { type: "use", input: "office-grip-closeup-vertical.png", duration: 2.8, title: "USE IT. REPEAT IT.", subtitle: "consistency beats setup", top: 1230, titleSize: 64 },
      { type: "logo", duration: 4.4, title: "MOVE SMALL", subtitle: "Train Smart." },
    ],
  },
];

for (const video of videos) {
  const files = video.scenes.map((scene, index) => {
    const out = path.join(segmentsDir, `${video.name}-${String(index + 1).padStart(2, "0")}.mp4`);
    if (scene.type === "micro" || scene.type === "stock") {
      videoSegment({ ...scene, input: resolveInput(scene), output: out });
    } else if (scene.type === "use") {
      imageSegment({ ...scene, input: resolveInput(scene), output: out });
    } else {
      logoSegment({ ...scene, output: out });
    }
    return out;
  });
  const final = concatSegments(video.name, files, video.duration, video.narration);
  console.log(`rendered ${final}`);
}
