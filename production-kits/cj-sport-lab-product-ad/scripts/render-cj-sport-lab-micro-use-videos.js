const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ffmpeg = require("@ffmpeg-installer/ffmpeg").path;

const root = path.resolve(__dirname, "..");
const assets = path.join(root, "assets");
const renders = path.join(root, "renders");
const segmentsDir = path.join(renders, "_segments");
const audioDir = path.join(renders, "audio");
const stock = path.join(assets, "stock-video");
const micro = path.join(stock, "micro-use");
const product = path.join(assets, "generated-product", "clean-product");
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

function q(p) {
  return path.resolve(p);
}

function escText(text) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%");
}

function captionLayer(title, subtitle, duration, opts = {}) {
  const top = opts.top ?? 1186;
  const titleSize = opts.titleSize ?? 72;
  const subSize = opts.subSize ?? 34;
  const titleText = escText(title);
  const subText = escText(subtitle || "");
  const outAt = Math.max(0.2, duration - 0.28).toFixed(2);
  const filters = [
    "drawbox=x=0:y=0:w=iw:h=ih:color=0x050605@0.16:t=fill",
    `drawbox=x=66:y=${top - 36}:w=166:h=7:color=0xC9FF00@0.95:t=fill`,
    `drawtext=fontfile='${fontDisplay}':text='${titleText}':fontsize=${titleSize}:fontcolor=0xF5F7EF:x=66:y=${top}:line_spacing=8:box=1:boxcolor=0x050605@0.55:boxborderw=24`,
  ];
  if (subtitle) {
    filters.push(
      `drawtext=fontfile='${fontBody}':text='${subText}':fontsize=${subSize}:fontcolor=0xC9FF00:x=70:y=${top + titleSize + 40}:box=1:boxcolor=0x050605@0.42:boxborderw=18`
    );
  }
  filters.push(
    "drawbox=x=66:y=1764:w=82:h=7:color=0xC9FF00@0.95:t=fill",
    "drawbox=x=160:y=1764:w=48:h=7:color=0xF5F7EF@0.7:t=fill",
    "fade=t=in:st=0:d=0.15",
    `fade=t=out:st=${outAt}:d=0.25`,
    "format=yuv420p"
  );
  return filters.join(",");
}

function videoSegment({ input, output, duration, start = 0, title, subtitle, top, titleSize, subSize, zoom = 1 }) {
  const vf = [
    "scale=1080:1920:force_original_aspect_ratio=increase",
    "crop=1080:1920",
    "setsar=1",
    "eq=contrast=1.1:saturation=1.06:brightness=-0.025",
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
      "21",
      "-movflags",
      "+faststart",
      q(output),
    ],
    `micro video segment ${path.basename(output)}`
  );
}

