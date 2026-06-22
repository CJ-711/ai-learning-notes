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
const product = path.join(assets, "generated-product", "clean-product");
const brand = path.join(assets, "brand");
const fontBold = "C\\:/Windows/Fonts/bahnschrift.ttf";
const fontBody = "C\\:/Windows/Fonts/segoeui.ttf";

fs.mkdirSync(renders, { recursive: true });
fs.mkdirSync(segmentsDir, { recursive: true });
fs.mkdirSync(audioDir, { recursive: true });

function run(cmd, args, label) {
  console.log(`\n${label}`);
  const result = spawnSync(cmd, args, { stdio: "inherit", windowsHide: true });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
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

function textFilters(title, subtitle, duration, opts = {}) {
  const top = opts.top ?? 1260;
  const titleSize = opts.titleSize ?? 76;
  const subSize = opts.subSize ?? 35;
  const titleText = escText(title);
  const subText = escText(subtitle || "");
  const fadeOut = Math.max(0.2, duration - 0.35).toFixed(2);
  const filters = [
    "drawbox=x=0:y=0:w=iw:h=ih:color=black@0.18:t=fill",
    `drawbox=x=72:y=${top - 42}:w=182:h=8:color=0xC9FF00@0.95:t=fill`,
    `drawtext=fontfile='${fontBold}':text='${titleText}':fontsize=${titleSize}:fontcolor=0xF5F7EF:x=72:y=${top}:line_spacing=10:box=1:boxcolor=0x080A08@0.55:boxborderw=28`,
  ];
  if (subtitle) {
    filters.push(
      `drawtext=fontfile='${fontBody}':text='${subText}':fontsize=${subSize}:fontcolor=0xC9FF00:x=76:y=${top + titleSize + 42}:box=1:boxcolor=0x080A08@0.42:boxborderw=20`
    );
  }
  filters.push(
    "drawbox=x=72:y=1768:w=82:h=8:color=0xC9FF00@0.9:t=fill",
    "drawbox=x=168:y=1768:w=52:h=8:color=0xF5F7EF@0.75:t=fill",
    "fade=t=in:st=0:d=0.18",
    `fade=t=out:st=${fadeOut}:d=0.28`,
    "format=yuv420p"
  );
  return filters.join(",");
}

function videoSegment({ input, output, duration, start = 0, title, subtitle, top, titleSize, subSize }) {
  const vf = [
    "scale=1080:1920:force_original_aspect_ratio=increase",
    "crop=1080:1920",
    "setsar=1",
    "eq=contrast=1.08:saturation=1.08:brightness=-0.02",
    textFilters(title, subtitle, duration, { top, titleSize, subSize }),
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
    `video segment ${path.basename(output)}`
  );
}

function imageSegment({ input, output, duration, title, subtitle, top, titleSize, subSize }) {
  const vf = [
    "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:1,eq=brightness=-0.16:saturation=0.86[bg]",
    "[0:v]scale=960:1420:force_original_aspect_ratio=decrease[fg]",
    `[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,${textFilters(title, subtitle, duration, { top, titleSize, subSize })}`,
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
    `image segment ${path.basename(output)}`
  );
}

function logoSegment({ output, duration, title, subtitle, logo = "cj-sport-lab-logo.png" }) {
  imageSegment({
    input: path.join(brand, logo),
    output,
    duration,
    title,
    subtitle,
    top: 1300,
    titleSize: 72,
    subSize: 34,
  });
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
$s.Rate = 1
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
  fs.writeFileSync(
    list,
    files.map((file) => `file '${q(file).replace(/\\/g, "/")}'`).join("\n"),
    "utf8"
  );
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
    name: "cj-sport-lab-v1-desk-to-training",
    duration: 21.2,
    narration:
      "Training does not always start in the gym. CJ Sport Lab turns small breaks into simple daily reps. Grip, control, and consistency before the next session. Move small. Train smart.",
    scenes: [
      { type: "video", input: "office-hands-computer-vertical.mp4", duration: 3.4, title: "TRAINING STARTS ANYWHERE", subtitle: "desk break to daily reps", top: 1170, titleSize: 66 },
      { type: "image", input: "cj-sport-lab-grip-trainer-main.png", duration: 3.4, title: "SMALL TOOL", subtitle: "real reps", top: 1250 },
      { type: "video", input: "basketball-training-alone.mp4", duration: 3.4, title: "GRIP", subtitle: "control before skill", top: 1220 },
      { type: "video", input: "indoor-workout-routine.mp4", duration: 3.8, title: "CONSISTENCY", subtitle: "at home or before training", top: 1220 },
      { type: "image", input: "cj-sport-lab-kit-flatlay-main.png", duration: 4.0, title: "CJ SPORT LAB", subtitle: "4-in-1 grip trainer kit", top: 1260 },
      { type: "logo", duration: 3.2, title: "MOVE SMALL", subtitle: "Train Smart." },
    ],
  },
  {
    name: "cj-sport-lab-v2-kit-showcase",
    duration: 18.0,
    narration:
      "A compact training kit for everyday athletes. Grip trainer, finger extensor, hand ring, and knuckle trainer. CJ Sport Lab tests small tools for real life movement.",
    scenes: [
      { type: "image", input: "cj-sport-lab-kit-flatlay-main.png", duration: 3.3, title: "4-IN-1 GRIP KIT", subtitle: "compact tools for daily reps", top: 1230, titleSize: 70 },
      { type: "image", input: "cj-sport-lab-grip-trainer-horizontal.png", duration: 2.8, title: "ADJUSTABLE GRIP", subtitle: "warm up. reset. repeat.", top: 1250, titleSize: 66 },
      { type: "image", input: "cj-sport-lab-finger-extensor-set.png", duration: 2.8, title: "EXTENSION WORK", subtitle: "balance the squeeze", top: 1250, titleSize: 66 },
      { type: "image", input: "cj-sport-lab-wrist-ring-set.png", duration: 2.8, title: "HAND CONTROL", subtitle: "simple repeatable effort", top: 1250, titleSize: 66 },
      { type: "image", input: "cj-sport-lab-knuckle-trainer-main.png", duration: 2.8, title: "DESK FRIENDLY", subtitle: "small breaks count", top: 1250, titleSize: 66 },
      { type: "logo", duration: 3.5, title: "CJ SPORT LAB", subtitle: "Move Small. Train Smart." },
    ],
  },
  {
    name: "cj-sport-lab-v3-sports-matrix",
    duration: 22.2,
    narration:
      "Every sport has a story. CJ Sport explains the game, the athlete, and the training behind the moment. CJ Sport Lab tests compact tools for everyday athletes. Move small. Train smart.",
    scenes: [
      { type: "video", input: "basketball-top-view.mp4", duration: 3.5, title: "EVERY SPORT HAS A STORY", subtitle: "CJ Sport", top: 1160, titleSize: 62 },
      { type: "video", input: "basketball-one-on-one.mp4", duration: 3.4, title: "BEFORE SKILL", subtitle: "comes control", top: 1220, titleSize: 68 },
      { type: "video", input: "treadmill-closeup.mp4", duration: 3.4, title: "BEFORE SPEED", subtitle: "comes rhythm", top: 1220, titleSize: 68 },
      { type: "video", input: "gym-strength-machine.mp4", duration: 3.4, title: "BEFORE POWER", subtitle: "comes consistency", top: 1220, titleSize: 68 },
      { type: "image", input: "cj-sport-lab-kit-horizontal.png", duration: 4.4, title: "STORIES + TOOLS", subtitle: "CJ Sport x CJ Sport Lab", top: 1240, titleSize: 68 },
      { type: "logo", duration: 4.1, title: "CJ SPORT", subtitle: "Move Small. Train Smart.", logo: "cj-sport-logo.png" },
    ],
  },
];

for (const video of videos) {
  const files = video.scenes.map((scene, index) => {
    const out = path.join(segmentsDir, `${video.name}-${String(index + 1).padStart(2, "0")}.mp4`);
    if (scene.type === "video") {
      videoSegment({
        ...scene,
        input: path.join(stock, scene.input),
        output: out,
      });
    } else if (scene.type === "image") {
      imageSegment({
        ...scene,
        input: path.join(product, scene.input),
        output: out,
      });
    } else {
      logoSegment({ ...scene, output: out });
    }
    return out;
  });
  const final = concatSegments(video.name, files, video.duration, video.narration);
  console.log(`rendered ${final}`);
}
