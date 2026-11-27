/* Vietnamese AI Voice MC (Web Speech API TTS) */
(function (root) {
  'use strict';

  function createTTSController(options = {}) {
    let enabled = options.enabled !== false;
    let speaking = false;
    let queue = []; // entries: { text, kind } — kind: 'event' | 'idle' | 'priority'
    let currentText = '';
    let lastActivityAt = Date.now();
    let viVoice = null;
    const onStateChange = options.onStateChange || (() => {});

    const hasSynth = typeof window !== 'undefined' && 'speechSynthesis' in window;

    function pickVietnameseVoice() {
      if (!hasSynth) return null;
      const voices = window.speechSynthesis.getVoices() || [];
      return (
        voices.find((v) => /vi[-_]?vn/i.test(v.lang)) ||
        voices.find((v) => /^vi/i.test(v.lang)) ||
        voices.find((v) => /vietnam/i.test(v.name)) ||
        null
      );
    }

    if (hasSynth) {
      viVoice = pickVietnameseVoice();
      if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
        window.speechSynthesis.onvoiceschanged = () => {
          viVoice = pickVietnameseVoice();
        };
      }
    }

    function notify(text = '') {
      onStateChange({ enabled, speaking, currentText: text });
    }

    function drainQueue() {
      if (!enabled || speaking || queue.length === 0) return;
      const next = queue.shift();
      const nextText = next.text;
      currentText = nextText;
      lastActivityAt = Date.now();

      if (!hasSynth) {
        // Simulate brief speaking state for visual indicator even in headless/no-TTS browsers
        speaking = true;
        notify(nextText);
        setTimeout(() => {
          speaking = false;
          currentText = '';
          notify('');
          drainQueue();
        }, 1800);
        return;
      }

      try {
        const utter = new SpeechSynthesisUtterance(nextText);
        utter.lang = 'vi-VN';
        utter.rate = 1.06;
        utter.pitch = 1.05;
        if (!viVoice) viVoice = pickVietnameseVoice();
        if (viVoice) utter.voice = viVoice;

        utter.onstart = () => {
          speaking = true;
          notify(nextText);
        };
        utter.onend = () => {
          speaking = false;
          currentText = '';
          notify('');
          drainQueue();
        };
        utter.onerror = () => {
          speaking = false;
          currentText = '';
          notify('');
          drainQueue();
        };

        speaking = true;
        notify(nextText);
        try {
          if (typeof navigator !== 'undefined' && navigator.audioSession && navigator.audioSession.type !== 'playback') {
            navigator.audioSession.type = 'playback';
          }
        } catch (_) { /* không hỗ trợ audioSession: bỏ qua */ }
        window.speechSynthesis.speak(utter);
      } catch (_err) {
        speaking = false;
        currentText = '';
        notify('');
      }
    }

    // Queue policy (continuous MC):
    // - FIFO, cap 6. Priority (Đại Chiến / winner) clears the queue and
    //   cancels current speech (unchanged).
    // - When full: drop the oldest IDLE line first; if none, drop the
    //   oldest queued line. Event lines are never silently dropped while
    //   an idle line is waiting.
    // - Identical text already queued (or speaking) is skipped (dedup).
    // - A new event line removes pending idle lines (filler yields to content).
    const QUEUE_CAP = 6;

    function speak(text, { priority = false, kind = 'event' } = {}) {
      if (!enabled || !text) return false;
      const clean = String(text).trim();
      if (!clean) return false;

      if (priority) {
        queue = [{ text: clean, kind: 'priority' }];
        if (hasSynth) {
          try { window.speechSynthesis.cancel(); } catch (_e) {}
        }
        speaking = false;
        currentText = '';
      } else {
        if (kind === 'event') {
          // Real events outrank filler: drop pending idle lines.
          queue = queue.filter((item) => item.kind !== 'idle');
        }
        if (currentText === clean || queue.some((item) => item.text === clean)) return true; // dedup
        if (queue.length >= QUEUE_CAP) {
          const idleIdx = queue.findIndex((item) => item.kind === 'idle');
          if (idleIdx !== -1) queue.splice(idleIdx, 1);
          else queue.shift();
        }
        queue.push({ text: clean, kind });
      }

      lastActivityAt = Date.now();
      drainQueue();
      return true;
    }

    function announceFirstLight(user, provinceName, funFact) {
      const text = `${user} vừa thắp sáng ${provinceName}. ${funFact}`;
      return speak(text);
    }

    function announceWinner(provinceName, roundNumber) {
      const text = `Chúc mừng ${provinceName} đã giành chiến thắng vòng đua thắp đèn số ${roundNumber}!`;
      return speak(text, { priority: true });
    }

    function announceDaiChien(user, provinceName) {
      const text = `${user} vừa mở Đại Chiến cho ${provinceName}! Cả nước cùng tăng tốc thắp đèn ngay bây giờ!`;
      return speak(text, { priority: true });
    }

    // --- Continuous-MC line pools (warm, friendly Vietnamese host voice) ---
    function pickRotating(pool, state) {
      const line = pool[state.idx % pool.length];
      state.idx += 1;
      return line;
    }

    const GIFT_LINES = {
      rose_light: [
        (u, p) => `${u} tặng hoa hồng cho ${p}, thêm một lượt thắp! Cảm ơn ${u} nhiều nhé!`,
        (u, p) => `Hoa hồng từ ${u} cho ${p} đây, quê mình sáng thêm một đèn!`,
      ],
      heart_beam: [
        (u, p) => `${u} bắn tim cho ${p}, tim bay rực rỡ luôn!`,
        (u, p) => `Cảm ơn ${u}, chùm tim sáng bừng ${p} rồi!`,
      ],
      camera_orbit: [
        (u, p) => `Camera đang bay quanh ${p}, quà của ${u} đây!`,
        (u, p) => `${u} tặng quà cho ${p}, cả nhà cùng ngắm camera bay nào!`,
      ],
      fireworks: [
        (u, p) => `Pháo hoa rực rỡ trên ${p}, cảm ơn ${u}!`,
        (u, p) => `${u} bắn pháo hoa cho ${p}, đẹp quá cả nhà ơi!`,
      ],
      dragon: [
        (u, p) => `Rồng vàng bay qua bản đồ, ${u} tặng cho ${p}! Quá đỉnh!`,
        (u, p) => `Cả nhà ơi, rồng vàng của ${u} đang bay vì ${p} đây!`,
      ],
      phoenix: [
        (u, p) => `Phượng hoàng lửa rực trời vì ${p}, cảm ơn ${u} rất nhiều!`,
        (u, p) => `${u} vừa gọi phượng hoàng lửa cho ${p}, cháy quá!`,
      ],
    };
    const giftRotateState = {};
    Object.keys(GIFT_LINES).forEach((k) => { giftRotateState[k] = { idx: 0 }; });

    const RELIGHT_LINES = [
      (u, p) => `Thêm một đèn cho ${p}, cảm ơn ${u}!`,
      (u, p) => `${p} sáng thêm, ${u} thắp hay quá!`,
    ];
    const relightState = { idx: 0 };

    const IDLE_LINES = [
      'Xin chào cả nhà! Comment tên tỉnh quê bạn để thắp sáng bản đồ nhé!',
      'Cả nhà ơi, tỉnh quê mình đã sáng chưa? Comment tên tỉnh nào!',
      'Mới vào live thì thả tim và comment quê của bạn nhé, MC đọc tên luôn!',
      'Đua thắp đèn đang chạy đó, tỉnh nào lên đèn nhanh nhất thì thắng vòng này!',
      'Tặng một bông hồng là quê mình sáng thêm một đèn, cả nhà thử nhé!',
      'Bản đồ còn nhiều tỉnh chưa sáng, quê bạn là tỉnh nào? Comment ngay nào!',
    ];
    const idleState = { idx: 0 };

    function announceGift(user, provinceName, effect) {
      const pool = GIFT_LINES[effect];
      if (!pool) return false;
      const line = pickRotating(pool, giftRotateState[effect]);
      return speak(line(user, provinceName), { kind: 'event' });
    }

    function announceRelight(user, provinceName) {
      const line = pickRotating(RELIGHT_LINES, relightState);
      return speak(line(user, provinceName), { kind: 'event' });
    }

    function announceReset() {
      return speak('Bản đồ vừa reset, cả nhà cùng thắp lại từ đầu nhé! Comment tên tỉnh quê bạn nào!', { kind: 'event' });
    }

    function announceIdle() {
      const line = pickRotating(IDLE_LINES, idleState);
      return speak(line, { kind: 'idle' });
    }

    function setEnabled(next) {
      enabled = Boolean(next);
      if (!enabled) {
        queue = [];
        speaking = false;
        if (hasSynth) {
          try { window.speechSynthesis.cancel(); } catch (_e) {}
        }
      }
      notify('');
      return enabled;
    }

    function toggle() {
      return setEnabled(!enabled);
    }

    return {
      speak,
      announceFirstLight,
      announceWinner,
      announceDaiChien,
      announceGift,
      announceRelight,
      announceReset,
      announceIdle,
      setEnabled,
      toggle,
      isEnabled: () => enabled,
      isSpeaking: () => speaking,
      queueLength: () => queue.length,
      getLastActivityAt: () => lastActivityAt,
    };
  }

  root.VietnamTTS = { createTTSController };
})(typeof self !== 'undefined' ? self : this);
