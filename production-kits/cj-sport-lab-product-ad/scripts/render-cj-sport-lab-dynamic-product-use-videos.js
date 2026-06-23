const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ffmpeg = require("@ffmpeg-installer/ffmpeg").path;

const root = path.resolve(__dirname, "..");
const assets = path.join(root, "assets");
const renders = path.join(root, "renders");
const segmentsDir = path.join(renders, "_segments", "dynamic-product-use");
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

function q(filePath) {
  return path.resolve(filePath);
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
  console.log(`\nprobe ${path.basename(filePath)}`);
  const result = spawnSync(ffmpeg, ["-hide_banner", "-i", q(filePath)], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    encoding: "utf8",
  });
  const text = `${result.stdout || ""}\n${result.stderr || ""}`;
  const match = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) throw new Error(`Could not read duration for ${filePath}`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  return hours * 3600 + minutes * 60 + seconds;
}

function captionLayer(title, subtitle, duration, opts = {}) {
  const top = opts.top ?? 1160;
  const titleSize = opts.titleSize ?? 72;
  const subSize = opts.subSize ?? 33;
  const titleText = escText(title);
  const subText = escText(subtitle || "");
  const fadeOut = Math.max(0.2, duration - 0.24).toFixed(2);
  const filters = [
    "drawbox=x=0:y=0:w=iw:h=ih:color=0x050605@0.10:t=fill",
    "drawbox=x=0:y=0:w=iw:h=156:color=0x050605@0.34:t=fill",
    "drawtext=fontfile='" + fontBody + "':text='CJ SPORT LAB':fontsize=26:fontcolor=0xC9FF00:x=64:y=72:box=1:boxcolor=0x050605@0.34:boxborderw=12",
    `drawbox=x=64:y=${top - 42}:w=124:h=8:color=0xC9FF00@0.98:t=fill`,
    `drawtext=fontfile='${fontDisplay}':text='${titleText}':fontsize=${titleSize}:fontcolor=0xF5F7EF:x=64:y=${top}:line_spacing=8:box=1:boxcolor=0x050605@0.58:boxborderw=22`,
  ];

  if (subtitle) {
    filters.push(
      `drawtext=fontfile='${fontBody}':text='${subText}':fontsize=${subSize}:fontcolor=0xC9FF00:x=68:y=${top + titleSize + 36}:box=1:boxcolor=0x050605@0.44:boxborderw=15`
    );
  }

  filters.push(
    "drawbox=x=64:y=1770:w=78:h=7:color=0xC9FF00@0.95:t=fill",
    "drawbox=x=152:y=1770:w=42:h=7:color=0xF5F7EF@0.72:t=fill",
    "fade=t=in:st=0:d=0.10",
    `fade=t=out:st=${fadeOut}:d=0.20`,
    "format=yuv420p"
  );
  return filters.join(",");
}

function beatAccents(duration) {
  const secondBeat = Math.max(0.8, Math.min(duration - 0.5, duration * 0.52)).toFixed(2);
  return [
    "drawbox=x=0:y=0:w=iw:h=ih:color=0xC9FF00@0.10:t=fill:enable='between(t,0.06,0.13)'",
    `drawbox=x=0:y=0:w=iw:h=ih:color=0xF5F7EF@0.09:t=fill:enable='between(t,${secondBeat},${(Number(secondBeat) + 0.07).toFixed(2)})'`,
    "drawbox=x=0:y=0:w=iw:h=12:color=0xC9FF00@0.80:t=fill:enable='between(t,0.06,0.16)'",
    "drawbox=x=0:y=1908:w=iw:h=12:color=0xC9FF00@0.80:t=fill:enable='between(t,0.06,0.16)'",
  ];
}

function scenePath(scene) {
  if (scene.type === "micro") return path.join(micro, scene.input);
  if (scene.type === "stock") return path.join(stock, scene.input);
  if (scene.type === "use") return path.join(productUse, scene.input);
  if (scene.type === "logo") return path.join(brand, "cj-sport-lab-logo.png");
  throw new Error(`Unknown scene type ${scene.type}`);
}

