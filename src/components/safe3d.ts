import * as THREE from 'three';

/** Comic-style 3D safe for the student-number picker. Loaded on demand (dynamic import) so three.js
 *  stays out of the main bundle. Flat toon shading + black inverted-hull outlines = comic ink look. */

const C = { navy: '#14213D', dblue: '#263C68', steel: '#33548f', gold: '#FCA311', cream: '#FFF8E8', red: '#B93838', ink: '#0b0f1a', manila: '#E9C877' };
const FONT = 'Prompt, "IBM Plex Sans Thai", sans-serif';

export interface Safe {
  /** spin the dial through `nums`, land on `result`, open the door and pull the file out */
  spin(result: number, nums: number[], onTick: () => void): Promise<void>;
  /** close the door and put the file back (ready for the next draw) */
  reset(): void;
  dispose(): void;
}

const ease = { out: (t: number) => 1 - (1 - t) ** 3, inOut: (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  back: (t: number) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2 };

function canvasTex(w: number, h: number) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return { ctx: cv.getContext('2d')!, tex, w, h };
}

export async function createSafe(canvas: HTMLCanvasElement, speed: number): Promise<Safe> {
  await Promise.all([document.fonts.load(`700 60px Prompt`), document.fonts.load(`600 40px Prompt`)]).catch(() => undefined);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); // throws without WebGL; caller falls back
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 0.5, 8); camera.lookAt(0, 0.1, 0);

  scene.add(new THREE.AmbientLight('#ffffff', 1.1));
  const sun = new THREE.DirectionalLight('#fff3d6', 2.2); sun.position.set(3, 5, 6); scene.add(sun);
  const glow = new THREE.PointLight(C.gold, 0, 6); glow.position.set(0, 0, 0.6); scene.add(glow);

  // 3-step toon ramp: hard comic shadows
  const ramp = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
  const toon = (color: string) => new THREE.MeshToonMaterial({ color, gradientMap: ramp });
  const inkMat = new THREE.MeshBasicMaterial({ color: C.ink, side: THREE.BackSide });
  const ink = <T extends THREE.Mesh>(m: T, s = 1.05): T => { const o = new THREE.Mesh(m.geometry, inkMat); o.scale.setScalar(s); m.add(o); return m; };
  const box = (w: number, h: number, d: number, color: string, outline = 1.04) => ink(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(color)), outline);

  const W = 2.4, H = 2.8, D = 2, T = 0.18;
  const safe = new THREE.Group(); scene.add(safe);
  // hollow body so the open door shows the inside
  const body: [number, number, number, number, number, number][] = [
    [W, H, T, 0, 0, -D / 2 + T / 2], [T, H, D, -W / 2 + T / 2, 0, 0], [T, H, D, W / 2 - T / 2, 0, 0],
    [W, T, D, 0, H / 2 - T / 2, 0], [W, T, D, 0, -H / 2 + T / 2, 0]];
  for (const [w, h, d, x, y, z] of body) { const m = box(w, h, d, C.dblue, 1.02); m.position.set(x, y, z); safe.add(m); }
  const inside = new THREE.Mesh(new THREE.PlaneGeometry(W - 2 * T, H - 2 * T), new THREE.MeshBasicMaterial({ color: '#0d1426' }));
  inside.position.z = -D / 2 + T + 0.01; safe.add(inside);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const f = box(0.35, 0.25, 0.35, C.gold); f.position.set(x * (W / 2 - 0.3), -H / 2 - 0.12, z * (D / 2 - 0.3)); safe.add(f); }
  const trim = box(W + 0.08, 0.12, D + 0.08, C.gold); trim.position.y = H / 2 + 0.02; safe.add(trim);

  // door on a hinge at the left front edge
  const hinge = new THREE.Group(); hinge.position.set(-W / 2, 0, D / 2); safe.add(hinge);
  const door = new THREE.Group(); door.position.set(W / 2, 0, 0.11); hinge.add(door);
  door.add(box(W - 0.02, H - 0.02, 0.2, C.steel, 1.03));
  const plate = box(W - 0.5, H - 0.5, 0.04, C.dblue, 1.01); plate.position.z = 0.11; door.add(plate);
  for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const b = ink(new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), toon(C.gold))); b.position.set(x * (W / 2 - 0.16), y * (H / 2 - 0.16), 0.11); door.add(b);
  }
  for (const y of [0.85, -0.85]) {
    const h = ink(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 12), toon(C.gold))); h.position.set(-W / 2 - 0.02, y, 0.02); door.add(h);
  }

  // counter window: shuffling student numbers
  const counter = canvasTex(512, 220);
  const drawCounter = (text: string, hot = false) => {
    const { ctx, w, h } = counter;
    ctx.fillStyle = C.ink; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = hot ? C.gold : '#6b7a99'; ctx.lineWidth = 14; ctx.strokeRect(7, 7, w - 14, h - 14);
    ctx.fillStyle = '#7f8db0'; ctx.font = `600 40px ${FONT}`; ctx.textBaseline = 'middle'; ctx.fillText('เลขที่', 30, h / 2);
    ctx.fillStyle = hot ? C.gold : '#ffd479'; ctx.font = `700 150px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(text, w / 2 + 60, h / 2 + 8); ctx.textAlign = 'left';
    counter.tex.needsUpdate = true;
  };
  drawCounter('?');
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.54), new THREE.MeshBasicMaterial({ map: counter.tex }));
  win.position.set(0, 0.86, 0.14); door.add(win);
  const winFrame = box(1.37, 0.66, 0.03, C.gold, 1.02); winFrame.position.set(0, 0.86, 0.12); door.add(winFrame);

  // dial with ticks and numbers
  const face = canvasTex(512, 512);
  { const { ctx } = face; ctx.fillStyle = C.cream; ctx.beginPath(); ctx.arc(256, 256, 256, 0, 7); ctx.fill();
    ctx.strokeStyle = C.navy; ctx.fillStyle = C.navy; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 42px ${FONT}`;
    for (let i = 0; i < 100; i++) {
      const a = (i / 100) * Math.PI * 2 - Math.PI / 2, big = i % 10 === 0;
      ctx.lineWidth = big ? 8 : 3; ctx.beginPath();
      ctx.moveTo(256 + Math.cos(a) * 240, 256 + Math.sin(a) * 240); ctx.lineTo(256 + Math.cos(a) * (big ? 200 : 222), 256 + Math.sin(a) * (big ? 200 : 222)); ctx.stroke();
      if (big) ctx.fillText(String(i), 256 + Math.cos(a) * 160, 256 + Math.sin(a) * 160);
    }
    ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(256, 256, 70, 0, 7); ctx.fill(); ctx.lineWidth = 10; ctx.stroke();
    face.tex.needsUpdate = true; }
  const dial = new THREE.Group(); dial.position.set(-0.25, -0.35, 0.14); door.add(dial);
  const disc = ink(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.16, 48), toon(C.gold)), 1.04); disc.rotation.x = Math.PI / 2; dial.add(disc);
  const faceMesh = new THREE.Mesh(new THREE.CircleGeometry(0.56, 48), new THREE.MeshBasicMaterial({ map: face.tex })); faceMesh.position.z = 0.085; dial.add(faceMesh);
  const pointer = ink(new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 3), toon(C.red)), 1.15);
  pointer.rotation.z = Math.PI; pointer.position.set(-0.25, 0.42, 0.2); door.add(pointer);

  // handle: three spokes
  const handle = new THREE.Group(); handle.position.set(0.72, -0.35, 0.2); door.add(handle);
  handle.add(ink(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.14, 20), toon(C.gold))).rotateX(Math.PI / 2));
  for (let k = 0; k < 3; k++) {
    const s = new THREE.Group(); s.rotation.z = (k * Math.PI * 2) / 3; handle.add(s);
    const bar = ink(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.42, 10), toon(C.gold)), 1.2); bar.position.y = 0.24; s.add(bar);
    const knob = ink(new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), toon(C.red))); knob.position.y = 0.46; s.add(knob);
  }

  // secret file inside
  const fileTex = canvasTex(640, 480);
  const drawFile = (n: number | null) => {
    const { ctx, w, h } = fileTex;
    ctx.fillStyle = C.manila; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d9b45c'; ctx.fillRect(0, 0, w, 54); ctx.fillRect(30, 0, 200, 70);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 12; ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.save(); ctx.translate(w - 150, 120); ctx.rotate(-0.22);
    ctx.strokeStyle = C.red; ctx.fillStyle = C.red; ctx.lineWidth = 7; ctx.strokeRect(-120, -40, 240, 80);
    ctx.font = `700 46px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('ลับสุดยอด', 0, 4); ctx.restore();
    ctx.fillStyle = C.navy; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `600 44px ${FONT}`; ctx.fillText('ผู้ต้องสงสัยหมายเลข', w / 2, 200);
    ctx.font = `700 190px ${FONT}`; ctx.fillText(n === null ? '?' : String(n), w / 2, 340);
    fileTex.tex.needsUpdate = true;
  };
  drawFile(null);
  const file = new THREE.Group(); safe.add(file);
  file.add(box(1.6, 1.2, 0.05, C.manila, 1.03));
  const fileFace = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), new THREE.MeshBasicMaterial({ map: fileTex.tex })); fileFace.position.z = 0.03; file.add(fileFace);
  const FILE_IN = new THREE.Vector3(0, -0.2, -0.25);
  file.position.copy(FILE_IN);

  // comic "POW" burst behind the revealed file
  const star = (r1: number, r2: number) => { const s = new THREE.Shape(); for (let i = 0; i <= 32; i++) { const a = (i / 32) * Math.PI * 2, r = i % 2 ? r2 : r1 * (0.85 + 0.15 * Math.sin(i * 7)); i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(r, 0); } return new THREE.ShapeGeometry(s); };
  const burst = new THREE.Group(); burst.position.set(0, 0.6, 1.4); burst.scale.setScalar(0); scene.add(burst);
  const b1 = new THREE.Mesh(star(2.3, 1.45), new THREE.MeshBasicMaterial({ color: C.ink })); burst.add(b1);
  const b2 = new THREE.Mesh(star(2.15, 1.35), new THREE.MeshBasicMaterial({ color: C.gold })); b2.position.z = 0.01; burst.add(b2);
  const b3 = new THREE.Mesh(star(1.5, 1.0), new THREE.MeshBasicMaterial({ color: C.cream })); b3.position.z = 0.02; burst.add(b3);

  // ---------- render loop ----------
  const k = Math.max(0.15, 1 / speed); // user's animation speed
  let raf = 0, last = performance.now(), idleT = 0, shake = 0, dialV = 0.4;
  let anim: ((now: number) => boolean) | null = null;
  const resize = () => {
    const p = canvas.parentElement!; const w = p.clientWidth, h = p.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.position.z = w / h < 0.9 ? 10.5 : 8; // portrait: step back so the whole safe fits
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize); ro.observe(canvas.parentElement!); resize();
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; idleT += dt;
    if (anim && !anim(now)) anim = null;
    dial.rotation.z -= dialV * dt;
    safe.rotation.y = Math.sin(idleT * 0.6) * 0.18 - 0.12;
    safe.position.set((Math.random() - 0.5) * shake, -0.25 + Math.sin(idleT * 1.3) * 0.04 + (Math.random() - 0.5) * shake, 0);
    burst.rotation.z += dt * 0.4;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  /** run one timed step; resolves when done */
  const step = (ms: number, f: (t: number) => void) => new Promise<void>((res) => {
    const t0 = performance.now(), dur = ms * k;
    anim = (now) => { const t = Math.min(1, (now - t0) / dur); f(t); if (t >= 1) { res(); return false; } return true; };
  });

  function closeNow() {
    hinge.rotation.y = 0; handle.rotation.z = 0; glow.intensity = 0; burst.scale.setScalar(0);
    safe.add(file); file.position.copy(FILE_IN); file.rotation.set(0, 0, 0); file.scale.setScalar(1);
    dialV = 0.4; shake = 0; drawFile(null); drawCounter('?');
  }

  return {
    async spin(result, nums, onTick) {
      closeNow();
      drawFile(result);
      let shown = -1, nextAt = 0;
      await step(2800, (t) => {
        dialV = 16 * (1 - t) ** 2 + 0.2; shake = 0.05 * (1 - t);
        if (t >= nextAt && t < 1) {                       // ticks slow down like a dial clicking into place
          let n = nums[Math.floor(Math.random() * nums.length)];
          if (nums.length > 1) while (n === shown) n = nums[Math.floor(Math.random() * nums.length)];
          shown = n; drawCounter(String(n)); onTick();
          nextAt = t + 0.02 + 0.13 * t ** 2;
        }
        if (t >= 1) { drawCounter(String(result), true); shake = 0; }
      });
      await step(450, (t) => { handle.rotation.z = -ease.back(t) * Math.PI / 2; });
      await step(900, (t) => { hinge.rotation.y = -1.95 * ease.back(t); glow.intensity = 3 * t; });
      // bring the file to the camera (scene space, so the swaying safe does not carry it)
      scene.attach(file);
      const from = file.position.clone(), to = new THREE.Vector3(0, 0.6, 2.4), q0 = file.quaternion.clone(), q1 = new THREE.Quaternion();
      await step(1000, (t) => {
        const e = ease.out(t);
        file.position.lerpVectors(from, to, e); file.position.y += Math.sin(t * Math.PI) * 0.6;
        file.quaternion.slerpQuaternions(q0, q1, e); file.rotation.z = Math.sin(t * Math.PI * 2) * 0.15 * (1 - t);
        file.scale.setScalar(1 + 0.15 * e);
        burst.scale.setScalar(ease.back(Math.max(0, t * 1.4 - 0.4)));
      });
    },
    reset() { anim = null; closeNow(); },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect();
      scene.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); const m = o.material as THREE.MeshBasicMaterial; m.map?.dispose(); m.dispose(); } });
      ramp.dispose(); renderer.dispose();
    },
  };
}
