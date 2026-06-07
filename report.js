// ====================================================================
// GrowRep ウィークリー（週報 + 分析ダッシュボード）配信ページ
// --------------------------------------------------------------
// weekly_reports/<exportDate> を auth 越しに読み込み、
//   ① 来週の確定種目バナー  ② Cowork週報(HTML)  ③ 分析ダッシュボード
// を表示する。ダッシュボードは analytics/dashboard.template.html の移植版。
// ====================================================================

const SEEN_KEY = 'growrep_lastSeenWeekly'; // index.html の NEW バッジと共有

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let _reports = []; // [{id, coverPeriodLabel, publishedAt}]
let _charts = []; // 描画済み Chart インスタンス（週切替時に破棄）

// ====================================================================
// AUTH
// ====================================================================
auth.onAuthStateChanged(async (u) => {
  if (u) {
    $('login-wrap').style.display = 'none';
    $('app').style.display = 'block';
    try {
      const ud = await db.collection('users').doc(u.uid).get();
      $('uname').textContent = ud.exists ? ud.data().userName || u.email || '' : u.email || '';
    } catch (e) {
      $('uname').textContent = u.email || '';
    }
    await initReports();
  } else {
    $('login-wrap').style.display = 'flex';
    $('app').style.display = 'none';
  }
});

$('login-btn').addEventListener('click', async () => {
  $('auth-error').textContent = '';
  const em = $('email').value.trim();
  const pw = $('password').value;
  if (!em || !pw) {
    $('auth-error').textContent = '入力してください';
    return;
  }
  try {
    await auth.signInWithEmailAndPassword(em, pw);
  } catch (e) {
    $('auth-error').textContent =
      (typeof getErrorMessage === 'function' && getErrorMessage(e.code)) || 'ログインに失敗しました';
  }
});
$('password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('login-btn').click();
});
$('logout-btn').addEventListener('click', () => auth.signOut());

// ====================================================================
// REPORTS 一覧 → 週セレクタ
// ====================================================================
async function initReports() {
  try {
    const snap = await db
      .collection('weekly_reports')
      .orderBy('publishedAt', 'desc')
      .limit(12)
      .get();
    _reports = snap.docs.map((d) => ({
      id: d.id,
      coverPeriodLabel: d.data().coverPeriodLabel || d.id,
    }));
  } catch (e) {
    // orderBy に必要なインデックスや publishedAt 欠落時のフォールバック（全件取得して id 降順）
    console.warn('[weekly] publishedAt 並べ替え失敗、フォールバック:', e);
    const snap = await db.collection('weekly_reports').get();
    _reports = snap.docs
      .map((d) => ({ id: d.id, coverPeriodLabel: d.data().coverPeriodLabel || d.id }))
      .sort((a, b) => (a.id < b.id ? 1 : -1))
      .slice(0, 12);
  }

  if (_reports.length === 0) {
    $('week-select').style.display = 'none';
    $('content').innerHTML =
      '<div class="empty" style="padding:60px 0;text-align:center">まだウィークリーが配信されていません。<br>日曜夜の配信をお待ちください。</div>';
    return;
  }

  // セレクタ生成
  $('week-select').innerHTML = _reports
    .map((r, i) => `<option value="${esc(r.id)}">${i === 0 ? '最新: ' : ''}${esc(r.coverPeriodLabel)}（${esc(r.id)}）</option>`)
    .join('');
  $('week-select').onchange = (e) => loadReport(e.target.value);

  // 最新を既読にする（index の NEW バッジを消す）
  try {
    localStorage.setItem(SEEN_KEY, _reports[0].id);
  } catch (e) {
    /* localStorage 不可環境は無視 */
  }

  await loadReport(_reports[0].id);
}