function videoSegment({ input, output, duration, start = 0, title, subtitle, top, titleSize, subSize, zoom = 1.05, pan = "center" }) {
  ensureFile(input);
  const panExpr =
    pan === "right"
      ? "crop=1080:1920:80+24*sin(t*3):0"
      : pan === "left"
        ? "crop=1080:1920:0+24*sin(t*3):0"
        : "crop=1080:1920";
  const vf = [
    "scale=1240:2204:force_original_aspect_ratio=increase",
    panExpr,
    `scale=trunc(iw*${zoom}/2)*2:trunc(ih*${zoom}/2)*2`,
    "crop=1080:1920",
    "setsar=1",
    "eq=contrast=1.12:saturation=1.05:brightness=-0.035",
    ...beatAccents(duration),
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

function dynamicImageSegment({ input, output, duration, title, subtitle, top, titleSize, subSize, motion = "push", tint = true }) {
  ensureFile(input);
  const frames = Math.round(duration * 30);
  const safeFrames = Math.max(frames, 1);
  const motionMap = {
    push: {
      z: `min(1.18,1.045+0.065*on/${safeFrames}+0.013*sin(on*0.55))`,
      x: "iw/2-(iw/zoom/2)+8*sin(on*0.30)",
      y: "ih/2-(ih/zoom/2)+5*sin(on*0.42)",
    },
    pull: {
      z: `max(1.025,1.14-0.060*on/${safeFrames}+0.010*sin(on*0.48))`,
      x: "iw/2-(iw/zoom/2)-9*sin(on*0.28)",
      y: "ih/2-(ih/zoom/2)+6*sin(on*0.34)",
    },
    squeeze: {
      z: `1.075+0.020*sin(on*0.82)+0.030*on/${safeFrames}`,
      x: "iw/2-(iw/zoom/2)+13*sin(on*0.62)",
      y: "ih/2-(ih/zoom/2)+4*sin(on*0.46)",
    },
    carry: {
      z: `1.060+0.045*on/${safeFrames}+0.010*sin(on*0.36)`,
      x: "iw/2-(iw/zoom/2)-18*sin(on*0.18)",
      y: "ih/2-(ih/zoom/2)+12*sin(on*0.21)",
    },
  };
  const m = motionMap[motion] || motionMap.push;
  const color = tint ? "eq=contrast=1.11:saturation=1.08:brightness=-0.028" : "eq=contrast=1.06:saturation=1.03:brightness=-0.02";
  const vf = [
    "scale=1380:2454:force_original_aspect_ratio=increase,crop=1380:2454",
    `zoompan=z='${m.z}':x='${m.x}':y='${m.y}':d=${frames}:s=1080x1920:fps=30`,
    "setsar=1",
    color,
    ...beatAccents(duration),
    "drawbox=x=44:y=44:w=992:h=1832:color=0xC9FF00@0.18:t=2",
    "drawbox=x=56:y=56:w=968:h=1808:color=0xF5F7EF@0.08:t=1",
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
    `dynamic image segment ${path.basename(output)}`
  );
}

function logoSegment({ input, output, duration, title, subtitle }) {
  ensureFile(input);
  const frames = Math.round(duration * 30);
  const vf = [
    "[0:v]scale=1300:2310:force_original_aspect_ratio=increase,crop=1300:2310,boxblur=30:1,eq=brightness=-0.26:saturation=0.88[bg]",
    "[0:v]scale=850:850:force_original_aspect_ratio=decrease[fg]",
    `[bg][fg]overlay=(W-w)/2:(H-h)/2-120,zoompan=z='1.020+0.035*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30,setsar=1`,
    ...beatAccents(duration),
    captionLayer(title, subtitle, duration, {
      top: 1310,
      titleSize: 76,
      subSize: 36,
    }),
  ].join(",");

  ff(
    [
      "-y",
      "-loop",
      "1",
      "-i",
      q(input),
      "-filter_complex",
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
    `logo segment ${path.basename(output)}`
  );
}

function makeTts(name, text, targetDuration) {
  const rates = [0, 1, -1, 2];
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
    const duration = mediaDuration(out);
    candidates.push({ out, rate, duration });
  }

  candidates.sort((a, b) => {
    const aPenalty =
      Math.abs(a.duration - targetDuration) +
      (a.duration < targetDuration - 0.35 ? 3 : 0) +
      (a.duration > targetDuration + 0.45 ? 1 : 0);
    const bPenalty =
      Math.abs(b.duration - targetDuration) +
      (b.duration < targetDuration - 0.35 ? 3 : 0) +
      (b.duration > targetDuration + 0.45 ? 1 : 0);
    return aPenalty - bPenalty;
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
  const finalDuration = audio.duration < videoDuration - 0.45 ? Math.min(videoDuration, audio.duration + 0.25) : videoDuration;

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
      finalDuration.toFixed(2),
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
  return { final, videoDuration: finalDuration, ttsRate: audio.rate, narrationDuration: audio.duration };
}

function renderContactSheet(videoPath) {
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

const videos = [
  {
    name: "cj-sport-lab-v9-desk-reset-dynamic",
    narration:
      "No gym window today? Good. Use the break you actually have. Between calls, hit a clean squeeze set. Open the hand back up. Pick the next tool, pack it small, and get back to the day. CJ Sport Lab is built for real schedules, desk breaks, commute gaps, and simple reps that keep you moving. Move small. Train smart.",
    scenes: [
      { type: "micro", input: "office-sitting-down-desk.mp4", duration: 2.35, start: 0.4, title: "NO GYM WINDOW?", subtitle: "use the break", top: 1118, titleSize: 68, zoom: 1.06, pan: "right" },
      { type: "use", input: "office-desk-grip-trainer-use.png", duration: 2.85, title: "DESK BREAK REPS", subtitle: "squeeze the reset", top: 1210, titleSize: 67, motion: "squeeze" },
      { type: "use", input: "office-grip-closeup-vertical.png", duration: 2.55, title: "SHORT SETS", subtitle: "clean reps, no setup", top: 1230, titleSize: 76, motion: "push" },
      { type: "use", input: "office-finger-extensor-vertical.png", duration: 2.85, title: "OPEN THE HAND", subtitle: "balance the grip", top: 1215, titleSize: 70, motion: "pull" },
      { type: "use", input: "office-break-grip-trainer-use.png", duration: 2.65, title: "BACK TO WORK", subtitle: "keep the rhythm", top: 1225, titleSize: 71, motion: "squeeze" },
      { type: "use", input: "desk-kit-layout-hand-select.png", duration: 2.75, title: "PICK YOUR TOOL", subtitle: "grip, extend, carry", top: 1228, titleSize: 66, motion: "pull" },
      { type: "micro", input: "bag-zipping-backpack.mp4", duration: 2.40, start: 1.0, title: "PACK IT SMALL", subtitle: "leave with it", top: 1230, titleSize: 72, zoom: 1.04, pan: "center" },
      { type: "logo", duration: 4.85, title: "CJ SPORT LAB", subtitle: "Move Small. Train Smart." },
    ],
  },
  {
    name: "cj-sport-lab-v10-pocket-reps-dynamic",
    narration:
      "Most people wait for the perfect workout. This is for the moments in between. Walking out, waiting for a ride, sitting back at the desk. Pull out a compact tool, get a few clean reps, put it back, and keep moving. CJ Sport Lab builds small training gear for daily momentum. Pack it. Use it. Repeat it. Move small. Train smart.",
    scenes: [
      { type: "micro", input: "commute-phone-from-pocket.mp4", duration: 2.55, start: 0.6, title: "FROM POCKET TO REPS", subtitle: "no big setup", top: 1128, titleSize: 58, zoom: 1.06, pan: "left" },
      { type: "use", input: "commute-waist-pack-carry.png", duration: 3.20, title: "POCKET-SIZE SETUP", subtitle: "carry the kit", top: 1210, titleSize: 61, motion: "carry" },
      { type: "use", input: "backpack-product-carry-closeup.png", duration: 2.35, title: "WHEN YOU WAIT", subtitle: "pull out the tool", top: 1212, titleSize: 73, motion: "carry" },
      { type: "use", input: "backpack-kit-carry-closeup.png", duration: 3.10, title: "GRAB. SQUEEZE. GO.", subtitle: "small tools, fast start", top: 1230, titleSize: 58, motion: "push" },
      { type: "use", input: "office-desk-grip-trainer-use.png", duration: 2.30, title: "GRIP SHOWS UP", subtitle: "outside the gym", top: 1218, titleSize: 67, motion: "squeeze" },
      { type: "use", input: "office-finger-extensor-vertical.png", duration: 3.10, title: "OPEN IT BACK UP", subtitle: "balance the grip", top: 1225, titleSize: 64, motion: "pull" },
      { type: "use", input: "dark-kit-bag-hero.png", duration: 3.05, title: "KEEP IT WITH YOU", subtitle: "no big setup", top: 1236, titleSize: 66, motion: "carry" },
      { type: "logo", duration: 4.95, title: "CJ SPORT LAB", subtitle: "Built for the gaps." },
    ],
  },
];

const summary = [];
for (const video of videos) {
  const files = video.scenes.map((scene, index) => {
    const input = scenePath(scene);
    const output = path.join(segmentsDir, `${video.name}-${String(index + 1).padStart(2, "0")}.mp4`);
    if (scene.type === "micro" || scene.type === "stock") {
      videoSegment({ ...scene, input, output });
    } else if (scene.type === "use") {
      dynamicImageSegment({ ...scene, input, output });
    } else {
      logoSegment({ ...scene, input, output });
    }
    return output;
  });
  const result = concatSegments(video.name, files, video.narration);
  const sheet = renderContactSheet(result.final);
  summary.push({
    file: path.relative(root, result.final).replace(/\\/g, "/"),
    duration: result.videoDuration.toFixed(2),
    narrationDuration: result.narrationDuration.toFixed(2),
    ttsRate: result.ttsRate,
    contactSheet: path.relative(root, sheet).replace(/\\/g, "/"),
  });
}

console.log("\nDynamic product-use renders");
console.table(summary);
