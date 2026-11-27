/* Core Game Engine for "Thắp Sáng Bản Đồ Việt Nam" (Universal Browser + Node.js) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const mapData = require('./provinces-data.js');
    module.exports = factory(mapData);
  } else {
    root.VietnamLightGame = factory(root.VIETNAM_MAP_DATA);
  }
}(typeof self !== 'undefined' ? self : this, function (MAP_DATA) {
  'use strict';

  const ROUND_DURATION_SEC = 300; // 5 phút mỗi vòng đua

  const GIFT_TIERS = [
    {
      id: 'rose',
      name: 'Hoa hồng',
      tiktokName: 'Rose',
      icon: '🌹',
      diamonds: 1,
      effect: 'rose_light',
      label: 'Hoa hồng',
      costText: '1 KC',
      desc: '+1 lượt thắp cho quê người tặng · Mưa hoa hồng',
    },
    {
      id: 'heart',
      name: 'Bắn tim',
      tiktokName: 'Finger Heart',
      icon: '🫶',
      diamonds: 5,
      effect: 'heart_beam',
      label: 'Bắn tim',
      costText: '5 KC',
      desc: 'Chùm sáng & tim bay rực rỡ trên tỉnh',
    },
    {
      id: 'camera',
      name: 'TikTok Orbit',
      tiktokName: 'TikTok',
      icon: '🎵',
      diamonds: 9,
      effect: 'camera_orbit',
      label: 'Cà phê / TikTok',
      costText: '9 KC',
      desc: 'Camera bay xoay quanh tỉnh quê bạn',
    },
    {
      id: 'fireworks',
      name: 'Pháo hoa',
      tiktokName: 'Doughnut',
      icon: '🎆',
      diamonds: 10,
      effect: 'fireworks',
      label: 'Pháo hoa',
      costText: '10+ KC',
      desc: 'Bắn pháo hoa rực sáng trên tỉnh',
    },
    {
      id: 'dragon',
      name: 'Rồng vàng',
      tiktokName: 'Golden Dragon',
      icon: '🐉',
      diamonds: 50,
      effect: 'dragon',
      label: 'Rồng vàng',
      costText: '50+ KC',
      desc: 'Rồng vàng uốn lượn bay qua bản đồ',
    },
    {
      id: 'phoenix',
      name: 'Phượng hoàng lửa',
      tiktokName: 'Phoenix',
      icon: '🔥',
      diamonds: 100,
      effect: 'phoenix',
      label: 'Phượng hoàng lửa',
      costText: '100+ KC',
      desc: 'Phượng hoàng lửa tung cánh rực trời',
    },
    {
      id: 'daichien',
      name: 'Mở Đại chiến',
      tiktokName: 'Lion',
      icon: '⚔️',
      diamonds: 500,
      effect: 'dai_chien',
      label: 'Quà Đại Chiến',
      costText: '500+ KC',
      desc: 'Mở Đại chiến ngay lập tức (vòng đua đặc biệt)',
    },
  ];

  function normalizeText(input) {
    if (typeof input !== 'string') return '';
    return input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    const alen = a.length;
    const blen = b.length;
    if (alen === 0) return blen;
    if (blen === 0) return alen;
    const dp = Array.from({ length: alen + 1 }, () => new Array(blen + 1).fill(0));
    for (let i = 0; i <= alen; i++) dp[i][0] = i;
    for (let j = 0; j <= blen; j++) dp[0][j] = j;
    for (let i = 1; i <= alen; i++) {
      for (let j = 1; j <= blen; j++) {
        const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        let val = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
        // Adjacent transposition (e.g. "ha nio" <-> "ha noi") counts as 1 edit
        if (
          i > 1 &&
          j > 1 &&
          a.charCodeAt(i - 1) === b.charCodeAt(j - 2) &&
          a.charCodeAt(i - 2) === b.charCodeAt(j - 1)
        ) {
          val = Math.min(val, dp[i - 2][j - 2] + 1);
        }
        dp[i][j] = val;
      }
    }
    return dp[alen][blen];
  }

  function resolveGiftEffect(diamonds) {
    const d = Number(diamonds) || 1;
    if (d >= 500) return 'dai_chien';
    if (d >= 100) return 'phoenix';
    if (d >= 50) return 'dragon';
    if (d >= 10) return 'fireworks';
    if (d >= 9) return 'camera_orbit';
    if (d >= 5) return 'heart_beam';
    return 'rose_light';
  }

  function buildMatcherIndex(provinces) {
    const exactMap = new Map();
    const multiWordAliases = [];
    const fuzzyTargets = [];
    const shortTokens = new Map(); // 2-3 char tokens like hn, sg, hcm, hue

    for (const p of provinces) {
      const names = new Set([normalizeText(p.name)]);
      for (const al of p.aliases || []) {
        const n = normalizeText(al);
        if (n) names.add(n);
      }

      for (const n of names) {
        if (!exactMap.has(n)) exactMap.set(n, p);
        const compact = n.replace(/\s+/g, '');
        if (compact.length >= 4 && !exactMap.has(compact)) {
          exactMap.set(compact, p);
        }

        if (n.length <= 3) {
          shortTokens.set(n, p);
        } else {
          multiWordAliases.push({ text: n, province: p, len: n.length });
          fuzzyTargets.push({ text: n, compact, province: p });
        }
      }
    }

    // Longer aliases matched first to prevent partial shadowing
    multiWordAliases.sort((a, b) => b.len - a.len);

    return { exactMap, multiWordAliases, fuzzyTargets, shortTokens };
  }

  const MATCHER_INDEX = buildMatcherIndex(MAP_DATA.provinces);

  // Common Vietnamese stop words / chat chatter that shouldn't fuzzy-match provinces
  const CHAT_BLOCKLIST = new Set([
    'hello', 'hi', 'helo', 'chao', 'chao shop', 'chao ad', 'hay qua', 'dep qua',
    'xin chao', 'ok', 'oke', 'yes', 'no', 'haha', 'hihi', 'hehe', 'kkk',
    'tim', 'tym', 'like', 'share', 'follow', 'live', 'comment', 'tang qua',
    'choi sao', 'cach choi', 'test', 'abc', 'xyz', 'cam on', 'thank you',
    'tuyet voi', 'qua dep', 'hay lam', 'yeu viet nam', 'viet nam',
  ]);

  function matchProvince(rawComment) {
    const norm = normalizeText(rawComment);
    if (!norm || norm.length < 2) return null;
    if (/^\d+$/.test(norm)) return null;
    if (CHAT_BLOCKLIST.has(norm)) return null;

    // Strip common leading prefixes like "tinh ", "tp ", "thanh pho ", "que "
    const stripped = norm
      .replace(/^(tinh|thanh pho|tp|que em o|que minh o|que o|que|em o|minh o|toi o|o|den tu|tu)\s+/g, '')
      .trim();

    // 1. Exact match (full comment or stripped prefix)
    if (MATCHER_INDEX.exactMap.has(norm)) {
      return MATCHER_INDEX.exactMap.get(norm);
    }
    if (stripped && MATCHER_INDEX.exactMap.has(stripped)) {
      return MATCHER_INDEX.exactMap.get(stripped);
    }

    // 2. Word-boundary phrase match inside a sentence (e.g. "Quê em ở Thanh Hóa nè")
    const padded = ` ${norm} `;
    for (const entry of MATCHER_INDEX.multiWordAliases) {
      if (padded.includes(` ${entry.text} `)) {
        return entry.province;
      }
    }

    // Standalone short tokens inside short messages (<= 4 words), e.g., "em ở Huế nè"
    const words = norm.split(' ');
    if (words.length <= 5) {
      for (const w of words) {
        if (w === 'hue' && MATCHER_INDEX.shortTokens.has('hue')) {
          return MATCHER_INDEX.shortTokens.get('hue');
        }
        if (words.length <= 2 && MATCHER_INDEX.shortTokens.has(w)) {
          // Only match 2-letter abbreviations (hn, sg, hp, dn, ct) in short 1-2 word comments
          return MATCHER_INDEX.shortTokens.get(w);
        }
      }
    }

    // 3. Fuzzy Levenshtein match for slight typos
    // Build candidate n-grams (length 1..3 words) from stripped comment
    const candWords = (stripped || norm).split(' ');
    const candidates = new Set();
    if (candWords.length <= 4) {
      candidates.add(candWords.join(' '));
      candidates.add(candWords.join(''));
    }
    for (let size = Math.min(3, candWords.length); size >= 1; size--) {
      for (let i = 0; i <= candWords.length - size; i++) {
        const phrase = candWords.slice(i, i + size).join(' ');
        if (phrase.length >= 4 && !CHAT_BLOCKLIST.has(phrase)) {
          candidates.add(phrase);
        }
      }
    }

    let bestProvince = null;
    let bestScore = Infinity;

    for (const cand of candidates) {
      if (/^\d+$/.test(cand)) continue;
      const candCompact = cand.replace(/\s+/g, '');
      if (candCompact.length < 4) continue;

      for (const target of MATCHER_INDEX.fuzzyTargets) {
        // Compare both spaced and compact forms
        const tLen = target.compact.length;
        const cLen = candCompact.length;
        if (Math.abs(tLen - cLen) > 2) continue;

        const maxDist = tLen >= 7 ? 2 : 1;
        const dSpaced = levenshtein(cand, target.text);
        const dCompact = levenshtein(candCompact, target.compact);
        const dist = Math.min(dSpaced, dCompact);

        if (dist > maxDist) continue;

        // Require high similarity ratio so random words don't accidentally match
        const denom = Math.max(tLen, cLen);
        const similarity = 1 - dist / denom;
        const minSim = tLen >= 7 ? 0.76 : 0.80;
        if (similarity < minSim) continue;

        // First character must match for distance == 1 on short words (<=6 chars)
        if (tLen <= 6 && candCompact[0] !== target.compact[0]) continue;

        const score = dist - similarity * 0.1;
        if (score < bestScore) {
          bestScore = score;
          bestProvince = target.province;
        }
      }
    }

    return bestProvince;
  }

  function createGameEngine(options = {}) {
    const roundDurationSec = options.roundDurationSec || ROUND_DURATION_SEC;

    let provinces = [];
    let provinceById = new Map();
    let uniqueUsers = new Set();
    let userStats = new Map(); // user -> { user, avatar, lights, gifts, lastProvinceId }
    let chatHistory = [];
    let giftFeed = [];
    let latestLit = null;
    let lastRoundWinner = null;
    let roundNumber = 1;
    let isDaiChien = false;
    let raceTimeRemaining = roundDurationSec;
    let raceRunning = true;
    let liveStats = {
      viewers: 128,
      views: 705,
      gifts: 0,
      shares: 8,
      likes: 6827,
    };

    function initProvinces() {
      provinces = MAP_DATA.provinces.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        region: p.region,
        funFact: p.funFact,
        cx: p.cx,
        cy: p.cy,
        lx: p.lx,
        ly: p.ly,
        d: p.d,
        bbox: p.bbox,
        lit: false,
        totalLights: 0,
        roundLights: 0,
        totalGifts: 0,
        giftCount: 0,
        firstLitBy: null,
        lastLitBy: null,
      }));
      provinceById = new Map(provinces.map((p) => [p.id, p]));
    }

    initProvinces();

    function getOrCreateUser(user, avatar) {
      const cleanName = String(user || 'Khán giả').trim() || 'Khán giả';
      if (!userStats.has(cleanName)) {
        userStats.set(cleanName, {
          user: cleanName,
          avatar: avatar || '',
          lights: 0,
          gifts: 0,
          lastProvinceId: null,
        });
      }
      const stat = userStats.get(cleanName);
      if (avatar) stat.avatar = avatar;
      return stat;
    }

    function applyLightToProvince(prov, userStat, amount, timestamp) {
      const count = Math.max(1, Number(amount) || 1);
      const isFirstLight = !prov.lit;
      prov.lit = true;
      prov.totalLights += count;
      prov.roundLights += count;
      prov.lastLitBy = { user: userStat.user, avatar: userStat.avatar, timestamp };
      if (isFirstLight) {
        prov.firstLitBy = { user: userStat.user, avatar: userStat.avatar, timestamp };
      }

      uniqueUsers.add(userStat.user);
      userStat.lights += count;
      userStat.lastProvinceId = prov.id;

      latestLit = {
        user: userStat.user,
        avatar: userStat.avatar,
        provinceId: prov.id,
        provinceName: prov.name,
        funFact: prov.funFact,
        isFirstLight,
        totalLights: prov.totalLights,
        timestamp,
      };

      return { isFirstLight, latestLit };
    }

    function processComment({ user, avatar, comment, rankBadge, timestamp = Date.now() }) {
      const cleanUser = String(user || 'Khán giả').trim() || 'Khán giả';
      const text = String(comment || '').trim();
      const matchedMeta = matchProvince(text);
      const prov = matchedMeta ? provinceById.get(matchedMeta.id) : null;

      const chatEntry = {
        id: `c_${timestamp}_${Math.random().toString(36).slice(2, 7)}`,
        user: cleanUser,
        avatar: avatar || '',
        comment: text,
        rankBadge: rankBadge || null,
        matchedProvinceId: prov ? prov.id : null,
        matchedProvinceName: prov ? prov.name : null,
        timestamp,
      };

      chatHistory.push(chatEntry);
      if (chatHistory.length > 80) chatHistory.shift();

      if (!prov) {
        return {
          matched: false,
          province: null,
          isFirstLight: false,
          latestLit: null,
          chatEntry,
        };
      }

      const userStat = getOrCreateUser(cleanUser, avatar);
      const { isFirstLight, latestLit: litCard } = applyLightToProvince(prov, userStat, 1, timestamp);

      return {
        matched: true,
        province: prov,
        isFirstLight,
        latestLit: litCard,
        chatEntry,
      };
    }

    function processGift({
      user,
      avatar,
      giftName,
      diamonds = 1,
      repeatCount = 1,
      provinceId = null,
      province = null,
      timestamp = Date.now(),
    }) {
      const cleanUser = String(user || 'Khán giả').trim() || 'Khán giả';
      const userStat = getOrCreateUser(cleanUser, avatar);
      const unitDiamonds = Math.max(1, Number(diamonds) || 1);
      const count = Math.max(1, Number(repeatCount) || 1);
      const totalDiamonds = unitDiamonds * count;
      const effect = resolveGiftEffect(unitDiamonds);

      // Determine target province (explicit -> user's hometown -> latestLit -> Hà Nội)
      let targetProv = null;
      if (provinceId && provinceById.has(provinceId)) {
        targetProv = provinceById.get(provinceId);
      } else if (province) {
        const m = matchProvince(province);
        if (m) targetProv = provinceById.get(m.id);
      }
      if (!targetProv && userStat.lastProvinceId) {
        targetProv = provinceById.get(userStat.lastProvinceId);
      }
      if (!targetProv && latestLit) {
        targetProv = provinceById.get(latestLit.provinceId);
      }
      if (!targetProv) {
        targetProv = provinceById.get('ha-noi');
      }

      userStat.gifts += totalDiamonds;
      if (!userStat.lastProvinceId && targetProv) {
        userStat.lastProvinceId = targetProv.id;
      }

      targetProv.totalGifts += totalDiamonds;
      targetProv.giftCount += count;

      liveStats.gifts += count;

      let isFirstLight = false;
      let litCard = null;
      let daiChienStarted = false;

      // 1 diamond Rose = +1 lượt thắp cho quê người tặng
      if (effect === 'rose_light') {
        const res = applyLightToProvince(targetProv, userStat, count, timestamp);
        isFirstLight = res.isFirstLight;
        litCard = res.latestLit;
      }

      // Quà lớn nhất (>=500 KC) = Mở Đại chiến ngay lập tức
      if (effect === 'dai_chien') {
        triggerDaiChien(cleanUser, targetProv.name);
        daiChienStarted = true;
      }

      const tierInfo = GIFT_TIERS.find((t) => t.effect === effect) || GIFT_TIERS[0];
      const displayGiftName = giftName || tierInfo.name;

      const giftEntry = {
        id: `g_${timestamp}_${Math.random().toString(36).slice(2, 7)}`,
        user: cleanUser,
        avatar: avatar || '',
        giftName: displayGiftName,
        icon: tierInfo.icon,
        diamonds: unitDiamonds,
        repeatCount: count,
        totalDiamonds,
        effect,
        provinceId: targetProv.id,
        provinceName: targetProv.name,
        timestamp,
      };

      giftFeed.push(giftEntry);
      if (giftFeed.length > 20) giftFeed.shift();

      return {
        giftEntry,
        province: targetProv,
        effect,
        isFirstLight,
        latestLit: litCard,
        daiChienStarted,
      };
    }

    function triggerDaiChien(triggeredBy = 'Host', provinceName = '') {
      for (const p of provinces) {
        p.roundLights = 0;
      }
      roundNumber += 1;
      isDaiChien = true;
      raceTimeRemaining = roundDurationSec;
      raceRunning = true;
      return {
        roundNumber,
        isDaiChien: true,
        triggeredBy,
        provinceName,
        raceTimeRemaining,
      };
    }

    function finishRaceRound(timestamp = Date.now()) {
      const ranked = getRaceTop5();
      const top = ranked.length > 0 ? ranked[0] : null;
      lastRoundWinner = top
        ? {
            roundNumber,
            isDaiChien,
            provinceId: top.id,
            provinceName: top.name,
            roundLights: top.roundLights,
            totalLights: top.totalLights,
            timestamp,
          }
        : null;

      // Reset round lights only; keep session totals (totalLights, lit, gifts, users)
      for (const p of provinces) {
        p.roundLights = 0;
      }
      roundNumber += 1;
      isDaiChien = false;
      raceTimeRemaining = roundDurationSec;

      return {
        finished: true,
        winner: lastRoundWinner,
        newRoundNumber: roundNumber,
      };
    }

    function tickRace(deltaSec = 1, timestamp = Date.now()) {
      if (!raceRunning) {
        return {
          finished: false,
          urgent: raceTimeRemaining > 0 && raceTimeRemaining <= 30,
          raceTimeRemaining,
        };
      }
      raceTimeRemaining = Math.max(0, raceTimeRemaining - deltaSec);
      if (raceTimeRemaining <= 0) {
        return finishRaceRound(timestamp);
      }
      return {
        finished: false,
        urgent: raceTimeRemaining <= 30,
        raceTimeRemaining,
      };
    }

    function setRaceRunning(running) {
      raceRunning = Boolean(running);
      return raceRunning;
    }

    function toggleRace() {
      raceRunning = !raceRunning;
      return raceRunning;
    }

    function resetMap() {
      initProvinces();
      uniqueUsers.clear();
      userStats.clear();
      latestLit = null;
      lastRoundWinner = null;
      giftFeed = [];
      liveStats.gifts = 0;
      roundNumber = 1;
      isDaiChien = false;
      raceTimeRemaining = roundDurationSec;
      return getSnapshot();
    }

    function getProgress() {
      let litCount = 0;
      let totalLights = 0;
      for (const p of provinces) {
        if (p.lit) litCount += 1;
        totalLights += p.totalLights;
      }
      return {
        litCount,
        totalProvinces: provinces.length,
        userCount: uniqueUsers.size,
        totalLights,
        percent: Math.round((litCount / provinces.length) * 1000) / 10,
      };
    }

    function getRaceTop5() {
      return provinces
        .filter((p) => p.roundLights > 0)
        .sort((a, b) => b.roundLights - a.roundLights || b.totalLights - a.totalLights)
        .slice(0, 5)
        .map((p) => ({
          id: p.id,
          name: p.name,
          roundLights: p.roundLights,
          totalLights: p.totalLights,
        }));
    }

    function getGiftTop5() {
      return provinces
        .filter((p) => p.totalGifts > 0)
        .sort((a, b) => b.totalGifts - a.totalGifts || b.giftCount - a.giftCount)
        .slice(0, 5)
        .map((p) => ({
          id: p.id,
          name: p.name,
          totalGifts: p.totalGifts,
          giftCount: p.giftCount,
        }));
    }

    function getHonorTop3() {
      return Array.from(userStats.values())
        .filter((u) => u.lights > 0)
        .sort((a, b) => b.lights - a.lights || b.gifts - a.gifts)
        .slice(0, 3);
    }

    function getSnapshot() {
      return {
        provinces,
        progress: getProgress(),
        latestLit,
        raceTop5: getRaceTop5(),
        giftTop5: getGiftTop5(),
        honorTop3: getHonorTop3(),
        roundNumber,
        isDaiChien,
        raceTimeRemaining,
        raceRunning,
        lastRoundWinner,
        chatHistory,
        giftFeed,
        liveStats,
      };
    }

    function exportState() {
      return {
        provinces: provinces.map((p) => ({
          id: p.id,
          lit: p.lit,
          totalLights: p.totalLights,
          roundLights: p.roundLights,
          totalGifts: p.totalGifts,
          giftCount: p.giftCount,
          firstLitBy: p.firstLitBy,
          lastLitBy: p.lastLitBy,
        })),
        uniqueUsers: Array.from(uniqueUsers),
        userStats: Array.from(userStats.values()),
        latestLit,
        lastRoundWinner,
        roundNumber,
        isDaiChien,
        raceTimeRemaining,
        raceRunning,
        chatHistory: chatHistory.slice(-45),
        giftFeed: giftFeed.slice(-10),
        liveStats: { ...liveStats },
      };
    }

    function importState(data) {
      if (!data || typeof data !== 'object') return getSnapshot();
      initProvinces();

      if (Array.isArray(data.provinces)) {
        for (const item of data.provinces) {
          const prov = provinceById.get(item.id);
          if (!prov) continue;
          prov.lit = Boolean(item.lit);
          prov.totalLights = Number(item.totalLights) || 0;
          prov.roundLights = Number(item.roundLights) || 0;
          prov.totalGifts = Number(item.totalGifts) || 0;
          prov.giftCount = Number(item.giftCount) || 0;
          prov.firstLitBy = item.firstLitBy || null;
          prov.lastLitBy = item.lastLitBy || null;
        }
      }

      uniqueUsers = new Set(Array.isArray(data.uniqueUsers) ? data.uniqueUsers : []);
      userStats = new Map();
      if (Array.isArray(data.userStats)) {
        for (const u of data.userStats) {
          if (u && u.user) {
            userStats.set(u.user, {
              user: u.user,
              avatar: u.avatar || '',
              lights: Number(u.lights) || 0,
              gifts: Number(u.gifts) || 0,
              lastProvinceId: u.lastProvinceId || null,
            });
          }
        }
      }

      latestLit = data.latestLit || null;
      lastRoundWinner = data.lastRoundWinner || null;
      roundNumber = Number(data.roundNumber) || 1;
      isDaiChien = Boolean(data.isDaiChien);
      raceTimeRemaining =
        data.raceTimeRemaining != null ? Number(data.raceTimeRemaining) : roundDurationSec;
      raceRunning = data.raceRunning !== undefined ? Boolean(data.raceRunning) : true;
      chatHistory = Array.isArray(data.chatHistory) ? data.chatHistory.slice(-80) : [];
      giftFeed = Array.isArray(data.giftFeed) ? data.giftFeed.slice(-20) : [];
      if (data.liveStats && typeof data.liveStats === 'object') {
        liveStats = { ...liveStats, ...data.liveStats };
      }
      return getSnapshot();
    }

    return {
      processComment,
      processGift,
      tickRace,
      finishRaceRound,
      triggerDaiChien,
      setRaceRunning,
      toggleRace,
      resetMap,
      getProgress,
      getRaceTop5,
      getGiftTop5,
      getHonorTop3,
      getSnapshot,
      exportState,
      importState,
      getProvince: (id) => provinceById.get(id) || null,
      updateLiveStats: (partial) => Object.assign(liveStats, partial),
    };
  }

  return {
    ROUND_DURATION_SEC,
    GIFT_TIERS,
    normalizeText,
    levenshtein,
    matchProvince,
    resolveGiftEffect,
    createGameEngine,
  };
}));