// ====================================================================
// 1週分の読み込み & 描画
// ====================================================================
async function loadReport(id) {
  // 既存チャートを破棄
  _charts.forEach((c) => {
    try {
      c.destroy();
    } catch (e) {
      /* noop */
    }
  });
  _charts = [];
  $('content').innerHTML = '<div class="loading"><i class="fa-solid fa-spinner fa-spin"></i> 読み込み中...</div>';

  let doc;
  try {
    doc = await db.collection('weekly_reports').doc(id).get();
  } catch (e) {
    $('content').innerHTML = `<div class="empty">読み込みに失敗しました: ${esc(e.message)}</div>`;
    return;
  }
  if (!doc.exists) {
    $('content').innerHTML = '<div class="empty">このウィークリーは見つかりませんでした。</div>';
    return;
  }
  const data = doc.data();
  const D = data.digest || {};

  // コンテナ骨組み
  $('content').innerHTML = `
    <div id="nextweek-slot"></div>
    <section><h2><span class="ic">📰</span>今週の週報</h2><div id="report-slot" class="report"></div></section>
    <section><h2><span class="ic">🏆</span>週間チャレンジ結果</h2><div id="wc-slot"></div></section>
    <section><h2><span class="ic">📅</span>月間ダービー</h2><div id="derby-slot"></div></section>
    <section><h2><span class="ic">📊</span>今週のサマリー</h2><div class="cards" id="summary-cards"></div></section>
    <section><h2><span class="ic">🏅</span>二つ名・ペルソナ</h2><div class="cards" id="persona-cards"></div></section>
    <section><h2><span class="ic">👤</span>ユーザー別カルテ</h2><div class="grid-users" id="user-cards"></div></section>
    <section><h2><span class="ic">🔥</span>種目ランキング（人気・勢い）</h2><div class="card" style="overflow:auto"><table class="tbl" id="exercise-table"></table></div></section>
    <section><h2><span class="ic">🏷️</span>タグ別の傾向</h2><div class="card" style="overflow:auto"><table class="tbl" id="tag-table"></table></div></section>
    <section><h2><span class="ic">⚔️</span>注目ライバル対決（僅差）</h2><div id="rivalry-list"></div></section>
  `;

  renderNextWeek(D, data);
  $('report-slot').innerHTML = data.reportHtml || '<div class="empty">週報がありません。</div>';
  renderWeeklyChallenge(D);
  renderDerby(D);
  if (D.summary) summaryCards(D);
  if (Array.isArray(D.users)) {
    personaCards(D);
    userCards(D);
  }
  if (Array.isArray(D.exercises)) exerciseTable(D);
  if (Array.isArray(D.tags)) tagTable(D);
  if (Array.isArray(D.rivalries)) rivalryList(D);
}

// ====================================================================
// 来週の確定種目バナー（無ければ確率予想にフォールバック）
// ====================================================================
function renderNextWeek(D, data) {
  const slot = $('nextweek-slot');
  const nc = D.nextWeekConfirmed;
  if (nc && Array.isArray(nc.exercises) && nc.exercises.length) {
    const items = nc.exercises
      .map((e) => {
        const bar = e.barbarian ? '<span class="bar-badge">バーバリアン</span>' : '';
        const fav = e.favorite
          ? `<div class="fav">出たら本命: <b>${esc(e.favorite.user)}</b>（${esc(e.favorite.value)}${e.barbarian ? '秒' : ''}）</div>`
          : '<div class="fav">記録保持者まだなし</div>';
        return `<div class="nw-item"><div class="nm">${esc(e.name)}${bar}</div>${fav}</div>`;
      })
      .join('');
    slot.innerHTML = `<div class="nextweek">
      <div class="nw-head"><i class="fa-solid fa-bullhorn"></i> 来週の確定種目${nc.label ? `・${esc(nc.label)}` : ''}</div>
      <div class="nw-grid">${items}</div>
    </div>`;
    return;
  }
  // フォールバック: 確率予想
  const fc = D.nextWeekForecast;
  if (fc) {
    const top = [...(fc.barbarianCandidates || []).slice(0, 1), ...(fc.normalCandidates || []).slice(0, 2)];
    const items = top
      .map(
        (e) =>
          `<div class="nw-item"><div class="nm">${esc(e.name)}${e.barbarian ? '<span class="bar-badge">バーバリアン</span>' : ''}</div>
           <div class="nw-prob">出やすさ ${esc(e.pickChance ?? '-')}%${e.favorite ? ` / 本命 ${esc(e.favorite.user)}` : ''}</div></div>`
      )
      .join('');
    slot.innerHTML = `<div class="nextweek">
      <div class="nw-head"><i class="fa-solid fa-dice"></i> 来週の予想（確率・抽選前）</div>
      <div class="nw-grid">${items}</div>
      <div class="nw-prob">※ 種目は日曜17時の加重ランダム抽選で確定します。</div>
    </div>`;
  }
}

