/**
 * 週間チャレンジ / 月間ダービー / チャレンジ外行動 / 評価交流 の集計
 * --------------------------------------------------------------
 * app.js の本体ロジックを「事実」として決定論的に再現する。
 *  - 週間チャレンジ得点: 平日(JST)・今週の3種目のみ。通常=self/max*100、バーバリアン=min/self*100
 *  - 月間ダービー: その月の各週(週間チャレンジ得点)の合計
 *  - チャレンジ外: 今週あえて3種目以外を行った行動（個性・愛のシグナル）
 *  - 評価交流: 種目評価(1-5)＋コメントのネットワーク
 *
 * 数値はここで確定させ、Cowork には解釈・物語化だけを任せる設計。
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const SCORE_EPS = 1e-3;

function tsMs(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function round(n, p = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  const f = 10 ** p;
  return Math.round(n * f) / f;
}

// JST換算で平日(月〜金)か
function isWeekdayJST(ms) {
  const dow = new Date(ms + JST_OFFSET_MS).getUTCDay();
  return dow >= 1 && dow <= 5;
}

// app.js getWeekNumberOfYear と同じ
function getWeekNumberOfYear(dateMs) {
  const d = new Date(dateMs);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((dateMs - yearStart) / DAY + 1) / 7);
}

// app.js buildChampionDocMeta と同じ（weekStart は UTC ms）
function championDocMeta(weekStartMs) {
  const monJST = weekStartMs + JST_OFFSET_MS + 1 * DAY;
  const friJST = weekStartMs + JST_OFFSET_MS + 5 * DAY;
  const weekNumber = getWeekNumberOfYear(monJST);
  const year = new Date(monJST).getUTCFullYear();
  const docId = `${year}_W${String(weekNumber).padStart(2, '0')}`;
  return { docId, year, weekNumber, monJST, friJST };
}

function periodLabel(weekStartMs) {
  const { monJST, friJST } = championDocMeta(weekStartMs);
  const dn = ['日', '月', '火', '水', '木', '金', '土'];
  const f = (ms) => {
    const d = new Date(ms);
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${dn[d.getUTCDay()]})`;
  };
  return `${f(monJST)}〜${f(friJST)}`;
}

// app.js getChampionDecisionTimeUTC / isChampionWeekDecided
function isChampionWeekDecided(weekStartMs, nowMs) {
  const { monJST } = championDocMeta(weekStartMs);
  const decisionTime = monJST + 5 * DAY; // 土曜0:00 JST(fakeUTC) = 確定時刻
  return nowMs >= decisionTime;
}

// app.js getMonthlyDerbyBounds
function monthlyDerbyBounds(year, month) {
  const firstMondayUTC = (y, m) => {
    const d = Date.UTC(y, m - 1, 1);
    const dow = new Date(d).getUTCDay();
    const daysToMon = (8 - dow) % 7;
    return d + daysToMon * DAY;
  };
  const derbyStart = firstMondayUTC(year, month);
  let ny = year;
  let nm = month + 1;
  if (nm > 12) {
    nm = 1;
    ny++;
  }
  const derbyEnd = firstMondayUTC(ny, nm) - DAY;
  return { derbyStart, derbyEnd };
}

// app.js getCurrentDerbyYearMonth（now は exportedAt ms）
function currentDerbyYearMonth(nowMs) {
  const jstNow = new Date(nowMs + JST_OFFSET_MS);
  let year = jstNow.getUTCFullYear();
  let month = jstNow.getUTCMonth() + 1;
  const { derbyStart } = monthlyDerbyBounds(year, month);
  const todayUTC = Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate());
  if (todayUTC < derbyStart) {
    month--;
    if (month < 1) {
      month = 12;
      year--;
    }
  }
  return { year, month };
}

// 競技順位付け（同点は同順位、タイブレークは uid）
function applyCompetitionRank(arr, scoreKey = 'totalScore') {
  arr.sort((a, b) =>
    Math.abs(b[scoreKey] - a[scoreKey]) > SCORE_EPS
      ? b[scoreKey] - a[scoreKey]
      : a.uid.localeCompare(b.uid)
  );
  let prev = null;
  let prevRank = 0;
  arr.forEach((u, i) => {
    if (prev !== null && Math.abs(u[scoreKey] - prev) <= SCORE_EPS) {
      u.rank = prevRank;
    } else {
      u.rank = i + 1;
      prevRank = i + 1;
    }
    prev = u[scoreKey];
  });
  return arr;
}

/**
 * 1週分の週間チャレンジ得点を計算する（app.js の getAllUsersScoresWeekly / buildWeeklyChampionPayload と同等）
 * @returns Map<uid, { ex:{key:bestValue}, scores:{key:pct}, totalScore }>
 */
