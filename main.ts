import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const W = 1024;
const H = 1024;
const buf = new Uint8Array(W * H * 3);

type RGB = [number, number, number];
const CREAM: RGB = [244, 239, 228];
const NAVY: RGB = [31, 42, 68];
const BLACK: RGB = [18, 18, 18];
const RED: RGB = [179, 35, 42];
const WHITE: RGB = [255, 255, 255];
const TAN: RGB = [210, 185, 140];
const SEA: RGB = [190, 210, 225];
const GREY: RGB = [120, 125, 135];
const LGREY: RGB = [200, 200, 200];
const BLUE: RGB = [60, 100, 160];
const SKY: RGB = [170, 200, 230];
const GREEN: RGB = [90, 140, 90];
const GOLD: RGB = [200, 160, 60];
const BROWN: RGB = [130, 90, 55];

function setPx(x: number, y: number, c: RGB) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
}
function fillRect(x: number, y: number, w: number, h: number, c: RGB) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPx(xx, yy, c);
}
function fillCircle(cx: number, cy: number, r: number, c: RGB) {
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy <= r * r) setPx(x, y, c);
  }
}
function ringCircle(cx: number, cy: number, r: number, c: RGB, t = 2) {
  for (let y = cy - r - t; y <= cy + r + t; y++) for (let x = cx - r - t; x <= cx + r + t; x++) {
    const dx = x - cx, dy = y - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d <= r && d >= r - t) setPx(x, y, c);
  }
}
function drawLine(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 2) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + (x1 - x0) * i / steps);
    const y = Math.round(y0 + (y1 - y0) * i / steps);
    fillRect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
  }
}
function fillPoly(pts: [number, number][], c: RGB) {
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        const x = a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]);
        xs.push(x);
      }
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = Math.round(xs[i]); x <= Math.round(xs[i + 1]); x++) setPx(x, y, c);
    }
  }
}
function frameRect(x: number, y: number, w: number, h: number, c: RGB, t = 2) {
  fillRect(x, y, w, t, c); fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c); fillRect(x + w - t, y, t, h, c);
}

// 5x7 bitmap font, rows top to bottom, '1' = ink
const FONT: Record<string, string[]> = {
  "A": ["01110","10001","10001","11111","10001","10001","10001"],
  "B": ["11110","10001","10001","11110","10001","10001","11110"],
  "C": ["01110","10001","10000","10000","10000","10001","01110"],
  "D": ["11100","10010","10001","10001","10001","10010","11100"],
  "E": ["11111","10000","10000","11110","10000","10000","11111"],
  "F": ["11111","10000","10000","11110","10000","10000","10000"],
  "G": ["01110","10001","10000","10111","10001","10001","01111"],
  "H": ["10001","10001","10001","11111","10001","10001","10001"],
  "I": ["01110","00100","00100","00100","00100","00100","01110"],
  "J": ["00111","00010","00010","00010","00010","10010","01100"],
  "K": ["10001","10010","10100","11000","10100","10010","10001"],
  "L": ["10000","10000","10000","10000","10000","10000","11111"],
  "M": ["10001","11011","10101","10101","10001","10001","10001"],
  "N": ["10001","11001","10101","10011","10001","10001","10001"],
  "O": ["01110","10001","10001","10001","10001","10001","01110"],
  "P": ["11110","10001","10001","11110","10000","10000","10000"],
  "Q": ["01110","10001","10001","10001","10101","10010","01101"],
  "R": ["11110","10001","10001","11110","10100","10010","10001"],
  "S": ["01111","10000","10000","01110","00001","00001","11110"],
  "T": ["11111","00100","00100","00100","00100","00100","00100"],
  "U": ["10001","10001","10001","10001","10001","10001","01110"],
  "V": ["10001","10001","10001","10001","10001","01010","00100"],
  "W": ["10001","10001","10001","10101","10101","11011","10001"],
  "X": ["10001","01010","00100","00100","00100","01010","10001"],
  "Y": ["10001","10001","01010","00100","00100","00100","00100"],
  "Z": ["11111","00001","00010","00100","01000","10000","11111"],
  "0": ["01110","10001","10011","10101","11001","10001","01110"],
  "1": ["00100","01100","00100","00100","00100","00100","01110"],
  "2": ["01110","10001","00001","00110","01000","10000","11111"],
  "3": ["11110","00001","00001","01110","00001","00001","11110"],
  "4": ["00010","00110","01010","10010","11111","00010","00010"],
  "5": ["11111","10000","11110","00001","00001","10001","01110"],
  "6": ["00110","01000","10000","11110","10001","10001","01110"],
  "7": ["11111","00001","00010","00100","01000","01000","01000"],
  "8": ["01110","10001","10001","01110","10001","10001","01110"],
  "9": ["01110","10001","10001","01111","00001","00010","01100"],
  " ": ["00000","00000","00000","00000","00000","00000","00000"],
  ".": ["00000","00000","00000","00000","00000","01100","01100"],
  ",": ["00000","00000","00000","00000","01100","00100","01000"],
  ":": ["00000","01100","01100","00000","01100","01100","00000"],
  "'": ["00100","00100","01000","00000","00000","00000","00000"],
  "-": ["00000","00000","00000","01110","00000","00000","00000"],
  "(": ["00010","00100","01000","01000","01000","00100","00010"],
  ")": ["01000","00100","00010","00010","00010","00100","01000"],
  "!": ["00100","00100","00100","00100","00100","00000","00100"],
  "?": ["01110","10001","00001","00110","00100","00000","00100"],
  "/": ["00001","00010","00010","00100","01000","01000","10000"],
  "&": ["01100","10010","10100","01000","10101","10010","01101"],
  "%": ["11001","11010","00010","00100","01000","01011","10011"],
};