// ====================================================================
// 週間チャレンジ結果
// ====================================================================
function renderWeeklyChallenge(D) {
  const slot = $('wc-slot');
  const wc = D.weeklyChallenge;
  if (!wc || !Array.isArray(wc.standings) || wc.standings.length === 0) {
    slot.innerHTML = '<div class="empty">今週の週間チャレンジ記録はありません。</div>';
    return;
  }
  const champ = wc.champion;
  const exNames = (wc.exercises || []).map((e) => `${esc(e.name)}${e.barbarian ? '⏱' : ''}`).join(' / ');
  const head = `<div class="card" style="margin-bottom:10px">
    <div class="stat small"><span class="crown"><i class="fa-solid fa-crown"></i></span> ${champ ? esc(champ.userName) : '-'}
      ${champ && champ.perfect ? '<span class="lead-pill">完全優勝</span>' : ''}</div>
    <div class="lbl">今週の王者（${champ ? esc(champ.totalScore) : '-'} / ${esc(wc.maxScore ?? '-')}点）${
    wc.leadMargin != null ? ` ・2位と${esc(wc.leadMargin)}点差` : ''
  }</div>
    <div class="lbl" style="margin-top:6px">種目: ${exNames || '-'}（${esc(wc.period?.label || '')}）</div>
  </div>`;

  const exCols = (wc.exercises || []).map((e) => `<th class="num">${esc(e.name)}${e.barbarian ? '⏱' : ''}</th>`).join('');
  const rows = wc.standings
    .map((s) => {
      const per = (s.perExercise || [])
        .map((p) => {
          const lead = p.isLeader ? ' style="color:var(--gold);font-weight:700"' : '';
          const val = p.value == null ? '—' : `${esc(p.value)}<span style="color:var(--tx2)">(${esc(p.score)})</span>`;
          return `<td class="num"${lead}>${val}</td>`;
        })
        .join('');
      return `<tr>
        <td class="${s.rank === 1 ? 'rank1' : ''}">${s.rank === 1 ? '👑 ' : ''}${esc(s.rank)}</td>
        <td>${esc(s.userName)}</td>
        <td class="num"><b>${esc(s.totalScore)}</b></td>
        ${per}
      </tr>`;
    })
    .join('');
  slot.innerHTML =
    head +
    `<div class="card" style="overflow:auto"><table class="tbl">
      <thead><tr><th>順位</th><th>名前</th><th class="num">合計</th>${exCols}</tr></thead>
      <tbody>${rows}</tbody></table></div>`;
}

