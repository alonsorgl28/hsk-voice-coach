import { useEffect, useRef } from 'react';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

// Dense, saturated palette. On white a pale mass would leave no visible trail, so the
// body stays heavy and the paper does the lightening.
const BLOBS = [
  {color:[255, 176,  40], ax:.30, ay:.26, sx:0.00, sy:1.90, rate:.24, size:.86, weight:.95},
  {color:[255,  92,  20], ax:.28, ay:.32, sx:2.30, sy:0.40, rate:.19, size:.74, weight:1.0},
  {color:[236,  30, 110], ax:.33, ay:.25, sx:4.10, sy:3.30, rate:.28, size:.70, weight:1.0},
  {color:[146,  62, 236], ax:.26, ay:.31, sx:5.60, sy:1.10, rate:.16, size:.82, weight:.62},
];

// The body only moves when someone is actually talking. `rest` is the motion it keeps
// with no sound at all — zero everywhere except while she is thinking, where a little
// drift is the only signal that anything is happening. `voice` is how much the live
// audio level adds on top. With both at zero the mass sits still, dead centre.
// fade: opacity of the wash over the previous frame — lower means a longer trail.
// travel: how far the mass can wander. amp: how hard the outline deforms.
const TARGETS: Record<OrbState, {vivid:number; scale:number; speed:number; fade:number; amp:number; travel:number; grain:number; rest:number; voice:number}> = {
  idle:      {vivid:.86, scale:.98, speed:.70, fade:.090, amp:.13, travel:.20, grain:.14, rest:0,   voice:0},
  listening: {vivid:.97, scale:1.0, speed:1.05, fade:.070, amp:.19, travel:.30, grain:.13, rest:0,   voice:1.15},
  thinking:  {vivid:.92, scale:.94, speed:2.0, fade:.045, amp:.25, travel:.42, grain:.16, rest:.5,  voice:.3},
  speaking:  {vivid:1.0, scale:1.02, speed:1.5, fade:.058, amp:.22, travel:.38, grain:.11, rest:0,   voice:1.15},
};
// The shape the outline relaxes into when nothing is moving: organic, but never a pulse.
const REST_AMP = .11;

const lerp = (a:number, b:number, t:number) => a + (b - a) * t;

// Value noise. A sine has a visible period — after ten seconds you watch the shape
// repeat itself. Noise never does, which is what makes the motion read as fluid.
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
function noise2(x:number, y:number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const u = fade(x - xi), v = fade(y - yi);
  const a = corner(xi, yi),     b = corner(xi + 1, yi);
  const c = corner(xi, yi + 1), d = corner(xi + 1, yi + 1);
  const top = a + (b - a) * u, bottom = c + (d - c) * u;
  return (top + (bottom - top) * v) * 2 - 1;
}