function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}
function drawText(x: number, y: number, s: string, scale: number, c: RGB) {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = FONT[ch] || FONT[" "];
    for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++) {
      if (g[r][col] === "1") fillRect(cx + col * scale, y + r * scale, scale, scale, c);
    }
    cx += 6 * scale;
  }
}
function drawTextCenter(cx: number, y: number, s: string, scale: number, c: RGB) {
  drawText(Math.round(cx - textWidth(s, scale) / 2), y, s, scale, c);
}
function wrapText(s: string, maxChars: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur.length === 0) cur = w;
    else if (cur.length + 1 + w.length <= maxChars) cur += " " + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawWrapped(x: number, y: number, s: string, scale: number, c: RGB, maxChars: number, lineGap: number, maxLines: number) {
  const lines = wrapText(s, maxChars).slice(0, maxLines);
  lines.forEach((ln, i) => drawText(x, y + i * (7 * scale + lineGap), ln, scale, c));
  return lines.length * (7 * scale + lineGap);
}
function numBadge(x: number, y: number, n: number) {
  fillCircle(x + 9, y + 9, 10, RED);
  const s = String(n);
  if (s.length === 1) drawText(x + 6, y + 5, s, 1, WHITE);
  else drawText(x + 3, y + 5, s, 1, WHITE);
}

