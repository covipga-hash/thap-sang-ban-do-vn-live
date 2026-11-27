/* Main UI Controller for "Thắp Sáng Bản Đồ Việt Nam" */
(function () {
  'use strict';

  const MAP_DATA = window.VIETNAM_MAP_DATA;
  const ENGINE_LIB = window.VietnamLightGame;
  const FX_LIB = window.VietnamEffects;
  const TTS_LIB = window.VietnamTTS;
  const WS_LIB = window.TikTokLiveBridge;

  // =========================================================
  // LAYER 4: CLEAN MODE RUNTIME ENFORCEMENT (?clean=1)
  // =========================================================
  function isCleanModeActive() {
    try {
      const params = new URLSearchParams(window.location.search);
      const val = params.get('clean');
      if (val === '1' || val === 'true') return true;
    } catch (_e) {}
    return (
      document.documentElement.classList.contains('clean-mode') ||
      document.body.classList.contains('clean-mode') ||
      document.documentElement.getAttribute('data-clean-mode') === '1'
    );
  }

  function enforceCleanModeLayer4() {
    if (!isCleanModeActive()) return;
    document.documentElement.classList.add('clean-mode');
    document.body.classList.add('clean-mode');
    document.documentElement.setAttribute('data-clean-mode', '1');
    const hostEls = document.querySelectorAll('.host-only, [data-host-control], .exit-clean-btn, .tt-input-area');
    hostEls.forEach((el) => {
      el.hidden = true;
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
      el.remove();
    });
  }

  // ─── Mở khóa âm thanh iOS (Cơ 27/11 ~02:06: iPhone live không nghe tiếng) ───
  // iOS: (1) giọng MC (speechSynthesis) đi qua kênh chuông nên công tắc im lặng
  // bật là mất tiếng ngay tại nguồn; (2) iOS đòi chạm vào trang 1 lần mới cho
  // phát tiếng. Không mở được nếu không có cử chỉ chạm — code chỉ chuẩn bị sẵn.
  function setAudioSessionPlayback() {
    try {
      const nav = typeof navigator !== 'undefined' ? navigator : null;
      if (nav && nav.audioSession && nav.audioSession.type !== 'playback') {
        nav.audioSession.type = 'playback';
      }
    } catch (_) { /* iOS cũ / trình duyệt không hỗ trợ audioSession: bỏ qua */ }
  }

  function primeSpeechSynthesis() {
    try {
      const ss = typeof window !== 'undefined' ? window.speechSynthesis : null;
      if (!ss || typeof ss.speak !== 'function') return;
      const UtteranceCtor = window.SpeechSynthesisUtterance || global.SpeechSynthesisUtterance;
      if (typeof UtteranceCtor !== 'function') return;
      const u = new UtteranceCtor('.');
      u.lang = 'vi-VN';
      u.volume = 0; // Mồi im lặng: chỉ để iOS mở khóa TTS, không phát ra tiếng.
      ss.speak(u);
    } catch (_) { /* bỏ qua */ }
  }

  function setupIosAudioUnlock() {
    setAudioSessionPlayback(); // Đặt sớm: đổi kênh âm thanh ngay khi tải trang.
    try {
      if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
      let unlocked = false;
      const onFirstGesture = () => {
        if (unlocked) return;
        unlocked = true;
        setAudioSessionPlayback();
        primeSpeechSynthesis();
      };
      // Chạm/click đầu tiên vào bất cứ đâu trên trang (chỉ 1 lần).
      window.addEventListener('pointerdown', onFirstGesture, { once: true, capture: true });
      window.addEventListener('touchstart', onFirstGesture, { once: true, capture: true });
      window.addEventListener('click', onFirstGesture, { once: true, capture: true });
    } catch (_) { /* bỏ qua */ }
  }

  // Deterministic avatar color palette
  const AVATAR_COLORS = [
    '#e11d48', '#2563eb', '#059669', '#d97706',
    '#7c3aed', '#0891b2', '#db2777', '#ea580c',
  ];

  function hashStr(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  function getAvatarColor(name) {
    return AVATAR_COLORS[hashStr(String(name || 'A')) % AVATAR_COLORS.length];
  }

  function getInitials(name) {
    const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function formatMMSS(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }

  function formatHHMMSS(sec) {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Demo viewer pool & comments
  const DEMO_VIEWERS = [
    { user: 'k17 ko có ny', rankBadge: 'No.1' },
    { user: 'Bé Hanzi', rankBadge: 'No.2' },
    { user: 'Trần Hà Tĩnh', rankBadge: 'No.3' },
    { user: 'Minh Anh 99', rankBadge: null },
    { user: 'Quang Hải FC', rankBadge: null },
    { user: 'Lan Phương SG', rankBadge: null },
    { user: 'Hậu Trần', rankBadge: null },
    { user: 'Tôi fan Messi', rankBadge: 'No.1' },
    { user: 'Phi Long Bùi', rankBadge: null },
    { user: 'tân cá chép', rankBadge: null },
    { user: 'nothing', rankBadge: null },
    { user: 'KHƯƠNG', rankBadge: 'No.2' },
    { user: 'Chợ Đồ Tất', rankBadge: null },
    { user: 'bánh mì 1874qtrị', rankBadge: 'No.3' },
  ];

  const DEMO_CHATTER = [
    'Đẹp quá ad ơi!',
    'Cả nhà ơi thắp sáng quê mình đi nào',
    '65',
    '74',
    'Quá đỉnh luôn',
    'Chào cả nhà yêu Việt Nam',
  ];

  // =========================================================
  // MAIN INITIALIZATION
  // =========================================================
  document.addEventListener('DOMContentLoaded', () => {
    // Enforce clean-mode Layer 4 immediately
    enforceCleanModeLayer4();
    setupIosAudioUnlock(); // Mở khóa âm thanh iOS (Cơ 27/11 ~02:06).

    // Bản Pages (GitHub Pages, không có server WS nội bộ):
    // ?live=<username> = chế độ live qua Ably; không có ?live= thì chạy
    // chế độ mô phỏng nội bộ (demo qua nút Host). ?obs=1 là marker OBS
    // (game tự chạy sẵn, không có màn hình chờ) — Ably nối ngay khi có ?live=.
    const IS_PAGES_BUILD = true;
    const liveParam = (() => { try { return new URLSearchParams(window.location.search).get('live') || ''; } catch (_e) { return ''; } })();
    const IS_ABLY_MODE = Boolean(liveParam);

    const engine = ENGINE_LIB.createGameEngine({ roundDurationSec: 300 });

    // DOM References
    const stageEl = document.getElementById('stage');
    const bgCanvas = document.getElementById('bg-stars-canvas');
    const fxCanvas = document.getElementById('fx-canvas');
    const mapSection = document.querySelector('.map-section');
    const cameraRig = document.getElementById('map-camera-rig');
    const svgEl = document.getElementById('vietnam-svg');
    const provincesLayer = document.getElementById('provinces-layer');
    const archipelagosLayer = document.getElementById('archipelagos-layer');
    const labelsLayer = document.getElementById('labels-layer');
    const beaconsLayer = document.getElementById('beacons-layer');

    const litCountEl = document.getElementById('lit-count');
    const userCountEl = document.getElementById('user-count');
    const progressFillEl = document.getElementById('progress-fill');
    const progressAriaEl = document.getElementById('progress-bar-aria');
    const daichienBadgeEl = document.getElementById('daichien-badge');

    const latestBodyEl = document.getElementById('latest-card-body');
    const latestAvatarEl = document.getElementById('latest-avatar');
    const latestUserEl = document.getElementById('latest-user');
    const firstLightTagEl = document.getElementById('first-light-tag');
    const latestProvinceEl = document.getElementById('latest-province');
    const latestFactEl = document.getElementById('latest-fact');

    const roundTagEl = document.getElementById('round-tag');
    const raceCountdownEl = document.getElementById('race-countdown');
    const raceTimerEl = document.getElementById('race-timer');
    const raceTop5El = document.getElementById('race-top5-list');
    const giftTop5El = document.getElementById('gift-top5-list');
    const giftLegendEl = document.getElementById('gift-legend-list');
    const honorTop3El = document.getElementById('honor-top3');

    const eventBannerEl = document.getElementById('event-banner');
    const winnerOverlayEl = document.getElementById('winner-overlay');
    const winnerRoundLabelEl = document.getElementById('winner-round-label');
    const winnerProvinceNameEl = document.getElementById('winner-province-name');
    const winnerScoreTextEl = document.getElementById('winner-score-text');

    const mcBadgeEl = document.getElementById('mc-badge');
    const mcStatusTextEl = document.getElementById('mc-status-text');

    const liveClockEl = document.getElementById('live-clock');
    const wsStatusDotEl = document.getElementById('ws-status-dot');
    const wsStatusLabelEl = document.getElementById('ws-status-label');
    const statViewersEl = document.getElementById('stat-viewers');
    const statViewsEl = document.getElementById('stat-views');
    const statGiftsEl = document.getElementById('stat-gifts');
    const statSharesEl = document.getElementById('stat-shares');
    const statLikesEl = document.getElementById('stat-likes');
    const giftToastsEl = document.getElementById('tt-gift-toasts');
    const chatFeedEl = document.getElementById('tt-chat-feed');
    const chatFormEl = document.getElementById('tt-chat-form');
    const commentInputEl = document.getElementById('tt-comment-input');
    const simViewerSelectEl = document.getElementById('sim-viewer-select');

    // Initialize 60fps Canvas Effects
    const fx = FX_LIB.createEffectsEngine({ bgCanvas, fxCanvas });

    // Initialize Vietnamese TTS
    const tts = TTS_LIB.createTTSController({
      enabled: true,
      onStateChange: ({ enabled, speaking }) => {
        if (!mcBadgeEl) return;
        mcBadgeEl.classList.toggle('is-speaking', Boolean(enabled && speaking));
        mcBadgeEl.classList.toggle('is-muted', !enabled);
        if (mcStatusTextEl) {
          mcStatusTextEl.textContent = !enabled
            ? 'MC giọng AI (đã tắt)'
            : speaking
            ? 'MC AI đang đọc...'
            : 'MC đọc bằng giọng AI';
        }
      },
    });

    // Responsive 1080x1920 stage scaling (khung dọc, Cơ 27/11)
    function fitStage() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const scale = Math.min(vw / 1080, vh / 1920);
      stageEl.style.transform = `scale(${scale})`;
      fx.resize();
      syncLitNodesToCanvas();
    }

    // Convert SVG (600x900) coordinate to #fx-canvas local pixel coordinate
    function svgToCanvasCoords(sx, sy) {
      const boxW = mapSection.clientWidth || 1040;
      const boxH = mapSection.clientHeight || 780;
      const vbW = 600;
      const vbH = 900;
      const svgScale = Math.min(boxW / vbW, boxH / vbH);
      const offsetX = (boxW - vbW * svgScale) * 0.5;
      const offsetY = (boxH - vbH * svgScale) * 0.5;
      return {
        x: offsetX + sx * svgScale,
        y: offsetY + sy * svgScale,
      };
    }

    // ---- Render Static Gift Legend Panel ----
    function renderGiftLegend() {
      giftLegendEl.innerHTML = ENGINE_LIB.GIFT_TIERS.map((tier) => {
        const isEpic = tier.effect === 'dai_chien';
        return `
          <li class="gift-legend-row${isEpic ? ' is-epic' : ''}">
            <span class="gift-legend-icon" aria-hidden="true">${tier.icon}</span>
            <div class="gift-legend-text">
              <span class="gift-legend-name">${escapeHtml(tier.label)}</span>
              <span class="gift-legend-cost">${escapeHtml(tier.costText)}</span>
              <span class="gift-legend-desc">${escapeHtml(tier.desc)}</span>
            </div>
          </li>
        `;
      }).join('');
    }

    // ---- Render 34-Province SVG Map ----
    const pathElById = new Map();
    const labelElById = new Map();
    const SVG_NS = 'http://www.w3.org/2000/svg';

    function createSvgEl(tag, attrs = {}) {
      const el = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, String(v));
      }
      return el;
    }

    function renderBaseMap() {
      provincesLayer.innerHTML = '';
      archipelagosLayer.innerHTML = '';
      labelsLayer.innerHTML = '';
      beaconsLayer.innerHTML = '';
      pathElById.clear();
      labelElById.clear();

      // 34 Province Polygons & Labels
      for (const prov of MAP_DATA.provinces) {
        const pathEl = createSvgEl('path', {
          d: prov.d,
          class: 'province-path',
          'data-id': prov.id,
          'data-name': prov.name,
        });
        pathEl.addEventListener('click', () => {
          const viewer = simViewerSelectEl ? simViewerSelectEl.value : 'Khán giả';
          handleIncomingComment({ user: viewer, comment: prov.name });
        });
        provincesLayer.appendChild(pathEl);
        pathElById.set(prov.id, pathEl);

        const labelEl = createSvgEl('text', {
          x: prov.lx,
          y: prov.ly,
          class: 'province-label',
          'data-id': prov.id,
        });
        labelEl.textContent = prov.name;
        labelsLayer.appendChild(labelEl);
        labelElById.set(prov.id, labelEl);
      }

      // Archipelagos: Hoàng Sa (TP. Đà Nẵng) & Trường Sa
      const archList = [MAP_DATA.archipelagos.hoangSa, MAP_DATA.archipelagos.truongSa];
      for (const arch of archList) {
        const g = createSvgEl('g', { class: 'archipelago-group' });
        const { x, y, w, h } = arch.box;
        g.appendChild(createSvgEl('rect', { x, y, width: w, height: h, class: 'archipelago-box' }));

        const titleEl = createSvgEl('text', {
          x: x + w / 2,
          y: y + 16,
          class: 'archipelago-title',
        });
        titleEl.textContent = arch.title;
        g.appendChild(titleEl);

        if (arch.subtitle && arch.title.includes('HOÀNG SA')) {
          const subEl = createSvgEl('text', {
            x: x + w / 2,
            y: y + 28,
            class: 'archipelago-sub',
          });
          subEl.textContent = arch.subtitle;
          g.appendChild(subEl);
        }

        arch.islands.forEach((isl, idx) => {
          const dot = createSvgEl('circle', {
            cx: isl.x,
            cy: isl.y,
            r: isl.r,
            class: 'archipelago-star',
            style: `animation-delay: ${(idx * 0.27).toFixed(2)}s`,
          });
          g.appendChild(dot);
        });

        archipelagosLayer.appendChild(g);
      }
    }

    // ---- Sync Lit Provinces & Beacons on SVG ----
    function syncLitNodesToCanvas() {
      const snap = engine.getSnapshot();
      const topId = snap.raceTop5[0]?.id || null;
      const nodes = [];
      for (const p of snap.provinces) {
        if (!p.lit) continue;
        const pos = svgToCanvasCoords(p.cx, p.cy);
        nodes.push({
          x: pos.x,
          y: pos.y,
          hot: p.id === topId || p.totalLights >= 5,
          phase: hashStr(p.id) % 10,
        });
      }
      fx.setLitNodes(nodes);
    }

    function renderMapState(justLitProvinceId = null) {
      const snap = engine.getSnapshot();
      const topId = snap.raceTop5[0]?.id || null;
      beaconsLayer.innerHTML = '';

      for (const p of snap.provinces) {
        const pathEl = pathElById.get(p.id);
        const labelEl = labelElById.get(p.id);
        if (!pathEl || !labelEl) continue;

        pathEl.classList.toggle('is-lit', p.lit);
        pathEl.classList.toggle('is-hot', p.lit && (p.id === topId || p.totalLights >= 5));
        labelEl.classList.toggle('is-lit', p.lit);

        if (justLitProvinceId && p.id === justLitProvinceId) {
          pathEl.classList.remove('just-lit');
          void pathEl.offsetWidth;
          pathEl.classList.add('just-lit');
        }

        if (p.lit) {
          const g = createSvgEl('g', {
            class: 'beacon-group',
            transform: `translate(${p.cx}, ${p.cy - 10})`,
          });

          // Flickering golden flame / lantern aura
          const flameHalo = createSvgEl('circle', {
            cx: 0,
            cy: -3,
            r: 11,
            fill: 'url(#flame-grad)',
            class: 'beacon-flame',
          });
          g.appendChild(flameHalo);

          // Flame teardrop path
          const flameShape = createSvgEl('path', {
            d: 'M0,-14 C4,-9 5,-4 0,0 C-5,-4 -4,-9 0,-14 Z',
            fill: '#fff5a8',
            stroke: '#ff7b00',
            'stroke-width': '0.9',
            class: 'beacon-flame',
          });
          g.appendChild(flameShape);

          // User Avatar Badge next to flame
          const litBy = p.lastLitBy || p.firstLitBy;
          const userName = litBy ? litBy.user : 'VN';
          const avGroup = createSvgEl('g', { transform: 'translate(10, -4)' });
          const ring = createSvgEl('circle', {
            cx: 0,
            cy: 0,
            r: 7.5,
            class: 'beacon-avatar-ring',
            style: `fill: ${getAvatarColor(userName)}`,
          });
          avGroup.appendChild(ring);

          const initials = createSvgEl('text', {
            x: 0,
            y: 0.4,
            class: 'beacon-avatar-text',
          });
          initials.textContent = getInitials(userName);
          avGroup.appendChild(initials);

          // Crown icon for #1 province
          if (p.id === topId) {
            const crown = createSvgEl('text', {
              x: 0,
              y: -11,
              'text-anchor': 'middle',
              'font-size': '10',
            });
            crown.textContent = '👑';
            avGroup.appendChild(crown);
          }

          g.appendChild(avGroup);
          beaconsLayer.appendChild(g);
        }
      }

      syncLitNodesToCanvas();
    }

    // ---- Render All HUD Panels ----
    function renderProgress() {
      const prog = engine.getProgress();
      litCountEl.textContent = String(prog.litCount);
      userCountEl.textContent = String(prog.userCount);
      progressFillEl.style.width = `${prog.percent}%`;
      progressAriaEl.setAttribute('aria-valuenow', String(prog.litCount));
    }

    function renderLatestCard(latest, animate = false) {
      if (!latest) {
        latestAvatarEl.textContent = '🇻🇳';
        latestAvatarEl.style.background = 'linear-gradient(135deg, #2563eb, #1d4ed8)';
        latestUserEl.textContent = 'Đang chờ ngọn đèn đầu tiên...';
        firstLightTagEl.classList.add('hidden');
        latestProvinceEl.textContent = '✨ Comment tên tỉnh quê bạn để thắp sáng!';
        latestFactEl.textContent =
          '34 tỉnh, thành phố Việt Nam đang chờ bạn thắp lên những ánh đèn rực rỡ đầu tiên.';
        return;
      }

      latestAvatarEl.style.background = getAvatarColor(latest.user);
      latestAvatarEl.textContent = getInitials(latest.user);
      latestUserEl.textContent = latest.user;
      firstLightTagEl.classList.toggle('hidden', !latest.isFirstLight);
      latestProvinceEl.textContent = `✨ thắp sáng ${latest.provinceName}`;
      latestFactEl.textContent = latest.funFact;

      if (animate) {
        latestBodyEl.classList.remove('card-pop-in');
        void latestBodyEl.offsetWidth;
        latestBodyEl.classList.add('card-pop-in');
      }
    }

    function renderRacePanel() {
      const snap = engine.getSnapshot();
      raceTimerEl.textContent = formatMMSS(snap.raceTimeRemaining);
      raceCountdownEl.classList.toggle(
        'urgent-blink',
        snap.raceRunning && snap.raceTimeRemaining > 0 && snap.raceTimeRemaining <= 30
      );
      raceCountdownEl.classList.toggle('is-paused', !snap.raceRunning);

      roundTagEl.textContent = snap.isDaiChien
        ? `⚔️ Đại Chiến #${snap.roundNumber}`
        : `Vòng ${snap.roundNumber}`;
      roundTagEl.classList.toggle('is-daichien', snap.isDaiChien);
      daichienBadgeEl.classList.toggle('hidden', !snap.isDaiChien);

      const top5 = snap.raceTop5;
      if (top5.length === 0) {
        raceTop5El.innerHTML = '<li class="rank-empty">Chưa có lượt thắp trong vòng đua này</li>';
        return;
      }

      raceTop5El.innerHTML = top5
        .map((item, idx) => {
          const rank = idx + 1;
          return `
            <li class="rank-item rank-${rank}">
              <div class="rank-left">
                <span class="rank-num">${rank}</span>
                <span class="rank-name">${escapeHtml(item.name)}</span>
                ${rank === 1 ? '<span class="rank-delta">🔥 Dẫn đầu</span>' : ''}
              </div>
              <span class="rank-val">${item.roundLights.toLocaleString('vi-VN')}</span>
            </li>
          `;
        })
        .join('');
    }

    function renderGiftTop5Panel() {
      const top5 = engine.getGiftTop5();
      if (top5.length === 0) {
        giftTop5El.innerHTML = '<li class="rank-empty">Tặng quà để ghi danh quê hương của bạn</li>';
        return;
      }
      giftTop5El.innerHTML = top5
        .map((item, idx) => {
          const rank = idx + 1;
          return `
            <li class="rank-item rank-${rank}">
              <div class="rank-left">
                <span class="rank-num">${rank}</span>
                <span class="rank-name">${escapeHtml(item.name)}</span>
              </div>
              <span class="rank-val">${item.totalGifts.toLocaleString('vi-VN')} KC</span>
            </li>
          `;
        })
        .join('');
    }

    function renderHonorTop3() {
      const top3 = engine.getHonorTop3();
      if (top3.length === 0) {
        honorTop3El.innerHTML = '<div class="honor-card honor-empty">Chưa có người thắp đèn</div>';
        return;
      }
      const medals = ['👑', '🥈', '🥉'];
      honorTop3El.innerHTML = top3
        .map((u, idx) => {
          const rank = idx + 1;
          return `
            <div class="honor-card honor-${rank}">
              <div class="honor-avatar" style="background: ${getAvatarColor(u.user)}">
                ${escapeHtml(getInitials(u.user))}
                <span class="honor-medal" aria-hidden="true">${medals[idx]}</span>
              </div>
              <div class="honor-meta">
                <div class="honor-name">${escapeHtml(u.user)}</div>
                <div class="honor-score">🏮 ${u.lights} lượt${u.gifts > 0 ? ` · 💎 ${u.gifts}` : ''}</div>
              </div>
            </div>
          `;
        })
        .join('');
    }

    function renderLiveStats() {
      const s = engine.getSnapshot().liveStats;
      statViewersEl.textContent = s.viewers.toLocaleString('vi-VN');
      statViewsEl.textContent = s.views.toLocaleString('vi-VN');
      statGiftsEl.textContent = s.gifts.toLocaleString('vi-VN');
      statSharesEl.textContent = s.shares.toLocaleString('vi-VN');
      statLikesEl.textContent = s.likes.toLocaleString('vi-VN');
    }

    // ---- Banners & Camera Effects ----
    let bannerTimeout = null;
    function showEventBanner(text, durationMs = 3600) {
      eventBannerEl.textContent = text;
      eventBannerEl.classList.remove('hidden');
      clearTimeout(bannerTimeout);
      bannerTimeout = setTimeout(() => {
        eventBannerEl.classList.add('hidden');
      }, durationMs);
    }

    let winnerTimeout = null;
    function showWinnerCelebration(winner) {
      if (!winner) return;
      winnerRoundLabelEl.textContent = winner.isDaiChien
        ? `KẾT THÚC ĐẠI CHIẾN #${winner.roundNumber}`
        : `KẾT THÚC VÒNG ĐUA #${winner.roundNumber}`;
      winnerProvinceNameEl.textContent = winner.provinceName.toUpperCase();
      winnerScoreTextEl.textContent = `Dẫn đầu với ${winner.roundLights} lượt thắp đèn!`;
      winnerOverlayEl.classList.remove('hidden');

      const prov = engine.getProvince(winner.provinceId);
      const pos = prov ? svgToCanvasCoords(prov.cx, prov.cy) : { x: 520, y: 390 };
      fx.spawnFireworks(pos.x, pos.y, 5);
      fx.spawnConfetti(160);
      tts.announceWinner(winner.provinceName, winner.roundNumber);

      clearTimeout(winnerTimeout);
      winnerTimeout = setTimeout(() => {
        winnerOverlayEl.classList.add('hidden');
      }, 5200);
    }

    let cameraTimeout = null;
    function triggerCameraOrbit(prov) {
      if (!prov) return;
      const boxW = mapSection.clientWidth || 1040;
      const boxH = mapSection.clientHeight || 780;
      const pos = svgToCanvasCoords(prov.cx, prov.cy);
      const tx = Math.round((boxW * 0.5 - pos.x) * 0.72);
      const ty = Math.round((boxH * 0.5 - pos.y) * 0.72);
      cameraRig.style.setProperty('--cam-tx', `${tx}px`);
      cameraRig.style.setProperty('--cam-ty', `${ty}px`);
      cameraRig.classList.remove('camera-orbiting');
      void cameraRig.offsetWidth;
      cameraRig.classList.add('camera-orbiting');
      clearTimeout(cameraTimeout);
      cameraTimeout = setTimeout(() => {
        cameraRig.classList.remove('camera-orbiting');
      }, 4300);
    }

    // ---- Chat Feed & Gift Toasts ----
    function appendChatMessage(chatEntry) {
      const div = document.createElement('div');
      div.className = 'tt-chat-msg';
      const badgeHtml = chatEntry.rankBadge
        ? `<span class="tt-badge-rank">${escapeHtml(chatEntry.rankBadge)}</span>`
        : '';
      const litTag = chatEntry.matchedProvinceName
        ? `<span class="tt-chat-lit-tag">🏮 ${escapeHtml(chatEntry.matchedProvinceName)}</span>`
        : '';

      div.innerHTML = `
        <div class="tt-chat-avatar" style="background: ${getAvatarColor(chatEntry.user)}">
          ${escapeHtml(getInitials(chatEntry.user))}
        </div>
        <div class="tt-chat-body">
          <div class="tt-chat-header">
            ${badgeHtml}
            <span class="tt-chat-user">${escapeHtml(chatEntry.user)}</span>
            ${litTag}
          </div>
          <div class="tt-chat-text">${escapeHtml(chatEntry.comment)}</div>
        </div>
      `;
      chatFeedEl.appendChild(div);
      while (chatFeedEl.children.length > 45) {
        chatFeedEl.removeChild(chatFeedEl.firstChild);
      }
      chatFeedEl.scrollTop = chatFeedEl.scrollHeight;
    }

    function appendGiftToast(giftEntry) {
      const pill = document.createElement('div');
      pill.className = `tt-gift-pill${giftEntry.diamonds >= 50 ? ' is-big' : ''}`;
      pill.innerHTML = `
        <span class="tt-gift-avatar" style="background: ${getAvatarColor(giftEntry.user)}">
          ${escapeHtml(getInitials(giftEntry.user))}
        </span>
        <span class="tt-gift-text">
          <b>${escapeHtml(giftEntry.user)}</b> đã gửi ${escapeHtml(giftEntry.giftName)} ${giftEntry.icon} x${giftEntry.repeatCount}
        </span>
      `;
      giftToastsEl.prepend(pill);
      while (giftToastsEl.children.length > 3) {
        giftToastsEl.removeChild(giftToastsEl.lastChild);
      }
    }

    // ---- Server Sync Helpers (Fix 2: Live state persistence across reloads & tabs) ----
    const seenClientMsgIds = new Set();
    let lastServerVersion = -1;
    let hasLocalInteraction = false;
    let liveElapsedSec = 0;

    function rememberMsgId(id) {
      if (!id) return;
      seenClientMsgIds.add(id);
      if (seenClientMsgIds.size > 200) {
        const first = seenClientMsgIds.values().next().value;
        seenClientMsgIds.delete(first);
      }
    }

    function sendActionToServer(actionPayload) {
      hasLocalInteraction = true;
      const clientMsgId = `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      rememberMsgId(clientMsgId);
      const msg = { ...actionPayload, clientMsgId };

      if (wsBridge && wsBridge.isConnected() && wsBridge.send(msg)) {
        return clientMsgId;
      }

      // Bản Pages: không có server nội bộ để gửi action tới — chỉ áp dụng cục bộ.
      if (IS_PAGES_BUILD) {
        return clientMsgId;
      }

      if (typeof fetch === 'function') {
        fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg),
          keepalive: true,
        }).catch(() => {});
      }
      return clientMsgId;
    }

    function renderChatAndGiftHistoryFromState() {
      const snap = engine.getSnapshot();
      chatFeedEl.innerHTML = '';
      for (const entry of snap.chatHistory.slice(-45)) {
        appendChatMessage(entry);
      }
      giftToastsEl.innerHTML = '';
      for (const entry of snap.giftFeed.slice(-3)) {
        appendGiftToast(entry);
      }
    }

    function hydrateFromServerState(serverState, { isReset = false } = {}) {
      if (!serverState || typeof serverState !== 'object') return;
      const ver = Number(serverState.stateVersion ?? 0);
      if (!isReset && ver < lastServerVersion) return;
      lastServerVersion = ver;

      engine.importState(serverState);
      if (serverState.liveElapsedSec != null) {
        liveElapsedSec = Number(serverState.liveElapsedSec) || 0;
        liveClockEl.textContent = formatHHMMSS(liveElapsedSec);
      }

      if (isReset) {
        lastArcSource = null;
        winnerOverlayEl.classList.add('hidden');
        eventBannerEl.classList.add('hidden');
      }

      const snap = engine.getSnapshot();
      renderMapState();
      renderProgress();
      renderLatestCard(snap.latestLit, false);
      renderRacePanel();
      syncRaceBtn();
      renderGiftTop5Panel();
      renderHonorTop3();
      renderLiveStats();
      renderChatAndGiftHistoryFromState();
    }

    // ---- Unified Event Handlers ----
    let lastArcSource = null;

    function handleIncomingComment(payload, { fromRemote = false } = {}) {
      if (!fromRemote) {
        sendActionToServer({
          type: 'comment',
          user: payload.user,
          avatar: payload.avatar || '',
          comment: payload.comment,
          rankBadge: payload.rankBadge || null,
        });
      }

      const res = engine.processComment(payload);
      appendChatMessage(res.chatEntry);

      engine.updateLiveStats({
        likes: engine.getSnapshot().liveStats.likes + Math.floor(Math.random() * 6) + 1,
      });
      renderLiveStats();

      if (!res.matched || !res.province) return res;

      const prov = res.province;
      const targetPos = svgToCanvasCoords(prov.cx, prov.cy);
      const canvasSize = fx.getCanvasSize();
      const fromPos = lastArcSource || { x: canvasSize.width * 0.25, y: canvasSize.height * 0.92 };
      fx.spawnLightArc(fromPos.x, fromPos.y, targetPos.x, targetPos.y);
      lastArcSource = targetPos;

      fx.spawnPulseRing(targetPos.x, targetPos.y, '#ffd84d', res.isFirstLight ? 88 : 48);

      if (res.isFirstLight) {
        fx.spawnFireworks(targetPos.x, targetPos.y, 2);
        tts.announceFirstLight(res.latestLit.user, prov.name, prov.funFact);
      }

      renderMapState(prov.id);
      renderProgress();
      renderLatestCard(res.latestLit, true);
      renderRacePanel();
      renderHonorTop3();
      return res;
    }

    function handleIncomingGift(payload, { fromRemote = false } = {}) {
      if (!fromRemote) {
        sendActionToServer({
          type: 'gift',
          user: payload.user,
          avatar: payload.avatar || '',
          giftName: payload.giftName,
          diamonds: payload.diamonds,
          repeatCount: payload.repeatCount || 1,
          province: payload.province || null,
          provinceId: payload.provinceId || null,
        });
      }

      const res = engine.processGift(payload);
      appendGiftToast(res.giftEntry);

      const prov = res.province;
      const pos = svgToCanvasCoords(prov.cx, prov.cy);
      const { user, provinceName, diamonds } = res.giftEntry;

      switch (res.effect) {
        case 'rose_light':
          fx.spawnRoseRain(pos.x, pos.y);
          if (res.isFirstLight) {
            fx.spawnFireworks(pos.x, pos.y, 2);
            tts.announceFirstLight(user, prov.name, prov.funFact);
          }
          if (res.latestLit) renderLatestCard(res.latestLit, true);
          break;
        case 'heart_beam':
          fx.spawnHeartBeam(pos.x, pos.y);
          showEventBanner(`🫶 ${user} bắn tim sáng rực ${provinceName}!`);
          break;
        case 'camera_orbit':
          fx.spawnPulseRing(pos.x, pos.y, '#38bdf8', 95);
          triggerCameraOrbit(prov);
          showEventBanner(`🎵 Camera bay quanh ${provinceName} · Quà từ ${user}!`, 4300);
          break;
        case 'fireworks':
          fx.spawnFireworks(pos.x, pos.y, 4);
          showEventBanner(`🎆 Pháo hoa rực rỡ trên ${provinceName} · ${user} (${diamonds} KC)!`);
          break;
        case 'dragon':
          fx.spawnGoldenDragon();
          fx.spawnFireworks(pos.x, pos.y, 2);
          showEventBanner(`🐉 RỒNG VÀNG BAY QUA BẢN ĐỒ · ${user} tặng cho ${provinceName}!`, 4800);
          break;
        case 'phoenix':
          fx.spawnFirePhoenix();
          fx.spawnFireworks(pos.x, pos.y, 3);
          showEventBanner(`🔥 PHƯỢNG HOÀNG LỬA RỰC TRỜI · ${user} tặng cho ${provinceName}!`, 4800);
          break;
        case 'dai_chien':
          fx.spawnDaiChienBurst(pos.x, pos.y);
          showEventBanner(`⚔️ ${user} MỞ ĐẠI CHIẾN NGAY LẬP TỨC CHO ${provinceName.toUpperCase()}!`, 5500);
          tts.announceDaiChien(user, provinceName);
          break;
      }

      renderMapState(prov.id);
      renderProgress();
      renderRacePanel();
      renderGiftTop5Panel();
      renderHonorTop3();
      renderLiveStats();
      return res;
    }

    function handleResetMap({ fromRemote = false } = {}) {
      if (!fromRemote) {
        sendActionToServer({ type: 'reset_map' });
      }
      engine.resetMap();
      lastArcSource = null;
      giftToastsEl.innerHTML = '';
      winnerOverlayEl.classList.add('hidden');
      eventBannerEl.classList.add('hidden');
      renderMapState();
      renderProgress();
      renderLatestCard(null, false);
      renderRacePanel();
      syncRaceBtn();
      renderGiftTop5Panel();
      renderHonorTop3();
      renderLiveStats();
    }

    // ---- Chat Form Submission ----
    // ?clean=1: Layer 4 đã xóa form khỏi DOM ngay đầu init — bỏ qua wiring
    // (không guard thì init crash tại đây, renderBaseMap không chạy, bản đồ trống).
    if (chatFormEl && commentInputEl) {
      chatFormEl.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = commentInputEl.value.trim();
        if (!text) return;
        const viewer = simViewerSelectEl ? simViewerSelectEl.value : 'Khán giả';
        handleIncomingComment({ user: viewer, comment: text });
        commentInputEl.value = '';
      });
    }

    // ---- Host Controls Wiring (Only active when not in direct ?clean=1 URL mode) ----
    const btnToggleRace = document.getElementById('btn-toggle-race');
    const btnFinishRound = document.getElementById('btn-finish-round');
    const btnToggleDemo = document.getElementById('btn-toggle-demo');
    const btnToggleTts = document.getElementById('btn-toggle-tts');
    const btnResetMap = document.getElementById('btn-reset-map');
    const btnOpenClean = document.getElementById('btn-open-clean');
    const btnExitClean = document.getElementById('btn-exit-clean');
    const btnSimRandom = document.getElementById('btn-sim-random-comment');

    // Fix 1: In-place OBS Clean toggle (no window.open, no location.href navigation)
    let inPlaceCleanActive = false;

    function setInPlaceClean(active) {
      if (isCleanModeActive()) return; // locked clean when opened directly via ?clean=1
      inPlaceCleanActive = Boolean(active);
      document.documentElement.classList.toggle('clean-toggle-active', inPlaceCleanActive);
      document.body.classList.toggle('clean-toggle-active', inPlaceCleanActive);
      if (btnExitClean) {
        btnExitClean.classList.toggle('hidden', !inPlaceCleanActive);
      }
      fitStage();
    }

    if (btnOpenClean) {
      btnOpenClean.addEventListener('click', () => {
        setInPlaceClean(!inPlaceCleanActive);
      });
    }

    if (btnExitClean) {
      btnExitClean.addEventListener('click', () => {
        setInPlaceClean(false);
      });
    }

    function syncRaceBtn() {
      if (!btnToggleRace) return;
      const running = engine.getSnapshot().raceRunning;
      btnToggleRace.textContent = running ? '⏸️ Tạm dừng đua' : '▶️ Tiếp tục đua';
    }

    if (btnToggleRace) {
      btnToggleRace.addEventListener('click', () => {
        engine.toggleRace();
        syncRaceBtn();
        renderRacePanel();
        sendActionToServer({ type: 'toggle_race' });
      });
    }

    if (btnFinishRound) {
      btnFinishRound.addEventListener('click', () => {
        const res = engine.finishRaceRound();
        if (res.winner) showWinnerCelebration(res.winner);
        renderRacePanel();
        sendActionToServer({ type: 'finish_round' });
      });
    }

    if (btnToggleTts) {
      btnToggleTts.addEventListener('click', () => {
        const enabled = tts.toggle();
        btnToggleTts.textContent = enabled ? '🔊 Giọng AI: BẬT' : '🔇 Giọng AI: TẮT';
        btnToggleTts.classList.toggle('host-btn-active', enabled);
      });
    }

    if (btnResetMap) {
      btnResetMap.addEventListener('click', () => {
        handleResetMap();
      });
    }

    // Random simulated comment helper
    function triggerRandomDemoEvent(allowGift = true) {
      const v = DEMO_VIEWERS[Math.floor(Math.random() * DEMO_VIEWERS.length)];
      const roll = Math.random();
      if (allowGift && roll < 0.24) {
        const giftPool = [
          { giftName: 'Rose', diamonds: 1 },
          { giftName: 'Rose', diamonds: 1 },
          { giftName: 'Bắn tim', diamonds: 5 },
          { giftName: 'TikTok', diamonds: 9 },
          { giftName: 'Pháo hoa', diamonds: 10 },
          { giftName: 'Rồng vàng', diamonds: 50 },
          { giftName: 'Phượng hoàng lửa', diamonds: 100 },
        ];
        const g = giftPool[Math.floor(Math.random() * giftPool.length)];
        const randomProv = MAP_DATA.provinces[Math.floor(Math.random() * MAP_DATA.provinces.length)];
        handleIncomingGift({
          user: v.user,
          giftName: g.giftName,
          diamonds: g.diamonds,
          repeatCount: 1,
          provinceId: randomProv.id,
        });
      } else if (roll < 0.86) {
        const prov = MAP_DATA.provinces[Math.floor(Math.random() * MAP_DATA.provinces.length)];
        handleIncomingComment({ user: v.user, rankBadge: v.rankBadge, comment: prov.name });
      } else {
        const msg = DEMO_CHATTER[Math.floor(Math.random() * DEMO_CHATTER.length)];
        handleIncomingComment({ user: v.user, rankBadge: v.rankBadge, comment: msg });
      }
    }

    if (btnSimRandom) {
      btnSimRandom.addEventListener('click', () => {
        triggerRandomDemoEvent(false);
      });
    }

    // Quick Gift Simulator Buttons
    document.querySelectorAll('.gift-sim-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const diamonds = Number(btn.getAttribute('data-gift-diamonds') || 1);
        const giftName = btn.getAttribute('data-gift-name') || 'Rose';
        const viewer = simViewerSelectEl ? simViewerSelectEl.value : 'Khán giả';
        handleIncomingGift({ user: viewer, giftName, diamonds, repeatCount: 1 });
      });
    });

    // Demo Mode Interval
    let demoInterval = null;
    function setDemoMode(active) {
      clearInterval(demoInterval);
      demoInterval = null;
      if (active) {
        triggerRandomDemoEvent(false);
        demoInterval = setInterval(() => triggerRandomDemoEvent(true), 1700);
      }
      if (btnToggleDemo) {
        btnToggleDemo.textContent = active ? '🤖 Demo tự động: BẬT' : '🤖 Demo tự động: TẮT';
        btnToggleDemo.classList.toggle('host-btn-active', active);
      }
    }

    if (btnToggleDemo) {
      btnToggleDemo.addEventListener('click', () => {
        setDemoMode(!demoInterval);
      });
    }

    // ---- Timers (Race Countdown + Live Session Clock) ----
    setInterval(() => {
      liveElapsedSec += 1;
      liveClockEl.textContent = formatHHMMSS(liveElapsedSec);

      const tick = engine.tickRace(1);
      if (tick.finished && tick.winner) {
        showWinnerCelebration(tick.winner);
      }
      renderRacePanel();
    }, 1000);

    // ---- Ably Live Hook Connection (bản Pages) ----
    // Trang GitHub Pages nhận event qua Ably subscribe (key SUBSCRIBE-ONLY
    // trong ably-config.js, tài khoản Ably riêng do Hikaru vận hành).
    // Chỉ đổi đường nhận event — mọi logic game giữ nguyên.
    const pageLoadTs = Date.now();
    const seenAblyMsgIds = new Set();
    let ablyConnected = false;

    function getAblyConfig() {
      const params = new URLSearchParams(window.location ? window.location.search : '');
      const fromFile = window.ABLY_CONFIG || {};
      return {
        key: params.get('ablyKey') || fromFile.key || window.ABLY_SUBSCRIBE_KEY || '',
        channel: params.get('ablyChannel') || fromFile.channel || window.ABLY_CHANNEL || 'thap-sang-ban-do-vn'
      };
    }

    function parseAblyData(raw) {
      if (raw && typeof raw === 'object') return raw;
      if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch (_e) { return null; }
      }
      return null;
    }

    // Chống trùng khi Ably replay sau reconnect (mỗi message có id duy nhất).
    function seenAblyMsg(msg) {
      if (!msg || !msg.id) return false;
      if (seenAblyMsgIds.has(msg.id)) return true;
      seenAblyMsgIds.add(msg.id);
      if (seenAblyMsgIds.size > 500) {
        const first = seenAblyMsgIds.values().next().value;
        seenAblyMsgIds.delete(first);
      }
      return false;
    }

    // Lọc event cũ hơn lúc tải trang − 10s (Ably có thể replay ~2 phút khi resume).
    function isStaleAblyMsg(msg, data) {
      const ts = Number((data && data.timestamp) || (msg && msg.timestamp) || 0);
      return Boolean(ts) && ts < pageLoadTs - 10000;
    }

    function updateAblyBadge() {
      wsStatusDotEl.classList.toggle('is-connected', ablyConnected);
      if (!IS_ABLY_MODE) return;
      if (!ablyConnected) {
        wsStatusLabelEl.textContent = 'Mất kết nối';
        return;
      }
      wsStatusLabelEl.textContent = `CHỜ LIVE @${liveParam}`;
    }

    function onAblyComment(msg) {
      if (seenAblyMsg(msg)) return;
      const data = parseAblyData(msg.data);
      if (!data || typeof data.text !== 'string') return;
      if (isStaleAblyMsg(msg, data)) return;
      handleIncomingComment({ user: data.user || data.username || 'Khán giả', avatar: data.avatar || '', comment: data.text }, { fromRemote: true });
    }

    function onAblyGift(msg) {
      if (seenAblyMsg(msg)) return;
      const data = parseAblyData(msg.data);
      if (!data || typeof data.giftName !== 'string') return;
      if (isStaleAblyMsg(msg, data)) return;
      handleIncomingGift({
        user: data.user || data.username || 'Khán giả',
        avatar: data.avatar || '',
        giftName: data.giftName,
        diamonds: Number(data.diamondCount ?? data.coins ?? 1),
        repeatCount: Number(data.repeatCount) || 1,
        provinceId: data.provinceId || null
      }, { fromRemote: true });
    }

    function onAblyLike(msg) {
      if (seenAblyMsg(msg)) return;
      const data = parseAblyData(msg.data);
      if (!data) return;
      if (isStaleAblyMsg(msg, data)) return;
      const cur = engine.getSnapshot().liveStats.likes;
      engine.updateLiveStats({
        likes: data.totalLikeCount != null ? data.totalLikeCount : cur + (data.likeCount || 1),
      });
      renderLiveStats();
    }

    function onAblyStatus(msg) {
      const data = parseAblyData(msg.data);
      if (!data) return;
      if (!IS_ABLY_MODE) return;
      if (data.viewerCount != null) {
        engine.updateLiveStats({ viewers: Number(data.viewerCount) || 0 });
        renderLiveStats();
      }
      if (data.connected) {
        wsStatusDotEl.classList.add('is-connected');
        wsStatusLabelEl.textContent = `LIVE @${data.username || liveParam}`;
      } else if (data.message && String(data.message).indexOf('Đang kết nối') !== -1) {
        wsStatusDotEl.classList.remove('is-connected');
        wsStatusLabelEl.textContent = `ĐANG KẾT NỐI @${data.username || liveParam}`;
      } else if (ablyConnected) {
        wsStatusDotEl.classList.add('is-connected');
        wsStatusLabelEl.textContent = `CHỜ LIVE @${liveParam}`;
      } else {
        wsStatusDotEl.classList.remove('is-connected');
        wsStatusLabelEl.textContent = 'MẤT KẾT NỐI';
      }
    }

    // API test: nhận 1 message Ably đã parse {name, data, id, timestamp}.
    function handleAblyMessage(msg) {
      if (!msg || typeof msg !== 'object') return false;
      if (msg.name === 'comment') { onAblyComment(msg); return true; }
      if (msg.name === 'like') { onAblyLike(msg); return true; }
      if (msg.name === 'gift') { onAblyGift(msg); return true; }
      if (msg.name === 'status') { onAblyStatus(msg); return true; }
      return false;
    }

    // Bridge tương thích interface của WS bridge (connect/disconnect/send/isConnected)
    // để sendActionToServer + phần còn lại của app không phải đổi.
    function createAblyBridge() {
      let client = null;
      return {
        connect() {
          if (typeof AblyPubSub === 'undefined' || typeof AblyPubSub.createClient !== 'function') {
            wsStatusLabelEl.textContent = 'KHÔNG TẢI ĐƯỢC ABLY SDK';
            return;
          }
          const cfg = getAblyConfig();
          if (!cfg.key || cfg.key === 'REPLACE_WITH_ABLY_SUBSCRIBE_KEY') {
            wsStatusLabelEl.textContent = 'CHỜ ABLY KEY (HIKARU)';
            return;
          }
          // Tài khoản MAU bắt buộc clientId trên device (không có thì 401).
          // ID CỐ ĐỊNH duy nhất của game này — KHÔNG đổi, không sinh ngẫu nhiên.
          client = AblyPubSub.createClient({
            key: cfg.key,
            clientId: 'obs-thap-sang-ban-do-vn'
          });
          client.connection.on('connected', () => {
            ablyConnected = true;
            updateAblyBadge();
          });
          client.connection.on('disconnected', () => {
            ablyConnected = false;
            updateAblyBadge();
          });
          client.connection.on('suspended', () => {
            ablyConnected = false;
            updateAblyBadge();
          });
          client.connection.on('failed', (err) => {
            ablyConnected = false;
            updateAblyBadge();
            console.error('[Ably] connection failed:', err && err.message ? err.message : err);
          });
          const channel = client.channels.get(cfg.channel);
          channel.on('failed', (err) => {
            console.error('[Ably] channel failed:', err && err.message ? err.message : err);
          });
          channel.subscribe('comment', onAblyComment);
          channel.subscribe('like', onAblyLike);
          channel.subscribe('gift', onAblyGift);
          channel.subscribe('status', onAblyStatus);
        },
        disconnect() {
          ablyConnected = false;
          try { if (client && typeof client.close === 'function') client.close(); } catch (_e) {}
          client = null;
          updateAblyBadge();
        },
        send() { return false; }, // subscribe-only: trang không publish lên Ably
        isConnected() { return ablyConnected; },
      };
    }

    // ---- WebSocket Live Hook Connection (chỉ bản live nội bộ; bản Pages dùng Ably) ----
    const wsBridge = IS_ABLY_MODE ? createAblyBridge() : (typeof WS_LIB !== 'undefined' && WS_LIB ? WS_LIB.createTikTokBridge({
      onStatus: (status) => {
        wsStatusDotEl.classList.toggle('is-connected', status === 'connected');
        wsStatusLabelEl.textContent =
          status === 'connected'
            ? 'TikTok WS'
            : status === 'connecting'
            ? 'Đang nối...'
            : 'Mô phỏng';
      },
      onEvent: (evt) => {
        if (evt.type === 'state_sync' && evt.state) {
          if (evt.clientMsgId && seenClientMsgIds.has(evt.clientMsgId)) {
            if (evt.state.stateVersion != null) {
              lastServerVersion = Math.max(lastServerVersion, Number(evt.state.stateVersion));
            }
            return;
          }
          if (evt.reason === 'connect' && hasLocalInteraction && Number(evt.state.stateVersion || 0) <= lastServerVersion) {
            return;
          }
          hydrateFromServerState(evt.state, { isReset: evt.reason === 'reset' });
          return;
        }

        if (evt.type === 'race_finished') {
          if (evt.clientMsgId && seenClientMsgIds.has(evt.clientMsgId)) {
            if (evt.state && evt.state.stateVersion != null) {
              lastServerVersion = Math.max(lastServerVersion, Number(evt.state.stateVersion));
            }
            return;
          }
          if (evt.state) {
            hydrateFromServerState(evt.state);
          }
          if (evt.winner) showWinnerCelebration(evt.winner);
          return;
        }

        // Deduplicate our own echoed comment/gift while syncing authoritative server version
        if (evt.clientMsgId && seenClientMsgIds.has(evt.clientMsgId)) {
          if (evt.state && evt.state.stateVersion != null) {
            lastServerVersion = Math.max(lastServerVersion, Number(evt.state.stateVersion));
          }
          return;
        }

        if (evt.type === 'comment') {
          handleIncomingComment(evt, { fromRemote: true });
          if (evt.state && evt.state.stateVersion != null) {
            lastServerVersion = Math.max(lastServerVersion, Number(evt.state.stateVersion));
          }
        } else if (evt.type === 'gift') {
          handleIncomingGift(evt, { fromRemote: true });
          if (evt.state && evt.state.stateVersion != null) {
            lastServerVersion = Math.max(lastServerVersion, Number(evt.state.stateVersion));
          }
        } else if (evt.type === 'like') {
          const cur = engine.getSnapshot().liveStats.likes;
          engine.updateLiveStats({
            likes: evt.totalLikeCount != null ? evt.totalLikeCount : cur + (evt.likeCount || 1),
          });
          renderLiveStats();
        } else if (evt.type === 'share') {
          engine.updateLiveStats({ shares: engine.getSnapshot().liveStats.shares + 1 });
          renderLiveStats();
        } else if (evt.type === 'stats') {
          const patch = {};
          if (evt.viewers != null) patch.viewers = evt.viewers;
          if (evt.views != null) patch.views = evt.views;
          engine.updateLiveStats(patch);
          renderLiveStats();
        }
      },
    }) : null);
    if (wsBridge) wsBridge.connect();

    // ---- Initial Render + Immediate HTTP State Hydration ----
    renderGiftLegend();
    renderBaseMap();
    renderMapState();
    renderProgress();
    renderLatestCard(null, false);
    renderRacePanel();
    renderGiftTop5Panel();
    renderHonorTop3();
    renderLiveStats();
    fitStage();
    fx.start();
    window.addEventListener('resize', fitStage);

    if (!IS_PAGES_BUILD && typeof fetch === 'function') {
      fetch('/api/state', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data || !data.ok || !data.state) return;
          if (hasLocalInteraction && Number(data.state.stateVersion || 0) <= lastServerVersion) return;
          hydrateFromServerState(data.state);
        })
        .catch(() => {});
    }

    // Optional ?demo=1 auto-start for preview showcase
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get('demo') === '1') setDemoMode(true);
    } catch (_e) {}

    // Expose hook for E2E & console debugging
    window.__GAME_APP__ = {
      engine,
      fx,
      tts,
      wsBridge,
      handleAblyMessage,
      isAblyMode: () => IS_ABLY_MODE,
      ablyConnected: () => ablyConnected,
      handleIncomingComment,
      handleIncomingGift,
      handleResetMap,
      renderRacePanel,
      setDemoMode,
      setInPlaceClean,
      isCleanMode: isCleanModeActive,
      isInPlaceClean: () => inPlaceCleanActive,
    };
  });
})();
