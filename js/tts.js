/* Vietnamese AI Voice MC (Web Speech API TTS) */
(function (root) {
  'use strict';

  function createTTSController(options = {}) {
    let enabled = options.enabled !== false;
    let speaking = false;
    let queue = [];
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
      const nextText = queue.shift();

      if (!hasSynth) {
        // Simulate brief speaking state for visual indicator even in headless/no-TTS browsers
        speaking = true;
        notify(nextText);
        setTimeout(() => {
          speaking = false;
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
          notify('');
          drainQueue();
        };
        utter.onerror = () => {
          speaking = false;
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
        notify('');
      }
    }

    function speak(text, { priority = false } = {}) {
      if (!enabled || !text) return false;
      const clean = String(text).trim();
      if (!clean) return false;

      if (priority) {
        queue = [clean];
        if (hasSynth) {
          try { window.speechSynthesis.cancel(); } catch (_e) {}
        }
        speaking = false;
      } else {
        // Keep queue tight so live announcements stay fresh
        if (queue.length >= 3) queue.shift();
        queue.push(clean);
      }

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
      setEnabled,
      toggle,
      isEnabled: () => enabled,
      isSpeaking: () => speaking,
    };
  }

  root.VietnamTTS = { createTTSController };
})(typeof self !== 'undefined' ? self : this);
