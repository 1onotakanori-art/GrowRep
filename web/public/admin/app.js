// GrowRep 管理画面の処理（web/admin.html から読み込む classic script）。
// 旧 GitHub Pages 版 admin.html のインラインスクリプトを移したもの。
// auth / db / firebase（compat SDK）は src/admin/main.ts がグローバルに用意してから
// このファイルを読み込む。onclick 属性から関数を呼ぶため、モジュールにはしていない。
// ====================================================================
// GLOBALS
// ====================================================================
const $ = id => document.getElementById(id);
let _exercises = {}, _wc = null, _wcConfig = {}, _users = {}, _override = null;
// settings_free/daily_mission（今日の種目・直近の選出履歴・過去最高回数）
let _dm = null;
// settings_free/raid_config の goals（日付キー→目標回数）。未設定の日は既定値
let _raidGoals = {};
// settings_free/raid_config の exercises（日付キー→種目キー）。未設定の日は名前から自動解決
let _raidExercises = {};
// settings_free/raid_config の memberCounts（日付キー→その日のログイン人数。アプリが自動記録）
let _raidMembers = {};

// 夏休みレイドの日程表。
// ⚠️ app.js / web の RAID_SCHEDULE の「表示用ミラー」。日付・既定値がズレても
//    実際に使われる目標はアプリ側の RAID_SCHEDULE + この画面が書く上書き
//    （日付キー単位）なので、ズレの影響はこの画面の表示だけに閉じる。
//    それでも紛らわしいので、日程を変えるときは3か所そろえること。
// 3日通算ブロック「複合種目総合1」の名前ヒント（app.js / web と同じ）
const RAID_BLOCK_TOTAL_1_HINTS = ['複合種目総合1', '複合種目総合', '複合種目'];

const RAID_SCHEDULE = [
    // goal = その日の合計を固定 / perPerson = ログイン人数 × 1人あたり
    { dateKey: '2026-08-09', day: 1, nameHints: ['プッシュアップ', '腕立て伏せ', '腕立て', 'push'], goal: 1000 },
    { dateKey: '2026-08-10', day: 2, nameHints: ['スクワット', 'squat'], perPerson: 200 },
    { dateKey: '2026-08-11', day: 3, nameHints: ['懸垂', 'チンニング', 'プルアップ', 'pull'], perPerson: 100 },
    { dateKey: '2026-08-12', day: 4, nameHints: ['クラップクランチ', 'クラップ', 'clap crunch', 'clap'], perPerson: 200 },
    { dateKey: '2026-08-13', day: 5, nameHints: ['ディップス(レイド)', 'ディップス（レイド）', 'ディップス', 'dip'], perPerson: 120 },
    // 8/14〜8/16 は「複合種目総合1」の3日通算ブロック（blockId でまとめる）
    // 数えるのはセット数（1セット＝腕立て10→バックエクステンション10→クラップクランチ10→スクワット20）
    { dateKey: '2026-08-14', day: 6, blockId: 'total1', nameHints: RAID_BLOCK_TOTAL_1_HINTS, perPerson: 30 },
    { dateKey: '2026-08-15', day: 7, blockId: 'total1', nameHints: RAID_BLOCK_TOTAL_1_HINTS, perPerson: 30 },
    { dateKey: '2026-08-16', day: 8, blockId: 'total1', nameHints: RAID_BLOCK_TOTAL_1_HINTS, perPerson: 30 }
];

// 通算ブロック：複数日を1種目でつなぎ、期間の合計で1体のボスを削る単位。
// 入力欄は日ごとのままで、ブロックの目標は「各日の1人あたりの合計 × 人数」
const RAID_BLOCKS = [
    { id: 'total1', title: '複合種目総合1', dateKeys: ['2026-08-14', '2026-08-15', '2026-08-16'] }
];

/** その日が属する通算ブロック（無ければ null） */
function raidBlockOf(d) {
    return RAID_BLOCKS.find(b => b.id === d.blockId) || null;
}

/** その日の設定値（固定目標なら goal、人数割なら perPerson） */
function raidConfiguredValue(d) {
    return (d.perPerson != null ? d.perPerson : d.goal) || 0;
}
const RAID_GOAL_MIN = 1;
const RAID_GOAL_MAX = 1000000;
// この種目はレイド向け、と種目側で宣言するためのタグ（app.js / web の RAID_TAG）
const RAID_TAG = 'レイド';

