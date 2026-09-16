import { useEffect, useRef } from 'react';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

// Luminous palette: on a white page the mass has to glow, not sit on it like a
// sticker. Nothing here goes darker than the rose — the edge dissolves instead.
const BLOBS = [
  {color:[255, 214, 138], ax:.40, ay:.34, sx:0.00, sy:1.90, rate:.21, size:.94, weight:.95},
  {color:[255, 122,  48], ax:.37, ay:.42, sx:2.30, sy:0.40, rate:.17, size:.80, weight:1.0},
  {color:[255,  78, 141], ax:.43, ay:.33, sx:4.10, sy:3.30, rate:.25, size:.74, weight:1.0},
  {color:[173, 118, 255], ax:.35, ay:.41, sx:5.60, sy:1.10, rate:.14, size:.92, weight:.60},
  {color:[255, 166,  92], ax:.31, ay:.29, sx:1.20, sy:5.00, rate:.29, size:.82, weight:.90},
];

// Per-state targets: colour strength, how wide the mass sits, drift speed, grain bite.
const TARGETS: Record<OrbState, {vivid:number; scale:number; speed:number; spread:number; grain:number}> = {
  idle:      {vivid:.80, scale:.90, speed:.42, spread:.86, grain:.25},
  listening: {vivid:.96, scale:.99, speed:.70, spread:1.0, grain:.22},
  thinking:  {vivid:.90, scale:.87, speed:1.45, spread:.74, grain:.30},
  speaking:  {vivid:1.0, scale:1.05, speed:1.05, spread:1.10, grain:.19},
};

const lerp = (a:number, b:number, t:number) => a + (b - a) * t;

// Value noise. Sine drift has a visible period — after ten seconds you can see the
// orb repeat itself. Noise never does, which is what makes the motion read as fluid.
const PERM = new Uint8Array(512);
{
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let seed = 1337;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}
const fade = (t:number) => t * t * t * (t * (t * 6 - 15) + 10);
const corner = (x:number, y:number) => PERM[(PERM[x & 255] + y) & 255] / 255;
// Returns roughly -1..1, smooth in both axes.
function noise2(x:number, y:number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const u = fade(x - xi), v = fade(y - yi);
  const a = corner(xi, yi),     b = corner(xi + 1, yi);
  const c = corner(xi, yi + 1), d = corner(xi + 1, yi + 1);
  const top = a + (b - a) * u, bottom = c + (d - c) * u;
  return (top + (bottom - top) * v) * 2 - 1;
}

// Film grain: a few static tiles swapped on a slow clock read as boiling grain,
// far cheaper than generating fresh noise every frame.
function makeGrainTiles(count:number, size:number) {
  const tiles:HTMLCanvasElement[] = [];
  for (let n = 0; n < count; n++) {
    const tile = document.createElement('canvas');
    tile.width = tile.height = size;
    const gtx = tile.getContext('2d');
    if (!gtx) break;
    const image = gtx.createImageData(size, size);
    for (let i = 0; i < image.data.length; i += 4) {
      // Centred on mid-grey so `overlay` leaves the base colour alone on average.
      const v = 128 + (Math.random() - .5) * 236;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
      image.data[i + 3] = 255;
    }
    gtx.putImageData(image, 0, 0);
    tiles.push(tile);
  }
  return tiles;
}