// ---- PNG encoder ----
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[n] = c >>> 0;
}
function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    Buffer.from(buf.buffer, y * W * 3, W * 3).copy(raw, y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---- Page ----
fillRect(0, 0, W, H, CREAM);
const M = 14;

// Masthead
fillRect(0, 0, W, 118, NAVY);
drawText(M, 10, "THE WORLD IN ONE DAY", 1, WHITE);
const rightTop = "35 STORIES - 6 CONTINENTS - ONE DAY";
drawText(W - M - textWidth(rightTop, 1), 10, rightTop, 1, WHITE);
drawTextCenter(W / 2, 30, "FRIDAY 20 NOVEMBER 2026", 4, WHITE);
fillRect(0, 118, W, 4, RED);

function kicker(x: number, y: number, s: string) {
  drawText(x, y, s, 1, RED);
}

// Scenes for leads
function sceneSummit(x: number, y: number, w: number, h: number) {
  fillRect(x, y, w, h, SKY);
  // three flags
  const cols: RGB[] = [[50, 80, 180], [200, 40, 40], [230, 230, 230]];
  for (let i = 0; i < 3; i++) {
    const fx = x + 40 + i * 90;
    fillRect(fx, y + 8, 3, 46, BLACK);
    fillRect(fx + 3, y + 8, 44, 26, cols[i]);
    frameRect(fx + 3, y + 8, 44, 26, BLACK, 1);
  }
  // table + leaders
  fillRect(x + 30, y + 72, w - 60, 14, BROWN);
  for (let i = 0; i < 3; i++) {
    const lx = x + 70 + i * 90;
    fillCircle(lx, y + 60, 10, [235, 195, 160]);
    fillRect(lx - 13, y + 68, 26, 10, NAVY);
  }
}
function sceneCourt(x: number, y: number, w: number, h: number) {
  fillRect(x, y, w, h, [225, 218, 200]);
  fillPoly([[x + 20, y + 34], [x + w / 2, y + 8], [x + w - 20, y + 34]], NAVY);
  for (let i = 0; i < 5; i++) fillRect(x + 34 + i * 58, y + 38, 12, 42, WHITE);
  fillRect(x + 20, y + 80, w - 40, 8, NAVY);
  // scales
  const cx = x + w / 2;
  drawLine(cx, y + 20, cx, y + 52, GOLD, 3);
  drawLine(cx - 30, y + 28, cx + 30, y + 28, GOLD, 3);
  fillPoly([[cx - 42, y + 46], [cx - 18, y + 46], [cx - 30, y + 54]], GOLD);
  fillPoly([[cx + 18, y + 46], [cx + 42, y + 46], [cx + 30, y + 54]], GOLD);
}
function sceneCyclone(x: number, y: number, w: number, h: number) {
  fillRect(x, y, w, h, [150, 180, 210]);
  fillRect(x, y + h - 18, w, 18, [120, 160, 110]);
  fillRect(x, y + h - 26, w, 8, SEA);
  const cx = x + w / 2, cy = y + 42;
  for (let r = 30; r >= 8; r -= 6) ringCircle(cx, cy, r, WHITE, 3);
  fillCircle(cx, cy, 5, [150, 180, 210]);
  drawLine(cx - 44, cy + 22, cx - 10, cy + 30, WHITE, 3);
  drawLine(cx + 10, cy - 30, cx + 44, cy - 22, WHITE, 3);
}

const leads = [
  { n: 1, kick: "ASIA - DIPLOMACY", head: "TRUMP, XI AND PUTIN HOLD FIRST THREE-WAY TALKS", deck: "MET THURSDAY IN SHENZHEN; NUCLEAR-RISK DIALOGUE PLEDGED, REPORTED FRIDAY", scene: sceneSummit },
  { n: 2, kick: "LAW - JUSTICE", head: "UN COURT RULES MYANMAR COMMITTED GENOCIDE", deck: "9-6 VERDICT THURSDAY IN GAMBIA'S ROHINGYA CASE; REPARATIONS ORDERED", scene: sceneCourt },
  { n: 3, kick: "ASIA - WEATHER", head: "CYCLONE AKVAN DUE ASHORE IN INDIA TODAY", deck: "LANDFALL EXPECTED NEAR GOPALPUR FRIDAY NOON; THREE LAKH EVACUATED", scene: sceneCyclone },
];

const leadY = 128;
const leadH = 202;
const colW = Math.floor((W - 2 * M - 16) / 3);
leads.forEach((L, i) => {
  const x = M + i * (colW + 8);
  frameRect(x, leadY, colW, leadH, BLACK, 2);
  L.scene(x + 4, leadY + 4, colW - 8, 92);
  numBadge(x + 4, leadY + 4, L.n);
  kicker(x + 8, leadY + 102, L.kick);
  drawWrapped(x + 8, leadY + 114, L.head, 2, BLACK, 22, 3, 3);
  drawWrapped(x + 8, leadY + 168, L.deck, 1, [60, 60, 60], 48, 2, 3);
});

// Featured icons
function iconCalendar(x: number, y: number, w: number, h: number) {
  fillRect(x, y, w, h, WHITE); frameRect(x, y, w, h, BLACK, 2);
  fillRect(x, y, w, 12, RED);
  drawTextCenter(x + w / 2, y + 16, "?", 3, BLACK);
}
function iconTower(x: number, y: number, w: number, h: number) {
  fillRect(x, y, w, h, SKY);
  fillRect(x + w / 2 - 26, y + 4, 52, h - 4, [70, 80, 100]);
  frameRect(x + w / 2 - 26, y + 4, 52, h - 4, BLACK, 2);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) fillRect(x + w / 2 - 18 + c * 14, y + 10 + r * 10, 8, 6, [240, 230, 160]);
  drawLine(x + w / 2 - 24, y + 8, x + w / 2 + 20, y + 36, BLACK, 3);
  fillCircle(x + w / 2 + 2, y + 22, 5, RED);
}
function iconDrone(x: number, y: number, w: number, h: number) {
  fillRect(x, y, w, h, [200, 210, 225]);
  fillRect(x + 14, y + h - 26, 30, 26, [220, 200, 160]);
  fillPoly([[x + 14, y + h - 26], [x + 29, y + h - 42], [x + 44, y + h - 26]], NAVY);
  const dx = x + w - 46, dy = y + 18;
  fillRect(dx, dy, 22, 8, BLACK);
  fillCircle(dx - 4, dy, 5, BLACK); fillCircle(dx + 26, dy, 5, BLACK);
  fillCircle(dx - 4, dy + 12, 5, BLACK); fillCircle(dx + 26, dy + 12, 5, BLACK);
}
function iconSpace(x: number, y: number, w: number, h: number) {
  fillRect(x, y, w, h, [20, 25, 60]);
  for (const [sx, sy] of [[18, 12], [50, 22], [90, 10], [120, 28], [70, 36]] as [number, number][]) fillCircle(x + sx, y + sy, 2, WHITE);
  fillCircle(x + w / 2, y + h / 2, 9, GOLD);
  fillRect(x + w / 2 - 30, y + h / 2 - 3, 20, 6, [180, 180, 200]);
  fillRect(x + w / 2 + 10, y + h / 2 - 3, 20, 6, [180, 180, 200]);
}
function iconGame(x: number, y: number, w: number, h: number) {
  fillRect(x, y, w, h, [40, 30, 80]);
  for (let i = 0; i < 5; i++) fillRect(x + 12 + i * 28, y + 18 + (i % 2) * 8, 18, h - 18 - (i % 2) * 8, [230, 80, 180]);
  drawText(x + w / 2 - 18, y + 6, "VI", 2, WHITE);
}
function iconBridge(x: number, y: number, w: number, h: number) {
  fillRect(x, y, w, h, SKY);
  fillRect(x, y + h - 12, w, 12, SEA);
  fillRect(x + 8, y + h - 22, w - 16, 5, BLACK);
  fillRect(x + 24, y + 10, 6, h - 22, BLACK); fillRect(x + w - 30, y + 10, 6, h - 22, BLACK);
  fillCircle(x + w / 2, y + h - 20, 8, [255, 170, 40]);
  fillCircle(x + w / 2, y + h - 20, 4, RED);
}
function iconAtom(x: number, y: number, w: number, h: number) {
  fillRect(x, y, w, h, [225, 225, 220]);
  const cx = x + w / 2, cy = y + h / 2;
  ringCircle(cx, cy, 17, BLUE, 4); ringCircle(cx, cy, 26, BLUE, 4);
  fillCircle(cx, cy, 7, RED);
  fillCircle(cx + 17, cy - 10, 4, NAVY); fillCircle(cx - 20, cy + 12, 4, NAVY);
  fillRect(x + 8, y + 4, 6, h - 8, [70, 70, 70]); fillRect(x + w - 14, y + 4, 6, h - 8, [70, 70, 70]);
}
function iconProbe(x: number, y: number, w: number, h: number) {
  fillRect(x, y, w, h, [25, 30, 55]);
  fillCircle(x + w - 34, y + h / 2, 15, [160, 140, 120]);
  fillCircle(x + w - 40, y + h / 2 - 4, 4, [130, 110, 95]);
  fillRect(x + 22, y + h / 2 - 6, 22, 12, GOLD);
  fillRect(x + 8, y + h / 2 - 3, 14, 6, [180, 180, 200]);
  fillCircle(x + 60, y + 12, 2, WHITE); fillCircle(x + 90, y + 30, 2, WHITE);
}
function iconIce(x: number, y: number, w: number, h: number) {
  fillRect(x, y, w, h, [150, 190, 225]);
  fillPoly([[x + 6, y + h - 6], [x + 40, y + 20], [x + 82, y + 12], [x + w - 8, y + h - 6]], BLACK);
  fillPoly([[x + 10, y + h - 8], [x + 42, y + 23], [x + 80, y + 16], [x + w - 12, y + h - 8]], WHITE);
  fillRect(x + w / 2, y + 4, 4, 28, BLACK);
  fillRect(x + w / 2 + 4, y + 4, 26, 14, RED);
  frameRect(x + w / 2 + 4, y + 4, 26, 14, BLACK, 1);
}
function iconGavel(x: number, y: number, w: number, h: number) {
  fillRect(x, y, w, h, [235, 228, 210]);
  fillRect(x + 20, y + 10, 40, 30, WHITE); frameRect(x + 20, y + 10, 40, 30, BLACK, 1);
  drawLine(x + 20, y + 10, x + 40, y + 24, BLACK, 1); drawLine(x + 60, y + 10, x + 40, y + 24, BLACK, 1);
  fillRect(x + w - 58, y + 14, 26, 10, BROWN);
  drawLine(x + w - 48, y + 24, x + w - 34, y + 40, BROWN, 4);
}
function iconChart(x: number, y: number, w: number, h: number) {
  fillRect(x, y, w, h, WHITE);
  drawLine(x + 12, y + h - 8, x + w - 10, y + h - 8, BLACK, 2);
  drawLine(x + 12, y + h - 8, x + 12, y + 8, BLACK, 2);
  drawLine(x + 16, y + h - 14, x + 52, y + h - 24, GREEN, 3);
  drawLine(x + 52, y + h - 24, x + 84, y + h - 18, GREEN, 3);
  drawLine(x + 84, y + h - 18, x + w - 18, y + 12, GREEN, 3);
  fillPoly([[x + w - 18, y + 12], [x + w - 28, y + 14], [x + w - 20, y + 24]], GREEN);
}
function iconCricket(x: number, y: number, w: number, h: number) {
  fillRect(x, y, w, h, [120, 175, 120]);
  fillRect(x + w / 2 - 12, y + 4, 20, h - 14, [235, 205, 140]);
  frameRect(x + w / 2 - 12, y + 4, 20, h - 14, BLACK, 2);
  fillRect(x + w / 2 - 5, y + h - 14, 8, 10, BROWN);
  fillCircle(x + w / 2 + 36, y + h - 14, 10, RED);
  ringCircle(x + w / 2 + 36, y + h - 14, 10, BLACK, 1);
}

