import { useEffect, useRef } from 'react';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

// Warm palette anchored on the ElevenLabs orange already in the design system,
// opened up with amber, rose and a violet edge so the mass reads as depth, not a flat disc.
const BLOBS = [
  {color:[255,206,88],  ax:.44, ay:.38, fx:.17, fy:.23, px:0.0, py:1.9, size:.92, weight:1.0},
  {color:[255,86,10],   ax:.40, ay:.46, fx:.23, fy:.15, px:2.3, py:0.4, size:.76, weight:1.0},
  {color:[236,25,112],  ax:.46, ay:.36, fx:.13, fy:.27, px:4.1, py:3.3, size:.72, weight:1.0},
  {color:[140,52,240],  ax:.38, ay:.44, fx:.29, fy:.19, px:5.6, py:1.1, size:.94, weight:.52},
  {color:[255,146,38],  ax:.34, ay:.32, fx:.21, fy:.31, px:1.2, py:5.0, size:.78, weight:1.0},
];

// Per-state targets: how vivid the colour is, how wide the mass sits, how fast it drifts.
const TARGETS: Record<OrbState, {vivid:number; scale:number; speed:number; spread:number}> = {
  idle:      {vivid:.74, scale:.92, speed:.55, spread:.88},
  listening: {vivid:.93, scale:.98, speed:.85, spread:1.0},
  thinking:  {vivid:.88, scale:.89, speed:1.5, spread:.76},
  speaking:  {vivid:1.0, scale:1.04, speed:1.25, spread:1.08},
};

const lerp = (a:number, b:number, t:number) => a + (b - a) * t;

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
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const R = (size * dpr) / 2;

    // Animated values, eased towards the current state's targets so nothing ever snaps.
    let vivid = TARGETS.idle.vivid, scale = TARGETS.idle.scale, spread = TARGETS.idle.spread;
    let level = 0, drift = 0, frame = 0, last = performance.now();

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
      vivid = lerp(vivid, target.vivid, ease);
      scale = lerp(scale, target.scale, ease);
      spread = lerp(spread, target.spread, ease);
      if (!still) drift += dt * target.speed * (1 + level * .9);

      // Breathing keeps the orb alive while nobody is talking.
      const breathe = still ? 0 : Math.sin(drift * .9) * .012;
      const bloom = scale + breathe + level * .085;

      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      ctx!.save();
      ctx!.beginPath();
      ctx!.arc(R, R, R * .995, 0, Math.PI * 2);
      ctx!.clip();

      // Saturated base: the blobs paint over colour, never over near-white,
      // which is what turns a stack of warm gradients into beige.
      const base = ctx!.createRadialGradient(R * .8, R * .75, 0, R, R, R * 1.15);
      base.addColorStop(0, '#ff8c2a');
      base.addColorStop(.62, '#e42a5c');
      base.addColorStop(1, '#8d1046');
      ctx!.fillStyle = base;
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height);

      for (const b of BLOBS) {
        const x = R + R * b.ax * spread * Math.sin(drift * b.fx * 2.4 + b.px) * bloom;
        const y = R + R * b.ay * spread * Math.cos(drift * b.fy * 2.4 + b.py) * bloom;
        const radius = R * b.size * spread * bloom * (1 + level * .12);
        // Opaque cores, soft falloff: each blob owns its region and only blends at the seams.
        const alpha = Math.min(b.weight * vivid * (.94 + level * .06), 1);
        const gradient = ctx!.createRadialGradient(x, y, 0, x, y, radius);
        const [r, g, bl] = b.color;
        gradient.addColorStop(0,   `rgba(${r},${g},${bl},${alpha})`);
        gradient.addColorStop(.34, `rgba(${r},${g},${bl},${alpha * .72})`);
        gradient.addColorStop(.68, `rgba(${r},${g},${bl},${alpha * .24})`);
        gradient.addColorStop(1,   `rgba(${r},${g},${bl},0)`);
        ctx!.fillStyle = gradient;
        ctx!.fillRect(0, 0, canvas!.width, canvas!.height);
      }

      if (vivid < .99) { ctx!.fillStyle = `rgba(255,247,240,${(1 - vivid) * .55})`; ctx!.fillRect(0, 0, canvas!.width, canvas!.height); }

      // Glass rim: a light top-left sheen and a soft darkening at the edge.
      const sheen = ctx!.createRadialGradient(R * .68, R * .58, 0, R, R, R);
      sheen.addColorStop(0, 'rgba(255,255,255,.16)');
      sheen.addColorStop(.5, 'rgba(255,255,255,0)');
      sheen.addColorStop(1, 'rgba(90,10,45,.30)');
      ctx!.fillStyle = sheen;
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height);
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