// The outline, as a closed path in polar coordinates. Sampling the noise on a circle
// makes it periodic in theta for free, so the contour always closes on itself.
function traceBlob(ctx:CanvasRenderingContext2D, cx:number, cy:number, R:number, t:number, amp:number, lobes:number) {
  const STEPS = 110;
  ctx.beginPath();
  for (let i = 0; i <= STEPS; i++) {
    const a = (i / STEPS) * Math.PI * 2;
    const n = noise2(Math.cos(a) * lobes + t, Math.sin(a) * lobes + t * .7);
    const r = R * (1 + amp * n);
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function makeGrainTiles(count:number, size:number) {
  const tiles:HTMLCanvasElement[] = [];
  for (let n = 0; n < count; n++) {
    const tile = document.createElement('canvas');
    tile.width = tile.height = size;
    const gtx = tile.getContext('2d');
    if (!gtx) break;
    const image = gtx.createImageData(size, size);
    for (let i = 0; i < image.data.length; i += 4) {
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
  const stateRef = useRef<OrbState>(state);
  const levelRef = useRef(getLevel);
  stateRef.current = state;
  levelRef.current = getLevel;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Transparent, not opaque white: washing towards white is asymptotic, so the trail
    // never quite got there and left a permanent grey square the size of the canvas.
    // Erasing towards transparent lets the page's own white finish the job.
    const ctx = canvas.getContext('2d', {alpha:true});
    if (!ctx) return;

    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const box = Math.round(size * dpr);
    canvas.width = canvas.height = box;
    const C = box / 2;
    // Bigger body now that it travels less: the trail needs far less room to live in.
    const R = C * .62;

    // The body is drawn off-screen so it can be composited through a blur: a clipped
    // path alone has a razor edge, and the reference has none anywhere.
    const off = document.createElement('canvas');
    off.width = off.height = box;
    const octx = off.getContext('2d');
    if (!octx) return;
    const blurPx = Math.max(box * .022, 4);

    const tiles = makeGrainTiles(4, 128);
    const patterns = tiles.map(t => ctx.createPattern(t, 'repeat')).filter(Boolean) as CanvasPattern[];

    let vivid = TARGETS.idle.vivid, scale = TARGETS.idle.scale, wash = TARGETS.idle.fade;
    let amp = REST_AMP, travel = TARGETS.idle.travel, grain = TARGETS.idle.grain, motion = 0;
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
      // How alive the body is right now: silence means still, voice means moving.
      // Curved, not linear: speech spends most of its time at low volume, and a linear
      // map would leave the body barely twitching through a normal sentence.
      const heard = level > 0 ? Math.pow(level, .62) : 0;
      const wanted = still ? 0 : Math.min(target.rest + target.voice * heard, 1.4);
      motion = lerp(motion, wanted, 1 - Math.exp(-dt * 4));
      vivid  = lerp(vivid,  target.vivid,  ease);
      scale  = lerp(scale,  target.scale,  ease);
      wash   = lerp(wash,   target.fade,   ease);
      amp    = lerp(amp,    REST_AMP + (target.amp - REST_AMP) * Math.min(motion, 1), ease);
      travel = lerp(travel, target.travel, ease);
      grain  = lerp(grain,  target.grain,  ease);
      drift += dt * target.speed * motion;

      // The trail: instead of clearing, erase the previous frame a little further
      // towards transparent. What survives underneath is the smear.
      ctx!.globalCompositeOperation = 'destination-out';
      ctx!.fillStyle = `rgba(0,0,0,${still ? 1 : wash})`;
      ctx!.fillRect(0, 0, box, box);
      ctx!.globalCompositeOperation = 'source-over';

      // No breathing: a mass that pulses on its own reads as an idle animation, and the
      // brief is that it only moves when somebody is talking.
      const bloom = scale + heard * .09;
      const reach = travel * motion;
      // Where the body sits this frame. Two decorrelated walks so it wanders, never orbits.
      const cx = C + C * reach * noise2(drift * 1.45, 11.5);
      const cy = C + C * reach * noise2(7.3, drift * 1.32);

      octx!.clearRect(0, 0, box, box);
      octx!.save();
      traceBlob(octx!, cx, cy, R * bloom, drift * 1.15, amp * (1 + level * .25), 1.7);
      octx!.clip();

      const base = octx!.createRadialGradient(cx - R * .3, cy - R * .34, 0, cx, cy, R * bloom * 1.5);
      base.addColorStop(0, '#ff9e2e');
      base.addColorStop(.56, '#f53a67');
      base.addColorStop(1, '#a52a84');
      octx!.fillStyle = base;
      octx!.fillRect(0, 0, box, box);

      for (const b of BLOBS) {
        const x = cx + R * b.ax * bloom * noise2(drift * b.rate + b.sx, b.sy) * 1.6;
        const y = cy + R * b.ay * bloom * noise2(b.sx, drift * b.rate + b.sy) * 1.6;
        const radius = Math.max(R * b.size * bloom * (1 + level * .14), 1);
        const alpha = Math.min(b.weight * vivid * (.94 + level * .06), 1);
        const g = octx!.createRadialGradient(x, y, 0, x, y, radius);
        const [r, gr, bl] = b.color;
        g.addColorStop(0,   `rgba(${r},${gr},${bl},${alpha})`);
        g.addColorStop(.38, `rgba(${r},${gr},${bl},${alpha * .68})`);
        g.addColorStop(.72, `rgba(${r},${gr},${bl},${alpha * .22})`);
        g.addColorStop(1,   `rgba(${r},${gr},${bl},0)`);
        octx!.fillStyle = g;
        octx!.fillRect(0, 0, box, box);
      }
      octx!.restore();

      ctx!.filter = `blur(${blurPx}px)`;
      ctx!.drawImage(off, 0, 0);
      ctx!.filter = 'none';

      // Grain goes on the body only. Painted over the whole box it lands on the trail
      // too, and since the trail is re-grained every frame it silts up into red speckle.
      if (patterns.length) {
        // Grain boils only while the body moves. Left running over a still mass it is a
        // shimmer nobody asked for, and the brief is that silence looks like silence.
        if (motion > .02) {
          grainClock += dt;
          if (grainClock > .07) { grainClock = 0; tile = (tile + 1) % patterns.length; }
        }
        ctx!.save();
        traceBlob(ctx!, cx, cy, R * bloom * .97, drift * 1.15, amp * (1 + level * .25), 1.7);
        ctx!.clip();
        ctx!.globalCompositeOperation = 'overlay';
        ctx!.globalAlpha = still ? grain * .6 : grain;
        ctx!.fillStyle = patterns[tile];
        ctx!.fillRect(0, 0, box, box);
        ctx!.globalAlpha = 1;
        ctx!.globalCompositeOperation = 'source-over';
        ctx!.restore();
      }

      frame = requestAnimationFrame(paint);
    }

    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [size]);

  return <div className={`orb orb-${state}`} style={{width:size, height:size}} aria-hidden="true">
    <canvas ref={canvasRef} style={{width:size, height:size}}/>
  </div>;
}