const feat = [
  { n: 4, kick: "US - IRAN", head: "TRUMP PUTS OFF IRAN WAR DECISION TO 2027", deck: "SAYS US WILL 'SEE WHAT HAPPENS' AFTER JAN 1, REUTERS REPORTS FRIDAY", icon: iconCalendar },
  { n: 5, kick: "MIDDLE EAST - SAUDI", head: "HOUTHI STRIKE DAMAGES RIYADH WEALTH-FUND TOWER", deck: "SECOND FINANCIAL-DISTRICT HIT IN 11 DAYS; NO INJURIES REPORTED THURSDAY", icon: iconTower },
  { n: 6, kick: "EUROPE - UKRAINE", head: "RUSSIAN DRONES DAMAGE TWO EMBASSIES IN KYIV", deck: "ONE KILLED THURSDAY; CATHEDRAL AND DUTCH, AUSTRIAN MISSIONS HIT", icon: iconDrone },
  { n: 7, kick: "SCIENCE - SPACE", head: "VOYAGER 1 NOW A LIGHT-DAY FROM EARTH", deck: "NASA CONFIRMS THE MILESTONE FRIDAY; A SIGNAL TAKES A DAY TO REACH IT", icon: iconSpace },
  { n: 8, kick: "CULTURE - GAMING", head: "GTA VI SALES PASS 1.8BN DOLLARS", deck: "BLOCKBUSTER LAUNCH REPORTED FRIDAY; OUT THURSDAY TO A 99 SCORE", icon: iconGame },
  { n: 9, kick: "EUROPE - UKRAINE", head: "UKRAINE HITS CRIMEAN BRIDGE; RAIL HALTED", deck: "PUTIN SAYS MOSCOW WILL NOT NEGOTIATE AFTER STRIKES, REPORTED FRIDAY", icon: iconBridge },
  { n: 10, kick: "MIDDLE EAST - NUCLEAR", head: "WEST PRESSES IRAN TO REOPEN NUCLEAR SITES", deck: "IAEA URGED FRIDAY TO RESUME INSPECTIONS AT BOMBED SITES", icon: iconAtom },
  { n: 11, kick: "SCIENCE - JAPAN", head: "JAPAN PROBE DROPS ASTEROID LANDING PLAN", deck: "ENGINE TROUBLE ENDS 2031 VISIT; NEW FLYBY SET FOR 2028, REPORTED FRIDAY", icon: iconProbe },
  { n: 12, kick: "ARCTIC - DENMARK", head: "DENMARK APPROVES US GREENLAND MILITARY DEAL", deck: "EXPANSION AGREED THURSDAY; REPORTED FRIDAY", icon: iconIce },
  { n: 13, kick: "ASIA - INDIA", head: "JUDGE SAYS RESIGNATION IS NOT GUILT ADMISSION", deck: "JUSTICE VARMA TELLS LOK SABHA SECRETARIAT FRIDAY, NDTV REPORTS", icon: iconGavel },
  { n: 14, kick: "BUSINESS - AI", head: "ANTHROPIC SOARS IN WALL STREET DEBUT", deck: "SHARES JUMP FRIDAY DESPITE AI JITTERS; VALUED NEAR 1.5 TRILLION", icon: iconChart },
  { n: 15, kick: "SPORT - CRICKET", head: "NICHOLLS AND PHILLIPS LIFT NEW ZEALAND", deck: "CENTURIES ON DAY TWO IN WELLINGTON FRIDAY; NZ 311 FOR 6", icon: iconCricket },
];