function computeWeekRecords(posts, exByKey, weekStartMs, weekEndMs, exerciseKeys) {
  const keys = exerciseKeys.filter((k) => exByKey.has(k));
  const rec = new Map();
  for (const p of posts) {
    const t = tsMs(p.timestamp);
    if (t === null || t < weekStartMs || t >= weekEndMs) continue;
    if (!isWeekdayJST(t)) continue;
    if (!keys.includes(p.exerciseKey)) continue;
    const v = Number(p.value) || 0;
    if (v <= 0) continue;
    if (!rec.has(p.uid)) rec.set(p.uid, { ex: {}, scores: {}, totalScore: 0 });
    const r = rec.get(p.uid);
    const isBar = !!exByKey.get(p.exerciseKey)?.barbarian;
    const cur = r.ex[p.exerciseKey];
    if (isBar) {
      if (cur === undefined || cur > v) r.ex[p.exerciseKey] = v;
    } else if (cur === undefined || cur < v) {
      r.ex[p.exerciseKey] = v;
    }
  }
  // 種目ごとの%計算と、種目別ベスト保持者
  const exerciseLeader = {};
  for (const key of keys) {
    const isBar = !!exByKey.get(key)?.barbarian;
    if (isBar) {
      let minVal = Infinity;
      let leaderUid = null;
      for (const [uid, r] of rec) {
        const v = r.ex[key];
        if (v !== undefined && v > 0 && v < minVal) {
          minVal = v;
          leaderUid = uid;
        }
      }
      for (const r of rec.values()) {
        const v = r.ex[key];
        const pct = v !== undefined && v > 0 && minVal !== Infinity ? (minVal / v) * 100 : 0;
        r.scores[key] = pct;
        r.totalScore += pct;
      }
      exerciseLeader[key] = leaderUid;
    } else {
      let maxVal = 0;
      let leaderUid = null;
      for (const [uid, r] of rec) {
        const v = r.ex[key] || 0;
        if (v > maxVal) {
          maxVal = v;
          leaderUid = uid;
        }
      }
      for (const r of rec.values()) {
        const v = r.ex[key] || 0;
        const pct = maxVal > 0 ? (v / maxVal) * 100 : 0;
        r.scores[key] = pct;
        r.totalScore += pct;
      }
      exerciseLeader[key] = leaderUid;
    }
  }
  return { rec, exerciseLeader, keys };
}

/**
 * 今週の週間チャレンジ標準分析
 */