export default function Gradient({state, getLevel, size = 280}:{state:OrbState; getLevel:() => number; size?:number}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<OrbState>(state);
  const levelRef = useRef(getLevel);
  stateRef.current = state;
  levelRef.current = getLevel;

  useEffect(() => {
    const canvas = canvasRef.current, shell = shellRef.current;
    if (!canvas || !shell) return;
    const ctx = canvas.getContext('2d', {alpha:true});
    if (!ctx) return;

    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const box = Math.round(size * dpr);
    canvas.width = canvas.height = box;
    const C = box / 2;
    // The mass sits inside the box so its soft edge has room to dissolve.
    const R = C * .80;

    const tiles = makeGrainTiles(4, 128);
    const patterns = tiles.map(t => ctx.createPattern(t, 'repeat')).filter(Boolean) as CanvasPattern[];

    let vivid = TARGETS.idle.vivid, scale = TARGETS.idle.scale;
    let spread = TARGETS.idle.spread, grain = TARGETS.idle.grain;
    let level = 0, drift = 0, frame = 0, last = performance.now(), grainClock = 0, tile = 0;

    function paint(now:number) {
      const dt = Math.min((now - last) / 1000, .05);
      last = now;
      const target = TARGETS[stateRef.current];

      let raw = 0;
      try { raw = levelRef.current(); } catch { raw = 0; }
      if (!Number.isFinite(raw)) raw = 0;
      raw = Math.min(Math.max(raw, 0), 1);
      // Fast attack, slow release: the mass jumps with the voice and settles gently.
      level = raw > level ? lerp(level, raw, 1 - Math.exp(-dt * 18)) : lerp(level, raw, 1 - Math.exp(-dt * 4.5));

      const ease = 1 - Math.exp(-dt * 3.2);
      vivid  = lerp(vivid,  target.vivid,  ease);
      scale  = lerp(scale,  target.scale,  ease);
      spread = lerp(spread, target.spread, ease);
      grain  = lerp(grain,  target.grain,  ease);
      if (!still) drift += dt * target.speed * (1 + level * .9);

      const breathe = still ? 0 : Math.sin(drift * .9) * .012;
      const bloom = scale + breathe + level * .085;

      ctx!.clearRect(0, 0, box, box);

      // Saturated base: the blobs paint over colour, never over near-white, which is
      // what turns a stack of warm gradients into beige.
      const base = ctx!.createRadialGradient(C - R * .22, C - R * .26, 0, C, C, R * 1.2);
      base.addColorStop(0, '#ffa63c');
      base.addColorStop(.58, '#f8446e');
      base.addColorStop(1, '#c0398f');
      ctx!.fillStyle = base;
      ctx!.fillRect(0, 0, box, box);

      for (const b of BLOBS) {
        // Two decorrelated noise walks per blob — one per axis.
        const nx = noise2(drift * b.rate + b.sx, b.sy);
        const ny = noise2(b.sx, drift * b.rate + b.sy);
        const x = C + R * b.ax * spread * nx * bloom;
        const y = C + R * b.ay * spread * ny * bloom;
        const radius = R * b.size * spread * bloom * (1 + level * .12);
        const alpha = Math.min(b.weight * vivid * (.94 + level * .06), 1);
        const g = ctx!.createRadialGradient(x, y, 0, x, y, Math.max(radius, 1));
        const [r, gr, bl] = b.color;
        g.addColorStop(0,   `rgba(${r},${gr},${bl},${alpha})`);
        g.addColorStop(.34, `rgba(${r},${gr},${bl},${alpha * .72})`);
        g.addColorStop(.68, `rgba(${r},${gr},${bl},${alpha * .24})`);
        g.addColorStop(1,   `rgba(${r},${gr},${bl},0)`);
        ctx!.fillStyle = g;
        ctx!.fillRect(0, 0, box, box);
      }

      if (vivid < .99) {
        ctx!.fillStyle = `rgba(255,250,246,${(1 - vivid) * .5})`;
        ctx!.fillRect(0, 0, box, box);
      }

      // Light from the upper left, so the mass reads as a body and not a disc.
      const sheen = ctx!.createRadialGradient(C - R * .3, C - R * .38, 0, C, C, R);
      sheen.addColorStop(0, 'rgba(255,255,255,.20)');
      sheen.addColorStop(.55, 'rgba(255,255,255,0)');
      sheen.addColorStop(1, 'rgba(150,35,95,.16)');
      ctx!.fillStyle = sheen;
      ctx!.fillRect(0, 0, box, box);

      // Grain, on its own slow clock. This is the signature of the look.
      if (patterns.length) {
        grainClock += dt;
        if (grainClock > .07) { grainClock = 0; tile = (tile + 1) % patterns.length; }
        ctx!.save();
        ctx!.globalCompositeOperation = 'overlay';
        ctx!.globalAlpha = still ? grain * .6 : grain;
        ctx!.fillStyle = patterns[tile];
        ctx!.fillRect(0, 0, box, box);
        ctx!.restore();
      }

      // Soft edge: no hard circle anywhere. The mass fades out instead of stopping,
      // which is what lets it sit on white without a cut-out rim.
      ctx!.save();
      ctx!.globalCompositeOperation = 'destination-in';
      const mask = ctx!.createRadialGradient(C, C, 0, C, C, R * 1.16);
      mask.addColorStop(0,    'rgba(0,0,0,1)');
      mask.addColorStop(.62,  'rgba(0,0,0,.98)');
      mask.addColorStop(.82,  'rgba(0,0,0,.72)');
      mask.addColorStop(.93,  'rgba(0,0,0,.26)');
      mask.addColorStop(1,    'rgba(0,0,0,0)');
      ctx!.fillStyle = mask;
      ctx!.fillRect(0, 0, box, box);
      ctx!.restore();

      // The outer halo lives in CSS so it can bleed past the canvas box.
      shell!.style.setProperty('--orb-glow', (level * .5 + vivid * .28).toFixed(3));
      shell!.style.setProperty('--orb-lift', (1 + level * .035).toFixed(4));
      frame = requestAnimationFrame(paint);
    }

    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [size]);

  return <div ref={shellRef} className={`orb orb-${state}`} style={{width:size, height:size}} aria-hidden="true">
    <canvas ref={canvasRef} style={{width:size, height:size}}/>
  </div>;
}