const featY = leadY + leadH + 8;
const fColW = Math.floor((W - 2 * M - 24) / 4);
const fRowH = 128;
feat.forEach((F, i) => {
  const col = i % 4, row = Math.floor(i / 4);
  const x = M + col * (fColW + 8);
  const y = featY + row * (fRowH + 6);
  frameRect(x, y, fColW, fRowH, BLACK, 1);
  F.icon(x + 4, y + 4, fColW - 8, 42);
  numBadge(x + 4, y + 4, F.n);
  kicker(x + 6, y + 50, F.kick);
  drawWrapped(x + 6, y + 60, F.head, 1, BLACK, 36, 2, 3);
  drawWrapped(x + 6, y + 94, F.deck, 1, [60, 60, 60], 36, 2, 3);
});

// Bottom band
const botY = featY + 3 * (fRowH + 6) + 2;
const botH = 224;
const mapW = 468;
frameRect(M, botY, mapW, botH, BLACK, 2);
drawText(M + 8, botY + 6, "WHERE IT HAPPENED", 2, NAVY);
const mx = M + 8, my = botY + 30, mw = mapW - 16, mh = 150;
fillRect(mx, my, mw, mh, SEA);
function proj(lon: number, lat: number): [number, number] {
  return [mx + (lon + 180) / 360 * mw, my + (90 - lat) / 180 * mh];
}
function continent(coords: [number, number][]) {
  fillPoly(coords.map(([lo, la]) => proj(lo, la)), TAN);
}
continent([[-168, 66], [-140, 70], [-125, 72], [-95, 80], [-80, 73], [-78, 62], [-85, 55], [-80, 45], [-70, 42], [-75, 35], [-81, 26], [-84, 30], [-90, 21], [-97, 16], [-105, 20], [-114, 29], [-122, 37], [-124, 46], [-132, 56], [-152, 60], [-168, 66]]);
continent([[-77, 8], [-60, 8], [-50, 0], [-44, -3], [-35, -8], [-39, -13], [-48, -26], [-52, -33], [-58, -39], [-65, -41], [-67, -46], [-69, -52], [-71, -54], [-74, -50], [-73, -44], [-72, -37], [-70, -30], [-70, -18], [-75, -15], [-77, -12], [-81, -4], [-80, 1], [-77, 4], [-77, 8]]);
continent([[-10, 36], [0, 38], [3, 42], [7, 44], [12, 44], [18, 40], [23, 36], [26, 38], [23, 36], [19, 42], [12, 46], [6, 50], [0, 51], [-2, 49], [-5, 48], [-2, 44], [-9, 43], [-9, 37], [-10, 36]]);
continent([[5, 58], [10, 57], [18, 56], [21, 60], [25, 60], [30, 60], [28, 66], [31, 70], [18, 69], [12, 65], [5, 60], [5, 58]]);
continent([[-17, 15], [-16, 21], [-13, 28], [-6, 35], [10, 37], [11, 34], [20, 32], [30, 31], [32, 31], [35, 28], [38, 22], [40, 15], [43, 12], [48, 11], [51, 12], [48, 5], [41, -2], [40, -10], [36, -18], [33, -26], [28, -33], [20, -35], [17, -32], [14, -22], [12, -15], [13, -10], [9, -1], [9, 4], [-8, 5], [-13, 8], [-17, 12], [-17, 15]]);
continent([[30, 36], [36, 36], [42, 37], [44, 38], [48, 30], [50, 29], [48, 28], [55, 26], [57, 27], [59, 22], [55, 17], [52, 15], [48, 14], [44, 12], [43, 12], [40, 15], [38, 22], [35, 28], [33, 27], [30, 36]]);
continent([[44, 38], [50, 44], [55, 46], [60, 50], [66, 50], [72, 52], [80, 50], [87, 49], [95, 50], [100, 52], [110, 52], [120, 53], [128, 50], [132, 43], [127, 40], [122, 38], [120, 32], [122, 28], [118, 25], [110, 20], [108, 12], [105, 9], [103, 2], [100, 6], [98, 10], [97, 16], [92, 16], [89, 22], [86, 20], [80, 13], [77, 8], [72, 20], [66, 25], [61, 25], [57, 27], [50, 29], [48, 30], [44, 38]]);
continent([[30, 60], [40, 65], [50, 68], [60, 69], [70, 72], [80, 73], [90, 75], [100, 77], [110, 74], [120, 73], [130, 72], [140, 72], [150, 70], [160, 69], [170, 66], [178, 65], [178, 62], [160, 60], [142, 59], [132, 50], [128, 50], [120, 53], [110, 52], [100, 52], [95, 50], [87, 49], [80, 50], [72, 52], [66, 50], [60, 50], [55, 46], [50, 44], [44, 38], [36, 36], [30, 36], [28, 41], [30, 46], [28, 60], [30, 60]]);
continent([[113, -22], [114, -28], [115, -34], [118, -35], [124, -33], [129, -32], [132, -32], [135, -35], [138, -35], [140, -38], [145, -38], [150, -37], [153, -27], [153, -22], [146, -19], [142, -11], [142, -14], [136, -15], [136, -12], [132, -11], [126, -14], [122, -17], [117, -20], [113, -22]]);
continent([[-45, 60], [-30, 68], [-22, 70], [-20, 76], [-30, 82], [-45, 80], [-55, 76], [-58, 70], [-53, 64], [-45, 60]]);
continent([[130, 31], [133, 34], [137, 35], [140, 36], [141, 40], [141, 45], [140, 42], [139, 38], [135, 34], [131, 33], [130, 31]]);
continent([[167, -45], [172, -41], [174, -39], [178, -38], [176, -37], [174, -41], [169, -46], [167, -45]]);