function buildWeeklyChallenge(ds, exByKey, nameOf) {
  const wc = ds.weeklyChallenge;
  if (!wc || !Array.isArray(wc.exercises) || wc.exercises.length === 0) return null;
  const weekStartMs = tsMs(wc.weekStart);
  const weekEndMs = tsMs(wc.weekEnd);
  if (weekStartMs === null || weekEndMs === null) return null;

  const { rec, exerciseLeader, keys } = computeWeekRecords(
    ds.posts,
    exByKey,
    weekStartMs,
    weekEndMs,
    wc.exercises
  );

  const exercises = wc.exercises.map((k) => {
    const e = exByKey.get(k);
    return {
      key: k,
      name: e?.name || k,
      barbarian: !!e?.barbarian,
      tags: e?.tags || [],
      ratingAvg: e?.rating?.avg ?? null,
      ratingCount: e?.rating?.count ?? 0,
      createdByName: e?.createdByName || null,
      unit: e?.barbarian ? '秒(短いほど良い)' : '回/値(多いほど良い)',
    };
  });

  const standings = [];
  for (const [uid, r] of rec) {
    const perExercise = keys.map((k) => ({
      key: k,
      name: exByKey.get(k)?.name || k,
      barbarian: !!exByKey.get(k)?.barbarian,
      value: r.ex[k] ?? null,
      score: round(r.scores[k] ?? 0, 1),
      isLeader: exerciseLeader[k] === uid,
    }));
    standings.push({
      uid,
      userName: nameOf(uid),
      totalScore: round(r.totalScore, 1),
      doneCount: Object.keys(r.ex).length,
      exerciseCount: keys.length,
      perfect: keys.length > 0 && Math.abs(r.totalScore - keys.length * 100) < 0.5,
      perExercise,
    });
  }
  applyCompetitionRank(standings);

  const leader = standings.find((s) => s.rank === 1) || null;
  const second = standings.find((s) => s.rank === 2) || null;

  // 各人へのナラティブ補助: トップとの差 / 一つ上との差 / 未消化種目 / 逆転に必要な種目
  const perUser = standings.map((s) => {
    const gapToLeader = leader ? round(leader.totalScore - s.totalScore, 1) : null;
    const up = standings.find((x) => x.rank === s.rank - 1);
    const gapToNextUp = up ? round(up.totalScore - s.totalScore, 1) : null;
    const down = standings.find((x) => x.rank === s.rank + 1);
    const gapToNextDown = down ? round(s.totalScore - down.totalScore, 1) : null;
    const missingExercises = s.perExercise.filter((e) => e.value === null).map((e) => e.name);
    // 伸びしろ: 自分がリーダーでない種目で、満点(100)との差が大きい順
    const improvable = s.perExercise
      .filter((e) => !e.isLeader && e.score !== null)
      .map((e) => ({ name: e.name, score: e.score, pointsToFull: round(100 - e.score, 1) }))
      .sort((a, b) => b.pointsToFull - a.pointsToFull);
    return {
      userName: s.userName,
      rank: s.rank,
      totalScore: s.totalScore,
      doneCount: s.doneCount,
      gapToLeader,
      gapToNextUp,
      gapToNextDown,
      missingExercises,
      improvable: improvable.slice(0, 3),
    };
  });

  return {
    period: { weekStart: wc.weekStart, weekEnd: wc.weekEnd, label: periodLabel(weekStartMs) },
    isManualOverride: !!wc.isManualOverride,
    overrideLabel: wc.overrideLabel || null,
    maxScore: keys.length * 100,
    exercises,
    champion: leader
      ? { userName: leader.userName, totalScore: leader.totalScore, perfect: leader.perfect, doneCount: leader.doneCount }
      : null,
    leadMargin: leader && second ? round(leader.totalScore - second.totalScore, 1) : null,
    standings: standings.sort((a, b) => a.rank - b.rank),
    perUser,
  };
}

/**
 * 月間ダービー（その月の各週の週間チャレンジ得点合計）
 */