// ====================================================================
// UTILS
// ====================================================================
function esc(s) { if (typeof s !== 'string') return String(s ?? ''); return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function fmtTs(ts) { if (!ts) return '—'; const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function fmtDate(ts) { if (!ts) return '—'; const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short' }); }
function tog(el) { el.classList.toggle('shut'); el.nextElementSibling.classList.toggle('shut'); }

// 今週の開始日時（JST 日曜17:00, UTC換算）を返す
function getCurrentWeekStart() {
    const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const now = new Date();
    const jstMs = now.getTime() + JST_OFFSET_MS;
    const jstDate = new Date(jstMs);
    const jstDayOfWeek = jstDate.getUTCDay();
    const jstHour = jstDate.getUTCHours();
    const jstMin = jstDate.getUTCMinutes();
    const jstSec = jstDate.getUTCSeconds();
    const jstMsec = jstDate.getUTCMilliseconds();
    const todayJstDayStartMs = jstMs - (jstHour * 3600 + jstMin * 60 + jstSec) * 1000 - jstMsec;
    let daysBack = (jstDayOfWeek === 0 && jstHour < 17) ? 7 : jstDayOfWeek;
    const lastSundayJstDayStartMs = todayJstDayStartMs - daysBack * 24 * 60 * 60 * 1000;
    return new Date(lastSundayJstDayStartMs + 17 * 60 * 60 * 1000 - JST_OFFSET_MS);
}

// 来週の開始日時（JST 日曜17:00, UTC換算）を返す
function getNextWeekStart() {
    return new Date(getCurrentWeekStart().getTime() + 7 * 24 * 60 * 60 * 1000);
}

// 週の開始境界（日曜17:00 JST）から対象週の月曜キー（JST, YYYY-MM-DD）。
// ⚠️ app.js: mondayKeyOfWeekStart / web: mondayKeyOfWeekStart と同じ計算にすること
function mondayKeyOfWeekStart(weekStart) {
    const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const monJST = new Date(weekStart.getTime() + JST_OFFSET_MS + 24 * 60 * 60 * 1000);
    const y = monJST.getUTCFullYear();
    const m = String(monJST.getUTCMonth() + 1).padStart(2, '0');
    const d = String(monJST.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// 対象週の上書き設定ドキュメントID。週ごとに分けているので、
// 別々の週を狙った設定（承認済みの特別イベントを含む）が潰し合わない
function weeklyOverrideDocId(mondayKey) { return `weekly_override_${mondayKey}`; }

// Toast
function toast(msg, dur = 2000) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), dur); }

// Confirm dialog
let _confirmCb = null;
function showConfirm(title, msg, cb) { $('confirm-title').textContent = title; $('confirm-msg').textContent = msg; _confirmCb = cb; $('confirm-overlay').classList.remove('hide'); }
function closeConfirm() { $('confirm-overlay').classList.add('hide'); _confirmCb = null; }
$('confirm-ok').addEventListener('click', () => { if (_confirmCb) _confirmCb(); closeConfirm(); });

// ====================================================================
// AUTH
// ====================================================================
auth.onAuthStateChanged(async u => {
    if (u) {
        $('login-wrap').style.display = 'none';
        $('app').style.display = 'block';
        const ud = await db.collection('users').doc(u.uid).get();
        $('user-label').textContent = ud.exists ? ud.data().userName : u.email;
        loadAll();
    } else {
        $('login-wrap').style.display = 'flex';
        $('app').style.display = 'none';
    }
});

$('login-btn').addEventListener('click', async () => {
    $('auth-error').textContent = '';
    const em = $('email').value.trim(), pw = $('password').value;
    if (!em || !pw) { $('auth-error').textContent = '入力してください'; return; }
    try { await auth.signInWithEmailAndPassword(em, pw); }
    catch (e) {
        const m = { 'auth/invalid-email': 'メール形式が不正', 'auth/user-not-found': 'ユーザー不明', 'auth/wrong-password': 'パスワード不正', 'auth/invalid-credential': '認証情報が不正' };
        $('auth-error').textContent = m[e.code] || 'ログイン失敗';
    }
});
$('password').addEventListener('keydown', e => { if (e.key === 'Enter') $('login-btn').click(); });
$('email').addEventListener('keydown', e => { if (e.key === 'Enter') $('password').focus(); });
$('logout-btn').addEventListener('click', () => auth.signOut());
$('refresh-btn').addEventListener('click', () => loadAll());

// ====================================================================
// DATA LOAD
// ====================================================================
async function loadAll() {
    $('loading').classList.remove('hide');
    try {
        const [exDoc, wcDoc, cfgDoc, legacyOverrideDoc, nextWeekOverrideDoc, raidDoc, dmDoc, mFree, mNorm, mInt, champSnap, histSnap, usrSnap] = await Promise.all([
            db.collection('settings_free').doc('exercises').get(),
            db.collection('settings_free').doc('weekly_challenge').get(),
            db.collection('settings_free').doc('weekly_config').get(),
            db.collection('settings_free').doc('weekly_override').get(),
            db.collection('settings_free').doc(weeklyOverrideDocId(mondayKeyOfWeekStart(getNextWeekStart()))).get(),
            db.collection('settings_free').doc('raid_config').get(),
            db.collection('settings_free').doc('daily_mission').get(),
            db.collection('settings_free').doc('multipliers').get(),
            db.collection('settings').doc('multipliers').get(),
            db.collection('settings_interval').doc('multipliers').get(),
            db.collection('weekly_champions').orderBy('weekStart', 'desc').get(),
            db.collection('weekly_challenge_history').orderBy('weekStart', 'desc').get(),
            db.collection('users').get()
        ]);
        _exercises = exDoc.exists ? (exDoc.data().exercises || {}) : {};
        _wc = wcDoc.exists ? wcDoc.data() : null;
        _wcConfig = cfgDoc.exists ? cfgDoc.data() : { weightExponent: 2 };
        // 来週ぶんの上書き設定。週ごとドキュメントを優先し、無ければ旧単一ドキュメント
        // （旧形式は targetWeekStart が来週のときだけ来週ぶんとして扱う）
        const nextWeekStartMs = getNextWeekStart().getTime();
        const legacy = legacyOverrideDoc.exists ? legacyOverrideDoc.data() : null;
        const legacyIsNextWeek = !!legacy && (!legacy.targetWeekStart
            || Math.abs(legacy.targetWeekStart.toDate().getTime() - nextWeekStartMs) < 60 * 1000);
        const nextWeekOverride = nextWeekOverrideDoc.exists ? nextWeekOverrideDoc.data() : null;
        const usable = (o) => !!o && !o.invalidated && Array.isArray(o.exercises) && o.exercises.length > 0;
        _override = usable(nextWeekOverride) ? nextWeekOverride
            : (usable(legacy) && legacyIsNextWeek ? legacy : null);
        _raidGoals = raidDoc.exists ? sanitizeRaidGoals(raidDoc.data().goals) : {};
        _raidExercises = raidDoc.exists ? sanitizeRaidExercises(raidDoc.data().exercises) : {};
        _raidMembers = raidDoc.exists ? (raidDoc.data().memberCounts || {}) : {};
        _dm = dmDoc.exists ? dmDoc.data() : null;
        _users = {};
        usrSnap.forEach(d => { _users[d.id] = d.data(); });

        renderWeekly();
        renderDaily();
        renderRaid();
        renderWeight();
        renderFree();
        renderMul(mFree, mNorm, mInt);
        renderChamp(champSnap);
        renderHist(histSnap);
        renderUsers(usrSnap);
    } catch (e) {
        console.error(e);
        alert('取得失敗: ' + e.message);
    } finally {
        $('loading').classList.add('hide');
    }
}

// ====================================================================
// 1. WEEKLY CHALLENGE
// ====================================================================
function renderWeekly() {
    const el = $('sec-weekly');
    let html = '';
    if (!_wc) {
        html = '<p style="color:var(--tx2);text-align:center;padding:12px">データなし</p>';
    } else {
        const keys = _wc.exercises || [];
        const overrideMark = _wc.isManualOverride
            ? ` <span class="badge badge-star"><i class="fa-solid fa-star"></i> ${esc(_wc.overrideLabel || '特別イベント')}</span>`
            : '';
        html = `<div class="info-panel">
        <div class="ip-row"><span class="ip-label">期間</span><span class="ip-val">${fmtDate(_wc.weekStart)} 〜 ${fmtDate(_wc.weekEnd)}${overrideMark}</span></div>
        <div class="ip-row"><span class="ip-label">更新</span><span class="ip-val">${fmtTs(_wc.updatedAt)}</span></div>
        <div class="ip-row"><span class="ip-label">操作</span><span class="ip-val"><button class="btn btn-sm btn-warn" onclick="forceReselect()" style="font-size:11px"><i class="fa-solid fa-rotate"></i> 今週を強制再選定</button></span></div>
    </div>`;
        if (keys.length === 0) {
            html += '<p style="color:var(--tx2)">選出種目なし</p>';
        } else {
            keys.forEach((key, i) => {
                const ex = _exercises[key] || {};
                const ic = ex.icon ? `fa-solid ${ex.icon}` : 'fa-solid fa-question';
                const barb = ex.barbarian ? ' <span class="badge badge-barb"><i class="fa-solid fa-stopwatch"></i> TA</span>' : '';
                const selCount = (_wc.selectionHistory || {})[key] || 0;
                html += `<div class="wk-ex">
            <i class="${ic} wk-icon"></i>
            <div class="wk-body">
                <div class="wk-name">${esc(ex.name || key)}${barb}</div>
                <div class="wk-sub">#${i + 1} / 累積${selCount}回選出</div>
            </div>
            <div class="wk-acts">
                <button class="btn btn-sm btn-warn" onclick="rerollOne('${esc(key)}',${i})" title="この種目だけ再抽選"><i class="fa-solid fa-dice"></i></button>
            </div>
        </div>`;
            });
        }
    }

    // 来週の手動設定セクション
    const availExs = Object.entries(_exercises)
        .filter(([, ex]) => !ex.excludeFromWeekly)
        .sort((a, b) => (a[1].name || '').localeCompare(b[1].name || '', 'ja'));
    const hasBarbEx = availExs.some(([, ex]) => ex.barbarian);
    const preKeys = (_override && _override.exercises) || ['', '', ''];
    const preLabel = (_override && _override.label) || '特別イベント';
    const makeOpts = (sel) => availExs.map(([k, ex]) =>
        `<option value="${esc(k)}"${k === sel ? ' selected' : ''}>${esc(ex.name + (ex.barbarian ? ' [TA]' : ''))}</option>`
    ).join('');

    html += `<hr style="border:none;border-top:1px solid #eee;margin:10px 0">
    <div style="font-size:11px;font-weight:700;color:var(--pri);margin-bottom:8px"><i class="fa-solid fa-wand-magic-sparkles"></i> 来週のチャレンジを手動設定</div>`;
    if (_override) {
        const targetWeekStr = _override.targetWeekStart ? fmtDate(_override.targetWeekStart) + '週' : '来週';
        // ユーザー提案が承認されたものか、管理者が手で入れたものかを見分けられるようにする
        const srcStr = _override.source === 'special_event_proposal' ? '承認済みの特別イベント' : '手動設定';
        const allNames = (_override.exercises || []).map(k => esc((_exercises[k] && _exercises[k].name) || k)).join(' / ');
        html += `<div class="cfg-result" style="margin-bottom:8px"><i class="fa-solid fa-circle-check"></i> 設定済み（対象: ${esc(targetWeekStr)} / ${esc(srcStr)}）: ${esc(preLabel)} — ${allNames}</div>`;
    }
    html += `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">
        <select id="override-ex-0" style="padding:6px 8px;border:1.5px solid var(--bdr);border-radius:7px;font-size:12px"><option value="">— 種目1を選択 —</option>${makeOpts(preKeys[0])}</select>
        <select id="override-ex-1" style="padding:6px 8px;border:1.5px solid var(--bdr);border-radius:7px;font-size:12px"><option value="">— 種目2を選択 —</option>${makeOpts(preKeys[1])}</select>
        <select id="override-ex-2" style="padding:6px 8px;border:1.5px solid var(--bdr);border-radius:7px;font-size:12px"><option value="">— 種目3を選択 —</option>${makeOpts(preKeys[2])}</select>
    </div>
    <div class="cfg-row" style="margin-bottom:8px">
        <label>イベント名:</label>
        <input type="text" id="override-label" value="${esc(preLabel)}" placeholder="特別イベント" style="flex:1;padding:6px 8px;border:1.5px solid var(--bdr);border-radius:7px;font-size:12px">
    </div>`;
    if (hasBarbEx) {
        html += `<p class="cfg-hint" style="margin-bottom:8px"><i class="fa-solid fa-circle-info" style="color:var(--info)"></i> Barbarian（TA）種目を1つ含めることを推奨します</p>`;
    }
    html += `<button class="btn btn-ok" style="width:100%;margin-top:2px" onclick="saveWeeklyOverride()"><i class="fa-solid fa-floppy-disk"></i> 来週の種目を設定する</button>`;
    el.innerHTML = html;
}

// Re-roll single exercise
async function rerollOne(oldKey, idx) {
    const name = _exercises[oldKey]?.name || oldKey;
    showConfirm('1種目リロール', `「${name}」を別の種目に入れ替えますか？`, async () => {
        $('loading').classList.remove('hide');
        try {
            const hist = _wc.selectionHistory || {};
            const exp = _wcConfig.weightExponent || 2;
            const currentKeys = _wc.exercises || [];
            // 候補: 現在選出中以外 かつ 週間チャレンジ除外フラグなし
            const candidates = Object.keys(_exercises).filter(k => !currentKeys.includes(k) && !_exercises[k]?.excludeFromWeekly);
            if (candidates.length === 0) { toast('入替候補がありません'); return; }
            // 重み付き抽選
            const weights = candidates.map(k => 1 / Math.pow((hist[k] || 0) + 1, exp));
            const total = weights.reduce((s, w) => s + w, 0);
            let r = Math.random() * total, picked = candidates[0];
            for (let j = 0; j < candidates.length; j++) { r -= weights[j]; if (r <= 0) { picked = candidates[j]; break; } }
            // 更新
            const newExercises = [...currentKeys];
            newExercises[idx] = picked;
            // 旧種目の選出回数を-1（リロールなので取り消し）、新種目を+1
            const newHist = { ...hist };
            if (newHist[oldKey] > 0) newHist[oldKey]--;
            newHist[picked] = (newHist[picked] || 0) + 1;
            await db.collection('settings_free').doc('weekly_challenge').update({
                exercises: newExercises,
                selectionHistory: newHist,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            toast(`${_exercises[picked]?.name || picked} に入替完了`);
            await loadAll();
        } catch (e) { console.error(e); toast('エラー: ' + e.message); }
        finally { $('loading').classList.add('hide'); }
    });
}

// ====================================================================
// 1.2 DAILY MISSION（今日の種目の引き直し）
// 保存先: settings_free/daily_mission { dateKey, exerciseKey, recentKeys, bestValue... }
// アプリは「dateKey が今日で exerciseKey が存在すればそれを使う」ので、
// ここで exerciseKey を差し替えればリロードした人から新しい種目になる。
// 過去最高回数（ピーク）は種目キーと照合して使われるため null で潰しておけば
// アプリ側が新しい種目で引き直す。目標回数はシード（ユーザー×日付×種目）から再計算。
// ====================================================================

const DAILY_REPS_DEFAULT_PEAK = 30; // app.js / web と同じ（投稿が無い種目のピーク）
const DAILY_RECENT_AVOID = 5;

/** デイリーミッションの候補（Barbarian・デイリー除外以外）。app.js: getDailyMissionCandidates */
function dailyCandidates() {
    return Object.keys(_exercises).filter(k => _exercises[k] && !_exercises[k].barbarian && !_exercises[k].excludeFromDaily);
}

function renderDaily() {
    const el = $('sec-daily');
    const today = todayDateKeyJST();
    const isRaidDay = RAID_SCHEDULE.some(d => d.dateKey === today);
    const curKey = _dm && _dm.dateKey === today ? _dm.exerciseKey : null;
    const cur = curKey ? _exercises[curKey] : null;
    let html = '<div class="info-panel">';
    html += `<div class="ip-row"><span class="ip-label">日付</span><span class="ip-val">${esc(fmtRaidDate(today))}</span></div>`;
    if (curKey) {
        const best = _dm.bestValueKey === curKey && _dm.bestValueDateKey === today ? _dm.bestValue : null;
        const bestStr = best == null ? '未集計' : (best > 0 ? `${best}回（ピーク${_dm.peak ?? best}）` : `投稿なし（ピーク既定${DAILY_REPS_DEFAULT_PEAK}）`);
        html += `<div class="ip-row"><span class="ip-label">種目</span><span class="ip-val">${esc((cur && cur.name) || curKey)}</span></div>
        <div class="ip-row"><span class="ip-label">過去最高</span><span class="ip-val">${esc(bestStr)}</span></div>
        <div class="ip-row"><span class="ip-label">更新</span><span class="ip-val">${fmtTs(_dm.updatedAt)}</span></div>`;
    } else {
        html += '<div class="ip-row"><span class="ip-label">種目</span><span class="ip-val">未生成（誰かがアプリを開くと決まります）</span></div>';
    }
    html += '</div>';
    if (isRaidDay) {
        html += '<p class="cfg-hint"><i class="fa-solid fa-circle-info" style="color:var(--info)"></i> 今日はレイド開催日のため、種目はレイドの設定で決まります（上の「夏休みレイド」から変更）</p>';
        el.innerHTML = html;
        return;
    }
    const opts = dailyCandidates()
        .filter(k => k !== curKey)
        .sort((a, b) => (_exercises[a].name || '').localeCompare(_exercises[b].name || '', 'ja'))
        .map(k => `<option value="${esc(k)}">${esc(_exercises[k].name || k)}</option>`).join('');
    html += `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">
        <select id="daily-reroll-ex" style="padding:6px 8px;border:1.5px solid var(--bdr);border-radius:7px;font-size:12px">
            <option value="">🎲 ランダム（投稿実績のある種目から）</option>${opts}
        </select>
    </div>
    <p class="cfg-hint">直近${DAILY_RECENT_AVOID}日に出た種目はランダムの対象外です。変更後はアプリをリロードした人から新しい種目・目標回数になります。</p>
    <button class="btn btn-warn" style="width:100%" onclick="rerollDaily()"><i class="fa-solid fa-dice"></i> 今日の種目を引き直す</button>`;
    el.innerHTML = html;
}

/** その種目に投稿が1件でもあるか */
async function hasAnyPost(key) {
    const snap = await db.collection('posts_free').where('exerciseType', '==', key).limit(1).get();
    return !snap.empty;
}

async function rerollDaily() {
    const today = todayDateKeyJST();
    const curKey = _dm && _dm.dateKey === today ? _dm.exerciseKey : null;
    const chosen = $('daily-reroll-ex').value;
    const curName = curKey ? ((_exercises[curKey] && _exercises[curKey].name) || curKey) : '（未生成）';
    const msg = chosen
        ? `今日の種目「${curName}」を「${(_exercises[chosen] && _exercises[chosen].name) || chosen}」に変更しますか？`
        : `今日の種目「${curName}」をランダムに引き直しますか？`;
    showConfirm('デイリーミッション引き直し', msg, async () => {
        $('loading').classList.remove('hide');
        try {
            // 引き直す前の種目は実際には使われなかったので、履歴から取り除く
            const recent = (Array.isArray(_dm && _dm.recentKeys) ? _dm.recentKeys : []).filter(k => k !== curKey);
            let picked = chosen;
            if (!picked) {
                const avoid = new Set([...recent, curKey]);
                const pool = dailyCandidates().filter(k => !avoid.has(k));
                // 一度もやられていない種目は目標回数が既定値頼みになるので、投稿実績のある種目に絞る
                const done = await Promise.all(pool.map(k => hasAnyPost(k).then(ok => ok ? k : null)));
                const withPosts = done.filter(Boolean);
                const finalPool = withPosts.length > 0 ? withPosts : pool;
                if (finalPool.length === 0) { toast('入替候補がありません'); return; }
                picked = finalPool[Math.floor(Math.random() * finalPool.length)];
            }
            await db.collection('settings_free').doc('daily_mission').set({
                dateKey: today,
                exerciseKey: picked,
                recentKeys: [picked, ...recent.filter(k => k !== picked)].slice(0, DAILY_RECENT_AVOID),
                // 旧種目の過去最高回数を新種目のピークとして使わせない（アプリ側で引き直させる）
                peak: null,
                bestValue: null,
                bestValueKey: null,
                bestValueDateKey: null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            toast(`${(_exercises[picked] && _exercises[picked].name) || picked} に変更しました`);
            await loadAll();
        } catch (e) { console.error(e); toast('エラー: ' + e.message); }
        finally { $('loading').classList.add('hide'); }
    });
}

// ====================================================================
// 1.5 SUMMER RAID（目標回数の上書き）
// 保存先: settings_free/raid_config { goals: { 'YYYY-MM-DD': 回数 } }
// 既定値と同じ日は保存しない＝コード側の既定がそのまま生きる。
// ====================================================================

/** Firestore/入力から読んだ goals を、日程表にある日・妥当な数値だけに絞る */
function sanitizeRaidGoals(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    const scheduled = new Set(RAID_SCHEDULE.map(d => d.dateKey));
    Object.keys(raw).forEach(k => {
        if (!scheduled.has(k)) return;
        const n = Number(raw[k]);
        if (!isFinite(n)) return;
        const goal = Math.round(n);
        if (goal < RAID_GOAL_MIN || goal > RAID_GOAL_MAX) return;
        out[k] = goal;
    });
    return out;
}

/** JSTの今日の日付キー（開催中の日を強調するため） */
function todayDateKeyJST() {
    const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}-${String(jst.getUTCDate()).padStart(2, '0')}`;
}

/** 前日の日付キー（通算ブロックの体力は初日の前日の人数で決まる） */
function prevDateKeyJST(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d) - 24 * 60 * 60 * 1000);
    return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}-${String(prev.getUTCDate()).padStart(2, '0')}`;
}

/** 日付キーを 8/9(日) 形式に */
function fmtRaidDate(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const names = ['日', '月', '火', '水', '木', '金', '土'];
    return `${m}/${d}(${names[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
}

/** Firestore/入力から読んだ exercises を、日程表にある日・種目キーだけに絞る */
function sanitizeRaidExercises(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    const scheduled = new Set(RAID_SCHEDULE.map(d => d.dateKey));
    Object.keys(raw).forEach(k => {
        if (!scheduled.has(k)) return;
        const v = raw[k];
        if (typeof v !== 'string' || v === '') return;
        out[k] = v;
    });
    return out;
}

/** レイドに使える種目キー（バーバリアンは合計で競えないので除外）を名前順で */
function raidEligibleKeys() {
    return Object.keys(_exercises)
        .filter(k => _exercises[k] && !_exercises[k].barbarian)
        .sort((a, b) => (_exercises[a].name || '').localeCompare(_exercises[b].name || '', 'ja'));
}

/** 「レイド」タグが付いているか */
function hasRaidTag(key) {
    const ex = _exercises[key];
    return !!ex && Array.isArray(ex.tags) && ex.tags.indexOf(RAID_TAG) >= 0;
}

/**
 * 候補の中から名前ヒントで1件選ぶ。
 * ⚠️ 部分一致の中では名前が短いものを優先する。「腕立て」で「腕立てジャンプ」が
 *    先に出てしまった実例があるため、素の種目（＝余計な語が無い）を選ぶ。
 */
function pickRaidKeyByNameHints(dayCfg, keys) {
    const nameOf = k => _exercises[k].name || '';
    for (const hint of dayCfg.nameHints) {
        const needle = hint.toLowerCase();
        const matches = keys
            .filter(k => nameOf(k).toLowerCase().includes(needle))
            .sort((a, b) => nameOf(a).length - nameOf(b).length || a.localeCompare(b));
        if (matches.length > 0) return matches[0];
    }
    return null;
}

/**
 * 種目の指定が無いときの自動解決（アプリ側 resolveRaidExercise と同じ規則）。
 * 「レイド」タグ付きを先に見て、無ければ全種目から名前で引く。
 * @returns {{key: string|null, source: string|null}}
 */
function autoResolveRaid(dayCfg) {
    const eligible = raidEligibleKeys();
    const byTag = pickRaidKeyByNameHints(dayCfg, eligible.filter(hasRaidTag));
    if (byTag) return { key: byTag, source: 'tag' };
    const byName = pickRaidKeyByNameHints(dayCfg, eligible);
    if (byName) return { key: byName, source: 'name' };
    return { key: null, source: null };
}

function renderRaid() {
    const el = $('sec-raid');
    if (!el) return;
    const today = todayDateKeyJST();
    const overrideCount = Object.keys(_raidGoals).length;

    const exPinnedCount = Object.keys(_raidExercises).length;
    const options = raidEligibleKeys();
    const taggedCount = options.filter(hasRaidTag).length;

    let html = `<div class="info-panel">
        <div class="ip-row"><span class="ip-label">期間</span><span class="ip-val">${fmtRaidDate(RAID_SCHEDULE[0].dateKey)} 〜 ${fmtRaidDate(RAID_SCHEDULE[RAID_SCHEDULE.length - 1].dateKey)}（全${RAID_SCHEDULE.length}日）</span></div>
        <div class="ip-row"><span class="ip-label">目標の上書き</span><span class="ip-val">${overrideCount > 0 ? `${overrideCount}日ぶん設定中` : 'なし（すべて既定値）'}</span></div>
        <div class="ip-row"><span class="ip-label">種目の指定</span><span class="ip-val">${exPinnedCount > 0 ? `${exPinnedCount}日ぶん指定中` : 'なし（すべて自動）'}</span></div>
        <div class="ip-row"><span class="ip-label">「${esc(RAID_TAG)}」タグ</span><span class="ip-val">${taggedCount > 0 ? `${taggedCount}種目に設定済み` : 'なし（名前から自動判定）'}</span></div>
        <div class="ip-row"><span class="ip-label">反映</span><span class="ip-val">保存後、各自がアプリを開き直した時点で反映されます</span></div>
    </div>`;

    // 通算ブロックは「各日の1人あたりの合計 × 人数」が期間ぶんの体力になる。
    // 日ごとの数字だけ見ても実際の目標が読めないので、合計をここに出す
    RAID_BLOCKS.forEach(b => {
        const days = RAID_SCHEDULE.filter(d => d.blockId === b.id);
        if (days.length === 0) return;
        const perPersonTotal = days.reduce((sum, d) => {
            const v = _raidGoals[d.dateKey] != null ? _raidGoals[d.dateKey] : raidConfiguredValue(d);
            return sum + v;
        }, 0);
        // 体力は「ブロック初日の前日」のログイン人数で決まる（期間中ずっと同じ）
        const members = _raidMembers[prevDateKeyJST(b.dateKeys[0])] || 0;
        html += `<div class="info-panel">
            <div class="ip-row"><span class="ip-label">通算ブロック</span><span class="ip-val">${esc(b.title)}（${fmtRaidDate(b.dateKeys[0])}〜${fmtRaidDate(b.dateKeys[b.dateKeys.length - 1])}／${b.dateKeys.length}日通算）</span></div>
            <div class="ip-row"><span class="ip-label">1人あたり</span><span class="ip-val">${perPersonTotal}回（${days.map(d => (_raidGoals[d.dateKey] != null ? _raidGoals[d.dateKey] : raidConfiguredValue(d))).join(' + ')}）</span></div>
            <div class="ip-row"><span class="ip-label">ボスの体力</span><span class="ip-val">${members > 0 ? `${perPersonTotal * members}回（${members}人 × ${perPersonTotal}回）` : `${perPersonTotal}回 × ${fmtRaidDate(b.dateKeys[0])}前日のログイン人数`}</span></div>
            <div class="ip-row"><span class="ip-label">扱い</span><span class="ip-val">日ごとの討伐判定はなく、${b.dateKeys.length}日間の合計で1体を削ります（得点は日ごとに分け合うまま）</span></div>
        </div>`;
    });

    RAID_SCHEDULE.forEach(d => {
        const base = raidConfiguredValue(d);
        const effective = _raidGoals[d.dateKey] != null ? _raidGoals[d.dateKey] : base;
        const isOverride = _raidGoals[d.dateKey] != null;
        const perPerson = d.perPerson != null;
        const members = _raidMembers[d.dateKey] || 0;
        const isToday = d.dateKey === today;
        const pinned = _raidExercises[d.dateKey] || '';
        const auto = autoResolveRaid(d);
        const autoLabel = auto.key
            ? `自動：${esc(_exercises[auto.key].name || auto.key)}${auto.source === 'tag' ? '（タグ）' : '（名前）'}`
            : '自動：該当なし（通常ミッションになります）';
        const opts = [`<option value="" ${pinned ? '' : 'selected'}>${autoLabel}</option>`]
            .concat(options.map(k => `<option value="${esc(k)}" ${pinned === k ? 'selected' : ''}>${hasRaidTag(k) ? '★ ' : ''}${esc(_exercises[k].name || k)}</option>`))
            .join('');
        const warn = (!pinned && !auto.key)
            ? ` <span style="color:var(--ng);font-size:.8em"><i class="fa-solid fa-triangle-exclamation"></i> 種目未定</span>`
            : (!pinned && auto.source === 'name' && taggedCount > 0)
                ? ` <span style="color:var(--warn);font-size:.8em"><i class="fa-solid fa-tag"></i> タグ未該当</span>`
                : '';
        const block = raidBlockOf(d);
        html += `<div class="cfg-row" style="align-items:center;flex-wrap:wrap;gap:8px;${isToday ? 'background:#fff8e1;border-radius:6px;padding:6px 8px' : ''}">
            <span style="min-width:96px;font-weight:700">Day ${d.day} <span style="color:var(--tx2);font-weight:400">${fmtRaidDate(d.dateKey)}</span>${isToday ? ' <span class="badge badge-sel">今日</span>' : ''}${block ? `<br><span style="color:var(--tx2);font-weight:400;font-size:.8em">通算：${esc(block.title)}</span>` : ''}</span>
            <select id="raid-ex-${d.dateKey}" style="flex:1;min-width:150px;padding:6px 8px">${opts}</select>${warn}
            <span style="display:flex;align-items:center;gap:5px">
                <input type="number" id="raid-goal-${d.dateKey}" value="${effective}" min="${RAID_GOAL_MIN}" max="${RAID_GOAL_MAX}" step="1" style="width:76px">
                <span style="font-size:.75em;color:var(--tx2);white-space:nowrap">${perPerson ? '回/人' : '回(合計)'}</span>
            </span>
            <span style="color:var(--tx2);font-size:.8em;min-width:104px">既定 ${base}${isOverride ? ' <b style="color:var(--pri)">(上書き中)</b>' : ''}${block ? '<br>通算ぶんに合算' : (perPerson && members > 0 ? `<br>= ${effective * members}回 (${members}人)` : '')}</span>
        </div>`;
    });

    html += `<div class="cfg-row">
        <button class="btn btn-sm btn-ok" onclick="saveRaidGoals()"><i class="fa-solid fa-floppy-disk"></i> 種目・目標回数を保存</button>
        <button class="btn btn-sm btn-warn" onclick="resetRaidGoals()"><i class="fa-solid fa-rotate-left"></i> すべて既定に戻す</button>
    </div>
    <div id="raid-result" class="cfg-result"></div>
    <p style="color:var(--tx2);font-size:.8em;margin-top:6px;line-height:1.6">
        種目の決まり方は <b>①この画面での指定 → ②「${esc(RAID_TAG)}」タグ付きの種目 → ③全種目から名前で推測</b> の順です。
        種目編集で「${esc(RAID_TAG)}」タグを付けておくと、名前の推測に頼らず確実にその種目が候補になります（★印がタグ付き）。<br>
        <b>2日目以降の目標は「ログイン人数 × 1人あたり」</b>です（初日だけ合計固定）。入力欄はその「1人あたり」の数字で、実際の目標は当日の人数で決まります。<br>
        <b>通算ブロックの日</b>（上の「通算：」表示がある日）は1日ごとの討伐判定をしません。入力欄は日ごとのままで、ブロックの体力は<b>各日の1人あたりを足した数 × ブロック初日の前日のログイン人数</b>になります。<br>
        既定値と同じ数字は保存しません（コード側の既定がそのまま使われます）。「種目未定」の日はレイドを行わず、通常のデイリーミッションになります。
    </p>`;

    el.innerHTML = html;
}

async function saveRaidGoals() {
    const goals = {};
    const exercises = {};
    const invalid = [];
    for (const d of RAID_SCHEDULE) {
        const inp = $(`raid-goal-${d.dateKey}`);
        if (inp) {
            const n = Math.round(Number(inp.value));
            if (!isFinite(n) || n < RAID_GOAL_MIN || n > RAID_GOAL_MAX) {
                invalid.push(`Day ${d.day}`);
            } else if (n !== raidConfiguredValue(d)) {
                // 既定と同じなら保存しない＝コード側の既定を生かす
                goals[d.dateKey] = n;
            }
        }
        const sel = $(`raid-ex-${d.dateKey}`);
        // 空 = 「自動」。保存しないことで名前ヒントの解決に任せる
        if (sel && sel.value) exercises[d.dateKey] = sel.value;
    }
    if (invalid.length > 0) {
        $('raid-result').textContent = `${invalid.join(' / ')} の値が不正です（${RAID_GOAL_MIN}〜${RAID_GOAL_MAX}）`;
        $('raid-result').className = 'cfg-result cfg-err';
        return;
    }
    try {
        await db.collection('settings_free').doc('raid_config').set({
            goals: goals,
            exercises: exercises,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        _raidGoals = goals;
        _raidExercises = exercises;
        const g = Object.keys(goals).length, x = Object.keys(exercises).length;
        $('raid-result').textContent = (g > 0 || x > 0)
            ? `保存しました（目標 ${g}日ぶん / 種目指定 ${x}日ぶん）`
            : 'すべて既定に戻しました';
        $('raid-result').className = 'cfg-result';
        renderRaid();
        toast('レイド設定を保存');
    } catch (e) {
        $('raid-result').textContent = '保存失敗: ' + e.message;
        $('raid-result').className = 'cfg-result cfg-err';
    }
}

function resetRaidGoals() {
    showConfirm('レイド設定をリセット', 'すべての日を既定（目標＝コードの値／種目＝自動）に戻しますか？', async () => {
        try {
            await db.collection('settings_free').doc('raid_config').set({
                goals: {},
                exercises: {},
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            _raidGoals = {};
            _raidExercises = {};
            renderRaid();
            toast('既定に戻しました');
        } catch (e) { console.error(e); toast('エラー: ' + e.message); }
    });
}

// ====================================================================
// 2. WEIGHT CONFIG + TABLE
// ====================================================================
function renderWeight() {
    const el = $('sec-weight');
    const hist = (_wc && _wc.selectionHistory) || {};
    const curSel = (_wc && _wc.exercises) || [];
    const exp = _wcConfig.weightExponent || 2;
    const allKeys = Object.keys(_exercises);

    // Config editor
    let html = `<div class="cfg-hint"><i class="fa-solid fa-circle-info"></i> 重み = 1/(選出回数+1)<sup>指数</sup> — 指数が大きいほど再選出されにくい</div>
    <div class="cfg-row">
        <label>重み指数:</label>
        <input type="number" id="cfg-exp" value="${exp}" min="0.5" max="10" step="0.5" style="width:60px">
        <button class="btn btn-sm btn-ok" onclick="saveWeightConfig()"><i class="fa-solid fa-floppy-disk"></i> 保存</button>
    </div>
    <div class="cfg-hint" id="exp-preview"></div>
    <div id="cfg-exp-result" class="cfg-result"></div>
    <hr style="border:none;border-top:1px solid #eee;margin:10px 0">
    <div class="cfg-hint"><i class="fa-solid fa-sliders"></i> 週間チャレンジ改革の設定（段階リリース用）</div>
    <div class="cfg-row">
        <label>公平化:</label>
        <select id="cfg-fairness" style="padding:4px">
            <option value="two_stage" ${(_wcConfig.fairnessMode || 'two_stage') === 'two_stage' ? 'selected' : ''}>2段階抽選(作成者公平)</option>
            <option value="legacy" ${_wcConfig.fairnessMode === 'legacy' ? 'selected' : ''}>従来(種目単位)</option>
        </select>
    </div>
    <div class="cfg-row">
        <label>種目数:</label>
        <select id="cfg-exercise-count" style="padding:4px">
            <option value="3" ${(_wcConfig.exerciseCount || 3) == 3 ? 'selected' : ''}>3種目(従来)</option>
            <option value="4" ${(_wcConfig.exerciseCount || 3) == 4 ? 'selected' : ''}>4種目(木曜追加・下位3採用)</option>
        </select>
    </div>
    <div class="cfg-row">
        <label><input type="checkbox" id="cfg-streak" ${_wcConfig.enableStreak ? 'checked' : ''}> 連続投稿ストリーク加点</label>
        <span style="color:var(--tx2);font-size:.85em">/日</span>
        <input type="number" id="cfg-streak-per" value="${_wcConfig.streakBonusPerDay != null ? _wcConfig.streakBonusPerDay : 3}" min="0" max="50" step="1" style="width:52px">
        <span style="color:var(--tx2);font-size:.85em">上限</span>
        <input type="number" id="cfg-streak-cap" value="${_wcConfig.streakBonusCap != null ? _wcConfig.streakBonusCap : 15}" min="0" max="300" step="1" style="width:56px">
    </div>
    <div class="cfg-row">
        <label><input type="checkbox" id="cfg-prediction" ${_wcConfig.enablePrediction ? 'checked' : ''}> チャンプ予想</label>
        <button class="btn btn-sm btn-ok" onclick="saveReformConfig()"><i class="fa-solid fa-floppy-disk"></i> 改革設定を保存</button>
    </div>
    <div id="cfg-reform-result" class="cfg-result"></div>
    <div id="creator-share"></div>
    <hr style="border:none;border-top:1px solid #eee;margin:10px 0">`;

    // Weight list
    if (allKeys.length === 0) { html += '<p style="color:var(--tx2)">種目なし</p>'; el.innerHTML = html; updateExpPreview(); return; }
    const data = allKeys.map(k => {
        const c = hist[k] || 0;
        const excluded = !!_exercises[k]?.excludeFromWeekly;
        const w = excluded ? 0 : 1 / Math.pow(c + 1, exp);
        return { k, name: _exercises[k]?.name || '?', count: c, weight: w, sel: curSel.includes(k), excluded };
    });
    const totalW = data.reduce((s, d) => s + d.weight, 0);
    const maxP = data.length > 0 ? Math.max(...data.map(d => totalW > 0 ? d.weight / totalW : 0)) : 0;
    data.sort((a, b) => b.weight - a.weight);

    let rank = 0;
    data.forEach(d => {
        const p = (!d.excluded && totalW > 0) ? (d.weight / totalW) : 0;
        const pPct = (p * 100).toFixed(1);
        const barW = maxP > 0 ? Math.round(p / maxP * 100) : 0;
        const barColor = d.sel ? '#f57f17' : 'var(--pri)';
        const selMark = d.sel ? ' <span class="badge badge-sel"><i class="fa-solid fa-star"></i></span>' : '';
        const exclMark = d.excluded ? ' <span class="badge" style="background:#eee;color:#888"><i class="fa-solid fa-calendar-xmark"></i> 除外</span>' : '';
        const rankLabel = d.excluded ? '—' : ++rank;
        html += `<div class="wt-item">
            <span class="wt-rank">${rankLabel}</span>
            <span class="wt-name">${esc(d.name)}${selMark}${exclMark}</span>
            <span class="wt-count">${d.excluded ? '—' : d.count + '回'}</span>
            <div class="wt-bar-wrap"><div class="wt-bar" style="width:${barW}%;background:${barColor}"></div></div>
            <span class="wt-pct">${d.excluded ? '0%' : pPct + '%'}</span>
        </div>`;
    });
    el.innerHTML = html;
    updateExpPreview();
    renderCreatorShare();
    // Live preview when input changes
    const inp = $('cfg-exp');
    if (inp) inp.addEventListener('input', updateExpPreview);
}

function updateExpPreview() {
    const inp = $('cfg-exp');
    const prev = $('exp-preview');
    if (!inp || !prev) return;
    const e = parseFloat(inp.value) || 2;
    prev.innerHTML = `<b>プレビュー:</b> 0回→100%, 1回→${(100 / Math.pow(2, e)).toFixed(1)}%, 2回→${(100 / Math.pow(3, e)).toFixed(1)}%, 3回→${(100 / Math.pow(4, e)).toFixed(1)}%`;
}

async function saveWeightConfig() {
    const v = parseFloat($('cfg-exp').value);
    if (isNaN(v) || v < 0.5 || v > 10) { $('cfg-exp-result').textContent = '0.5〜10の値を入力'; $('cfg-exp-result').className = 'cfg-result cfg-err'; return; }
    try {
        await db.collection('settings_free').doc('weekly_config').set({
            weightExponent: v,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        _wcConfig.weightExponent = v;
        $('cfg-exp-result').textContent = `指数を ${v} に保存しました`;
        $('cfg-exp-result').className = 'cfg-result';
        renderWeight();
        toast('重み指数を保存');
    } catch (e) {
        $('cfg-exp-result').textContent = '保存失敗: ' + e.message;
        $('cfg-exp-result').className = 'cfg-result cfg-err';
    }
}

async function saveReformConfig() {
    const fairnessMode = $('cfg-fairness').value;
    const exerciseCount = parseInt($('cfg-exercise-count').value, 10) || 3;
    const enableStreak = $('cfg-streak').checked;
    const streakBonusPerDay = Math.max(0, parseInt($('cfg-streak-per').value, 10) || 0);
    const streakBonusCap = Math.max(0, parseInt($('cfg-streak-cap').value, 10) || 0);
    const enablePrediction = $('cfg-prediction').checked;
    try {
        await db.collection('settings_free').doc('weekly_config').set({
            fairnessMode, exerciseCount, enableStreak, streakBonusPerDay, streakBonusCap, enablePrediction,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        Object.assign(_wcConfig, { fairnessMode, exerciseCount, enableStreak, streakBonusPerDay, streakBonusCap, enablePrediction });
        $('cfg-reform-result').textContent = '改革設定を保存しました';
        $('cfg-reform-result').className = 'cfg-result';
        renderWeight();
        toast('改革設定を保存');
    } catch (e) {
        $('cfg-reform-result').textContent = '保存失敗: ' + e.message;
        $('cfg-reform-result').className = 'cfg-result cfg-err';
    }
}

// 作成者別の登録数と、2段階抽選での期待選出シェア（作成者数依存しない均等）を可視化
function renderCreatorShare() {
    const el = $('creator-share');
    if (!el) return;
    const entries = Object.entries(_exercises).filter(([, e]) => !e?.excludeFromWeekly);
    const byCreator = {};
    entries.forEach(([key, e]) => {
        const cid = e.createdBy || ('__ex_' + key);
        const name = e.createdByName || (e.createdBy ? e.createdBy.slice(0, 6) : '(不明)');
        if (!byCreator[cid]) byCreator[cid] = { name, count: 0 };
        byCreator[cid].count++;
    });
    const creators = Object.values(byCreator).sort((a, b) => b.count - a.count);
    if (creators.length === 0) { el.innerHTML = ''; return; }
    const totalEx = entries.length;
    const nCreators = creators.length;
    const mode = _wcConfig.fairnessMode || 'two_stage';
    let html = `<div class="cfg-hint" style="margin-top:8px"><i class="fa-solid fa-users"></i> 作成者別シェア（${mode === 'two_stage' ? '2段階=作成者均等' : '従来=種目数比'}）</div>`;
    creators.forEach(c => {
        const legacyShare = totalEx > 0 ? (c.count / totalEx) : 0;      // 種目単位（近似）
        const fairShare = nCreators > 0 ? (1 / nCreators) : 0;          // 作成者均等
        const share = mode === 'two_stage' ? fairShare : legacyShare;
        const barW = Math.round(share * 100);
        html += `<div class="wt-item">
            <span class="wt-name">${esc(c.name)}</span>
            <span class="wt-count">${c.count}種目</span>
            <div class="wt-bar-wrap"><div class="wt-bar" style="width:${barW}%;background:${mode === 'two_stage' ? '#7c3aed' : 'var(--pri)'}"></div></div>
            <span class="wt-pct">${(share * 100).toFixed(1)}%</span>
        </div>`;
    });
    el.innerHTML = html;
}

// ====================================================================
// 3. FREE EXERCISES
// ====================================================================
function renderFree() {
    const el = $('sec-free');
    const entries = Object.entries(_exercises);
    const barbC = entries.filter(([, e]) => e.barbarian).length;
    const tags = new Set();
    entries.forEach(([, e]) => (e.tags || []).forEach(t => tags.add(t)));

    let html = `<div class="stats">
        <div class="chip"><div class="v">${entries.length}</div><div class="l">種目</div></div>
        <div class="chip"><div class="v">${barbC}</div><div class="l">TA</div></div>
        <div class="chip"><div class="v">${entries.length - barbC}</div><div class="l">回数系</div></div>
        <div class="chip"><div class="v">${tags.size}</div><div class="l">タグ</div></div>
    </div>`;

    if (entries.length === 0) { html += '<p style="color:var(--tx2)">種目なし</p>'; el.innerHTML = html; return; }
    entries.sort((a, b) => (b[1].createdAt || '').localeCompare(a[1].createdAt || ''));
    entries.forEach(([key, ex]) => {
        const ic = ex.icon ? `fa-solid ${ex.icon}` : 'fa-solid fa-dumbbell';
        const tgs = (ex.tags || []).map(t => `<span class="badge badge-tag">${esc(t)}</span>`).join('');
        const barb = ex.barbarian ? ' <span class="badge badge-barb"><i class="fa-solid fa-stopwatch"></i> TA</span>' : '';
        const excl = ex.excludeFromWeekly ? ' <span class="badge" style="background:#eee;color:#888"><i class="fa-solid fa-calendar-xmark"></i> 除外</span>' : '';
        html += `<div class="ex-card">
            <i class="${ic} ex-icon"></i>
            <div class="ex-body">
                <div class="ex-name">${esc(ex.name || '(名称なし)')}${barb}${excl}</div>
                <div class="ex-meta">${esc(ex.rule || '')}${ex.createdByName ? ' / ' + esc(ex.createdByName) : ''}</div>
                <div class="ex-tags">${tgs}</div>
            </div>
        </div>`;
    });
    el.innerHTML = html;
}

// ====================================================================
// 4. MULTIPLIERS
// ====================================================================
function renderMul(fDoc, nDoc, iDoc) {
    const el = $('sec-mul');
    const names = { pushup: 'プッシュアップ', dips: 'ディップス', squat: '片足スクワット', Lsit: 'Lシット', pullup: '懸垂' };
    function grid(d, label) {
        if (!d) return `<p style="color:var(--tx2);font-size:11px">${label}: 未設定</p>`;
        const items = Object.entries(d).filter(([k]) => k !== 'updatedAt').map(([k, v]) =>
            `<div class="mul-item"><div class="mn">${esc(names[k] || k)}</div><div class="mv">×${Number(v).toFixed(1)}</div></div>`
        ).join('');
        return `<div style="font-size:11px;font-weight:700;color:var(--pri);margin-bottom:4px">${label}</div><div class="mul-grid">${items}</div>`;
    }
    el.innerHTML = [
        grid(nDoc?.exists ? nDoc.data() : null, 'ノーマル'),
        grid(iDoc?.exists ? iDoc.data() : null, 'インターバル'),
        grid(fDoc?.exists ? fDoc.data() : null, 'フリー')
    ].join('');
}

// ====================================================================
// 5. CHAMPIONS
// ====================================================================
function renderChamp(snap) {
    const el = $('sec-champ');
    if (snap.empty) { el.innerHTML = '<p style="color:var(--tx2);text-align:center">データなし</p>'; return; }
    let html = '';
    snap.forEach(doc => {
        const d = doc.data();
        const period = d.periodLabel || `${fmtDate(d.weekStart)}〜${fmtDate(d.weekEnd)}`;
        const exKeys = d.exercises ? Object.keys(d.exercises) : [];
        const exHtml = exKeys.map(k => {
            const n = _exercises[k] ? _exercises[k].name : k;
            const v = d.exercises[k]?.value;
            return `<span class="badge badge-tag">${esc(n)}${v != null ? ': ' + v : ''}</span>`;
        }).join('');
        html += `<div class="champ-card">
            <div class="cc-week">${esc(doc.id)} / ${esc(period)}</div>
            <div class="cc-name"><i class="fa-solid fa-crown" style="color:#ffd600"></i> ${esc(d.champUserName || '—')} <span style="font-size:10px;color:var(--tx2)">${d.champTotalScore != null ? Number(d.champTotalScore).toFixed(1) + 'pt' : ''}</span></div>
            <div class="cc-ex">${exHtml || '—'}</div>
        </div>`;
    });
    el.innerHTML = html;
}

// ====================================================================
// 6. HISTORY
// ====================================================================
function renderHist(snap) {
    const el = $('sec-hist');
    if (snap.empty) { el.innerHTML = '<p style="color:var(--tx2);text-align:center">データなし</p>'; return; }
    let html = '';
    snap.forEach(doc => {
        const d = doc.data();
        const exHtml = (d.exercises || []).map(k => { const n = _exercises[k] ? _exercises[k].name : k; return `<span class="badge badge-tag">${esc(n)}</span>`; }).join('');
        html += `<div class="hist-item">
            <span class="hist-id">${esc(doc.id)}</span> <span class="hist-date">${fmtDate(d.weekStart)}〜${fmtDate(d.weekEnd)}</span>
            <div class="hist-ex">${exHtml || '—'}</div>
        </div>`;
    });
    el.innerHTML = html;
}

// ====================================================================
// 7. USERS
// ====================================================================
function renderUsers(snap) {
    const el = $('sec-users');
    let html = `<div class="stats"><div class="chip"><div class="v">${snap.size}</div><div class="l">ユーザー</div></div></div>`;
    if (snap.empty) { html += '<p style="color:var(--tx2)">なし</p>'; el.innerHTML = html; return; }
    html += '<div class="usr-grid">';
    snap.forEach(doc => {
        const d = doc.data();
        html += `<div class="usr-card"><div class="un"><i class="fa-solid fa-user"></i> ${esc(d.userName || '(未設定)')}</div><div class="ue">${esc(d.email || '—')}</div></div>`;
    });
    html += '</div>';
    el.innerHTML = html;
}

// ====================================================================
// 今週の強制再選定
// ====================================================================
async function forceReselect() {
    showConfirm(
        '今週の種目を再選定',
        '現在の週間チャレンジ設定を破棄し、今週の種目を自動選出し直します。投稿データは消えません。実行しますか？',
        async () => {
            $('loading').classList.remove('hide');
            try {
                // weekly_challenge の weekStart フィールドを削除して再選定をトリガー
                // （ドキュメント削除は Firestore ルールで禁止のため update で対応）
                await db.collection('settings_free').doc('weekly_challenge').update({
                    weekStart: firebase.firestore.FieldValue.delete(),
                    isManualOverride: firebase.firestore.FieldValue.delete(),
                    overrideLabel: firebase.firestore.FieldValue.delete()
                });
                // 今週ぶんの上書き設定だけ無効化する（削除不可のため invalidated フラグ）。
                // 来週以降を狙った承認済みイベントの予約には触らない
                const curWeekStart = getCurrentWeekStart();
                await db.collection('settings_free')
                    .doc(weeklyOverrideDocId(mondayKeyOfWeekStart(curWeekStart)))
                    .set({ invalidated: true }, { merge: true }).catch(() => {});
                const legacy = await db.collection('settings_free').doc('weekly_override').get();
                if (legacy.exists && !legacy.data().invalidated) {
                    const t = legacy.data().targetWeekStart;
                    if (!t || Math.abs(t.toDate().getTime() - curWeekStart.getTime()) < 60 * 1000) {
                        await db.collection('settings_free').doc('weekly_override')
                            .set({ invalidated: true }, { merge: true }).catch(() => {});
                    }
                }
                toast('再選定の準備完了。チャレンジページを開くと自動的に新しい種目が選定されます。');
                await loadAll();
            } catch (e) {
                toast('エラー: ' + e.message);
            } finally {
                $('loading').classList.add('hide');
            }
        }
    );
}

// ====================================================================
// 手動上書き保存
// ====================================================================
async function saveWeeklyOverride() {
    const keys = [
        $('override-ex-0').value,
        $('override-ex-1').value,
        $('override-ex-2').value
    ];
    const label = ($('override-label').value || '').trim() || '特別イベント';
    if (keys.some(k => !k)) { toast('3種目すべて選択してください'); return; }
    if (new Set(keys).size !== 3) { toast('重複しない種目を選んでください'); return; }

    const hasBarb = keys.some(k => _exercises[k] && _exercises[k].barbarian);

    const nextWeekStart = getNextWeekStart();
    const mondayKey = mondayKeyOfWeekStart(nextWeekStart);

    const doSave = async () => {
        $('loading').classList.remove('hide');
        try {
            await db.collection('settings_free').doc(weeklyOverrideDocId(mondayKey)).set({
                exercises: keys,
                label,
                targetWeekStart: firebase.firestore.Timestamp.fromDate(nextWeekStart),
                mondayKey,
                invalidated: false,
                setAt: firebase.firestore.FieldValue.serverTimestamp(),
                setBy: auth.currentUser ? auth.currentUser.uid : '',
                source: 'admin'
            });
            // 旧単一ドキュメントが同じ週を狙っていると二重適用になりうるので無効化する
            const legacy = await db.collection('settings_free').doc('weekly_override').get();
            if (legacy.exists && !legacy.data().invalidated) {
                const t = legacy.data().targetWeekStart;
                if (!t || Math.abs(t.toDate().getTime() - nextWeekStart.getTime()) < 60 * 1000) {
                    await db.collection('settings_free').doc('weekly_override')
                        .set({ invalidated: true }, { merge: true }).catch(() => {});
                }
            }
            toast('来週の手動設定を保存しました');
            await loadAll();
        } catch (e) { toast('エラー: ' + e.message); }
        finally { $('loading').classList.add('hide'); }
    };

    const confirmBarbarian = () => {
        if (hasBarb) return doSave();
        showConfirm(
            'Barbarian種目が含まれていません',
            'Barbarian（TA）種目が選ばれていません。通常は1種目含めることを推奨しています。このまま設定しますか？',
            doSave
        );
    };

    // 承認済みの特別イベントを黙って潰さない。上書きするか確認してから進む
    $('loading').classList.remove('hide');
    let approvedEvent = null;
    try {
        const cur = await db.collection('settings_free').doc(weeklyOverrideDocId(mondayKey)).get();
        if (cur.exists && cur.data().source === 'special_event_proposal') approvedEvent = cur.data();
    } catch (e) { /* 読めなければ確認を挟まずに進む */ }
    finally { $('loading').classList.add('hide'); }

    if (approvedEvent) {
        const exNames = (approvedEvent.exercises || [])
            .map(k => (_exercises[k] && _exercises[k].name) || k).join(' / ');
        showConfirm(
            '承認済みの特別イベントがあります',
            `来週は承認された特別イベント「${approvedEvent.label || '特別イベント'}」（${exNames}）が設定されています。手動設定で上書きしますか？（提案者には「別の設定に上書きされた」と表示されます）`,
            confirmBarbarian
        );
        return;
    }
    await confirmBarbarian();
}