const dots: [number, number, number][] = [
  [1, 114, 22], [2, 96, 20], [3, 85, 19], [4, -98, 39], [5, 47, 25],
  [6, 31, 50], [7, 0, 88], [8, -98, 39], [9, 34, 45], [10, 53, 32],
  [11, 138, 37], [12, -42, 72], [13, 77, 29], [14, -98, 39], [15, 172, -41],
];
// offset overlapping US dots slightly
const off: Record<number, [number, number]> = { 4: [-8, -6], 8: [8, -6], 14: [0, 8] };
for (const [n, lo, la] of dots) {
  let [px, py] = proj(lo, la);
  if (off[n]) { px += off[n][0]; py += off[n][1]; }
  if (n === 7) { px = mx + mw / 2; py = my + 8; }
  fillCircle(Math.round(px), Math.round(py), 8, RED);
  const s = String(n);
  drawText(Math.round(px) - (s.length === 1 ? 2 : 5), Math.round(py) - 3, s, 1, WHITE);
}
drawText(M + 8, my + mh + 6, "NUMBERED DOTS MARK STORIES 1-15.", 1, BLACK);
drawText(M + 8, my + mh + 18, "7 = VOYAGER 1, DEEP SPACE.", 1, BLACK);

const alsoX = M + mapW + 8;
const alsoW = W - alsoX - M;
frameRect(alsoX, botY, alsoW, botH, BLACK, 2);
drawText(alsoX + 8, botY + 6, "ALSO ON FRIDAY 20 NOVEMBER", 2, NAVY);
const also: string[] = [
  "16. US: JEFFRIES NEARS HOUSE HISTORY",
  "17. US: TRUMP PICK DENIES JAN 6 ATTACK",
  "18. MARKETS: GOLD TESTS YEARLY LOWS",
  "19. TECH: AMD SLIDES ON CHINA REPORT",
  "20. US: FIONA THE HIPPO DIES, ATE A HAT",
  "21. KOREA: COURT OVERTURNS EX-PM HAN",
  "22. FIJI: DISASTER OVER EL NINO DROUGHT",
  "23. N. KOREA EXPANDS YONGBYON PLANT",
  "24. US-VENEZUELA MILITARY DEAL SIGNED",
  "25. EUROPE READY FOR RUSSIA TALKS",
  "26. JAPAN PM SEEKS CHINA DIALOGUE",
  "27. AUSTRALIA SANCTIONS SETTLER LEADER",
  "28. BLACK SEA: TANKER HIT BY PROJECTILES",
  "29. INDIA: MODI MEETS WALES ROYALS",
  "30. SENSEX +1.21%, NIFTY TOPS 25,400",
  "31. SPORT: BAVUMA OUT OF TEST DECIDER",
  "32. CHESS: CARLSEN FORFEIT SHOCKS WORLD",
  "33. SPACE: HERA INSPECTS NASA CRASH SITE",
  "34. TECH: APPLE IOS 27.3 PUBLIC BETA",
  "35. WORLD CHILDREN'S DAY MARKED",
];
const colW2 = Math.floor((alsoW - 16) / 2);
also.forEach((ln, i) => {
  const col = i < 10 ? 0 : 1;
  const row = i % 10;
  const x = alsoX + 8 + col * colW2;
  const y = botY + 30 + row * 18;
  const lines = wrapText(ln, 40).slice(0, 1);
  lines.forEach((l, j) => drawText(x, y + j * 9, l, 1, BLACK));
});

// Footer
const footY = botY + botH + 8;
fillRect(M, footY, W - 2 * M, 2, BLACK);
drawText(M, footY + 8, "EVERY STORY HAPPENED OR WAS FIRST REPORTED ON FRIDAY 20 NOVEMBER 2026. DISPUTED CLAIMS ARE ATTRIBUTED.", 1, BLACK);
drawText(M, footY + 20, "SOURCES: AP, REUTERS, AFP, BBC, AL JAZEERA, UN NEWS. ORIGINAL DRAWINGS.", 1, BLACK);

const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "entry.png"), encodePNG());
