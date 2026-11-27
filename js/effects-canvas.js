/* 60fps Canvas Effects Engine: Stars, Fireflies, Light Arcs, Roses, Hearts, Fireworks, Golden Dragon, Fire Phoenix, Confetti */
(function (root) {
  'use strict';

  function createEffectsEngine({ bgCanvas, fxCanvas }) {
    const bgCtx = bgCanvas ? bgCanvas.getContext('2d') : null;
    const fxCtx = fxCanvas ? fxCanvas.getContext('2d') : null;

    let bgW = 1080, bgH = 1920;
    let fxW = 900, fxH = 900;
    let rafId = null;
    let lastTime = performance.now();

    // Persistent ambient particles
    const stars = [];
    const shootingStars = [];
    const fireflies = [];

    // Transient effect arrays
    const fireworks = [];
    const sparks = [];
    const petals = [];
    const heartBeams = [];
    const arcs = [];
    const pulseRings = [];
    const dragons = [];
    const phoenixes = [];
    const confetti = [];

    // Lit province coordinates for subtle rotating rays on canvas
    let litNodes = [];

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (bgCanvas && bgCtx) {
        const rect = bgCanvas.getBoundingClientRect();
        bgW = Math.max(1, Math.round(rect.width || 1080));
        bgH = Math.max(1, Math.round(rect.height || 1920));
        bgCanvas.width = Math.round(bgW * dpr);
        bgCanvas.height = Math.round(bgH * dpr);
        bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        initStars();
      }
      if (fxCanvas && fxCtx) {
        const rect = fxCanvas.getBoundingClientRect();
        fxW = Math.max(1, Math.round(rect.width || 1040));
        fxH = Math.max(1, Math.round(rect.height || 780));
        fxCanvas.width = Math.round(fxW * dpr);
        fxCanvas.height = Math.round(fxH * dpr);
        fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        initFireflies();
      }
    }

    function initStars() {
      stars.length = 0;
      const count = 170;
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * bgW,
          y: Math.random() * bgH,
          r: 0.6 + Math.random() * 1.9,
          baseAlpha: 0.22 + Math.random() * 0.68,
          phase: Math.random() * Math.PI * 2,
          speed: 0.9 + Math.random() * 2.4,
          hue: Math.random() < 0.35 ? 46 : Math.random() < 0.7 ? 210 : 0,
          sat: Math.random() < 0.35 ? 95 : 50,
        });
      }
    }

    function initFireflies() {
      fireflies.length = 0;
      const count = 48;
      for (let i = 0; i < count; i++) {
        fireflies.push({
          x: Math.random() * fxW,
          y: Math.random() * fxH,
          vx: (Math.random() - 0.5) * 18,
          vy: -6 - Math.random() * 16,
          r: 1.4 + Math.random() * 2.6,
          phase: Math.random() * Math.PI * 2,
          speed: 1.5 + Math.random() * 2.8,
        });
      }
    }

    function setLitNodes(nodes) {
      litNodes = nodes || [];
    }

    // ---- Spawners ----

    function spawnPulseRing(x, y, color = '#ffd84d', maxR = 88) {
      pulseRings.push({
        x, y, r: 8, maxR, alpha: 1, color, lineWidth: 3.5,
      });
      pulseRings.push({
        x, y, r: 4, maxR: maxR * 0.68, alpha: 0.9, color: '#fff4c2', lineWidth: 2,
      });
    }

    function spawnLightArc(fromX, fromY, toX, toY) {
      const mx = (fromX + toX) * 0.5 - Math.max(70, Math.abs(toY - fromY) * 0.28);
      const my = (fromY + toY) * 0.5;
      arcs.push({
        x0: fromX, y0: fromY,
        cx: mx, cy: my,
        x1: toX, y1: toY,
        t: 0,
        duration: 1.15,
        hold: 2.2,
      });
      if (arcs.length > 8) arcs.shift();
    }

    function spawnFireworks(x, y, count = 2) {
      const palettes = [
        ['#ffe566', '#ffb703', '#fff8d6', '#ff7b00'],
        ['#ff5e8e', '#ffd166', '#ffffff', '#ff9f1c'],
        ['#56cfe1', '#ffe566', '#ffffff', '#72efdd'],
        ['#ff4d4d', '#ffd84d', '#ffae00', '#fff0b3'],
      ];
      for (let b = 0; b < count; b++) {
        const ox = x + (b === 0 ? 0 : (Math.random() - 0.5) * 110);
        const oy = y + (b === 0 ? 0 : (Math.random() - 0.5) * 90);
        const delay = b * 0.22;
        const palette = palettes[Math.floor(Math.random() * palettes.length)];
        fireworks.push({ x: ox, y: oy, delay, palette, burst: false });
      }
    }

    function explodeFirework(x, y, palette) {
      spawnPulseRing(x, y, palette[0], 68);
      const particles = 44;
      for (let i = 0; i < particles; i++) {
        const angle = (Math.PI * 2 * i) / particles + (Math.random() - 0.5) * 0.16;
        const speed = 55 + Math.random() * 145;
        sparks.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          gravity: 95,
          drag: 0.965,
          r: 1.8 + Math.random() * 2.4,
          color: palette[i % palette.length],
          life: 0,
          maxLife: 0.85 + Math.random() * 0.65,
          trail: [],
        });
      }
    }

    function spawnRoseRain(x, y) {
      spawnPulseRing(x, y, '#ff4d8d', 64);
      for (let i = 0; i < 24; i++) {
        petals.push({
          x: x + (Math.random() - 0.5) * 150,
          y: y - 70 - Math.random() * 90,
          vx: (Math.random() - 0.5) * 35,
          vy: 38 + Math.random() * 55,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 4,
          size: 5 + Math.random() * 6,
          life: 0,
          maxLife: 2.0 + Math.random() * 1.1,
          kind: 'rose',
        });
      }
    }

    function spawnHeartBeam(x, y) {
      spawnPulseRing(x, y, '#ff5e99', 82);
      heartBeams.push({
        x, y, life: 0, maxLife: 2.4,
      });
      for (let i = 0; i < 22; i++) {
        const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * 1.3;
        const spd = 45 + Math.random() * 90;
        petals.push({
          x: x + (Math.random() - 0.5) * 28,
          y: y + (Math.random() - 0.5) * 18,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          rot: 0,
          vrot: (Math.random() - 0.5) * 1.5,
          size: 7 + Math.random() * 8,
          life: 0,
          maxLife: 1.5 + Math.random() * 0.9,
          kind: 'heart',
        });
      }
    }

    function spawnGoldenDragon() {
      const fromLeft = Math.random() > 0.35;
      dragons.push({
        t: 0,
        duration: 4.8,
        p0: fromLeft ? { x: -120, y: fxH * 0.82 } : { x: fxW + 120, y: fxH * 0.80 },
        p1: fromLeft ? { x: fxW * 0.25, y: fxH * 0.15 } : { x: fxW * 0.72, y: fxH * 0.18 },
        p2: fromLeft ? { x: fxW * 0.78, y: fxH * 0.65 } : { x: fxW * 0.22, y: fxH * 0.60 },
        p3: fromLeft ? { x: fxW + 140, y: fxH * 0.14 } : { x: -140, y: fxH * 0.14 },
        history: [],
      });
    }

    function spawnFirePhoenix() {
      phoenixes.push({
        t: 0,
        duration: 4.6,
        p0: { x: -110, y: fxH * 0.74 },
        p1: { x: fxW * 0.34, y: fxH * 0.08 },
        p2: { x: fxW * 0.66, y: fxH * 0.48 },
        p3: { x: fxW + 130, y: fxH * 0.10 },
        history: [],
      });
    }

    function spawnConfetti(amount = 140) {
      const colors = ['#ffd84d', '#ff4d6d', '#38bdf8', '#4ade80', '#ffffff', '#f59e0b', '#c084fc'];
      for (let i = 0; i < amount; i++) {
        confetti.push({
          x: Math.random() * fxW,
          y: -20 - Math.random() * 240,
          vx: (Math.random() - 0.5) * 90,
          vy: 110 + Math.random() * 170,
          w: 6 + Math.random() * 7,
          h: 4 + Math.random() * 5,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 9,
          color: colors[i % colors.length],
          life: 0,
          maxLife: 3.4 + Math.random() * 1.8,
        });
      }
    }

    function spawnDaiChienBurst(cx, cy) {
      spawnPulseRing(cx, cy, '#ff3b3b', 180);
      spawnPulseRing(cx, cy, '#ffd84d', 140);
      spawnFireworks(cx, cy, 6);
      spawnGoldenDragon();
      spawnFirePhoenix();
      spawnConfetti(100);
    }

    // ---- Bezier helpers ----
    function cubicBezier(p0, p1, p2, p3, t) {
      const u = 1 - t;
      const tt = t * t, uu = u * u;
      const uuu = uu * u, ttt = tt * t;
      return {
        x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
        y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
      };
    }

    function quadBezier(x0, y0, cx, cy, x1, y1, t) {
      const u = 1 - t;
      return {
        x: u * u * x0 + 2 * u * t * cx + t * t * x1,
        y: u * u * y0 + 2 * u * t * cy + t * t * y1,
      };
    }

    // ---- Draw helpers ----

    function drawBackground(dt, nowSec) {
      if (!bgCtx) return;
      bgCtx.clearRect(0, 0, bgW, bgH);

      // Twinkling stars
      for (const s of stars) {
        const twinkle = 0.5 + 0.5 * Math.sin(nowSec * s.speed + s.phase);
        const alpha = s.baseAlpha * (0.35 + 0.65 * twinkle);
        bgCtx.beginPath();
        bgCtx.fillStyle = s.hue === 0
          ? `rgba(255,255,255,${alpha.toFixed(3)})`
          : `hsla(${s.hue}, ${s.sat}%, 85%, ${alpha.toFixed(3)})`;
        bgCtx.arc(s.x, s.y, s.r * (0.85 + 0.25 * twinkle), 0, Math.PI * 2);
        bgCtx.fill();

        if (s.r > 1.7 && twinkle > 0.78) {
          bgCtx.strokeStyle = `rgba(255, 240, 175, ${(alpha * 0.55).toFixed(3)})`;
          bgCtx.lineWidth = 0.8;
          const len = s.r * 3.2;
          bgCtx.beginPath();
          bgCtx.moveTo(s.x - len, s.y);
          bgCtx.lineTo(s.x + len, s.y);
          bgCtx.moveTo(s.x, s.y - len);
          bgCtx.lineTo(s.x, s.y + len);
          bgCtx.stroke();
        }
      }

      // Occasional subtle shooting star
      if (Math.random() < dt * 0.22 && shootingStars.length < 2) {
        shootingStars.push({
          x: Math.random() * bgW * 0.75 + bgW * 0.1,
          y: Math.random() * bgH * 0.35,
          vx: 380 + Math.random() * 220,
          vy: 140 + Math.random() * 110,
          life: 0,
          maxLife: 0.75,
        });
      }
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const st = shootingStars[i];
        st.life += dt;
        st.x += st.vx * dt;
        st.y += st.vy * dt;
        const p = st.life / st.maxLife;
        if (p >= 1) {
          shootingStars.splice(i, 1);
          continue;
        }
        const alpha = (1 - p) * 0.7;
        const grad = bgCtx.createLinearGradient(st.x, st.y, st.x - st.vx * 0.16, st.y - st.vy * 0.16);
        grad.addColorStop(0, `rgba(255, 245, 200, ${alpha.toFixed(3)})`);
        grad.addColorStop(1, 'rgba(255, 245, 200, 0)');
        bgCtx.strokeStyle = grad;
        bgCtx.lineWidth = 2;
        bgCtx.beginPath();
        bgCtx.moveTo(st.x, st.y);
        bgCtx.lineTo(st.x - st.vx * 0.16, st.y - st.vy * 0.16);
        bgCtx.stroke();
      }
    }

    function drawHeart(ctx, x, y, size, color, alpha) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(size / 16, size / 16);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.bezierCurveTo(-10, -4, -14, 6, 0, 14);
      ctx.bezierCurveTo(14, 6, 10, -4, 0, 4);
      ctx.fill();
      ctx.restore();
    }

    function drawDragon(ctx, d, dt, nowSec) {
      d.t += dt / d.duration;
      if (d.t >= 1.25) return false;
      const headT = Math.min(1, d.t);
      const pos = cubicBezier(d.p0, d.p1, d.p2, d.p3, headT);
      const wave = Math.sin(nowSec * 12) * 14;
      const head = { x: pos.x, y: pos.y + wave };

      if (d.t <= 1.05) {
        d.history.unshift(head);
        if (d.history.length > 46) d.history.pop();
        // Gold sparkle trail
        if (Math.random() < 0.75) {
          sparks.push({
            x: head.x + (Math.random() - 0.5) * 18,
            y: head.y + (Math.random() - 0.5) * 18,
            vx: (Math.random() - 0.5) * 30,
            vy: (Math.random() - 0.5) * 30 + 14,
            gravity: 12,
            drag: 0.96,
            r: 1.6 + Math.random() * 2.2,
            color: Math.random() < 0.5 ? '#ffe566' : '#ff9f1c',
            life: 0,
            maxLife: 0.65 + Math.random() * 0.4,
            trail: [],
          });
        }
      } else if (d.history.length > 0) {
        d.history.pop();
      }

      if (d.history.length < 3) return d.t < 1.2;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // Draw sinuous golden scales from tail to head
      for (let i = d.history.length - 1; i >= 0; i--) {
        const pt = d.history[i];
        const ratio = 1 - i / d.history.length;
        const radius = 3.5 + Math.sin(ratio * Math.PI) * 14 + (i === 0 ? 5 : 0);
        const grad = ctx.createRadialGradient(pt.x, pt.y, 1, pt.x, pt.y, radius * 1.6);
        grad.addColorStop(0, 'rgba(255, 250, 210, 0.95)');
        grad.addColorStop(0.45, 'rgba(255, 200, 45, 0.85)');
        grad.addColorStop(1, 'rgba(245, 130, 10, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius * 1.6, 0, Math.PI * 2);
        ctx.fill();

        // Dorsal golden spines
        if (i % 3 === 1 && i < d.history.length - 2) {
          const prev = d.history[i - 1];
          const ang = Math.atan2(prev.y - pt.y, prev.x - pt.x) - Math.PI * 0.5;
          ctx.strokeStyle = 'rgba(255, 232, 120, 0.85)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(pt.x + Math.cos(ang) * (radius + 9), pt.y + Math.sin(ang) * (radius + 9));
          ctx.stroke();
        }
      }

      // Glowing Dragon Head + Horns + Whiskers
      const h0 = d.history[0];
      const h1 = d.history[1];
      const angle = Math.atan2(h0.y - h1.y, h0.x - h1.x);
      ctx.translate(h0.x, h0.y);
      ctx.rotate(angle);

      ctx.fillStyle = '#ffd84d';
      ctx.beginPath();
      ctx.ellipse(4, 0, 18, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      // Horns
      ctx.strokeStyle = '#fff3b0';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-4, -7);
      ctx.lineTo(-18, -20);
      ctx.moveTo(-4, 7);
      ctx.lineTo(-18, 20);
      ctx.stroke();

      // Flowing whiskers
      ctx.strokeStyle = 'rgba(255, 240, 170, 0.9)';
      ctx.lineWidth = 1.6;
      const wWave = Math.sin(nowSec * 16) * 5;
      ctx.beginPath();
      ctx.moveTo(16, -4);
      ctx.quadraticCurveTo(28, -14 + wWave, 36, -6 - wWave);
      ctx.moveTo(16, 4);
      ctx.quadraticCurveTo(28, 14 - wWave, 36, 6 + wWave);
      ctx.stroke();

      // Blazing eye
      ctx.fillStyle = '#ff2a2a';
      ctx.beginPath();
      ctx.arc(8, -4, 3, 0, Math.PI * 2);
      ctx.arc(8, 4, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      return true;
    }

    function drawPhoenix(ctx, p, dt, nowSec) {
      p.t += dt / p.duration;
      if (p.t >= 1.25) return false;
      const headT = Math.min(1, p.t);
      const pos = cubicBezier(p.p0, p.p1, p.p2, p.p3, headT);
      const bob = Math.sin(nowSec * 9) * 10;
      const head = { x: pos.x, y: pos.y + bob };

      if (p.t <= 1.05) {
        p.history.unshift(head);
        if (p.history.length > 38) p.history.pop();
        // Fire embers
        for (let e = 0; e < 2; e++) {
          sparks.push({
            x: head.x + (Math.random() - 0.5) * 26,
            y: head.y + (Math.random() - 0.5) * 26,
            vx: (Math.random() - 0.5) * 45,
            vy: -15 + (Math.random() - 0.5) * 35,
            gravity: -18,
            drag: 0.95,
            r: 2 + Math.random() * 2.5,
            color: Math.random() < 0.5 ? '#ff4d00' : '#ffd84d',
            life: 0,
            maxLife: 0.7 + Math.random() * 0.45,
            trail: [],
          });
        }
      } else if (p.history.length > 0) {
        p.history.pop();
      }

      if (p.history.length < 3) return p.t < 1.2;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // 3 Flowing Fire Tail Ribbons
      for (let r = -1; r <= 1; r++) {
        ctx.beginPath();
        for (let i = 0; i < p.history.length; i++) {
          const pt = p.history[i];
          const spread = (i / p.history.length) * 24 * r + Math.sin(nowSec * 14 + i * 0.4 + r) * 5;
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y + spread);
        }
        ctx.strokeStyle = r === 0 ? 'rgba(255, 224, 102, 0.85)' : 'rgba(255, 72, 0, 0.65)';
        ctx.lineWidth = r === 0 ? 5 : 3.2;
        ctx.stroke();
      }

      // Flapping Phoenix Body & Wings
      const h0 = p.history[0];
      const h1 = p.history[1];
      const angle = Math.atan2(h0.y - h1.y, h0.x - h1.x);
      ctx.translate(h0.x, h0.y);
      ctx.rotate(angle);

      const flap = Math.sin(nowSec * 15) * 24;
      // Glowing aura
      const aura = ctx.createRadialGradient(0, 0, 4, 0, 0, 56);
      aura.addColorStop(0, 'rgba(255, 245, 180, 0.95)');
      aura.addColorStop(0.4, 'rgba(255, 110, 0, 0.65)');
      aura.addColorStop(1, 'rgba(255, 30, 0, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, 56, 0, Math.PI * 2);
      ctx.fill();

      // Left & Right Flame Wings
      const wingGrad = ctx.createLinearGradient(0, -45, 0, 45);
      wingGrad.addColorStop(0, '#ff3d00');
      wingGrad.addColorStop(0.5, '#ffd84d');
      wingGrad.addColorStop(1, '#ff3d00');
      ctx.fillStyle = wingGrad;

      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.quadraticCurveTo(-8, -38 - flap * 0.5, -34, -46 + flap);
      ctx.quadraticCurveTo(-18, -14, -8, 0);
      ctx.quadraticCurveTo(-18, 14, -34, 46 - flap);
      ctx.quadraticCurveTo(-8, 38 + flap * 0.5, 10, 0);
      ctx.fill();

      // Golden Beak & Crest
      ctx.fillStyle = '#fff7cc';
      ctx.beginPath();
      ctx.moveTo(24, 0);
      ctx.lineTo(8, -6);
      ctx.lineTo(8, 6);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
      return true;
    }

    function drawFx(dt, nowSec) {
      if (!fxCtx) return;
      fxCtx.clearRect(0, 0, fxW, fxH);

      // 1. Subtle rotating golden sunbeams on lit provinces
      if (litNodes.length > 0) {
        fxCtx.save();
        fxCtx.globalCompositeOperation = 'lighter';
        for (const node of litNodes) {
          const rot = nowSec * 0.45 + node.phase;
          const rayCount = 6;
          const rOuter = node.hot ? 42 : 24;
          fxCtx.save();
          fxCtx.translate(node.x, node.y);
          fxCtx.rotate(rot);
          for (let r = 0; r < rayCount; r++) {
            const a = (Math.PI * 2 * r) / rayCount;
            const grad = fxCtx.createLinearGradient(0, 0, Math.cos(a) * rOuter, Math.sin(a) * rOuter);
            grad.addColorStop(0, node.hot ? 'rgba(255, 232, 120, 0.34)' : 'rgba(255, 215, 75, 0.16)');
            grad.addColorStop(1, 'rgba(255, 215, 75, 0)');
            fxCtx.strokeStyle = grad;
            fxCtx.lineWidth = node.hot ? 3.2 : 1.8;
            fxCtx.beginPath();
            fxCtx.moveTo(0, 0);
            fxCtx.lineTo(Math.cos(a) * rOuter, Math.sin(a) * rOuter);
            fxCtx.stroke();
          }
          fxCtx.restore();
        }
        fxCtx.restore();
      }

      // 2. Continuous ambient golden fireflies drifting across map
      for (const f of fireflies) {
        f.x += (f.vx + Math.sin(nowSec * 1.4 + f.phase) * 10) * dt;
        f.y += f.vy * dt;
        if (f.y < -10) { f.y = fxH + 10; f.x = Math.random() * fxW; }
        if (f.x < -10) f.x = fxW + 10;
        if (f.x > fxW + 10) f.x = -10;

        const glow = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(nowSec * f.speed + f.phase));
        const grad = fxCtx.createRadialGradient(f.x, f.y, 0.2, f.x, f.y, f.r * 3.8);
        grad.addColorStop(0, `rgba(255, 248, 196, ${(glow * 0.95).toFixed(3)})`);
        grad.addColorStop(0.45, `rgba(255, 200, 55, ${(glow * 0.45).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(255, 190, 40, 0)');
        fxCtx.fillStyle = grad;
        fxCtx.beginPath();
        fxCtx.arc(f.x, f.y, f.r * 3.8, 0, Math.PI * 2);
        fxCtx.fill();
      }

      // 3. Curved dotted light arcs (like the screenshot!)
      for (let i = arcs.length - 1; i >= 0; i--) {
        const a = arcs[i];
        a.t += dt;
        const progress = Math.min(1, a.t / a.duration);
        const fade = a.t > a.duration ? Math.max(0, 1 - (a.t - a.duration) / a.hold) : 1;
        if (fade <= 0) {
          arcs.splice(i, 1);
          continue;
        }

        fxCtx.save();
        fxCtx.setLineDash([4, 6]);
        fxCtx.strokeStyle = `rgba(175, 225, 255, ${(fade * 0.55).toFixed(3)})`;
        fxCtx.lineWidth = 1.6;
        fxCtx.beginPath();
        const steps = 28;
        const maxStep = Math.max(1, Math.floor(steps * progress));
        for (let s = 0; s <= maxStep; s++) {
          const pt = quadBezier(a.x0, a.y0, a.cx, a.cy, a.x1, a.y1, s / steps);
          if (s === 0) fxCtx.moveTo(pt.x, pt.y);
          else fxCtx.lineTo(pt.x, pt.y);
        }
        fxCtx.stroke();
        fxCtx.setLineDash([]);

        // Glowing comet head along the arc
        if (progress < 1) {
          const head = quadBezier(a.x0, a.y0, a.cx, a.cy, a.x1, a.y1, progress);
          const g = fxCtx.createRadialGradient(head.x, head.y, 1, head.x, head.y, 14);
          g.addColorStop(0, 'rgba(255, 255, 230, 1)');
          g.addColorStop(0.5, 'rgba(255, 212, 70, 0.75)');
          g.addColorStop(1, 'rgba(255, 200, 40, 0)');
          fxCtx.fillStyle = g;
          fxCtx.beginPath();
          fxCtx.arc(head.x, head.y, 14, 0, Math.PI * 2);
          fxCtx.fill();
        }
        fxCtx.restore();
      }

      // 4. Expanding light pulse rings
      for (let i = pulseRings.length - 1; i >= 0; i--) {
        const ring = pulseRings[i];
        ring.r += (ring.maxR - ring.r) * Math.min(1, dt * 4.5) + dt * 28;
        ring.alpha -= dt * 1.15;
        if (ring.alpha <= 0) {
          pulseRings.splice(i, 1);
          continue;
        }
        fxCtx.save();
        fxCtx.strokeStyle = ring.color;
        fxCtx.globalAlpha = Math.max(0, ring.alpha);
        fxCtx.lineWidth = ring.lineWidth;
        fxCtx.beginPath();
        fxCtx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
        fxCtx.stroke();
        fxCtx.restore();
      }

      // 5. Heart Light Beams (5 KC gift)
      for (let i = heartBeams.length - 1; i >= 0; i--) {
        const b = heartBeams[i];
        b.life += dt;
        const p = b.life / b.maxLife;
        if (p >= 1) {
          heartBeams.splice(i, 1);
          continue;
        }
        const alpha = Math.sin(p * Math.PI) * 0.65;
        const beamW = 36 + Math.sin(nowSec * 12) * 8;
        const grad = fxCtx.createLinearGradient(b.x, b.y + 10, b.x, Math.max(0, b.y - 260));
        grad.addColorStop(0, `rgba(255, 110, 170, ${alpha.toFixed(3)})`);
        grad.addColorStop(0.45, `rgba(255, 220, 110, ${(alpha * 0.7).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(255, 220, 110, 0)');
        fxCtx.save();
        fxCtx.globalCompositeOperation = 'lighter';
        fxCtx.fillStyle = grad;
        fxCtx.beginPath();
        fxCtx.moveTo(b.x - beamW * 0.35, b.y + 6);
        fxCtx.lineTo(b.x + beamW * 0.35, b.y + 6);
        fxCtx.lineTo(b.x + beamW * 1.15, Math.max(0, b.y - 260));
        fxCtx.lineTo(b.x - beamW * 1.15, Math.max(0, b.y - 260));
        fxCtx.closePath();
        fxCtx.fill();
        fxCtx.restore();
      }

      // 6. Delayed fireworks queue
      for (let i = fireworks.length - 1; i >= 0; i--) {
        const fw = fireworks[i];
        fw.delay -= dt;
        if (fw.delay <= 0) {
          explodeFirework(fw.x, fw.y, fw.palette);
          fireworks.splice(i, 1);
        }
      }

      // 7. Sparks (fireworks + dragon/phoenix trails)
      fxCtx.save();
      fxCtx.globalCompositeOperation = 'lighter';
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        sp.life += dt;
        if (sp.life >= sp.maxLife) {
          sparks.splice(i, 1);
          continue;
        }
        sp.trail.push({ x: sp.x, y: sp.y });
        if (sp.trail.length > 5) sp.trail.shift();

        sp.vx *= sp.drag;
        sp.vy = sp.vy * sp.drag + sp.gravity * dt;
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;

        const alpha = 1 - sp.life / sp.maxLife;
        if (sp.trail.length > 1) {
          fxCtx.strokeStyle = sp.color;
          fxCtx.globalAlpha = alpha * 0.55;
          fxCtx.lineWidth = sp.r * 0.9;
          fxCtx.beginPath();
          fxCtx.moveTo(sp.trail[0].x, sp.trail[0].y);
          for (let t = 1; t < sp.trail.length; t++) {
            fxCtx.lineTo(sp.trail[t].x, sp.trail[t].y);
          }
          fxCtx.stroke();
        }
        fxCtx.fillStyle = sp.color;
        fxCtx.globalAlpha = alpha;
        fxCtx.beginPath();
        fxCtx.arc(sp.x, sp.y, sp.r * (0.4 + 0.6 * alpha), 0, Math.PI * 2);
        fxCtx.fill();
      }
      fxCtx.restore();

      // 8. Rose petals & floating hearts
      for (let i = petals.length - 1; i >= 0; i--) {
        const p = petals[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          petals.splice(i, 1);
          continue;
        }
        p.x += (p.vx + Math.sin(nowSec * 5 + i) * 16) * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
        const alpha = Math.min(1, (1 - p.life / p.maxLife) * 1.35);

        if (p.kind === 'heart') {
          drawHeart(fxCtx, p.x, p.y, p.size, '#ff4d8d', alpha);
        } else {
          fxCtx.save();
          fxCtx.translate(p.x, p.y);
          fxCtx.rotate(p.rot);
          fxCtx.globalAlpha = alpha;
          fxCtx.fillStyle = i % 2 === 0 ? '#ff3b7a' : '#ff7aa8';
          fxCtx.beginPath();
          fxCtx.ellipse(0, 0, p.size, p.size * 0.58, 0, 0, Math.PI * 2);
          fxCtx.fill();
          fxCtx.restore();
        }
      }

      // 9. Golden Dragons (50+ KC)
      for (let i = dragons.length - 1; i >= 0; i--) {
        if (!drawDragon(fxCtx, dragons[i], dt, nowSec)) {
          dragons.splice(i, 1);
        }
      }

      // 10. Fire Phoenixes (100+ KC)
      for (let i = phoenixes.length - 1; i >= 0; i--) {
        if (!drawPhoenix(fxCtx, phoenixes[i], dt, nowSec)) {
          phoenixes.splice(i, 1);
        }
      }

      // 11. Victory Confetti Rain
      for (let i = confetti.length - 1; i >= 0; i--) {
        const c = confetti[i];
        c.life += dt;
        if (c.life >= c.maxLife || c.y > fxH + 30) {
          confetti.splice(i, 1);
          continue;
        }
        c.x += (c.vx + Math.sin(nowSec * 4 + i) * 28) * dt;
        c.y += c.vy * dt;
        c.rot += c.vrot * dt;
        const alpha = Math.min(1, (1 - c.life / c.maxLife) * 1.4);
        fxCtx.save();
        fxCtx.translate(c.x, c.y);
        fxCtx.rotate(c.rot);
        fxCtx.globalAlpha = alpha;
        fxCtx.fillStyle = c.color;
        fxCtx.fillRect(-c.w * 0.5, -c.h * 0.5, c.w, c.h * Math.abs(Math.cos(c.rot)));
        fxCtx.restore();
      }
    }

    function frame(now) {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      const nowSec = now / 1000;
      drawBackground(dt, nowSec);
      drawFx(dt, nowSec);
      rafId = requestAnimationFrame(frame);
    }

    function start() {
      resize();
      if (!rafId) {
        lastTime = performance.now();
        rafId = requestAnimationFrame(frame);
      }
    }

    function stop() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    return {
      start,
      stop,
      resize,
      setLitNodes,
      spawnPulseRing,
      spawnLightArc,
      spawnFireworks,
      spawnRoseRain,
      spawnHeartBeam,
      spawnGoldenDragon,
      spawnFirePhoenix,
      spawnConfetti,
      spawnDaiChienBurst,
      getCanvasSize: () => ({ width: fxW, height: fxH }),
    };
  }

  root.VietnamEffects = { createEffectsEngine };
})(typeof self !== 'undefined' ? self : this);