// ====================================================================
// 月間ダービー
// ====================================================================
function renderDerby(D) {
  const slot = $('derby-slot');
  const dby = D.monthlyDerby;
  if (!dby || !Array.isArray(dby.standings) || dby.standings.length === 0) {
    slot.innerHTML = '<div class="empty">月間ダービーのデータはまだありません。</div>';
    return;
  }
  const statusPill = dby.monthOver
    ? '<span class="lead-pill" style="color:var(--gold)">確定</span>'
    : '<span class="lead-pill">途中経過・暫定</span>';
  const head = `<div class="card" style="margin-bottom:10px">
    <div class="stat small">${esc(dby.label || '月間ダービー')} ${statusPill}</div>
    <div class="lbl">${dby.monthOver ? '月間チャンプ' : '暫定首位'}: <b>${esc(dby.leader?.userName || '-')}</b>（${esc(
    dby.leader?.total ?? '-'
  )}点）${dby.leadMargin != null ? ` ・2位と${esc(dby.leadMargin)}点差` : ''}</div>
  </div>`;
  const weekCols = (dby.weeks || []).map((w) => `<th class="num" title="${esc(w.label)}">第${esc(w.weekNum)}週</th>`).join('');
  const rows = dby.standings
    .map(
      (s) => `<tr>
        <td class="${s.rank === 1 ? 'rank1' : ''}">${esc(s.rank)}</td>
        <td>${esc(s.userName)}</td>
        <td class="num"><b>${esc(s.total)}</b></td>
        ${(s.weeklyScores || []).map((v) => `<td class="num">${v ? esc(v) : '−'}</td>`).join('')}
      </tr>`
    )
    .join('');
  slot.innerHTML =
    head +
    `<div class="card" style="overflow:auto"><table class="tbl">
      <thead><tr><th>順位</th><th>名前</th><th class="num">合計</th>${weekCols}</tr></thead>
      <tbody>${rows}</tbody></table></div>`;
}

// ====================================================================
// 以下、dashboard.template.html からの移植
// ====================================================================
function summaryCards(D) {
  const s = D.summary;
  const cards = [
    { n: s.postsThisWeek, l: '今週の投稿数' },
    { n: s.activeUsersThisWeek, l: '今週の活動人数' },
    { n: s.hottestExercise || '-', l: '今週の人気種目', small: true },
    { n: s.mvp ? s.mvp.userName : '-', l: `今週のMVP${s.mvp ? `（PB${s.mvp.pbThisWeek}・投稿${s.mvp.postsThisWeek}）` : ''}`, small: true },
    { n: s.totalPosts, l: '累計投稿数' },
    { n: s.activeUsers + '/' + s.totalUsers, l: '活動ユーザー' },
    { n: s.totalExercises, l: '種目数' },
  ];
  $('summary-cards').innerHTML = cards
    .map((c) => `<div class="card"><div class="stat ${c.small ? 'small' : ''}">${esc(c.n)}</div><div class="lbl">${esc(c.l)}</div></div>`)
    .join('');
}

function personaCards(D) {
  const holders = {};
  for (const u of D.users) {
    for (const b of u.badges || []) {
      if (!holders[b.label]) holders[b.label] = [];
      holders[b.label].push({ user: u.userName, desc: b.desc, value: b.value });
    }
  }
  const order = ['投稿王', '継続の鬼', '急成長株', '人気者', 'いいね職人', 'コメント番長', '種目クリエイター', '神種目メーカー', '万能型', '一点特化型', '朝型', '夜型'];
  const keys = Object.keys(holders).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  $('persona-cards').innerHTML =
    keys
      .map((k) => {
        const list = holders[k];
        const who = list
          .map((h) => esc(h.user) + (h.value != null ? ` <span style="color:var(--tx2)">(${esc(h.value)})</span>` : ''))
          .join('、');
        return `<div class="card"><div class="stat small" style="color:var(--gold)">${esc(k)}</div>
        <div class="lbl">${esc(list[0].desc)}</div>
        <div style="margin-top:6px;font-weight:600">${who}</div></div>`;
      })
      .join('') || '<div class="empty">該当者なし</div>';
}

function pctClass(p) {
  return p >= 66 ? 'hi' : p <= 33 ? 'lo' : 'mid';
}
const WD = ['日', '月', '火', '水', '木', '金', '土'];