function buildMonthlyDerby(ds, exByKey, nameOf) {
  const nowMs = tsMs(ds.meta?.exportedAt) || Date.now();
  const { year, month } = currentDerbyYearMonth(nowMs);
  const { derbyStart, derbyEnd } = monthlyDerbyBounds(year, month);

  // 履歴 + 今週から、ダービー期間内の週を収集
  const weeks = [];
  const seen = new Set();
  const addWeek = (weekStart, weekEnd, exercises) => {
    const wsMs = tsMs(weekStart);
    if (wsMs === null) return;
    const { docId, monJST } = championDocMeta(wsMs);
    const monDay = Date.UTC(
      new Date(monJST).getUTCFullYear(),
      new Date(monJST).getUTCMonth(),
      new Date(monJST).getUTCDate()
    );
    if (monDay < derbyStart || monDay > derbyEnd) return;
    if (seen.has(docId)) return;
    seen.add(docId);
    weeks.push({
      docId,
      weekStartMs: wsMs,
      weekEndMs: tsMs(weekEnd) ?? wsMs + 7 * DAY,
      exercises: Array.isArray(exercises) ? exercises : [],
    });
  };

  // 現在進行中の週は「ライブの weekly_challenge」を真とする（同 docId の履歴が
  // 古い種目で残っているケースがあるため、ライブを先に登録して dedup で勝たせる）
  const wc = ds.weeklyChallenge;
  if (wc && wc.weekStart) addWeek(wc.weekStart, wc.weekEnd, wc.exercises);
  for (const h of ds.weeklyHistory || []) addWeek(h.weekStart, h.weekEnd, h.exercises);

  weeks.sort((a, b) => a.weekStartMs - b.weekStartMs);
  if (weeks.length === 0) return { year, month, weeks: 0, standings: [] };

  const weekMeta = [];
  const summary = new Map(); // uid -> { total, weeklyScores[] }
  weeks.forEach((w, wi) => {
    const { rec } = computeWeekRecords(ds.posts, exByKey, w.weekStartMs, w.weekEndMs, w.exercises);
    weekMeta.push({
      weekNum: wi + 1,
      label: periodLabel(w.weekStartMs),
      exercises: w.exercises
        .filter((k) => exByKey.has(k))
        .map((k) => exByKey.get(k)?.name || k),
      decided: isChampionWeekDecided(w.weekStartMs, nowMs),
    });
    for (const [uid, r] of rec) {
      if (!summary.has(uid))
        summary.set(uid, { uid, userName: nameOf(uid), total: 0, weeklyScores: new Array(weeks.length).fill(0) });
      const s = summary.get(uid);
      s.weeklyScores[wi] = round(r.totalScore, 1);
      s.total += r.totalScore;
    }
  });

  const standings = [...summary.values()].map((s) => ({
    uid: s.uid,
    userName: s.userName,
    total: round(s.total, 1),
    weeklyScores: s.weeklyScores,
    weeksParticipated: s.weeklyScores.filter((x) => x > 0).length,
  }));
  applyCompetitionRank(standings, 'total');
  standings.sort((a, b) => a.rank - b.rank);

  const leader = standings.find((s) => s.rank === 1) || null;
  const second = standings.find((s) => s.rank === 2) || null;
  const lastWeek = weeks[weeks.length - 1];
  const lastWeekDecided = isChampionWeekDecided(lastWeek.weekStartMs, nowMs);
  // 月そのものが終わったか（JST で derbyEnd を過ぎたか）= 真の月間チャンプ確定条件
  const todayUTC = (() => {
    const j = new Date(nowMs + JST_OFFSET_MS);
    return Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate());
  })();
  const monthOver = todayUTC > derbyEnd;

  return {
    year,
    month,
    label: `${year}年${month}月ダービー`,
    weeksTotal: weeks.length,
    weeksDecided: weekMeta.filter((w) => w.decided).length,
    monthOver, // 月が終了し最終確定したか（暫定首位か正式チャンプかの判定に使う）
    lastWeekDecided,
    weeks: weekMeta,
    champion: monthOver && leader ? { userName: leader.userName, total: leader.total } : null,
    leader: leader ? { userName: leader.userName, total: leader.total } : null,
    leadMargin: leader && second ? round(leader.total - second.total, 1) : null,
    standings,
  };
}

/**
 * チャレンジ外行動（今週あえて3種目以外をやった = 個性・愛のシグナル）
 * 解釈は出さず、事実（消化数・種目・部位）だけを添える。
 */
function buildOffChallenge(ds, exByKey, nameOf) {
  const wc = ds.weeklyChallenge;
  if (!wc || !Array.isArray(wc.exercises)) return null;
  const weekStartMs = tsMs(wc.weekStart);
  const weekEndMs = tsMs(wc.weekEnd);
  if (weekStartMs === null) return null;
  const challengeSet = new Set(wc.exercises);

  // 各人の今週の投稿を集計（チャレンジ消化数は平日得点ベースに合わせる）
  const { rec } = computeWeekRecords(ds.posts, exByKey, weekStartMs, weekEndMs, wc.exercises);

  const byUser = new Map(); // uid -> { off: Map<key,count>, offDays:Set }
  for (const p of ds.posts) {
    const t = tsMs(p.timestamp);
    if (t === null || t < weekStartMs || t >= weekEndMs) continue;
    if (challengeSet.has(p.exerciseKey)) continue;
    if (!p.uid || !p.exerciseKey) continue;
    if (!byUser.has(p.uid)) byUser.set(p.uid, new Map());
    const m = byUser.get(p.uid);
    m.set(p.exerciseKey, (m.get(p.exerciseKey) || 0) + 1);
  }

  const players = [];
  for (const [uid, m] of byUser) {
    const exercises = [...m.entries()]
      .map(([k, count]) => {
        const e = exByKey.get(k);
        return {
          name: e?.name || k,
          tags: e?.tags || [],
          barbarian: !!e?.barbarian,
          excludeFromWeekly: !!e?.excludeFromWeekly,
          createdByName: e?.createdByName || null,
          count,
        };
      })
      .sort((a, b) => b.count - a.count);
    const challengeDoneCount = rec.has(uid) ? Object.keys(rec.get(uid).ex).length : 0;
    players.push({
      userName: nameOf(uid),
      uid,
      challengeDoneCount, // 3種目中いくつ平日に消化したか
      challengeTotal: wc.exercises.filter((k) => exByKey.has(k)).length,
      totalOffPosts: [...m.values()].reduce((s, x) => s + x, 0),
      exercises,
    });
  }
  players.sort((a, b) => b.totalOffPosts - a.totalOffPosts);

  return {
    weekLabel: periodLabel(weekStartMs),
    players,
    note:
      'チャレンジ外種目はあえて選ばれていない種目への投稿。その種目・部位への愛着/こだわりのサイン。' +
      'challengeDoneCount はその人が今週の3種目を平日にいくつ消化したか（前向きな文脈で使う）。',
  };
}