function productSegment({ input, output, duration, title, subtitle, top, titleSize, subSize, productScale = 900 }) {
  const vf = [
    "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=26:1,eq=brightness=-0.18:saturation=0.9[bg]",
    `[0:v]scale=${productScale}:1500:force_original_aspect_ratio=decrease[fg]`,
    `[bg][fg]overlay=(W-w)/2:(H-h)/2-72,setsar=1,${captionLayer(title, subtitle, duration, {
      top,
      titleSize,
      subSize,
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
      "20",
      "-movflags",
      "+faststart",
      q(output),
    ],
    `micro product segment ${path.basename(output)}`
  );
}

function logoSegment({ output, duration, title, subtitle, logo = "cj-sport-lab-logo.png" }) {
  productSegment({
    input: path.join(brand, logo),
    output,
    duration,
    title,
    subtitle,
    top: 1305,
    titleSize: 72,
    subSize: 34,
    productScale: 930,
  });
}

function resolveInput(scene) {
  if (scene.type === "micro") return path.join(micro, scene.input);
  if (scene.type === "stock") return path.join(stock, scene.input);
  if (scene.type === "product") return path.join(product, scene.input);
  return null;
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
$s.Rate = 2
$s.Volume = 92
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
    name: "cj-sport-lab-v4-office-micro-reps",
    duration: 21.0,
    narration:
      "Your training window might be three minutes between tasks. CJ Sport Lab keeps grip work small enough for the desk, simple enough to repeat, and compact enough to carry into the rest of your day. Move small. Train smart.",
    scenes: [
      { type: "micro", input: "office-typing-keyboard-closeup.mp4", duration: 2.8, start: 1.0, title: "TRAIN BETWEEN TASKS", subtitle: "desk break, real routine", top: 1138, titleSize: 66 },
      { type: "micro", input: "office-mouse-closeup.mp4", duration: 2.4, start: 0.8, title: "HANDS FEEL IT FIRST", subtitle: "before the next rep", top: 1220, titleSize: 66 },
      { type: "product", input: "cj-sport-lab-grip-trainer-main.png", duration: 3.0, title: "GRIP TRAINER", subtitle: "compact daily reps", top: 1260, titleSize: 70 },
      { type: "micro", input: "office-texting-home-office.mp4", duration: 2.8, start: 2.0, title: "ONE SMALL WINDOW", subtitle: "use the pause", top: 1188, titleSize: 68 },
      { type: "product", input: "cj-sport-lab-kit-flatlay-main.png", duration: 3.6, title: "4 TOOLS", subtitle: "one carryable kit", top: 1270, titleSize: 74 },
      { type: "micro", input: "bag-zipping-backpack.mp4", duration: 2.8, start: 0.8, title: "PACK IT", subtitle: "desk to commute", top: 1210, titleSize: 78 },
      { type: "logo", duration: 3.6, title: "MOVE SMALL", subtitle: "Train Smart." },
    ],
  },
  {
    name: "cj-sport-lab-v5-commute-carry",
    duration: 20.4,
    narration:
      "Commute time, coffee line, office break. Small tools make training easier to start. CJ Sport Lab is built around compact grip work for everyday athletes. Pack it, use it, repeat it. Move small. Train smart.",
    scenes: [
      { type: "micro", input: "commute-phone-from-pocket.mp4", duration: 2.7, start: 0.8, title: "YOUR ROUTINE HAS GAPS", subtitle: "turn them into reps", top: 1128, titleSize: 62 },
      { type: "micro", input: "commute-subway-handle.mp4", duration: 2.5, start: 0.0, title: "GRIP SHOWS UP", subtitle: "outside the gym", top: 1210, titleSize: 72 },
      { type: "product", input: "cj-sport-lab-wrist-ring-set.png", duration: 2.8, title: "HAND CONTROL", subtitle: "small enough to carry", top: 1260, titleSize: 70 },
      { type: "micro", input: "commute-coffee-phone.mp4", duration: 2.7, start: 1.2, title: "WAITING TIME", subtitle: "training time", top: 1188, titleSize: 72 },
      { type: "micro", input: "bag-putting-stuff-backpack.mp4", duration: 2.8, start: 1.2, title: "IN THE BAG", subtitle: "ready when you are", top: 1218, titleSize: 74 },
      { type: "product", input: "cj-sport-lab-kit-horizontal.png", duration: 3.4, title: "CJ SPORT LAB", subtitle: "compact grip system", top: 1260, titleSize: 68 },
      { type: "logo", duration: 3.5, title: "PACK IT", subtitle: "Use it. Repeat it." },
    ],
  },
  {
    name: "cj-sport-lab-v6-pocket-training-system",
    duration: 26.2,
    narration:
      "Big sessions are not the only sessions. CJ Sport Lab turns the small moments around work, transit, and warmups into simple grip reps. Less setup. More consistency. Move small. Train smart.",
    scenes: [
      { type: "micro", input: "office-sitting-down-desk.mp4", duration: 2.8, start: 1.0, title: "SMALL SESSIONS COUNT", subtitle: "start smaller", top: 1145, titleSize: 66 },
      { type: "micro", input: "office-typing-keyboard-closeup.mp4", duration: 2.5, start: 2.0, title: "DESK", subtitle: "micro reset", top: 1210, titleSize: 78 },
      { type: "product", input: "cj-sport-lab-grip-trainer-horizontal.png", duration: 2.9, title: "SQUEEZE", subtitle: "simple, repeatable effort", top: 1260, titleSize: 76 },
      { type: "micro", input: "bag-putting-stuff-backpack.mp4", duration: 2.7, start: 0.8, title: "BAG", subtitle: "carry the routine", top: 1215, titleSize: 78 },
      { type: "micro", input: "commute-walking-phone.mp4", duration: 2.6, start: 1.0, title: "COMMUTE", subtitle: "keep it practical", top: 1190, titleSize: 76 },
      { type: "micro", input: "commute-woman-subway-wait.mp4", duration: 2.8, start: 1.0, title: "WAIT", subtitle: "small windows count", top: 1200, titleSize: 76 },
      { type: "product", input: "cj-sport-lab-clean-product-alt.png", duration: 3.4, title: "POCKET TRAINING SYSTEM", subtitle: "CJ Sport Lab", top: 1260, titleSize: 62 },
      { type: "stock", input: "indoor-workout-routine.mp4", duration: 2.7, start: 0.5, title: "THEN TRAIN", subtitle: "with more control", top: 1200, titleSize: 76 },
      { type: "logo", duration: 3.8, title: "MOVE SMALL", subtitle: "Train Smart." },
    ],
  },
];

for (const video of videos) {
  const files = video.scenes.map((scene, index) => {
    const out = path.join(segmentsDir, `${video.name}-${String(index + 1).padStart(2, "0")}.mp4`);
    if (scene.type === "micro" || scene.type === "stock") {
      videoSegment({ ...scene, input: resolveInput(scene), output: out });
    } else if (scene.type === "product") {
      productSegment({ ...scene, input: resolveInput(scene), output: out });
    } else {
      logoSegment({ ...scene, output: out });
    }
    return out;
  });
  const final = concatSegments(video.name, files, video.duration, video.narration);
  console.log(`rendered ${final}`);
}