function userCards(D) {
  const cont = $('user-cards');
  const actives = D.users.filter((u) => u.totalPosts > 0);
  cont.innerHTML = actives
    .map((u, i) => {
      const tagKeys = Object.keys(u.tagStrength || {});
      const badges =
        (u.badges || []).map((b) => `<span class="badge" title="${esc(b.desc)}">${esc(b.label)}</span>`).join('') ||
        '<span class="badge no">称号なし</span>';
      const strengths = u.strengths && u.strengths.length
        ? u.strengths
            .map((e) => `<li><span>${esc(e.name)}</span><span class="pct ${pctClass(e.percentile)}">上位${(100 - e.percentile).toFixed(0)}%</span></li>`)
            .join('')
        : '<li class="empty">比較データ不足</li>';
      const weak = u.weaknesses && u.weaknesses.length
        ? u.weaknesses
            .map((e) => `<li><span>${esc(e.name)}</span><span class="pct ${pctClass(e.percentile)}">上位${(100 - e.percentile).toFixed(0)}%</span></li>`)
            .join('')
        : '<li class="empty">-</li>';
      const grow = u.growthStars && u.growthStars.length
        ? u.growthStars.map((e) => `<li><span>${esc(e.name)}</span><span class="trend-improving">+${esc(e.relSlopeWeekPct)}%/週</span></li>`).join('')
        : '<li class="empty">該当なし</li>';
      const neglect = u.neglectedTags && u.neglectedTags.length
        ? u.neglectedTags.map((t) => `<span class="chip">${esc(t)}</span>`).join('')
        : '<span class="empty">なし</span>';
      return `<div class="ucard">
      <div class="uhead"><div class="uname2">${esc(u.userName)}</div><div class="utype">${esc(u.type || '-')}</div></div>
      <div class="badges">${badges}</div>
      <div class="mini">
        <div><div class="n">${esc(u.totalPosts)}</div><div class="l">投稿</div></div>
        <div><div class="n">${esc(u.activeDays)}</div><div class="l">活動日</div></div>
        <div><div class="n">${esc(u.longestStreak)}</div><div class="l">最長連続</div></div>
        <div><div class="n">${u.overallSkill ?? '-'}</div><div class="l">総合力%</div></div>
      </div>
      <div class="mini">
        <div><div class="n">${esc(u.social.likesReceived)}</div><div class="l">被いいね</div></div>
        <div><div class="n">${esc(u.social.likesGiven)}</div><div class="l">応援した</div></div>
        <div><div class="n">${esc(u.social.commentsReceived)}</div><div class="l">被コメ</div></div>
        <div><div class="n">${esc(u.social.commentsGiven)}</div><div class="l">コメした</div></div>
      </div>
      ${tagKeys.length >= 3 ? `<div class="sect-lbl">タグ別の強み（相対パーセンタイル）</div><div class="canvas-wrap"><canvas id="radar-${i}"></canvas></div>` : ''}
      <div class="row"><div class="col">
        <div class="sect-lbl">得意トップ3</div><ul class="lst">${strengths}</ul>
      </div><div class="col">
        <div class="sect-lbl">苦手ワースト3</div><ul class="lst">${weak}</ul>
      </div></div>
      <div class="sect-lbl">急成長中</div><ul class="lst">${grow}</ul>
      <div class="sect-lbl">未開拓タグ（次の挑戦候補）</div><div class="neglect">${neglect}</div>
      <div class="sect-lbl">曜日別の投稿</div>
      <div class="canvas-wrap" style="height:120px"><canvas id="wd-${i}"></canvas></div>
    </div>`;
    })
    .join('');

  actives.forEach((u, i) => {
    const tagKeys = Object.keys(u.tagStrength || {});
    if (tagKeys.length >= 3 && $(`radar-${i}`)) {
      _charts.push(
        new Chart($(`radar-${i}`), {
          type: 'radar',
          data: {
            labels: tagKeys,
            datasets: [
              {
                data: tagKeys.map((t) => u.tagStrength[t]),
                backgroundColor: 'rgba(78,161,255,.2)',
                borderColor: '#4ea1ff',
                pointBackgroundColor: '#4ea1ff',
              },
            ],
          },
          options: {
            plugins: { legend: { display: false } },
            scales: {
              r: {
                suggestedMin: 0,
                suggestedMax: 100,
                ticks: { display: false, stepSize: 25 },
                grid: { color: '#2a323d' },
                angleLines: { color: '#2a323d' },
                pointLabels: { color: '#9aa7b4', font: { size: 10 } },
              },
            },
            responsive: true,
            maintainAspectRatio: false,
          },
        })
      );
    }
    if ($(`wd-${i}`)) {
      _charts.push(
        new Chart($(`wd-${i}`), {
          type: 'bar',
          data: { labels: WD, datasets: [{ data: u.weekday, backgroundColor: '#4ea1ff' }] },
          options: {
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { color: '#9aa7b4', font: { size: 10 } }, grid: { display: false } },
              y: { ticks: { display: false }, grid: { color: '#222' } },
            },
            responsive: true,
            maintainAspectRatio: false,
          },
        })
      );
    }
  });
}