/**
 * 種目の作成・評価・コメントの交流シーン
 */
function buildRatingScene(ds, exByKey, nameOf) {
  const nowMs = tsMs(ds.meta?.exportedAt) || Date.now();
  const detail = ds.ratingDetail || {};

  // 評価エントリを正規化
  const entries = []; // {exKey, exName, creatorName, rater, raterName, rating, comment, t}
  const givenBy = new Map(); // raterUid -> {ratings, comments}
  const engagement = new Map(); // `${raterName}→${creatorName}` -> count
  for (const [exKey, arr] of Object.entries(detail)) {
    const e = exByKey.get(exKey);
    if (!Array.isArray(arr)) continue;
    for (const r of arr) {
      const raterUid = r.uid || r.userId;
      const raterName = r.userName || nameOf(raterUid);
      const comment = (r.comment || '').trim();
      entries.push({
        exKey,
        exName: e?.name || exKey,
        creatorName: e?.createdByName || null,
        raterUid,
        raterName,
        rating: typeof r.rating === 'number' ? r.rating : null,
        comment,
        t: tsMs(r.timestamp || r.updatedAt),
      });
      if (!givenBy.has(raterUid)) givenBy.set(raterUid, { userName: raterName, ratings: 0, comments: 0 });
      const g = givenBy.get(raterUid);
      g.ratings += 1;
      if (comment) g.comments += 1;
      if (e?.createdByName && e.createdByName !== raterName) {
        const key = `${raterName}→${e.createdByName}`;
        engagement.set(key, (engagement.get(key) || 0) + 1);
      }
    }
  }

  // 評価の達人（評価＋コメントを多く付けた人）
  const topEvaluators = [...givenBy.values()]
    .sort((a, b) => b.ratings - a.ratings || b.comments - a.comments)
    .slice(0, 5);

  // 名作種目（評価件数2件以上で平均が高い順）
  const mostLoved = ds.exercises
    .filter((e) => (e.rating?.count || 0) >= 2 && typeof e.rating?.avg === 'number')
    .sort((a, b) => b.rating.avg - a.rating.avg || b.rating.count - a.rating.count)
    .slice(0, 8)
    .map((e) => ({
      name: e.name,
      createdByName: e.createdByName || null,
      avg: round(e.rating.avg, 2),
      count: e.rating.count,
      tags: e.tags || [],
      comments: (detail[e.key] || [])
        .filter((r) => (r.comment || '').trim())
        .map((r) => ({ by: r.userName || nameOf(r.uid), rating: r.rating, comment: r.comment.trim() }))
        .slice(0, 4),
    }));

  // 注目コメント（テキスト付きの評価コメント全件 — Cowork が拾う）
  const notableComments = entries
    .filter((e) => e.comment)
    .sort((a, b) => (b.t || 0) - (a.t || 0))
    .slice(0, 20)
    .map((e) => ({
      exercise: e.exName,
      createdByName: e.creatorName,
      by: e.raterName,
      rating: e.rating,
      comment: e.comment,
    }));

  // 評価ネットワーク（誰が誰の種目を評価しているか）
  const engagementList = [...engagement.entries()]
    .map(([k, count]) => {
      const [rater, creator] = k.split('→');
      return { rater, creator, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // クリエイター別シーン
  const creatorMap = new Map();
  for (const e of ds.exercises) {
    if (!e.createdBy) continue;
    const name = e.createdByName || nameOf(e.createdBy);
    if (!creatorMap.has(e.createdBy))
      creatorMap.set(e.createdBy, {
        userName: name,
        createdCount: 0,
        ratedCount: 0,
        ratingsReceived: 0,
        sumAvg: 0,
        loved: null,
      });
    const c = creatorMap.get(e.createdBy);
    c.createdCount += 1;
    if ((e.rating?.count || 0) > 0 && typeof e.rating?.avg === 'number') {
      c.ratedCount += 1;
      c.ratingsReceived += e.rating.count;
      c.sumAvg += e.rating.avg;
      if (!c.loved || e.rating.avg > c.loved.avg) c.loved = { name: e.name, avg: round(e.rating.avg, 2), count: e.rating.count };
    }
  }
  const creators = [...creatorMap.values()]
    .map((c) => ({
      userName: c.userName,
      createdCount: c.createdCount,
      ratingsReceived: c.ratingsReceived,
      avgRating: c.ratedCount ? round(c.sumAvg / c.ratedCount, 2) : null,
      lovedExercise: c.loved,
    }))
    .sort((a, b) => b.createdCount - a.createdCount);

  // 新作種目（直近14日で作成）
  const freshExercises = ds.exercises
    .filter((e) => {
      const t = tsMs(e.createdAt);
      return t !== null && nowMs - t <= 14 * DAY;
    })
    .sort((a, b) => (tsMs(b.createdAt) || 0) - (tsMs(a.createdAt) || 0))
    .map((e) => ({
      name: e.name,
      createdByName: e.createdByName || null,
      createdAt: e.createdAt,
      tags: e.tags || [],
      ratingAvg: e.rating?.avg ?? null,
      ratingCount: e.rating?.count ?? 0,
    }))
    .slice(0, 10);

  return {
    totalRatedExercises: Object.keys(detail).length,
    topEvaluators,
    mostLoved,
    notableComments,
    engagement: engagementList,
    creators,
    freshExercises,
  };
}

// app.js calcExerciseRatingModifier の移植（種目評価による選出補正）
function exerciseRatingModifier(rating) {
  if (!rating || (rating.count || 0) < 3) return 1.0;
  const avg = rating.avg;
  if (avg == null) return 1.0;
  if (avg <= 2) return 0.3;
  if (avg >= 4) return 2.0;
  if (avg < 3) return 0.3 + (avg - 2) * 0.7;
  return 1.0 + (avg - 3) * 1.0;
}

// app.js calcCreatorRatingModifier の移植（作成者評価による選出補正）
function creatorRatingModifier(creator) {
  if (!creator) return 1.0;
  const count = creator.creatorRatedExerciseCount || 0;
  if (count < 3) return 1.0;
  const avg = creator.creatorAvgRating;
  if (avg == null) return 1.0;
  if (avg <= 2) return 0.6;
  if (avg >= 4) return 1.4;
  return 1.0;
}

/**
 * 次週チャレンジ予想（確率ベース）
 * --------------------------------------------------------------
 * 本体の選出アルゴリズム（除外フラグ無しプールから 通常2＋バーバリアン1 を
 * 重み = 1/(選出回数+1)^指数 × 種目評価補正 × 作成者評価補正 で加重抽選）を再現し、
 * 各種目の相対選出ウェイト（=出やすさ）を算出する。実際の選定は日曜17時以降の
 * 抽選なので「確率予想」。各候補に現状のベスト記録保持者（＝出たら本命）も添える。
 */
function buildNextWeekForecast(ds, exByKey, nameOf) {
  const weightExponent = ds.weeklyConfig?.weightExponent ?? 2;
  const history = ds.weeklyChallenge?.selectionHistory || {};
  const currentKeys = new Set(ds.weeklyChallenge?.exercises || []);

  const creatorByUid = new Map(
    ds.users.map((u) => [
      u.uid,
      { creatorAvgRating: u.creatorAvgRating, creatorRatedExerciseCount: u.creatorRatedExerciseCount },
    ])
  );

  // 種目ごとの全期間ベスト記録（出たら本命を推定する材料）
  const bestByEx = new Map(); // key -> Map<uid, best>
  for (const p of ds.posts) {
    if (!p.exerciseKey || !p.uid) continue;
    const v = Number(p.value) || 0;
    if (v <= 0) continue;
    if (!bestByEx.has(p.exerciseKey)) bestByEx.set(p.exerciseKey, new Map());
    const m = bestByEx.get(p.exerciseKey);
    const isBar = !!exByKey.get(p.exerciseKey)?.barbarian;
    const cur = m.get(p.uid);
    if (cur === undefined || (isBar ? v < cur : v > cur)) m.set(p.uid, v);
  }
  const favoritesOf = (key, barbarian) => {
    const m = bestByEx.get(key);
    if (!m || m.size === 0) return { favorite: null, contenders: [], recordHolders: 0 };
    const ranked = [...m.entries()]
      .map(([uid, v]) => ({ user: nameOf(uid), value: v }))
      .sort((a, b) => (barbarian ? a.value - b.value : b.value - a.value));
    return {
      favorite: ranked[0] || null,
      contenders: ranked.slice(0, 3),
      recordHolders: m.size,
    };
  };

  const pool = ds.exercises.filter((e) => !e.excludeFromWeekly);
  const buildPool = (list, slots) => {
    const weighted = list.map((e) => {
      const base = 1 / Math.pow((history[e.key] || 0) + 1, weightExponent);
      const exMod = exerciseRatingModifier(e.rating);
      const crMod = creatorRatingModifier(e.createdBy ? creatorByUid.get(e.createdBy) : null);
      return { e, weight: Math.max(base * exMod * crMod, 1e-9) };
    });
    const total = weighted.reduce((s, w) => s + w.weight, 0) || 1;
    return weighted
      .map(({ e, weight }) => {
        const fav = favoritesOf(e.key, !!e.barbarian);
        // 1抽選あたりの選出確率 p、slots回の独立近似で「最低1回選ばれる」確率
        const p = weight / total;
        const pickChance = 1 - Math.pow(1 - p, slots);
        return {
          key: e.key,
          name: e.name,
          tags: e.tags || [],
          barbarian: !!e.barbarian,
          createdByName: e.createdByName || null,
          timesSelected: history[e.key] || 0,
          ratingAvg: e.rating?.avg ?? null,
          ratingCount: e.rating?.count ?? 0,
          weightShare: round(p * 100, 1), // 1枠あたりの相対確率
          pickChance: round(pickChance * 100, 1), // 枠数を考慮した「出る」確率(近似)
          isCurrentWeek: currentKeys.has(e.key),
          favorite: fav.favorite,
          contenders: fav.contenders,
          recordHolders: fav.recordHolders,
        };
      })
      .sort((a, b) => b.weightShare - a.weightShare);
  };

  const normal = buildPool(pool.filter((e) => !e.barbarian), 2);
  const barbarian = buildPool(pool.filter((e) => e.barbarian), 1);

  return {
    weightExponent,
    poolSize: { normal: normal.length, barbarian: barbarian.length },
    selectionRule: '通常枠2＋バーバリアン枠1。重み=1/(選出回数+1)^指数×種目評価補正×作成者評価補正。',
    note:
      '実際の選定は日曜17時以降の加重ランダム抽選。weightShare=その枠での1抽選あたり相対確率、' +
      'pickChance=枠数を考慮して最低1回選ばれる近似確率。favorite=その種目の全期間ベスト記録保持者（出たら本命）。' +
      'isCurrentWeek=true は今週出題済みで選出回数+1により当面出にくい。',
    normalCandidates: normal.slice(0, 10),
    barbarianCandidates: barbarian.slice(0, 8),
  };
}

export function buildChallengeSections(ds, exByKey, nameOf) {
  return {
    weeklyChallenge: buildWeeklyChallenge(ds, exByKey, nameOf),
    monthlyDerby: buildMonthlyDerby(ds, exByKey, nameOf),
    offChallenge: buildOffChallenge(ds, exByKey, nameOf),
    nextWeekForecast: buildNextWeekForecast(ds, exByKey, nameOf),
    ratingScene: buildRatingScene(ds, exByKey, nameOf),
  };
}