function exerciseTable(D) {
  const rows = D.exercises
    .map((e) => {
      const mom =
        e.momentum > 0
          ? `<span class="mom-up">▲${esc(e.momentum)}</span>`
          : e.momentum < 0
          ? `<span class="mom-down">▼${Math.abs(e.momentum)}</span>`
          : '<span class="mom-flat">−</span>';
      const rating = e.rating && e.rating.count > 0 ? `★${esc(e.rating.avg)} (${esc(e.rating.count)})` : '-';
      return `<tr>
      <td>${esc(e.name)}</td>
      <td>${(e.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join('') || '-'}</td>
      <td class="num">${esc(e.totalPosts)}</td>
      <td class="num">${esc(e.uniqueUsers)}</td>
      <td class="num">${esc(e.recent7)}</td>
      <td class="num">${mom}</td>
      <td>${esc(e.topUser || '-')}</td>
      <td>${rating}</td>
      <td style="color:var(--tx2)">${esc(e.createdByName || '-')}</td>
    </tr>`;
    })
    .join('');
  $('exercise-table').innerHTML = `<thead><tr><th>種目</th><th>タグ</th><th>累計</th><th>人数</th><th>今週</th><th>勢い</th><th>トップ</th><th>評価</th><th>作成者</th></tr></thead><tbody>${rows}</tbody>`;
}

function tagTable(D) {
  const rows = D.tags
    .map(
      (t) =>
        `<tr><td>${esc(t.tag)}</td><td class="num">${esc(t.exerciseCount)}</td><td class="num">${esc(t.postCount)}</td>
     <td>${t.king ? esc(t.king.user) + ` <span style="color:var(--tx2)">(${esc(t.king.score)})</span>` : '-'}</td></tr>`
    )
    .join('');
  $('tag-table').innerHTML = `<thead><tr><th>タグ</th><th>種目数</th><th>投稿数</th><th>タグ王（相対実力）</th></tr></thead><tbody>${rows}</tbody>`;
}

function rivalryList(D) {
  const cont = $('rivalry-list');
  if (!D.rivalries.length) {
    cont.innerHTML = '<div class="empty">僅差の対決はありません</div>';
    return;
  }
  cont.innerHTML = D.rivalries
    .map((r) => {
      const ratio = r.leaderValue > 0 ? (r.challengerValue / r.leaderValue) * 100 : 0;
      return `<div class="rival">
      <div class="vs"><span class="who">🥇 ${esc(r.leader)} (${esc(r.leaderValue)})</span>
        <span class="gap">差 ${esc(r.gapPct)}%</span>
        <span class="who" style="color:var(--tx2)">${esc(r.challenger)} (${esc(r.challengerValue)}) 🥈</span></div>
      <div style="font-size:11px;color:var(--tx2);margin-top:4px">${esc(r.exercise)}</div>
      <div class="bar"><i style="width:${ratio}%"></i></div>
    </div>`;
    })
    .join('');
}
