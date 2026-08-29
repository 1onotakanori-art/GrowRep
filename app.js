// ====================================================================
// XSS対策: HTMLエスケープ関数
// ====================================================================
/**
 * HTMLエスケープ処理
 * @param {string} str - エスケープする文字列
 * @returns {string} エスケープ済み文字列
 */
function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ====================================================================
// モード管理
// ====================================================================
let currentMode = 'free'; // 'normal', 'interval', 'free', または 'weekly'

/**
 * モードに応じたコレクション名を取得
 * @param {string} baseCollection - 基本コレクション名（'posts', 'scores', 'multipliers'）
 * @returns {string} モード別のコレクション名
 */
function getCollectionName(baseCollection) {
    if (currentMode === 'interval') {
        return `${baseCollection}_interval`;
    }
    // レイドはフリーモードの投稿（posts_free）をそのまま使う
    if (currentMode === 'free' || currentMode === 'weekly' || currentMode === 'raid') {
        return `${baseCollection}_free`;
    }
    return baseCollection;
}

// ====================================================================
// DOM要素の取得
// ====================================================================
const loginContainer = document.getElementById('login-container');
const mainContainer = document.getElementById('main-container');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const logoutBtn = document.getElementById('logout-btn');
const profileBtn = document.getElementById('profile-btn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const authError = document.getElementById('auth-error');
// const userName = document.getElementById('user-name');  // 削除
const postError = document.getElementById('post-error');
const postsList = document.getElementById('posts-list');
const rankingList = document.getElementById('ranking-list');
const progressChart = document.getElementById('progress-chart');
const graphExerciseType = document.getElementById('graph-exercise-type');

// パスワードリセット関連
const forgotPasswordLink = document.getElementById('forgot-password-link');
const resetPasswordModal = document.getElementById('reset-password-modal');
const closeResetModal = document.querySelector('.close-reset-modal');
const resetEmailInput = document.getElementById('reset-email');
const sendResetBtn = document.getElementById('send-reset-btn');
const resetError = document.getElementById('reset-error');
const resetSuccess = document.getElementById('reset-success');

// ルールタブ関連
const updateMultipliersBtn = document.getElementById('update-multipliers-btn');
const rulesMessage = document.getElementById('rules-message');
const rulesError = document.getElementById('rules-error');
const multiplierInputs = {
    pushup: document.getElementById('multiplier-pushup'),
    dips: document.getElementById('multiplier-dips'),
    squat: document.getElementById('multiplier-squat'),
    Lsit: document.getElementById('multiplier-Lsit'),
    pullup: document.getElementById('multiplier-pullup')
};

// 得点タブ関連
const userCheckboxes = document.getElementById('user-checkboxes');
const scoreChart = document.getElementById('score-chart');
const totalScoresList = document.getElementById('total-scores-list');
const scoreError = document.getElementById('score-error');
const weeklySimulatorControls = document.getElementById('weekly-simulator-controls');
const weeklySimulatorToggle = document.getElementById('weekly-simulator-toggle');

// モード切り替え関連
const modeSelect = document.getElementById('mode-select');

// 3秒タイマー関連
const timerCount = document.getElementById('timer-count');
const timerElapsed = document.getElementById('timer-elapsed');
const timerStartBtn = document.getElementById('timer-start-btn');
const timerStopBtn = document.getElementById('timer-stop-btn');
const timerResetBtn = document.getElementById('timer-reset-btn');

// プロフィールモーダル関連
const profileModal = document.getElementById('profile-modal');
const closeModal = document.querySelector('.close-modal');
const profileEmail = document.getElementById('profile-email');
const currentUsername = document.getElementById('current-username');
const newUsernameInput = document.getElementById('new-username');
const updateUsernameBtn = document.getElementById('update-username-btn');
const usernameError = document.getElementById('username-error');
const currentPasswordInput = document.getElementById('current-password');
const newPasswordInput = document.getElementById('new-password');
const confirmPasswordInput = document.getElementById('confirm-password');
const updatePasswordBtn = document.getElementById('update-password-btn');
const passwordError = document.getElementById('password-error');

// ゲストログイン関連
const guestLoginBtn = document.getElementById('guest-login-btn');
const guestModeSection = document.getElementById('guest-mode-section');
const usernameSectionEl = document.getElementById('username-section');
const passwordSectionEl = document.getElementById('password-section');

// 歴代チャンプ詳細モーダル関連
const championDetailModal = document.getElementById('champion-detail-modal');
const closeChampionDetailModal = document.querySelector('.close-champion-detail-modal');
const championDetailTitle = document.getElementById('champion-detail-title');
const championDetailSubtitle = document.getElementById('champion-detail-subtitle');
const championDetailRankings = document.getElementById('champion-detail-rankings');

// 種目名の日本語マッピング
const exerciseNames = {
    'pushup': 'プッシュアップ',
    'dips': 'ディップス',
    'squat': '片足スクワット',
    'Lsit': 'Lシット(秒)',
    'pullup': '懸垂(セット)'
};

// グローバル変数
let currentUser = null;
let currentUserData = null;  // ユーザー情報（usersコレクションから取得）
let myChart = null;
let myScoreChart = null;  // 得点レーダーチャート用
let unsubscribePosts = null;  // 投稿リスナーの解除用

// キャッシュ用変数（Firebase読み取り削減）
// モード別キャッシュ
let postsCache = {
    normal: null,
    interval: null,
    free: null,
    weekly: null
};
let postsCacheTime = {
    normal: null,
    interval: null,
    free: null,
    weekly: null
};
// 投稿フィードの表示件数（全期間スキャンを避けるため初期は新しい順50件）
const POSTS_PAGE_SIZE = 50;
let postsDisplayLimit = POSTS_PAGE_SIZE;
let postsHasMore = false;
let rankingCache = {
    normal: null,
    interval: null,
    free: null,
    weekly: null
};
let rankingCacheTime = {
    normal: null,
    interval: null,
    free: null,
    weekly: null
};
let scoreCache = {
    normal: null,
    interval: null,
    free: null,
    weekly: null
};
let scoreCacheTime = {
    normal: null,
    interval: null,
    free: null,
    weekly: null
};
let progressCache = {
    normal: {},
    interval: {},
    free: {},
    weekly: {}
};  // 種目ごとにキャッシュ
const CACHE_DURATION = 5 * 60 * 1000;  // キャッシュ有効期間: 5分
const RANKING_TIE_EPSILON = 1e-6;

// ====================================================================
// Chart.js 遅延ロード
//   グラフ（成長グラフ/総合得点/月間ダービー）でしか使わない ~200KB の
//   Chart.js を初期ロードから外し、初回にグラフを描く直前で一度だけ取得する。
//   これにより初期表示（3種目・投稿・得点数値）が Chart.js の到着を待たない。
// ====================================================================
const CHART_JS_SRC = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
let _chartJsPromise = null;
function ensureChartJs() {
    if (typeof Chart !== 'undefined') return Promise.resolve();
    if (_chartJsPromise) return _chartJsPromise;
    _chartJsPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = CHART_JS_SRC;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => {
            _chartJsPromise = null;  // 失敗時は次回リトライできるようにする
            reject(new Error('Chart.js の読み込みに失敗しました'));
        };
        document.head.appendChild(s);
    });
    return _chartJsPromise;
}

// ユーザー情報の一括キャッシュ（N+1クエリ削減用）
// 投稿/ランキングの行ごとに getUserData() を逐次呼ぶと参加人数に比例して
// Firestore 読み取りが増えるため、users コレクションを1回だけ取得して使い回す。
let usersMapCache = null;       // { [userId]: userData }
let usersMapCacheTime = null;

// ====================================================================
// Phase0: 簡易パフォーマンス計測
//   各画面表示で「Firestore読み取り何件 / 何ms」かを可視化し、
//   リファクタ前後の改善を数値で比較できるようにする。
// ====================================================================
const perfMetrics = { firestoreReads: 0 };

/**
 * Firestore読み取り件数を加算
 * @param {number} n - 読み取ったドキュメント数
 */
function countReads(n) {
    perfMetrics.firestoreReads += (n || 0);
}

/**
 * 処理時間とFirestore読み取り件数を計測してログ出力
 * @param {string} label - 計測ラベル
 * @param {Function} fn - 計測対象の非同期処理
 * @returns {Promise<*>} fnの戻り値
 */
async function measure(label, fn) {
    const startReads = perfMetrics.firestoreReads;
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    try {
        return await fn();
    } finally {
        const ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
        const reads = perfMetrics.firestoreReads - startReads;
        console.log(`[perf] ${label}: ${ms}ms, Firestore読み取り ${reads}件`);
    }
}

// 歴代チャンプ詳細表示用のメモリキャッシュ
let championsHistoryCache = [];
const championDetailRetryMap = {};
let championDetailEventsBound = false;
let weeklyChampionBackfillDoneInSession = false;

// 週間チャレンジ総合得点シミュレーター用（非永続）
let weeklySimulatorEnabled = false;
let weeklySimulatorOverrides = {};
let weeklySimulatorBaseScores = null;
let weeklySimulatorExerciseKeys = [];
let weeklySimulatorExpandedUserId = null;
let weeklySimulatorPreviousRanks = {};
let weeklySimulatorPendingAnimation = false;
let weeklySimulatorFocusUserId = null;

function clampWeeklySimulatorValue(rawValue, fallback = 0) {
    const num = Number(rawValue);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(0, Math.round(num));
}

function resetWeeklySimulatorState() {
    weeklySimulatorEnabled = false;
    weeklySimulatorOverrides = {};
    weeklySimulatorExpandedUserId = null;
    weeklySimulatorBaseScores = null;
    weeklySimulatorExerciseKeys = [];
    weeklySimulatorPreviousRanks = {};
    weeklySimulatorPendingAnimation = false;
    weeklySimulatorFocusUserId = null;
    if (weeklySimulatorToggle) {
        weeklySimulatorToggle.checked = false;
    }
}

function setWeeklySimulatorControlsVisible(visible) {
    if (!weeklySimulatorControls) return;
    weeklySimulatorControls.style.display = visible ? 'block' : 'none';
    if (!visible) {
        resetWeeklySimulatorState();
    }
}

function calculateWeeklySimulatedScores(baseUsersScores, exerciseKeys) {
    const simulated = {};
    const keys = Array.isArray(exerciseKeys) ? exerciseKeys : [];

    Object.entries(baseUsersScores || {}).forEach(([userId, userData]) => {
        const exercises = {};
        keys.forEach((key) => {
            const baseValue = clampWeeklySimulatorValue(userData?.exercises?.[key] || 0, 0);
            const overrideValue = weeklySimulatorOverrides?.[userId]?.[key];
            exercises[key] = overrideValue === undefined ? baseValue : clampWeeklySimulatorValue(overrideValue, baseValue);
        });

        simulated[userId] = {
            userName: userData.userName,
            exercises,
            scores: {},
            totalScore: 0,
            // ストリークは投稿日数依存で種目値のシミュレーションに影響されないため base をそのまま持ち越す
            streakDays: userData.streakDays || 0,
            streakBonus: userData.streakBonus || 0
        };
    });

    keys.forEach((key) => {
        const isBarbarian = !!(freeExercises[key] && freeExercises[key].barbarian);

        if (isBarbarian) {
            let minVal = Infinity;
            Object.values(simulated).forEach((user) => {
                const value = user.exercises[key] || 0;
                if (value > 0 && value < minVal) {
                    minVal = value;
                }
            });

            Object.values(simulated).forEach((user) => {
                const value = user.exercises[key] || 0;
                const pct = (value > 0 && minVal !== Infinity) ? (minVal / value) * 100 : 0;
                user.scores[key] = pct;
            });
            return;
        }

        let maxVal = 0;
        Object.values(simulated).forEach((user) => {
            const value = user.exercises[key] || 0;
            if (value > maxVal) {
                maxVal = value;
            }
        });

        Object.values(simulated).forEach((user) => {
            const value = user.exercises[key] || 0;
            const pct = maxVal > 0 ? (value / maxVal) * 100 : 0;
            user.scores[key] = pct;
        });
    });

    // 総合得点を集計（4種目以上のアクティブ時は下位3つ採用＝最高%を1つ切り捨て）＋ストリーク加点
    Object.values(simulated).forEach((user) => {
        user.totalScore = sumAdoptedScores(keys.map((k) => user.scores[k] || 0)) + (user.streakBonus || 0);
    });

    return simulated;
}

// ====================================================================
// Firestoreユーティリティ関数
// ====================================================================

/**
 * ユーザー名の重複チェック
 * @param {string} userName - チェックするユーザー名
 * @returns {Promise<boolean>} 重複していればtrue
 */
async function checkUsernameExists(userName) {
    const snapshot = await db.collection('users')
        .where('userName', '==', userName)
        .get();
    return !snapshot.empty;
}

/**
 * スケルトンUI（読み込み中プレースホルダ）のHTMLを生成
 * 通信中に「止まって見える」のを防ぎ、体感速度を改善する。
 * @param {number} count - プレースホルダ行数
 * @returns {string} スケルトンHTML
 */
function skeletonHTML(count = 3) {
    let html = '<div class="skeleton-loader" aria-busy="true" aria-label="読み込み中">';
    for (let i = 0; i < count; i++) {
        html += '<div class="skeleton-item"></div>';
    }
    html += '</div>';
    return html;
}

/**
 * 全ユーザー情報を一括取得（N+1クエリ削減）
 * users コレクションを1回だけ取得してキャッシュし、行ごとの個別取得を避ける。
 * @param {boolean} forceRefresh - キャッシュを無視して再取得するか
 * @returns {Promise<Object>} { [userId]: userData } 形式のマップ
 */
async function getUsersMap(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && usersMapCache && usersMapCacheTime && (now - usersMapCacheTime < CACHE_DURATION)) {
        return usersMapCache;
    }
    const snapshot = await db.collection('users').get();
    countReads(snapshot.size);
    const map = {};
    snapshot.forEach(doc => {
        map[doc.id] = doc.data();
    });
    usersMapCache = map;
    usersMapCacheTime = now;
    return map;
}

/**
 * ユーザー一括キャッシュを無効化（ユーザー作成・名前変更時に呼ぶ）
 */
function invalidateUsersMapCache() {
    usersMapCache = null;
    usersMapCacheTime = null;
}

/**
 * ユーザー情報を取得
 * 一括キャッシュ（getUsersMap）経由で参照し、未収載の場合のみ単体取得にフォールバックする。
 * これにより投稿/ランキング/コメントの行ごとの逐次取得が実質1回の全件取得に集約される。
 * @param {string} userId - ユーザーID
 * @returns {Promise<Object|null>} ユーザー情報
 */
async function getUserData(userId) {
    const usersMap = await getUsersMap();
    if (usersMap[userId]) {
        return usersMap[userId];
    }
    // キャッシュ未収載（新規登録直後など）は単体取得でフォールバック
    const doc = await db.collection('users').doc(userId).get();
    countReads(1);
    return doc.exists ? doc.data() : null;
}

/**
 * ユーザー情報を作成
 * @param {string} userId - ユーザーID
 * @param {string} userName - ユーザー名
 * @param {string} email - メールアドレス
 */
async function createUserData(userId, userName, email) {
    await db.collection('users').doc(userId).set({
        userId: userId,
        userName: userName,
        email: email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    invalidateUsersMapCache();
}

/**
 * 「今日ログインした」印を users ドキュメントに残す（デイリーミッションの
 * みんなの目標を、その日ログインした人だけに絞るため）。
 * 既に今日の印があれば書き込まない。⚠️ web/src/lib/users.ts: touchUserActivity のミラー。
 * @param {string} userId - ユーザーID
 * @param {string} dateKey - JSTの暦日 'YYYY-MM-DD'
 */
async function touchUserActivity(userId, dateKey) {
    try {
        const current = await getUserData(userId);
        if (current && current.lastActiveDateKey === dateKey) return;
        await db.collection('users').doc(userId).set({
            lastActiveDateKey: dateKey,
            lastActiveAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        invalidateUsersMapCache();
    } catch (e) {
        // 記録できなくてもアプリは動く（自分は必ずグラフに載る）
        console.warn('[ユーザー] ログイン記録に失敗:', e);
    }
}

/**
 * ユーザー名を更新
 * @param {string} userId - ユーザーID
 * @param {string} newUserName - 新しいユーザー名
 */
async function updateUserName(userId, newUserName) {
    await db.collection('users').doc(userId).update({
        userName: newUserName,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    invalidateUsersMapCache();
}

// ====================================================================
// ルール管理機能
// ====================================================================

/**
 * 種目倍率の設定を取得
 * @returns {Promise<Object>} 倍率設定オブジェクト
 */
async function getMultipliers() {
    const collectionName = getCollectionName('settings');
    console.log(`[getMultipliers] モード: ${currentMode}, コレクション: ${collectionName}`);
    const doc = await db.collection(collectionName).doc('multipliers').get();
    if (doc.exists) {
        return doc.data();
    } else {
        console.log(`[getMultipliers] デフォルト値を使用 (${currentMode}モードで設定が未作成)`);
        // デフォルト値を返す
        return {
            pushup: 1.0,
            dips: 1.0,
            squat: 1.0,
            Lsit: 1.0,
            pullup: 1.0
        };
    }
}

/**
 * 種目倍率の設定を更新
 * @param {Object} multipliers - 倍率設定オブジェクト
 */
async function updateMultipliers(multipliers) {
    const collectionName = getCollectionName('settings');
    console.log(`[updateMultipliers] モード: ${currentMode}, コレクション: ${collectionName}`);
    await db.collection(collectionName).doc('multipliers').set({
        ...multipliers,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    console.log(`[updateMultipliers] 倍率更新完了 (${currentMode}モード)`);
}

/**
 * 倍率設定をUIにロード
 */
async function loadMultipliers() {
    try {
        const multipliers = await getMultipliers();
        
        // 各入力フィールドに値をセット
        for (const [exercise, value] of Object.entries(multipliers)) {
            if (multiplierInputs[exercise]) {
                multiplierInputs[exercise].value = value;
            }
        }
    } catch (error) {
        console.error('倍率の取得に失敗しました:', error);
        rulesError.textContent = '倍率の取得に失敗しました';
    }
}

// ====================================================================
// 得点計算機能
// ====================================================================

/**
 * 各ユーザーの種目別最高記録と得点を取得（キャッシュ対応）
 * @param {boolean} forceRefresh - キャッシュを無視して再取得するか
 * @returns {Promise<Object>} ユーザーIDをキーとした得点データ
 */
async function getAllUsersScores(forceRefresh = false) {
    try {
        const now = Date.now();
        const mode = currentMode;
        
        // キャッシュが有効な場合はキャッシュを使用
        if (!forceRefresh && scoreCache[mode] && scoreCacheTime[mode] && (now - scoreCacheTime[mode] < CACHE_DURATION)) {
            console.log(`[getAllUsersScores] キャッシュを使用 (${mode}モード)`);
            return scoreCache[mode];
        }
        
        console.log(`[getAllUsersScores] Firestoreから取得中 (${mode}モード)`);
        
        // 独立した3クエリを並列化（直列ウォーターフォール解消）
        const collectionName = getCollectionName('posts');
        const [multipliers, postsSnapshot, usersMap] = await Promise.all([
            getMultipliers(),
            db.collection(collectionName).get(),
            getUsersMap()
        ]);
        countReads(postsSnapshot.size);

        // ユーザー情報を格納
        const usersData = {};
        Object.keys(usersMap).forEach(uid => {
            const data = usersMap[uid];
            usersData[uid] = data.userName || data.email;
        });
        
        // ユーザーごと、種目ごとの最高記録を集計
        const userRecords = {};
        
        postsSnapshot.forEach(doc => {
            const post = doc.data();
            const userId = post.userId;
            const exerciseType = post.exerciseType;
            const value = post.value;
            
            if (!userRecords[userId]) {
                userRecords[userId] = {
                    userName: usersData[userId] || 'Unknown',
                    exercises: {}
                };
            }
            
            // 種目ごとの最高記録を更新
            if (!userRecords[userId].exercises[exerciseType] || 
                userRecords[userId].exercises[exerciseType] < value) {
                userRecords[userId].exercises[exerciseType] = value;
            }
        });
        
        // 得点を計算
        const exerciseTypes = ['pushup', 'dips', 'squat', 'Lsit', 'pullup'];
        
        for (const userId in userRecords) {
            const user = userRecords[userId];
            user.scores = {};
            user.totalScore = 0;
            
            exerciseTypes.forEach(exercise => {
                const record = user.exercises[exercise] || 0;
                const multiplier = multipliers[exercise] || 1.0;
                const score = record * multiplier;
                
                user.scores[exercise] = score;
                user.totalScore += score;
            });
        }
        
        // キャッシュを更新
        scoreCache[mode] = userRecords;
        scoreCacheTime[mode] = now;
        
        console.log(`[getAllUsersScores] ${Object.keys(userRecords).length}人の得点を計算 (${mode}モード)`);
        
        return userRecords;
        
    } catch (error) {
        console.error(`[getAllUsersScores] エラー (${currentMode}モード):`, error);
        throw error;
    }
}

/**
 * 得点レーダーチャートを描画
 * @param {Array} selectedUserIds - 表示するユーザーIDの配列
 */
async function loadScoreChart(selectedUserIds = []) {
    try {
        scoreError.textContent = '';
        
        const usersScores = await getAllUsersScores();

        // 総合得点ランキングを先に描画する。
        // Chart.js の読み込み/描画に依存させないことで、通信が悪くても数値は即表示される。
        displayTotalScores(usersScores);

        // 選択されたユーザーがいない場合は全ユーザー表示
        if (selectedUserIds.length === 0) {
            selectedUserIds = Object.keys(usersScores);
        }

        // 集計方法は「最高得点を100%とした%の合計」で固定
        const isDeviationMode = false;
        const isPercentageMode = true;
        
        // 偏差値データまたは%データを取得
        let deviationData = null;
        let percentageData = null;
        if (isDeviationMode) {
            deviationData = calculateDeviationScores(usersScores);
        } else if (isPercentageMode) {
            percentageData = calculatePercentageScores(usersScores);
        }
        
        // 全ユーザーIDをソートして固定順序を作成（色の衝突を防ぐ）
        const allUserIds = Object.keys(usersScores).sort();
        
        // ユーザーIDから固定の色インデックスを取得する関数
        const getUserColorIndex = (userId) => {
            // ソートされた全ユーザーリスト内での位置を色インデックスとする
            const index = allUserIds.indexOf(userId);
            return index >= 0 ? index : 0;
        };
        
        // Chart.jsのデータセットを作成
        const datasets = selectedUserIds.map((userId) => {
            const user = usersScores[userId];
            if (!user) return null;
            
            const colors = [
                'rgba(102, 126, 234, 0.6)',
                'rgba(237, 100, 166, 0.6)',
                'rgba(255, 159, 64, 0.6)',
                'rgba(75, 192, 192, 0.6)',
                'rgba(153, 102, 255, 0.6)',
                'rgba(255, 205, 86, 0.6)'
            ];
            
            const borderColors = [
                'rgb(102, 126, 234)',
                'rgb(237, 100, 166)',
                'rgb(255, 159, 64)',
                'rgb(75, 192, 192)',
                'rgb(153, 102, 255)',
                'rgb(255, 205, 86)'
            ];
            
            // userIdの固定順序に基づいて色を割り当て
            const colorIndex = getUserColorIndex(userId) % colors.length;
            const color = colors[colorIndex];
            const borderColor = borderColors[colorIndex];
            
            // データを集計方法に応じて取得
            let chartData;
            if (isDeviationMode && deviationData && deviationData[userId]) {
                // 偏差値モード
                chartData = [
                    deviationData[userId].deviations.pushup || 0,
                    deviationData[userId].deviations.dips || 0,
                    deviationData[userId].deviations.squat || 0,
                    deviationData[userId].deviations.Lsit || 0,
                    deviationData[userId].deviations.pullup || 0
                ];
            } else if (isPercentageMode && percentageData && percentageData[userId]) {
                // %モード
                chartData = [
                    percentageData[userId].percentages.pushup || 0,
                    percentageData[userId].percentages.dips || 0,
                    percentageData[userId].percentages.squat || 0,
                    percentageData[userId].percentages.Lsit || 0,
                    percentageData[userId].percentages.pullup || 0
                ];
            } else {
                // 通常モード（得点）
                chartData = [
                    user.scores.pushup || 0,
                    user.scores.dips || 0,
                    user.scores.squat || 0,
                    user.scores.Lsit || 0,
                    user.scores.pullup || 0
                ];
            }
            
            return {
                label: user.userName,
                data: chartData,
                backgroundColor: color,
                borderColor: borderColor,
                borderWidth: 2,
                pointBackgroundColor: borderColor,
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: borderColor
            };
        }).filter(dataset => dataset !== null);
        
        // Chart.js を遅延ロード（初回のみ取得）
        await ensureChartJs();

        // 既存のチャートを破棄
        if (myScoreChart) {
            myScoreChart.destroy();
        }

        // レーダーチャートを描画
        const ctx = scoreChart.getContext('2d');
        myScoreChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: [
                    'プッシュアップ',
                    'ディップス',
                    '片足スクワット',
                    'Lシット',
                    '懸垂'
                ],
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 10,
                        bottom: 10,
                        left: 20,
                        right: 20
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 10
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        align: 'center',
                        labels: {
                            font: {
                                size: 13
                            },
                            padding: 15,
                            boxWidth: 15,
                            boxHeight: 15
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed.r.toFixed(1);
                                let unit = '点';
                                if (isDeviationMode) {
                                    unit = '';
                                } else if (isPercentageMode) {
                                    unit = '%';
                                }
                                return context.dataset.label + ': ' + value + unit;
                            }
                        }
                    }
                }
            }
        });

    } catch (error) {
        console.error('得点チャートの描画に失敗しました:', error);
        // 数値ランキングは既に表示済みなので、チャートのみ失敗した旨を伝える
        scoreError.textContent = '得点グラフの描画に失敗しました（通信状態をご確認ください）';
    }
}

/**
 * 偏差値を計算する
 * @param {number} score - 個人の得点
 * @param {number} mean - 平均値
 * @param {number} stdDev - 標準偏差
 * @returns {number} 偏差値
 */
function calculateDeviation(score, mean, stdDev) {
    if (stdDev === 0) return 50; // 全員同じ点数の場合は50
    return 50 + (10 * (score - mean) / stdDev);
}

/**
 * 種目ごとの偏差値を計算
 * @param {Object} usersScores - ユーザー得点データ
 * @returns {Object} ユーザーごとの偏差値データ
 */
function calculateDeviationScores(usersScores) {
    const exercises = ['pushup', 'dips', 'squat', 'Lsit', 'pullup'];
    const deviationData = {};
    
    // 種目ごとに平均と標準偏差を計算
    exercises.forEach(exercise => {
        const scores = [];
        const userIds = [];
        
        // 記録があるユーザーのみを対象
        Object.entries(usersScores).forEach(([userId, user]) => {
            const score = user.scores[exercise] || 0;
            if (score > 0) {
                scores.push(score);
                userIds.push(userId);
            }
        });
        
        if (scores.length === 0) return;
        
        // 平均を計算
        const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        
        // 標準偏差を計算
        const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
        const stdDev = Math.sqrt(variance);
        
        // 各ユーザーの偏差値を計算
        Object.entries(usersScores).forEach(([userId, user]) => {
            if (!deviationData[userId]) {
                deviationData[userId] = {
                    userName: user.userName,
                    exercises: {},
                    deviations: {},
                    totalDeviation: 0
                };
            }
            
            const score = user.scores[exercise] || 0;
            const exerciseValue = user.exercises[exercise] || 0;
            
            if (score > 0) {
                const deviation = calculateDeviation(score, mean, stdDev);
                deviationData[userId].deviations[exercise] = deviation;
                deviationData[userId].exercises[exercise] = exerciseValue;
                deviationData[userId].totalDeviation += deviation;
            } else {
                deviationData[userId].deviations[exercise] = 0;
                deviationData[userId].exercises[exercise] = 0;
            }
        });
    });
    
    return deviationData;
}

/**
 * 種目ごとの%を計算（最高得点を100%とする）
 * @param {Object} usersScores - ユーザー得点データ
 * @returns {Object} ユーザーごとの%データ
 */
function calculatePercentageScores(usersScores) {
    const exercises = ['pushup', 'dips', 'squat', 'Lsit', 'pullup'];
    const percentageData = {};
    
    // 種目ごとに最高得点を計算
    exercises.forEach(exercise => {
        let maxScore = 0;
        
        // 最高得点を取得
        Object.entries(usersScores).forEach(([userId, user]) => {
            const score = user.scores[exercise] || 0;
            if (score > maxScore) {
                maxScore = score;
            }
        });
        
        // 各ユーザーの%を計算
        Object.entries(usersScores).forEach(([userId, user]) => {
            if (!percentageData[userId]) {
                percentageData[userId] = {
                    userName: user.userName,
                    exercises: {},
                    percentages: {},
                    totalPercentage: 0
                };
            }
            
            const score = user.scores[exercise] || 0;
            const exerciseValue = user.exercises[exercise] || 0;
            
            if (maxScore > 0 && score > 0) {
                const percentage = (score / maxScore) * 100;
                percentageData[userId].percentages[exercise] = percentage;
                percentageData[userId].exercises[exercise] = exerciseValue;
                percentageData[userId].totalPercentage += percentage;
            } else {
                percentageData[userId].percentages[exercise] = 0;
                percentageData[userId].exercises[exercise] = 0;
            }
        });
    });
    
    return percentageData;
}

/**
 * 総合得点ランキングを表示
 * @param {Object} usersScores - ユーザー得点データ
 */
async function displayTotalScores(usersScores) {
    // 集計方法は「最高得点を100%とした%の合計」で固定
    const scoringMethod = 'percentage';
    
    let sortedUsers;
    let dataToDisplay;
    
    if (scoringMethod === 'deviation') {
        // 偏差値方式
        const deviationData = calculateDeviationScores(usersScores);
        sortedUsers = Object.entries(deviationData)
            .sort((a, b) => b[1].totalDeviation - a[1].totalDeviation);
        dataToDisplay = 'deviation';
    } else if (scoringMethod === 'percentage') {
        // %方式
        const percentageData = calculatePercentageScores(usersScores);
        sortedUsers = Object.entries(percentageData)
            .sort((a, b) => b[1].totalPercentage - a[1].totalPercentage);
        dataToDisplay = 'percentage';
    } else {
        // 合計方式（デフォルト）
        sortedUsers = Object.entries(usersScores)
            .sort((a, b) => b[1].totalScore - a[1].totalScore);
        dataToDisplay = 'sum';
    }
    
    // 倍率を取得
    const multipliers = await getMultipliers();
    
    let html = '';
    let currentRank = 1;
    let previousScore = null;
    
    sortedUsers.forEach(([userId, userData], index) => {
        // 総合得点を取得
        let totalScore;
        if (dataToDisplay === 'deviation') {
            totalScore = userData.totalDeviation;
        } else if (dataToDisplay === 'percentage') {
            totalScore = userData.totalPercentage;
        } else {
            totalScore = userData.totalScore;
        }
        
        // 前の人と同じ得点でなければ順位を更新
        if (previousScore !== null && totalScore !== previousScore) {
            currentRank = index + 1;
        }
        previousScore = totalScore;
        
        const medal = currentRank === 1 ? '🥇' : currentRank === 2 ? '🥈' : currentRank === 3 ? '🥉' : `${currentRank}.`;
        
        // 詳細内訳を作成（集計方法によって異なる）
        let details;
        if (dataToDisplay === 'deviation') {
            // 偏差値方式：種目名、回数、得点、偏差値
            details = `
                <div class="score-details" id="score-details-${escapeHtml(userId)}" style="display: none;">
                    <div class="score-breakdown">
                        <div class="breakdown-item breakdown-deviation">
                            <span class="breakdown-label">プッシュアップ</span>
                            <span class="breakdown-num">${userData.exercises.pushup || 0}回</span>
                            <span class="breakdown-score">${(usersScores[userId].scores.pushup || 0).toFixed(1)}点</span>
                            <span class="breakdown-dev">${userData.deviations.pushup ? userData.deviations.pushup.toFixed(1) : '0.0'}</span>
                        </div>
                        <div class="breakdown-item breakdown-deviation">
                            <span class="breakdown-label">ディップス</span>
                            <span class="breakdown-num">${userData.exercises.dips || 0}回</span>
                            <span class="breakdown-score">${(usersScores[userId].scores.dips || 0).toFixed(1)}点</span>
                            <span class="breakdown-dev">${userData.deviations.dips ? userData.deviations.dips.toFixed(1) : '0.0'}</span>
                        </div>
                        <div class="breakdown-item breakdown-deviation">
                            <span class="breakdown-label">片足スクワット</span>
                            <span class="breakdown-num">${userData.exercises.squat || 0}回</span>
                            <span class="breakdown-score">${(usersScores[userId].scores.squat || 0).toFixed(1)}点</span>
                            <span class="breakdown-dev">${userData.deviations.squat ? userData.deviations.squat.toFixed(1) : '0.0'}</span>
                        </div>
                        <div class="breakdown-item breakdown-deviation">
                            <span class="breakdown-label">Lシット</span>
                            <span class="breakdown-num">${userData.exercises.Lsit || 0}秒</span>
                            <span class="breakdown-score">${(usersScores[userId].scores.Lsit || 0).toFixed(1)}点</span>
                            <span class="breakdown-dev">${userData.deviations.Lsit ? userData.deviations.Lsit.toFixed(1) : '0.0'}</span>
                        </div>
                        <div class="breakdown-item breakdown-deviation">
                            <span class="breakdown-label">懸垂</span>
                            <span class="breakdown-num">${userData.exercises.pullup || 0}セット</span>
                            <span class="breakdown-score">${(usersScores[userId].scores.pullup || 0).toFixed(1)}点</span>
                            <span class="breakdown-dev">${userData.deviations.pullup ? userData.deviations.pullup.toFixed(1) : '0.0'}</span>
                        </div>
                    </div>
                </div>
            `;
        } else if (dataToDisplay === 'percentage') {
            // %方式：種目名、回数、得点、%
            details = `
                <div class="score-details" id="score-details-${escapeHtml(userId)}" style="display: none;">
                    <div class="score-breakdown">
                        <div class="breakdown-item breakdown-deviation">
                            <span class="breakdown-label">プッシュアップ</span>
                            <span class="breakdown-num">${userData.exercises.pushup || 0}回</span>
                            <span class="breakdown-score">${(usersScores[userId].scores.pushup || 0).toFixed(1)}点</span>
                            <span class="breakdown-pct">${userData.percentages.pushup ? userData.percentages.pushup.toFixed(1) : '0.0'}%</span>
                        </div>
                        <div class="breakdown-item breakdown-deviation">
                            <span class="breakdown-label">ディップス</span>
                            <span class="breakdown-num">${userData.exercises.dips || 0}回</span>
                            <span class="breakdown-score">${(usersScores[userId].scores.dips || 0).toFixed(1)}点</span>
                            <span class="breakdown-pct">${userData.percentages.dips ? userData.percentages.dips.toFixed(1) : '0.0'}%</span>
                        </div>
                        <div class="breakdown-item breakdown-deviation">
                            <span class="breakdown-label">片足スクワット</span>
                            <span class="breakdown-num">${userData.exercises.squat || 0}回</span>
                            <span class="breakdown-score">${(usersScores[userId].scores.squat || 0).toFixed(1)}点</span>
                            <span class="breakdown-pct">${userData.percentages.squat ? userData.percentages.squat.toFixed(1) : '0.0'}%</span>
                        </div>
                        <div class="breakdown-item breakdown-deviation">
                            <span class="breakdown-label">Lシット</span>
                            <span class="breakdown-num">${userData.exercises.Lsit || 0}秒</span>
                            <span class="breakdown-score">${(usersScores[userId].scores.Lsit || 0).toFixed(1)}点</span>
                            <span class="breakdown-pct">${userData.percentages.Lsit ? userData.percentages.Lsit.toFixed(1) : '0.0'}%</span>
                        </div>
                        <div class="breakdown-item breakdown-deviation">
                            <span class="breakdown-label">懸垂</span>
                            <span class="breakdown-num">${userData.exercises.pullup || 0}セット</span>
                            <span class="breakdown-score">${(usersScores[userId].scores.pullup || 0).toFixed(1)}点</span>
                            <span class="breakdown-pct">${userData.percentages.pullup ? userData.percentages.pullup.toFixed(1) : '0.0'}%</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // 合計方式：従来の表示
            const user = userData;
            details = `
                <div class="score-details" id="score-details-${escapeHtml(userId)}" style="display: none;">
                    <div class="score-breakdown">
                        <div class="breakdown-item">
                            <span class="breakdown-label">プッシュアップ</span>
                            <span class="breakdown-num">${user.exercises.pushup || 0}</span>
                            <span class="breakdown-unit">回</span>
                            <span class="breakdown-times">×</span>
                            <span class="breakdown-mult">${multipliers.pushup}</span>
                            <span class="breakdown-equals">=</span>
                            <span class="breakdown-score">${(user.scores.pushup || 0).toFixed(1)}</span>
                            <span class="breakdown-point">点</span>
                        </div>
                        <div class="breakdown-item">
                            <span class="breakdown-label">ディップス</span>
                            <span class="breakdown-num">${user.exercises.dips || 0}</span>
                            <span class="breakdown-unit">回</span>
                            <span class="breakdown-times">×</span>
                            <span class="breakdown-mult">${multipliers.dips}</span>
                            <span class="breakdown-equals">=</span>
                            <span class="breakdown-score">${(user.scores.dips || 0).toFixed(1)}</span>
                            <span class="breakdown-point">点</span>
                        </div>
                        <div class="breakdown-item">
                            <span class="breakdown-label">片足スクワット</span>
                            <span class="breakdown-num">${user.exercises.squat || 0}</span>
                            <span class="breakdown-unit">回</span>
                            <span class="breakdown-times">×</span>
                            <span class="breakdown-mult">${multipliers.squat}</span>
                            <span class="breakdown-equals">=</span>
                            <span class="breakdown-score">${(user.scores.squat || 0).toFixed(1)}</span>
                            <span class="breakdown-point">点</span>
                        </div>
                        <div class="breakdown-item">
                            <span class="breakdown-label">Lシット</span>
                            <span class="breakdown-num">${user.exercises.Lsit || 0}</span>
                            <span class="breakdown-unit">秒</span>
                            <span class="breakdown-times">×</span>
                            <span class="breakdown-mult">${multipliers.Lsit}</span>
                            <span class="breakdown-equals">=</span>
                            <span class="breakdown-score">${(user.scores.Lsit || 0).toFixed(1)}</span>
                            <span class="breakdown-point">点</span>
                        </div>
                        <div class="breakdown-item">
                            <span class="breakdown-label">懸垂</span>
                            <span class="breakdown-num">${user.exercises.pullup || 0}</span>
                            <span class="breakdown-unit">セット</span>
                            <span class="breakdown-times">×</span>
                            <span class="breakdown-mult">${multipliers.pullup}</span>
                            <span class="breakdown-equals">=</span>
                            <span class="breakdown-score">${(user.scores.pullup || 0).toFixed(1)}</span>
                            <span class="breakdown-point">点</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        html += `
            <div class="total-score-item" onclick="toggleScoreDetails('${escapeHtml(userId)}')">
                <div class="score-header">
                    <span class="score-rank">${medal}</span>
                    <span class="score-username">${escapeHtml(userData.userName)}</span>
                    <span class="score-value">${totalScore.toFixed(1)}${dataToDisplay === 'sum' ? '点' : dataToDisplay === 'percentage' ? '%' : ''}</span>
                </div>
                ${details}
            </div>
        `;
    });
    
    totalScoresList.innerHTML = html;
}

/**
 * 得点詳細の表示切り替え
 * @param {string} userId - ユーザーID
 */
function toggleScoreDetails(userId) {
    const detailsElement = document.getElementById(`score-details-${userId}`);
    if (detailsElement) {
        const isVisible = detailsElement.style.display === 'block';
        if (currentMode === 'weekly' && weeklySimulatorEnabled) {
            weeklySimulatorExpandedUserId = isVisible ? null : userId;
        }
        
        if (isVisible) {
            // 閉じる時：slideUpアニメーションを適用してから非表示
            detailsElement.style.animation = 'slideUp 0.3s ease';
            setTimeout(() => {
                detailsElement.style.display = 'none';
                detailsElement.style.animation = 'slideDown 0.3s ease'; // 次回開く時用にリセット
            }, 300);
        } else {
            // 開く時：slideDownアニメーション（既存のCSS）
            detailsElement.style.display = 'block';
        }
    }
}

/**
 * ユーザー選択チェックボックスを作成（キャッシュ対応）
 */
async function loadUserCheckboxes(forceRefresh = false) {
    try {
        setWeeklySimulatorControlsVisible(false);
        const usersScores = await getAllUsersScores(forceRefresh);
        
        let html = '';
        Object.keys(usersScores).forEach(userId => {
            const user = usersScores[userId];
            const isCurrentUser = userId === currentUser.uid;
            const checked = isCurrentUser ? 'checked' : '';
            
            html += `
                <label class="user-checkbox">
                    <input type="checkbox" value="${userId}" ${checked}>
                    <span>${escapeHtml(user.userName)}</span>
                </label>
            `;
        });
        
        userCheckboxes.innerHTML = html;
        
        // チェックボックス変更時のイベントリスナー
        userCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const selectedIds = Array.from(
                    userCheckboxes.querySelectorAll('input[type="checkbox"]:checked')
                ).map(cb => cb.value);
                
                loadScoreChart(selectedIds);
            });
        });
        
        // 初期表示（現在のユーザーのみ）
        loadScoreChart([currentUser.uid]);
        
    } catch (error) {
        console.error('ユーザーチェックボックスの作成に失敗しました:', error);
        scoreError.textContent = 'ユーザーリストの取得に失敗しました';
    }
}

// ====================================================================
// 認証状態の監視
// ====================================================================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;

        const isGuestAccount = user.email === GUEST_EMAIL;

        if (isGuestAccount) {
            // 固定ゲストアカウント処理
            let guestData = await getUserData(user.uid);
            if (!guestData) {
                // 初回ログイン時にFirestoreドキュメントを作成
                await db.collection('users').doc(user.uid).set({
                    userId: user.uid,
                    userName: 'ゲスト',
                    email: GUEST_EMAIL,
                    isGuest: true,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                invalidateUsersMapCache();
                guestData = await getUserData(user.uid);
            } else if (!guestData.isGuest) {
                // isGuestフラグが未設定の場合は補完
                await db.collection('users').doc(user.uid).update({ isGuest: true });
                invalidateUsersMapCache();
                guestData = { ...guestData, isGuest: true };
            }
            currentUserData = guestData;
        } else {
            // 通常ユーザー処理
            currentUserData = await getUserData(user.uid);

            // ユーザー情報が存在しない場合（既存ユーザーの初回ログイン）
            if (!currentUserData) {
                await createUserData(user.uid, user.email, user.email);
                currentUserData = await getUserData(user.uid);
            }
        }

        // デイリーミッションの「みんなの目標」に載る条件なので、
        // 一覧を読む処理より先に今日の印を残す
        await touchUserActivity(user.uid, getDailyDateKeyJST());

        // ユーザー名をプロフィールボタンに表示
        let displayName = currentUserData?.userName || user.email || 'ゲスト';
        profileBtn.innerHTML = '<i class="fa-solid fa-user"></i> ' + displayName;
        
        loginContainer.style.display = 'none';
        mainContainer.style.display = 'block';
        
        // モードセレクターの値を現在のモードに同期
        modeSelect.value = currentMode;
        
        // 背景色クラスを設定（bodyとhtmlの両方）
        document.body.classList.remove('mode-normal', 'mode-interval', 'mode-free', 'mode-weekly');
        document.body.classList.add(`mode-${currentMode}`);
        document.documentElement.classList.remove('mode-normal', 'mode-interval', 'mode-free', 'mode-weekly');
        document.documentElement.classList.add(`mode-${currentMode}`);
        
        // モードに応じたタブ表示を初期化
        updateTabsForMode();

        // フリーモードが初期モードの場合はUI初期化
        if (currentMode === 'free') {
            await initFreeMode();
        } else if (currentMode === 'weekly') {
            await initWeeklyMode();
        } else {
            // 通常モード：投稿タブに標準種目カードを表示
            restoreStandardExerciseUI();
        }

        // 今日のデイリーミッションが未クリアなら、まずその画面を開く（起動時1回のみ）
        maybeOpenDailyMissionOnStart();

        // 自分あての特別イベント承認依頼があればポップアップで聞く（回答するまで毎回）
        maybeShowSpecialEventApprovalOnStart();

        // 初期表示は投稿タブのみ。掲示板の投稿一覧を読み込む。
        loadPosts();
        // ランキングは表示中でないため初期ロードしない（ランキングタブを開いた時に読み込む）。
        // 全postsの取得を初期クリティカルパスから外し、初回表示を軽くする。

        // 週次ウィークリー（週報＆分析）の新着チェック（NEWバッジ／バナー制御）
        checkLatestWeeklyReport();
    } else {
        // ログアウト時の処理
        currentUser = null;
        currentUserData = null;
        
        // グラフをクリア
        if (myChart) {
            myChart.destroy();
            myChart = null;
        }
        
        // タイマーを停止
        if (timerInterval) {
            resetTimer();
        }
        
        loginContainer.style.display = 'block';
        mainContainer.style.display = 'none';

        // 開いているモーダルをすべて閉じる
        if (profileModal) profileModal.style.display = 'none';
        if (championDetailModal) championDetailModal.style.display = 'none';
        if (resetPasswordModal) resetPasswordModal.style.display = 'none';
        closeSpecialEventModal();
        // 次のログインで承認依頼と結果通知をもう一度チェックする
        specialEventStartCheckDone = false;
        specialEventAfterApproval = null;
        specialEventResultQueue = [];
        specialEventResultIndex = 0;
    }
});

/**
 * 週次ウィークリー（weekly_reports）の最新を確認し、未読なら NEW バッジ／バナーを表示する。
 * 既読判定は report.html と共有の localStorage キー（最後に開いた週の docId）で行う。
 */
async function checkLatestWeeklyReport() {
    try {
        const snap = await db.collection('weekly_reports')
            .orderBy('publishedAt', 'desc')
            .limit(1)
            .get();
        if (snap.empty) return;
        const latestId = snap.docs[0].id;
        let seen = null;
        try { seen = localStorage.getItem('growrep_lastSeenWeekly'); } catch (e) { /* localStorage 不可は無視 */ }
        const unseen = seen !== latestId;
        const badge = document.getElementById('weekly-new-badge');
        const banner = document.getElementById('weekly-report-banner');
        if (badge) badge.style.display = unseen ? 'block' : 'none';
        if (banner) banner.style.display = unseen ? 'flex' : 'none';
    } catch (e) {
        console.warn('[ウィークリー] 最新レポート確認に失敗:', e);
    }
}

// ログイン
loginBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    if (!email || !password) {
        authError.textContent = 'メールアドレスとパスワードを入力してください';
        return;
    }
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        authError.textContent = '';
    } catch (error) {
        authError.textContent = getErrorMessage(error.code);
    }
});

// 新規登録
signupBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    if (!email || !password) {
        authError.textContent = 'メールアドレスとパスワードを入力してください';
        return;
    }
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        
        // ユーザー情報を作成（初期ユーザー名はメールアドレス）
        await createUserData(userCredential.user.uid, email, email);
        
        authError.textContent = '';
    } catch (error) {
        authError.textContent = getErrorMessage(error.code);
    }
});

// ゲストログイン
guestLoginBtn.addEventListener('click', async () => {
    authError.textContent = '';
    if (GUEST_EMAIL === '__GUEST_EMAIL__' || GUEST_PASSWORD === '__GUEST_PASSWORD__') {
        authError.textContent = 'ゲストアカウントが未設定です。firebase-config.js の GUEST_EMAIL / GUEST_PASSWORD を設定してください。';
        return;
    }
    try {
        await auth.signInWithEmailAndPassword(GUEST_EMAIL, GUEST_PASSWORD);
    } catch (error) {
        authError.textContent = 'ゲストログインに失敗しました: ' + error.message;
    }
});

// ログアウト
logoutBtn.addEventListener('click', () => {
    auth.signOut();
});

// ====================================================================
// パスワードリセット機能
// ====================================================================

// パスワードリセットリンククリック
forgotPasswordLink.addEventListener('click', (e) => {
    e.preventDefault();
    resetEmailInput.value = '';
    resetError.textContent = '';
    resetSuccess.textContent = '';
    resetPasswordModal.style.display = 'block';
});

// リセットモーダルを閉じる
closeResetModal.addEventListener('click', () => {
    resetPasswordModal.style.display = 'none';
});

// モーダル外クリックで閉じる
window.addEventListener('click', (event) => {
    if (event.target === resetPasswordModal) {
        resetPasswordModal.style.display = 'none';
    }
});

// パスワードリセットメール送信
sendResetBtn.addEventListener('click', async () => {
    const email = resetEmailInput.value.trim();
    
    if (!email) {
        resetError.textContent = 'メールアドレスを入力してください';
        resetSuccess.textContent = '';
        return;
    }
    
    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        resetError.textContent = '有効なメールアドレスを入力してください';
        resetSuccess.textContent = '';
        return;
    }
    
    try {
        await auth.sendPasswordResetEmail(email);
        resetError.textContent = '';
        resetSuccess.textContent = `パスワードリセットメールを ${email} に送信しました。メールをご確認ください。`;
        resetEmailInput.value = '';
        
        // 3秒後にモーダルを閉じる
        setTimeout(() => {
            resetPasswordModal.style.display = 'none';
            resetSuccess.textContent = '';
        }, 3000);
    } catch (error) {
        resetSuccess.textContent = '';
        if (error.code === 'auth/user-not-found') {
            resetError.textContent = 'このメールアドレスは登録されていません';
        } else if (error.code === 'auth/invalid-email') {
            resetError.textContent = '無効なメールアドレスです';
        } else if (error.code === 'auth/too-many-requests') {
            resetError.textContent = 'リクエストが多すぎます。しばらく待ってから再度お試しください';
        } else {
            resetError.textContent = 'エラーが発生しました: ' + error.message;
        }
    }
});

// ====================================================================
// プロフィールモーダル
// ====================================================================

// プロフィールボタンクリック
profileBtn.addEventListener('click', () => {
    if (currentUser && currentUserData) {
        const isGuest = !!currentUserData.isGuest;

        if (isGuest) {
            // ゲスト専用表示
            profileEmail.textContent = 'ゲストユーザー（共有アカウント）';
            currentUsername.textContent = 'ゲスト';

            guestModeSection.style.display = 'block';
            usernameSectionEl.style.display = 'none';
            passwordSectionEl.style.display = 'none';
        } else {
            // 通常ユーザー表示
            guestModeSection.style.display = 'none';
            usernameSectionEl.style.display = '';
            passwordSectionEl.style.display = '';

            profileEmail.textContent = currentUser.email;
            if (currentUserData.userName && currentUserData.userName !== currentUser.email) {
                currentUsername.textContent = currentUserData.userName;
            } else {
                currentUsername.textContent = '未設定';
            }
        }

        newUsernameInput.value = '';
        usernameError.textContent = '';
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';
        passwordError.textContent = '';
        profileModal.style.display = 'block';

        // 「特別イベント提案」を押した時に待たせないよう、ここで先読みしておく
        if (!isGuest && typeof prefetchSpecialEventProposalData === 'function') {
            prefetchSpecialEventProposalData();
        }
    }
});

// モーダルを閉じる
closeModal.addEventListener('click', () => {
    profileModal.style.display = 'none';
});

// モーダル外クリックで閉じる
window.addEventListener('click', (event) => {
    if (event.target === profileModal) {
        profileModal.style.display = 'none';
    }
});

// ユーザー名更新
updateUsernameBtn.addEventListener('click', async () => {
    const newUsername = newUsernameInput.value.trim();
    
    if (!newUsername) {
        usernameError.textContent = 'ユーザー名を入力してください';
        return;
    }
    
    if (newUsername.length < 2 || newUsername.length > 20) {
        usernameError.textContent = 'ユーザー名は2〜20文字で入力してください';
        return;
    }
    
    // 現在のユーザー名と同じかチェック
    if (currentUserData.userName === newUsername) {
        usernameError.textContent = '現在と同じユーザー名です';
        return;
    }
    
    try {
        // 重複チェック
        const exists = await checkUsernameExists(newUsername);
        if (exists) {
            usernameError.textContent = 'このユーザー名は既に使用されています';
            return;
        }
        
        // ユーザー名更新
        await updateUserName(currentUser.uid, newUsername);
        
        // ローカル情報更新
        currentUserData = await getUserData(currentUser.uid);
        profileBtn.innerHTML = '<i class="fa-solid fa-user"></i> ' + newUsername;
        currentUsername.textContent = newUsername;
        
        usernameError.textContent = '';
        newUsernameInput.value = '';
        alert('ユーザー名を更新しました！');
    } catch (error) {
        usernameError.textContent = 'エラーが発生しました: ' + error.message;
    }
});

// パスワード変更
updatePasswordBtn.addEventListener('click', async () => {
    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    
    // バリデーション
    if (!currentPassword || !newPassword || !confirmPassword) {
        passwordError.textContent = 'すべての項目を入力してください';
        return;
    }
    
    if (newPassword.length < 6) {
        passwordError.textContent = '新しいパスワードは6文字以上で入力してください';
        return;
    }
    
    if (newPassword !== confirmPassword) {
        passwordError.textContent = '新しいパスワードが一致しません';
        return;
    }
    
    if (currentPassword === newPassword) {
        passwordError.textContent = '現在のパスワードと同じパスワードは使用できません';
        return;
    }
    
    try {
        // 現在のパスワードで再認証
        const credential = firebase.auth.EmailAuthProvider.credential(
            currentUser.email,
            currentPassword
        );
        await currentUser.reauthenticateWithCredential(credential);
        
        // パスワード更新
        await currentUser.updatePassword(newPassword);
        
        // 入力欄をクリア
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';
        passwordError.textContent = '';
        
        alert('パスワードを変更しました！');
    } catch (error) {
        if (error.code === 'auth/wrong-password') {
            passwordError.textContent = '現在のパスワードが間違っています';
        } else if (error.code === 'auth/weak-password') {
            passwordError.textContent = 'パスワードが弱すぎます';
        } else {
            passwordError.textContent = 'エラーが発生しました: ' + error.message;
        }
    }
});

// ====================================================================
// モード切り替え機能
// ====================================================================

/**
 * モードに応じてタブの表示/非表示を制御
 */
function updateTabsForMode() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(btn => {
        const btnMode = btn.dataset.mode;
        if (btnMode) {
            // data-mode属性がある場合、そのモードでのみ表示
            btn.style.display = btnMode === currentMode ? 'block' : 'none';
        } else if (currentMode === 'raid') {
            // レイドはレイド専用タブだけの軽いモード。
            // 汎用タブ（投稿・掲示板・ランキング等）はフリー/週間側で見てもらう
            btn.style.display = 'none';
        } else {
            // data-mode属性がない場合、常に表示
            btn.style.display = 'block';
        }
    });

    tabContents.forEach(content => {
        const contentMode = content.dataset.mode;
        if (contentMode && contentMode !== currentMode) {
            // 表示中のタブがモード専用で、現在のモードと一致しない場合は非表示
            // ただしtimer-tabはintervalとfreeとweeklyの両方で使用可能
            if (content.id === 'timer-tab' && (currentMode === 'interval' || currentMode === 'free' || currentMode === 'weekly')) {
                // timer-tabはintervalとfreeとweeklyで共有
            } else {
                content.classList.remove('active');
            }
        }
    });
    
    // 既定のタブに戻す（モード専用タブが表示できなくなった場合）。
    // レイドは投稿タブを出さないので、代わりに今日のレイドへ戻す
    const fallbackToPostTab = () => {
        const fallbackTab = currentMode === 'raid' ? 'daily' : 'post';
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const btn = document.querySelector(`.tab-btn[data-tab="${fallbackTab}"]:not([style*="display: none"])`)
            || document.querySelector(`.tab-btn[data-tab="${fallbackTab}"]`);
        if (btn) btn.classList.add('active');
        const content = document.getElementById(`${fallbackTab}-tab`);
        if (content) content.classList.add('active');
        if (fallbackTab === 'daily') renderDailyMissionTab(false);
    };

    // 現在表示中のタブがモード専用かつ表示できない場合、既定のタブに戻る
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab) {
        const activeMode = activeTab.dataset.mode;
        if (activeMode && activeMode !== currentMode) {
            fallbackToPostTab();
        }
    }

    // デイリーミッションタブは free / weekly / raid で共有（data-mode を持たないため個別に判定）。
    // 対応外のモードに切り替えたら既定のタブに戻す。
    const dailyTab = document.getElementById('daily-tab');
    if (dailyTab && dailyTab.classList.contains('active')
        && currentMode !== 'free' && currentMode !== 'weekly' && currentMode !== 'raid') {
        fallbackToPostTab();
    }

    // レイドで汎用タブを開いたままモードを切り替えた場合も戻す
    if (currentMode === 'raid') {
        const active = document.querySelector('.tab-content.active');
        const allowed = ['daily-tab', 'raid-score-tab'];
        if (active && allowed.indexOf(active.id) < 0) fallbackToPostTab();
    }

    // モード情報を更新
    updateModeInfo();
}

/**
 * 各タブのモード情報を更新
 */
function updateModeInfo() {
    const modeTexts = {
        'normal': {
            post: 'ノーマルモードの記録を投稿すること',
            board: 'ノーマルモードのデータのみ表示',
            ranking: 'ノーマルモードのランキング表示',
            progress: 'ノーマルモードの成長記録',
            rules: 'ノーマルモードのルールと倍率設定',
            score: 'ノーマルモードの総合得点',
            timer: ''
        },
        'interval': {
            post: 'インターバルモードの記録を投稿すること',
            board: 'インターバルモードのデータのみ表示',
            ranking: 'インターバルモードのランキング表示',
            progress: 'インターバルモードの成長記録',
            rules: 'インターバルモードのルールと倍率設定',
            score: 'インターバルモードの総合得点',
            timer: '指定した秒数ごとに音が鳴り、カウントアップされます'
        },
        'free': {
            post: 'フリーモードの記録を投稿（自由種目）',
            board: 'フリーモードのデータのみ表示',
            ranking: 'フリーモードのランキング表示',
            progress: 'フリーモードの成長記録',
            rules: 'フリーモードの種目管理（種目の追加・削除が可能）',
            score: 'フリーモードの総合得点',
            timer: '指定した秒数ごとに音が鳴り、カウントアップされます',
            daily: '毎日入れ替わる共通種目のミッション（目標回数は人それぞれ／その日の合計で判定）'
        },
        'weekly': {
            post: '週間チャレンジの記録を投稿（今週の3種目のみ）',
            board: 'フリーモードの投稿を表示（週間チャレンジ記録も含む）',
            ranking: '今週（月〜金）の最高記録ランキング',
            progress: '週間チャレンジ種目の成長記録',
            rules: '今週の3種目ルール（読み取り専用）',
            score: '今週の週間チャレンジ得点',
            champions: '毎週の総合得点チャンピオンの記録',
            derby: '週間チャレンジの得点を1ヶ月合計した月間ランキング',
            timer: '指定した秒数ごとに音が鳴り、カウントアップされます',
            daily: '毎日入れ替わる共通種目のミッション（目標回数は人それぞれ／その日の合計で判定）'
        },
        'raid': {
            daily: '今日の種目を全員の合計で目標まで積み上げる（0:00に種目発表／入力は7:00から）',
            'raid-score': 'その日の貢献度（％）を点にして、開催期間ぶん積み上げた成績表',
            timer: '指定した秒数ごとに音が鳴り、カウントアップされます'
        }
    };

    const currentTexts = modeTexts[currentMode] || modeTexts['normal'];
    const modeClass = currentMode === 'normal' ? 'normal'
                    : currentMode === 'interval' ? 'interval-mode'
                    : currentMode === 'weekly' ? 'weekly-mode'
                    : currentMode === 'raid' ? 'raid-mode'
                    : 'free-mode';
    
    // 各タブのモード情報を更新
    const modeInfoElements = {
        'post-mode-info': currentTexts.post,
        'board-mode-info': currentTexts.board,
        'ranking-mode-info': currentTexts.ranking,
        'progress-mode-info': currentTexts.progress,
        'rules-mode-info': currentTexts.rules,
        'score-mode-info': currentTexts.score,
        'timer-mode-info': currentTexts.timer,
        'champions-mode-info': currentTexts.champions,
        'derby-mode-info': currentTexts.derby,
        'daily-mode-info': currentTexts.daily,
        'raid-score-mode-info': currentTexts['raid-score']
    };
    
    Object.entries(modeInfoElements).forEach(([id, text]) => {
        const element = document.getElementById(id);
        if (element) {
            // モードによっては未定義（そのモードに無いタブ）。'undefined' の表示を避ける。
            element.textContent = text || '';
            element.className = `mode-info ${modeClass}`;
        }
    });
}

/**
 * モード変更処理
 */
async function changeMode(newMode) {
    if (currentMode === newMode) return;
    
    console.log(`モード切り替え: ${currentMode} → ${newMode}`);
    
    // タイマーが実行中なら停止
    if (timerInterval) {
        console.log('[モード切り替え] タイマーを停止します');
        resetTimer();
    }
    
    currentMode = newMode;
    resetWeeklySimulatorState();

    // フィードの表示件数を初期化（モードごとに新しい順50件から）
    postsDisplayLimit = POSTS_PAGE_SIZE;
    postsHasMore = false;

    // モードセレクターの値を同期
    modeSelect.value = newMode;
    
    // 背景色クラスを切り替え（トランジション付き）（bodyとhtmlの両方）
    document.body.classList.remove('mode-normal', 'mode-interval', 'mode-free', 'mode-weekly', 'mode-raid');
    document.body.classList.add(`mode-${newMode}`);
    document.documentElement.classList.remove('mode-normal', 'mode-interval', 'mode-free', 'mode-weekly', 'mode-raid');
    document.documentElement.classList.add(`mode-${newMode}`);
    
    // タブの表示を更新
    updateTabsForMode();
    
    // 現在のモードのプログレスキャッシュをクリア
    progressCache[newMode] = {};
    
    // データをリフレッシュ
    if (currentUser) {
        try {
            console.log(`${newMode}モードのデータを読み込み中...`);
            console.log(`使用コレクション: ${getCollectionName('posts')}, ${getCollectionName('settings')}`);

            // レイドは専用タブだけの軽いモード。汎用タブを出さないので
            // 投稿一覧・ランキングの読み込みも走らせない
            if (newMode === 'raid') {
                await renderDailyMissionTab(true);
                const activeRaidTab = document.querySelector('.tab-content.active');
                if (activeRaidTab && activeRaidTab.id === 'raid-score-tab') {
                    await renderRaidScoreTab(true);
                }
                console.log('レイドモードへの切り替え完了');
                return;
            }

            // モード別UI初期化
            if (newMode === 'free') {
                await initFreeMode();
            } else if (newMode === 'weekly') {
                await initWeeklyMode();
            } else {
                // フリー/週間チャレンジから戻る場合はUI復元
                restoreStandardExerciseUI();
            }

            loadPosts(true);  // 強制リフレッシュ
            loadRanking(true);  // 強制リフレッシュ

            // 得点タブの場合も再読み込み
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab && activeTab.id === 'score-tab') {
                if (newMode === 'free') {
                    loadFreeUserCheckboxes(true);
                } else if (newMode === 'weekly') {
                    loadWeeklyUserCheckboxes(true);
                } else {
                    loadUserCheckboxes(true);
                }
            } else if (activeTab && activeTab.id === 'progress-tab') {
                loadProgressChart();
            } else if (activeTab && activeTab.id === 'daily-tab') {
                renderDailyMissionTab(false);
            }

            console.log(`${newMode}モードへの切り替え完了`);
        } catch (error) {
            console.error('モード切り替え時のデータ読み込みエラー:', error);
            alert('モード切り替え時にエラーが発生しました。再度お試しください。');
        }
    }
}

// ====================================================================
// タブ切り替え
// ====================================================================
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        
        // タイマータブ以外に切り替える場合、タイマーを停止
        if (tabName !== 'timer' && typeof stopTimer === 'function') {
            stopTimer();
        }
        
        // すべてのタブボタンとコンテンツから active を削除
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        // クリックされたタブを active に
        btn.classList.add('active');
        const targetTab = document.getElementById(`${tabName}-tab`);
        targetTab.classList.add('active');
        
        // インラインスタイルのdisplay: noneを削除（タイマータブ対応）
        targetTab.style.display = '';
        
        // 掲示板タブの場合はキャッシュを使用
        if (tabName === 'board') {
            loadPosts(false);  // キャッシュ使用
        }
        
        // ランキングタブの場合はキャッシュを使用
        if (tabName === 'ranking') {
            loadRanking(false);  // キャッシュ使用
        }
        
        // グラフタブの場合は描画
        if (tabName === 'progress') {
            loadProgressChart();
        }
        
        // ルールタブの場合は倍率をロード（フリーモードでは種目管理UI、週間チャレンジでは読み取り専用）
        if (tabName === 'rules') {
            if (currentMode === 'free') {
                updateFreeRulesTab();
            } else if (currentMode === 'weekly') {
                updateWeeklyRulesTab();
            } else {
                loadMultipliers();
            }
        }
        
        // 得点タブの場合はキャッシュを使用
        if (tabName === 'score') {
            if (currentMode === 'free') {
                loadFreeUserCheckboxes(false);
            } else if (currentMode === 'weekly') {
                loadWeeklyUserCheckboxes(false);
            } else {
                loadUserCheckboxes(false);
            }
        }
        
        // タイマータブの場合は初期化
        if (tabName === 'timer') {
            // タイマーが実行中でなければ表示を初期化
            if (!timerInterval) {
                updateTimerDisplay();
            }
        }
        
        // デイリーミッションタブの場合は描画（キャッシュ済みなら再取得しない）
        if (tabName === 'daily') {
            renderDailyMissionTab(false);
        }

        // 積み上げ得点タブ（レイド）
        if (tabName === 'raid-score') {
            renderRaidScoreTab(false);
        }

        // 歴代チャンプタブの場合はデータ読み込み
        if (tabName === 'champions') {
            loadChampionsHistory();
        }

        // 月間ダービータブの場合はデータ読み込み
        if (tabName === 'derby') {
            loadMonthlyDerby();
        }
    });
});

// ====================================================================
// 統合更新ボタンのイベントリスナー
// ====================================================================

// 統合更新ボタン（全ての主要データを更新）
document.getElementById('refresh-all-btn').addEventListener('click', async function() {
    this.classList.add('loading');
    const originalText = this.innerHTML;
    this.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> 更新中...';
    
    try {
        const mode = currentMode;
        
        // 現在アクティブなタブを取得
        const activeTab = document.querySelector('.tab-content.active');
        const tabId = activeTab ? activeTab.id : null;

        // レイドは専用タブだけなので、掲示板・ランキングは触らない
        if (mode === 'raid') {
            raidScoreboardCache = null;
            await renderDailyMissionTab(true);
            if (tabId === 'raid-score-tab') await renderRaidScoreTab(true);
            return;
        }

        // 常に掲示板とランキングを更新
        await Promise.all([
            loadPosts(true),
            loadRanking(true)
        ]);

        // タブごとの追加更新処理
        switch(tabId) {
            case 'progress-tab':
                progressCache[mode] = {};  // グラフのキャッシュをクリア
                await loadProgressChart();
                break;
            case 'score-tab':
                if (currentMode === 'free') {
                    await loadFreeUserCheckboxes(true);
                } else if (currentMode === 'weekly') {
                    await loadWeeklyUserCheckboxes(true);
                } else {
                    await loadUserCheckboxes(true);
                }
                break;
            case 'champions-tab':
                await loadChampionsHistory();
                break;
            case 'derby-tab':
                await loadMonthlyDerby();
                break;
            case 'daily-tab':
                await renderDailyMissionTab(true);
                break;
        }
    } catch (error) {
        console.error('[更新ボタン] エラー:', error);
        alert('データの更新中にエラーが発生しました。もう一度お試しください。');
    } finally {
        this.classList.remove('loading');
        this.innerHTML = originalText;
    }
});

// 投稿の送信
// バリデーション: 入力値の検証を強化
// submitPost はカード内のボタンから呼ばれる
async function submitPost(exerciseKey) {
    const valueInput = document.querySelector(`.rule-item[data-key="${exerciseKey}"] .post-inline-value`);
    const value = valueInput ? parseInt(valueInput.value) : NaN;
    
    // 種目の検証
    const validExercises = currentMode === 'free' ? freeExercises
                         : currentMode === 'weekly' ? getWeeklyExercisesObject()
                         : exerciseNames;
    if (!exerciseKey || !validExercises[exerciseKey]) {
        postError.textContent = '種目を選択してください';
        return;
    }
    
    // 数値の検証
    if (!value || value <= 0 || isNaN(value) || value > 10000) {
        postError.textContent = '回数または秒数を正しく入力してください（1〜10000）';
        return;
    }

    // 週間チャレンジは、その日のデイリーミッションをクリアするまで投稿できない。
    // カードを開いたまま日付をまたいだ場合に備え、送信時にもここで確認する。
    if (currentMode === 'weekly' && isWeeklyPostLockedByDailyMission()) {
        postError.textContent = '今日のデイリーミッションをクリアすると投稿できます。';
        updateWeeklyPostDropdown();
        return;
    }

    try {
        const collectionName = getCollectionName('posts');
        console.log(`[submitPost] モード: ${currentMode}, コレクション: ${collectionName}`);
        
        await db.collection(collectionName).add({
            userId: currentUser.uid,
            userEmail: currentUser.email,
            exerciseType: exerciseKey,
            value: value,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            likes: [],
            comments: []
        });
        
        console.log(`[submitPost] 投稿成功: ${exerciseKey} ${value} (${currentMode}モード)`);
        
        // 投稿後、現在のモードのキャッシュをクリア
        const mode = currentMode;
        rankingCache[mode] = null;
        rankingCacheTime[mode] = null;
        scoreCache[mode] = null;
        scoreCacheTime[mode] = null;
        progressCache[mode] = {};
        postsCache[mode] = null;
        postsCacheTime[mode] = null;
        if (mode === 'weekly') {
            rankingCache.free = null;
            rankingCacheTime.free = null;
            scoreCache.free = null;
            scoreCacheTime.free = null;
            postsCache.free = null;
            postsCacheTime.free = null;
            // 自分の投稿が反映されていない古い先行表示を避けるため、週間の前回値も破棄
            try { localStorage.removeItem(WEEKLY_RANKING_LS_KEY); } catch (e) { /* 無視 */ }
        }
        
        // デイリーミッションの種目を投稿した場合は達成状況が変わるため作り直す
        if (dailyMissionState && dailyMissionState.exerciseKey === exerciseKey) {
            loadDailyMissionState()
                .then(onDailyMissionStateChanged)
                .catch(e => console.warn('[デイリーミッション] 更新失敗:', e));
        }

        // 選択をクリア
        selectedPostExerciseKey = null;
        // カード内の入力エリアを閉じる
        document.querySelectorAll('.post-inline-form').forEach(f => f.remove());
        document.querySelectorAll('.rule-item.selected').forEach(c => c.classList.remove('selected'));
        postError.textContent = '';
        
        // 投稿後、掲示板タブに切り替え
        document.querySelector('[data-tab="board"]').click();
        
        alert('投稿しました！');
    } catch (error) {
        postError.textContent = '投稿に失敗しました。もう一度お試しください。';
        console.error('投稿エラー:', error);
    }
}

// 投稿の読み込み（キャッシュ対応）
async function loadPosts(forceRefresh = false) {
    const now = Date.now();
    const mode = currentMode;
    
    // キャッシュが有効な場合はキャッシュを使用
    if (!forceRefresh && postsCache[mode] && postsCacheTime[mode] && (now - postsCacheTime[mode] < CACHE_DURATION)) {
        console.log(`[loadPosts] キャッシュを使用 (${mode}モード)`);
        renderPosts(postsCache[mode]);
        return;
    }
    
    try {
        await measure(`loadPosts(${mode})`, async () => {
            const collectionName = getCollectionName('posts');
            console.log(`[loadPosts] Firestoreから取得中: ${collectionName} (${mode}モード)`);

            // 読み込み中のスケルトン表示（体感速度の改善）
            postsList.innerHTML = skeletonHTML(4);

            // 投稿一覧（新しい順に上限件数のみ）とユーザー一覧を並列取得
            // 全期間スキャンを避けるため limit を付与。続きは「もっと見る」で取得する。
            const [snapshot, usersMap] = await Promise.all([
                db.collection(collectionName).orderBy('timestamp', 'desc').limit(postsDisplayLimit).get(),
                getUsersMap()
            ]);
            countReads(snapshot.size);
            // 取得件数が上限に達していれば、まだ続きがある可能性が高い
            postsHasMore = snapshot.size >= postsDisplayLimit;

            console.log(`[loadPosts] ${snapshot.size}件の投稿を取得 (${mode}モード)`);

            if (snapshot.empty) {
                postsList.innerHTML = '<p style="text-align: center; color: #999;">まだ投稿がありません</p>';
                postsCache[mode] = [];
                postsCacheTime[mode] = now;
                return;
            }

            // 各投稿のユーザー名を一括マップから解決（同期・通信なし）
            const posts = snapshot.docs.map(doc => {
                const post = doc.data();
                const userData = usersMap[post.userId];
                return {
                    id: doc.id,
                    data: post,
                    userName: userData && userData.userName ? userData.userName : post.userEmail
                };
            });

            // キャッシュを更新
            postsCache[mode] = posts;
            postsCacheTime[mode] = now;

            console.log(`[loadPosts] キャッシュ更新完了 (${mode}モード)`);

            // 投稿を表示
            renderPosts(posts);
        });
    } catch (error) {
        console.error(`[loadPosts] エラー (${mode}モード):`, error);
        postsList.innerHTML = '<p style="text-align: center; color: #e74c3c;">投稿の読み込みに失敗しました</p>';
    }
}

// 投稿を表示する関数
function renderPosts(posts) {
    postsList.innerHTML = '';
    
    if (posts.length === 0) {
        postsList.innerHTML = '<p style="text-align: center; color: #999;">まだ投稿がありません</p>';
        return;
    }
    
    posts.forEach(({ id, data, userName }) => {
        const postElement = createPostElement(id, data, userName);
        postsList.appendChild(postElement);
    });

    // まだ続きがある場合のみ「もっと見る」ボタンを表示
    if (postsHasMore) {
        const moreBtn = document.createElement('button');
        moreBtn.className = 'load-more-posts-btn';
        moreBtn.textContent = 'もっと見る';
        moreBtn.addEventListener('click', () => {
            moreBtn.disabled = true;
            moreBtn.textContent = '読み込み中...';
            postsDisplayLimit += POSTS_PAGE_SIZE;
            loadPosts(true);
        });
        postsList.appendChild(moreBtn);
    }
}

// 投稿要素の作成
// XSS対策: ユーザー入力値は必ずエスケープ
function createPostElement(postId, post, userName) {
    const div = document.createElement('div');
    div.className = 'post-item';
    
    const date = post.timestamp ? new Date(post.timestamp.toDate()).toLocaleString('ja-JP') : '投稿中...';
    const isLiked = post.likes && post.likes.includes(currentUser.uid);
    const likeCount = post.likes ? post.likes.length : 0;
    const isOwner = post.userId === currentUser.uid;
    
    // XSS対策: エスケープ処理を適用
    const safeUserName = escapeHtml(userName);
    const currentExNames = (currentMode === 'free' || currentMode === 'weekly') ? getFreeExerciseNames() : exerciseNames;
    const safeExerciseName = escapeHtml(currentExNames[post.exerciseType] || post.exerciseType);
    const safeValue = parseInt(post.value) || 0; // 数値として扱う
    const safePostId = escapeHtml(postId);
    
    // バーバリアン種目判定
    const isBarbarian = freeExercises[post.exerciseType] && freeExercises[post.exerciseType].barbarian;
    let unitText = '';
    if (isBarbarian) {
        unitText = '秒';
    } else if (currentMode !== 'free' && currentMode !== 'weekly') {
        unitText = post.exerciseType === 'Lsit' ? '秒' : post.exerciseType === 'pullup' ? 'セット' : '回';
    }
    
    div.innerHTML = `
        <div class="post-header">
            <span class="post-user">${safeUserName}</span>
            <span class="post-date">${escapeHtml(date)}</span>
        </div>
        <div class="post-content">
            <span class="post-exercise">${safeExerciseName}</span>
            <span class="post-value">${safeValue} ${unitText}</span>
        </div>
        <div class="post-actions">
            <button class="like-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${safePostId}')">
                <i class="fa-solid fa-heart"></i> ${likeCount > 0 ? likeCount : ''}
            </button>
            <button class="comment-btn" onclick="toggleComments('${safePostId}')">
                <i class="fa-solid fa-comment"></i> ${post.comments && post.comments.length > 0 ? post.comments.length : ''}
            </button>
            ${isOwner ? `<button class="delete-btn" onclick="deletePost('${safePostId}')"><i class="fa-solid fa-trash"></i></button>` : ''}
        </div>
        <div id="comments-${safePostId}" class="comments-section" style="display: none;">
            <div id="comments-list-${safePostId}"></div>
            <div class="comment-input">
                <input type="text" id="comment-input-${safePostId}" placeholder="コメントを入力...">
                <button onclick="addComment('${safePostId}')">送信</button>
            </div>
        </div>
    `;
    
    // コメントを非同期で読み込んで表示
    if (post.comments && post.comments.length > 0) {
        renderComments(post.comments, postId).then(html => {
            const commentsList = div.querySelector(`#comments-list-${postId}`);
            if (commentsList) {
                commentsList.innerHTML = html;
            }
        });
    }
    
    return div;
}

// コメントの表示
// XSS対策: コメント内容をエスケープ
async function renderComments(comments, postId) {
    if (!comments || comments.length === 0) {
        return '';
    }
    
    const commentElements = [];
    for (let i = 0; i < comments.length; i++) {
        const comment = comments[i];
        const userData = await getUserData(comment.userId);
        const userName = userData && userData.userName ? userData.userName : comment.userEmail;
        const isOwner = comment.userId === currentUser.uid;
        
        // コメントのインデックスとタイムスタンプを使って一意のIDを生成
        const commentId = `${comment.timestamp}_${i}`;
        
        commentElements.push(`
            <div class="comment-item">
                <div class="comment-content">
                    <div class="comment-author">${escapeHtml(userName)}</div>
                    <div class="comment-text">${escapeHtml(comment.text)}</div>
                </div>
                ${isOwner ? `<button class="comment-delete-btn" onclick="deleteComment('${escapeHtml(postId)}', ${i})"><i class="fa-solid fa-trash-can"></i></button>` : ''}
            </div>
        `);
    }
    
    return commentElements.join('');
}

// いいねの切り替え（楽観的UI更新）
async function toggleLike(postId) {
    try {
        // いいねボタン要素を取得
        const likeBtn = document.querySelector(`button[onclick="toggleLike('${postId}')"]`);
        if (!likeBtn) return;
        
        // 現在の状態を取得
        const isLiked = likeBtn.classList.contains('liked');
        const currentText = likeBtn.textContent.trim();
        const currentCount = parseInt(currentText.replace(/[^0-9]/g, '')) || 0;
        
        // UIを即座に更新（楽観的更新）
        if (isLiked) {
            // いいねを取り消す場合
            likeBtn.classList.remove('liked');
            const newCount = Math.max(0, currentCount - 1);
            likeBtn.innerHTML = `<i class="fa-solid fa-heart"></i> ${newCount > 0 ? newCount : ''}`;
        } else {
            // いいねを追加する場合
            likeBtn.classList.add('liked');
            const newCount = currentCount + 1;
            likeBtn.innerHTML = `<i class="fa-solid fa-heart"></i> ${newCount}`;
        }
        
        // 裏でFirestoreを更新
        const collectionName = getCollectionName('posts');
        const postRef = db.collection(collectionName).doc(postId);
        
        if (isLiked) {
            // いいねを取り消し
            await postRef.update({
                likes: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
            });
        } else {
            // いいねを追加
            await postRef.update({
                likes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
            });
        }
        
    } catch (error) {
        console.error('いいねの更新エラー:', error);
        // エラー時は再読み込みして正しい状態に戻す
        await loadPosts(true);
    }
}

// コメント表示の切り替え
async function toggleComments(postId) {
    const commentsSection = document.getElementById(`comments-${postId}`);
    const isVisible = commentsSection.style.display === 'block';
    
    if (!isVisible) {
        // コメントを表示する前に最新のコメントを取得
        const collectionName = getCollectionName('posts');
        const doc = await db.collection(collectionName).doc(postId).get();
        const post = doc.data();
        const commentsList = document.getElementById(`comments-list-${postId}`);
        
        if (post.comments && post.comments.length > 0) {
            const html = await renderComments(post.comments, postId);
            commentsList.innerHTML = html;
        } else {
            commentsList.innerHTML = '<p style="color: #999; padding: 10px;">まだコメントがありません</p>';
        }
        
        commentsSection.style.display = 'block';
    } else {
        commentsSection.style.display = 'none';
    }
}

// コメントの追加
// バリデーション: コメントの長さ制限
async function addComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    const text = input.value.trim();
    
    // バリデーション
    if (!text) {
        return;
    }
    
    if (text.length > 500) {
        alert('コメントは500文字以内で入力してください');
        return;
    }
    
    try {
        const collectionName = getCollectionName('posts');
        const postRef = db.collection(collectionName).doc(postId);
        await postRef.update({
            comments: firebase.firestore.FieldValue.arrayUnion({
                userId: currentUser.uid,
                userEmail: currentUser.email,
                text: text,
                timestamp: new Date().toISOString()
            })
        });
        
        input.value = '';
        
        // コメントリストを更新
        const doc = await postRef.get();
        const post = doc.data();
        const commentsSection = document.getElementById(`comments-${postId}`);
        const commentsList = commentsSection ? commentsSection.querySelector(`#comments-list-${postId}`) : null;
        
        if (commentsList && post.comments && post.comments.length > 0) {
            const html = await renderComments(post.comments, postId);
            commentsList.innerHTML = html;
        }
        
        // コメント数を更新
        if (commentsSection) {
            const postElement = commentsSection.closest('.post-item');
            const commentBtn = postElement ? postElement.querySelector('.comment-btn') : null;
            if (commentBtn) {
                commentBtn.innerHTML = `<i class="fa-solid fa-comment"></i> ${post.comments.length}`;
            }
        }
        
        // 成功メッセージを表示
        alert('コメントが送信されました！');
    } catch (error) {
        console.error('コメント送信エラー:', error);
        alert('コメントの送信に失敗しました');
    }
}

// 投稿の削除
async function deletePost(postId) {
    if (!confirm('本当にこの投稿を削除しますか？')) {
        return;
    }
    
    try {
        const collectionName = getCollectionName('posts');
        await db.collection(collectionName).doc(postId).delete();
        alert('投稿を削除しました');
    } catch (error) {
        alert('削除に失敗しました');
        console.error('削除エラー:', error);
    }
}

// コメントの削除
async function deleteComment(postId, commentIndex) {
    if (!confirm('本当にこのコメントを削除しますか？')) {
        return;
    }
    
    try {
        const collectionName = getCollectionName('posts');
        const postRef = db.collection(collectionName).doc(postId);
        const doc = await postRef.get();
        const post = doc.data();
        
        if (!post.comments || !post.comments[commentIndex]) {
            alert('コメントが見つかりませんでした');
            return;
        }
        
        // コメント配列から該当のコメントを削除
        const updatedComments = [...post.comments];
        updatedComments.splice(commentIndex, 1);
        
        await postRef.update({
            comments: updatedComments
        });
        
        // コメントリストを更新
        const commentsSection = document.getElementById(`comments-${postId}`);
        const commentsList = commentsSection ? commentsSection.querySelector(`#comments-list-${postId}`) : null;
        
        if (commentsList) {
            if (updatedComments.length > 0) {
                const html = await renderComments(updatedComments, postId);
                commentsList.innerHTML = html;
            } else {
                commentsList.innerHTML = '<p style="color: #999; padding: 10px;">まだコメントがありません</p>';
            }
        }
        
        // コメント数を更新
        if (commentsSection) {
            const postElement = commentsSection.closest('.post-item');
            const commentBtn = postElement ? postElement.querySelector('.comment-btn') : null;
            if (commentBtn) {
                commentBtn.innerHTML = `<i class="fa-solid fa-comment"></i> ${updatedComments.length > 0 ? updatedComments.length : ''}`;
            }
        }
        
        alert('コメントを削除しました');
    } catch (error) {
        console.error('コメント削除エラー:', error);
        alert('コメントの削除に失敗しました');
    }
}

// ランキングの読み込み（キャッシュ対応）
async function loadRanking(forceRefresh = false) {
    // 週間チャレンジモードは専用関数に委譲
    if (currentMode === 'weekly') {
        await loadWeeklyRanking(forceRefresh);
        return;
    }

    const now = Date.now();
    const mode = currentMode;

    // キャッシュが有効な場合はキャッシュを使用
    if (!forceRefresh && rankingCache[mode] && rankingCacheTime[mode] && (now - rankingCacheTime[mode] < CACHE_DURATION)) {
        console.log(`[loadRanking] キャッシュを使用 (${mode}モード)`);
        renderRanking(rankingCache[mode]);
        return;
    }
    
    try {
        // Firestoreからデータを取得
        const collectionName = getCollectionName('posts');
        console.log(`[loadRanking] Firestoreから取得中: ${collectionName} (${mode}モード)`);

        // 読み込み中のスケルトン表示（体感速度の改善）
        rankingList.innerHTML = skeletonHTML(3);

        const snapshot = await db.collection(collectionName).get();
        countReads(snapshot.size);

        console.log(`[loadRanking] ${snapshot.size}件の投稿からランキング集計 (${mode}モード)`);
        
    const rankings = {};

    // 種目ごとに最高記録を集計
    const currentExNames = currentMode === 'free' ? getFreeExerciseNames() : exerciseNames;
    Object.keys(currentExNames).forEach(type => {
        rankings[type] = {};
    });

    snapshot.forEach((doc) => {
        const post = doc.data();
        const type = post.exerciseType;
        const userId = post.userId;
        const value = post.value;

        // フリーモードでは動的に種目が増えるので、rankingsにキーがなければ追加
        if (!rankings[type]) {
            rankings[type] = {};
        }

        // バーバリアン方式の場合は最小値をベストとする
        const isBarbarian = freeExercises[type] && freeExercises[type].barbarian;
        if (isBarbarian) {
            if (!rankings[type][userId] || rankings[type][userId].value > value) {
                rankings[type][userId] = {
                    value: value,
                    userId: userId,
                    email: post.userEmail
                };
            }
        } else {
            if (!rankings[type][userId] || rankings[type][userId].value < value) {
                rankings[type][userId] = {
                    value: value,
                    userId: userId,
                    email: post.userEmail
                };
            }
        }
    });
    
    // キャッシュを更新
    rankingCache[mode] = rankings;
    rankingCacheTime[mode] = now;
    
        console.log(`[loadRanking] キャッシュ更新完了 (${mode}モード)`);
    
    // レンダリング
    await renderRanking(rankings);
    } catch (error) {
        console.error(`[loadRanking] エラー (${mode}モード):`, error);
        rankingList.innerHTML = '<p style="text-align: center; color: #e74c3c;">ランキングの読み込みに失敗しました</p>';
    }
}

// ランキングの表示
async function renderRanking(rankings) {
    rankingList.innerHTML = '';

    // 週間チャレンジモード以外では weekly-challenge-info を非表示
    const weeklyInfo = document.getElementById('weekly-challenge-info');
    if (weeklyInfo && currentMode !== 'weekly') {
        weeklyInfo.style.display = 'none';
    }

    let currentExNames;
    if (currentMode === 'weekly') {
        currentExNames = getWeeklyExerciseNames();
    } else if (currentMode === 'free') {
        currentExNames = getFreeExerciseNames();
    } else {
        currentExNames = exerciseNames;
    }
    
    // フリーモードではフィルタ・ソートを適用
    let exerciseKeys;
    if (currentMode === 'free') {
        // ランキングタブにフィルタUIを挿入（ranking-listの直前）
        const rankingTab = document.getElementById('ranking-tab');
        const existingFilter = rankingTab.querySelector('.exercise-filter-bar');
        if (existingFilter) existingFilter.remove();
        
        // 週間チャレンジモードではフィルターUIを表示しない
        if (currentMode !== 'weekly') {
            const filterBar = createExerciseFilterUI(rankingTab, async () => {
                await renderRanking(rankings);
            });
            // フィルタバーをranking-listの直前に移動
            rankingTab.insertBefore(filterBar, rankingList);
        }
        
        const filteredEntries = getFilteredAndSortedExercises(exerciseFilterState);
        exerciseKeys = filteredEntries.map(([key]) => key);
        
        if (exerciseFilterState.sortBy === 'tags-group') {
            const groups = groupExercisesByTag(filteredEntries);
            for (const [tag, groupEntries] of Object.entries(groups)) {
                const groupHeader = document.createElement('div');
                groupHeader.className = 'exercise-tag-section';
                groupHeader.innerHTML = `<h4><i class="fa-solid fa-tag"></i> ${escapeHtml(tag)}</h4>`;
                rankingList.appendChild(groupHeader);
                
                for (const [type] of groupEntries) {
                    await renderRankingCategory(rankingList, type, currentExNames, rankings);
                }
            }
            
            if (filteredEntries.length === 0 && Object.keys(freeExercises).length > 0) {
                rankingList.innerHTML += '<p style="text-align: center; color: #999; padding: 20px;"><i class="fa-solid fa-filter"></i> 該当する種目が見つかりません</p>';
            }
            return;
        }
    } else {
        exerciseKeys = Object.keys(currentExNames);
    }
    
    for (const type of exerciseKeys) {
        await renderRankingCategory(rankingList, type, currentExNames, rankings);
    }
    
    if (currentMode === 'free' && exerciseKeys.length === 0 && Object.keys(freeExercises).length > 0) {
        rankingList.innerHTML += '<p style="text-align: center; color: #999; padding: 20px;"><i class="fa-solid fa-filter"></i> 該当する種目が見つかりません</p>';
    }
}

/**
 * ランキングの1種目分をレンダリング
 */
async function renderRankingCategory(container, type, currentExNames, rankings) {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'ranking-category';
        
        // バーバリアン方式か判定
        const isBarbarian = freeExercises[type] && freeExercises[type].barbarian;
        
        // 各ユーザーのユーザー名を取得
        const entries = [];
        for (const [userId, data] of Object.entries(rankings[type] || {})) {
            const userData = await getUserData(userId);
            const userName = userData && userData.userName ? userData.userName : data.email;
            entries.push({
                userName: userName,
                value: data.value
            });
        }
        
        // バーバリアンは昇順（短いタイムが上位）、通常は降順
        const sorted = isBarbarian 
            ? entries.sort((a, b) => a.value - b.value)
            : entries.sort((a, b) => b.value - a.value);
        
        const barbarianLabel = isBarbarian ? ' <span class="barbarian-badge-sm"><i class="fa-solid fa-stopwatch"></i></span>' : '';
        let rankingHTML = `<h3>${currentExNames[type] || type}${barbarianLabel}</h3>`;
        
        if (sorted.length === 0) {
            rankingHTML += '<p style="color: #999;">まだ記録がありません</p>';
        } else {
            let currentRank = 1;
            let previousValue = null;
            
            sorted.forEach((data, index) => {
                // 前の人と同じ値でなければ順位を更新
                if (previousValue !== null && data.value !== previousValue) {
                    currentRank = index + 1;
                }
                previousValue = data.value;
                
                // 単位表示: バーバリアンは「秒」、それ以外はモード別
                let unitText = '';
                if (isBarbarian) {
                    unitText = '秒';
                } else if (currentMode !== 'free' && currentMode !== 'weekly') {
                    unitText = type === 'Lsit' ? '秒' : type === 'pullup' ? 'セット' : '回';
                }
                
                const positionClass = currentRank === 1 ? 'first' : currentRank === 2 ? 'second' : currentRank === 3 ? 'third' : '';
                rankingHTML += `
                    <div class="ranking-item">
                        <div class="ranking-position ${positionClass}">${currentRank}</div>
                        <div class="ranking-user">${escapeHtml(data.userName)}</div>
                        <div class="ranking-value">${data.value} ${unitText}</div>
                    </div>
                `;
            });
        }
        
        categoryDiv.innerHTML = rankingHTML;
        container.appendChild(categoryDiv);
}

// 成長グラフの読み込み
async function loadProgressChart() {
    const selectedType = graphExerciseType.value;
    
    try {
        // 投稿データは postsCache を再利用（掲示板で取得済みなら再通信しない）。
        // キャッシュが無効な場合のみ Firestore から取得する。
        const mode = currentMode;
        const now = Date.now();
        let rawPosts;
        if (postsCache[mode] && postsCacheTime[mode] && (now - postsCacheTime[mode] < CACHE_DURATION)) {
            rawPosts = postsCache[mode].map(p => p.data);
        } else {
            const collectionName = getCollectionName('posts');
            const snapshot = await db.collection(collectionName).get();
            countReads(snapshot.size);
            rawPosts = snapshot.docs.map(doc => doc.data());
        }

        const userPosts = [];

        // 現在のユーザーかつ選択された種目の投稿を抽出
        rawPosts.forEach((post) => {
            if (post.userId === currentUser.uid &&
                post.exerciseType === selectedType &&
                post.timestamp) {
                userPosts.push({
                    timestamp: post.timestamp,
                    value: post.value
                });
            }
        });
        
        // タイムスタンプでソート
        userPosts.sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());
        
        // データポイントを {x: Date, y: value} 形式で作成
        const chartData = [];
        userPosts.forEach(post => {
            const date = new Date(post.timestamp.toDate());
            chartData.push({ x: date, y: post.value });
        });

        // 既存のチャートを破棄
        if (myChart) {
            myChart.destroy();
        }

        // データがない場合のメッセージ
        if (chartData.length === 0) {
            const ctx = progressChart.getContext('2d');
            ctx.clearRect(0, 0, progressChart.width, progressChart.height);
            ctx.font = '16px Arial';
            ctx.fillStyle = '#999';
            ctx.textAlign = 'center';
            ctx.fillText('この種目の記録がまだありません', progressChart.width / 2, progressChart.height / 2);
            return;
        }

        // 新しいチャートを作成
        // 日付間隔を実際のカレンダーに合わせるため、最初の投稿日～今日まで全日付をラベルにし
        // データがない日はnullにしてspanGapsで線を繋ぐ
        const ctx = progressChart.getContext('2d');
        const exerciseLabel = currentMode === 'free' ? (freeExercises[selectedType]?.name || selectedType) : exerciseNames[selectedType];

        // 日付キー(M/d)と値のマップを作成（同じ日の複数投稿は最後の値を使用）
        const dateValueMap = {};
        chartData.forEach(d => {
            const key = `${d.x.getFullYear()}-${String(d.x.getMonth()+1).padStart(2,'0')}-${String(d.x.getDate()).padStart(2,'0')}`;
            dateValueMap[key] = d.y;
        });

        // 最初の投稿日から今日までの全日付を生成
        const firstDate = new Date(chartData[0].x);
        firstDate.setHours(0,0,0,0);
        const today = new Date();
        today.setHours(0,0,0,0);

        const allLabels = [];
        const allValues = [];
        const cursor = new Date(firstDate);
        while (cursor <= today) {
            const key = `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(cursor.getDate()).padStart(2,'0')}`;
            const label = `${cursor.getMonth()+1}/${cursor.getDate()}`;
            allLabels.push(label);
            allValues.push(dateValueMap[key] !== undefined ? dateValueMap[key] : null);
            cursor.setDate(cursor.getDate() + 1);
        }

        // Chart.js を遅延ロード（初回のみ取得）
        await ensureChartJs();

        myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: allLabels,
                datasets: [{
                    label: exerciseLabel,
                    data: allValues,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true,
                    spanGaps: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: true } },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: currentMode === 'free' ? '記録' : (selectedType === 'Lsit' ? '秒数' : selectedType === 'pullup' ? 'セット数' : '回数')
                        }
                    },
                    x: { title: { display: true, text: '日付' } }
                }
            }
        });
        
    } catch (error) {
        console.error('成長グラフの読み込みエラー:', error);
        const ctx = progressChart.getContext('2d');
        ctx.clearRect(0, 0, progressChart.width, progressChart.height);
        ctx.font = '16px Arial';
        ctx.fillStyle = '#e74c3c';
        ctx.textAlign = 'center';
        ctx.fillText('グラフの読み込みに失敗しました', progressChart.width / 2, progressChart.height / 2);
    }
}

// グラフの種目変更時
graphExerciseType.addEventListener('change', loadProgressChart);

if (weeklySimulatorToggle) {
    weeklySimulatorToggle.addEventListener('change', async (e) => {
        weeklySimulatorEnabled = !!e.target.checked;
        weeklySimulatorExpandedUserId = null;

        if (!weeklySimulatorEnabled) {
            weeklySimulatorOverrides = {};
            weeklySimulatorPreviousRanks = {};
            weeklySimulatorPendingAnimation = false;
            weeklySimulatorFocusUserId = null;
        }

        if (currentMode !== 'weekly') {
            return;
        }

        if (!weeklySimulatorBaseScores) {
            weeklySimulatorBaseScores = await getAllUsersScoresWeekly(false);
        }
        if (!weeklySimulatorExerciseKeys || weeklySimulatorExerciseKeys.length === 0) {
            weeklySimulatorExerciseKeys = weeklyChallenge ? getActiveWeeklyKeys(weeklyChallenge.exercises).filter(k => freeExercises[k]) : [];
        }

        displayFreeScores(weeklySimulatorBaseScores, weeklySimulatorExerciseKeys);
    });
}

if (totalScoresList) {
    totalScoresList.addEventListener('click', (e) => {
        if (e.target.classList.contains('weekly-sim-input')) {
            e.stopPropagation();
        }
    });

    totalScoresList.addEventListener('focusin', (e) => {
        const target = e.target;
        if (!target.classList.contains('weekly-sim-input')) {
            return;
        }
        const wrapper = target.closest('.weekly-sim-edit-wrap');
        if (wrapper) {
            wrapper.classList.add('is-editing');
        }
    });

    totalScoresList.addEventListener('focusout', (e) => {
        const target = e.target;
        if (!target.classList.contains('weekly-sim-input')) {
            return;
        }
        const wrapper = target.closest('.weekly-sim-edit-wrap');
        if (wrapper) {
            wrapper.classList.remove('is-editing');
        }
    });

    totalScoresList.addEventListener('keydown', (e) => {
        const target = e.target;
        if (!target.classList.contains('weekly-sim-input')) {
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            target.blur();
        }
    });

    totalScoresList.addEventListener('change', (e) => {
        const target = e.target;
        if (!target.classList.contains('weekly-sim-input')) {
            return;
        }

        e.stopPropagation();

        const userId = target.dataset.userId;
        const exerciseKey = target.dataset.exerciseKey;
        if (!userId || !exerciseKey || !weeklySimulatorEnabled || currentMode !== 'weekly') {
            return;
        }

        const fallback = weeklySimulatorBaseScores?.[userId]?.exercises?.[exerciseKey] || 0;
        const normalized = clampWeeklySimulatorValue(target.value, fallback);
        target.value = normalized;

        if (!weeklySimulatorOverrides[userId]) {
            weeklySimulatorOverrides[userId] = {};
        }
        if (normalized === clampWeeklySimulatorValue(fallback, 0)) {
            delete weeklySimulatorOverrides[userId][exerciseKey];
            if (Object.keys(weeklySimulatorOverrides[userId]).length === 0) {
                delete weeklySimulatorOverrides[userId];
            }
        } else {
            weeklySimulatorOverrides[userId][exerciseKey] = normalized;
        }
        weeklySimulatorExpandedUserId = userId;
        weeklySimulatorPendingAnimation = true;
        weeklySimulatorFocusUserId = userId;

        if (weeklySimulatorBaseScores && weeklySimulatorExerciseKeys.length > 0) {
            displayFreeScores(weeklySimulatorBaseScores, weeklySimulatorExerciseKeys);
        }
    });
}

// モード切り替え
modeSelect.addEventListener('change', (e) => {
    changeMode(e.target.value);
});

// ====================================================================
// ルールタブのイベントリスナー
// ====================================================================

// 倍率の更新
updateMultipliersBtn.addEventListener('click', async () => {
    try {
        // エラーメッセージをクリア
        rulesError.textContent = '';
        rulesMessage.textContent = '';
        
        // 各入力値を取得してバリデーション
        const multipliers = {};
        for (const [exercise, input] of Object.entries(multiplierInputs)) {
            const value = parseFloat(input.value);
            
            if (isNaN(value) || value < 0.1) {
                rulesError.textContent = '倍率は0.1以上で入力してください';
                return;
            }
            
            multipliers[exercise] = value;
        }
        
        // Firestoreに保存
        await updateMultipliers(multipliers);
        
        rulesMessage.textContent = '倍率を更新しました！';
        
        // 3秒後にメッセージを消す
        setTimeout(() => {
            rulesMessage.textContent = '';
        }, 3000);
        
    } catch (error) {
        console.error('倍率の更新に失敗しました:', error);
        rulesError.textContent = '倍率の更新に失敗しました';
    }
});

// ====================================================================
// インターバルタイマー機能
// ====================================================================

let timerInterval = null;
let timerStartTime = null;
let currentCount = 0;
let elapsedSeconds = 0;
let intervalSeconds = 3; // デフォルト3秒
let isPreparationPhase = false;
let preparationCountdown = 10;

// 高精度タイマー用の追加状態
const TIMER_POLL_MS = 200;           // ポーリング間隔 (ms)
const AUDIO_LOOKAHEAD_SEC = 0.3;     // 音声先読みスケジュール時間 (秒)
let timerRAF = null;                  // requestAnimationFrame ID
let audioTimeOffset = 0;             // Date.now()/1000 と audioContext.currentTime の差分
let nextScheduledSecond = 0;         // 次にスケジュールすべき経過秒
let nextScheduledPrepSecond = 0;     // 準備フェーズでスケジュール済みの経過秒
let prepStartTime = null;            // 準備フェーズ開始時刻 (Date.now())
let scheduledNodes = [];             // スケジュール済み音ノード（クリーンアップ用）

// Web Audio APIでビープ音を生成
let audioContext = null;

// ロック画面でもオーディオセッションを維持するためのサイレント音声要素
let silentAudio = null;
let wakeLock = null;

/**
 * サイレント音声ループを開始してオーディオセッションを維持する
 * モバイルブラウザはaudio要素が再生中ならバックグラウンドでもAudioContextを維持する
 */
function startSilentAudioKeepAlive() {
    if (silentAudio) return;
    try {
        silentAudio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
        silentAudio.loop = true;
        silentAudio.volume = 0.01;
        silentAudio.play().then(() => {
            console.log('[タイマー] サイレント音声ループ開始 - ロック画面でもオーディオ維持');
        }).catch(err => {
            console.warn('[タイマー] サイレント音声ループ開始失敗:', err);
            silentAudio = null;
        });
    } catch (err) {
        console.warn('[タイマー] サイレント音声要素作成失敗:', err);
        silentAudio = null;
    }
}

function stopSilentAudioKeepAlive() {
    if (silentAudio) {
        silentAudio.pause();
        silentAudio.src = '';
        silentAudio = null;
        console.log('[タイマー] サイレント音声ループ停止');
    }
}

/**
 * Wake Lock APIでスクリーンロックを防止する（対応ブラウザのみ）
 */
async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        console.log('[タイマー] Wake Lock取得成功');
        wakeLock.addEventListener('release', () => {
            console.log('[タイマー] Wake Lock解放');
        });
    } catch (err) {
        console.warn('[タイマー] Wake Lock取得失敗:', err);
    }
}

function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release().catch(() => {});
        wakeLock = null;
    }
}

// ====================================================================
// タイマー音声設定
// ====================================================================
// マスターボリューム（すべての音に適用）
let masterVolume = 1.0; // 0.0 ~ 1.0

// 個別の音量調整（それぞれの音の種類）
let tickSoundVolume = 1.0;      // チック音（毎秒の小さな音）
let beepSoundVolume = 1.0;      // ビープ音（インターバルごとの大きな音）
let countdownSoundVolume = 0.5; // カウントダウン音（準備時間の音）

// 音の周波数設定
let tickSoundFrequency = 440;      // チック音の周波数（Hz）
let beepSoundFrequency = 880;      // ビープ音の周波数（Hz）
let countdownSoundFrequency = 660; // カウントダウン音の周波数（Hz）

// 音の長さ設定（秒）
let tickSoundDuration = 0.3;      // チック音の長さ
let beepSoundDuration = 0.6;       // ビープ音の長さ
let countdownSoundDuration = 0.3;  // カウントダウン音の長さ

/**
 * 複合音量を計算（マスターボリューム × 個別ボリューム）
 * @param {number} individualVolume - 個別音量
 * @returns {number} 計算済み音量
 */
function getComputedVolume(individualVolume) {
    return Math.max(0, Math.min(1, (individualVolume * masterVolume)));
}

// ====================================================================
// 高精度音声スケジューリング
// ====================================================================

/**
 * AudioContextのcurrentTimeとDate.now()の差分を校正する
 * audioContext.currentTimeはハードウェアレベルの精密な時計
 * Date.now()はウォールクロック（JSの時計）
 * この差分を使ってウォールクロック時刻をAudioContext時刻に変換する
 */
function calibrateAudioTimeOffset() {
    if (audioContext && audioContext.state === 'running') {
        audioTimeOffset = Date.now() / 1000 - audioContext.currentTime;
    }
}

/**
 * ウォールクロック時刻(ms)をAudioContext時刻(秒)に変換する
 * @param {number} wallMs - Date.now()ベースの時刻 (ms)
 * @returns {number} audioContext.currentTimeベースの時刻 (秒)
 */
function wallMsToAudioTime(wallMs) {
    return wallMs / 1000 - audioTimeOffset;
}

/**
 * 低レベル音スケジュール関数 - 指定時刻にオシレーター音をスケジュール
 * Web Audio APIのハードウェアスケジューラを利用して
 * JS実行タイミングに依存しない正確な音再生を実現
 * @param {number} frequency - 周波数 (Hz)
 * @param {number} volume - 音量 (0-1)
 * @param {number} duration - 長さ (秒)
 * @param {number} when - 再生開始のaudioContext時刻 (省略時は即座に再生)
 * @returns {OscillatorNode|null}
 */
function scheduleOscillator(frequency, volume, duration, when) {
    const ctx = audioContext;
    if (!ctx || ctx.state !== 'running') return null;

    try {
        const now = ctx.currentTime;
        const startTime = (when !== undefined && when > now) ? when : now;

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        const startVol = Math.max(0.001, volume);
        const endVol = Math.max(0.001, volume / 50);
        gainNode.gain.setValueAtTime(startVol, startTime);
        gainNode.gain.exponentialRampToValueAtTime(endVol, startTime + duration);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);

        return oscillator;
    } catch (error) {
        console.error('[タイマー] 音のスケジュールに失敗:', error);
        return null;
    }
}

/**
 * 指定audioContext時刻にチック音をスケジュール
 */
function scheduleTickAt(audioTime) {
    const osc = scheduleOscillator(
        tickSoundFrequency,
        getComputedVolume(tickSoundVolume),
        tickSoundDuration,
        audioTime
    );
    if (osc) scheduledNodes.push(osc);
}

/**
 * 指定audioContext時刻にビープ音をスケジュール（視覚フィードバック付き）
 */
function scheduleBeepAt(audioTime) {
    const osc = scheduleOscillator(
        beepSoundFrequency,
        getComputedVolume(beepSoundVolume),
        beepSoundDuration,
        audioTime
    );
    if (osc) {
        scheduledNodes.push(osc);
        // 視覚的フィードバック（音のタイミングに合わせて表示）
        const delay = Math.max(0, (audioTime - (audioContext ? audioContext.currentTime : 0)) * 1000);
        setTimeout(() => {
            const countDisplay = document.querySelector('.count-display');
            if (countDisplay) {
                countDisplay.classList.add('beep');
                setTimeout(() => countDisplay.classList.remove('beep'), 300);
            }
        }, delay);
    }
}

/**
 * 指定audioContext時刻にカウントダウン音をスケジュール
 */
function scheduleCountdownAt(audioTime) {
    const osc = scheduleOscillator(
        countdownSoundFrequency,
        getComputedVolume(countdownSoundVolume),
        countdownSoundDuration,
        audioTime
    );
    if (osc) scheduledNodes.push(osc);
}

/**
 * スケジュール済み音ノードをすべて停止・クリーンアップ
 */
function cancelAllScheduledNodes() {
    for (const node of scheduledNodes) {
        try { node.stop(); } catch (e) { /* already stopped */ }
    }
    scheduledNodes = [];
}

/**
 * 今後再生すべき音を先読みしてスケジュールする
 * AudioContextのハードウェアスケジューラにより、JS実行タイミングの
 * ブレに影響されない正確なタイミングでの音再生を実現
 */
function scheduleUpcomingAudio() {
    if (!audioContext || audioContext.state !== 'running') {
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {});
        }
        return;
    }

    const currentAudioTime = audioContext.currentTime;
    const lookAheadUntil = currentAudioTime + AUDIO_LOOKAHEAD_SEC;

    if (isPreparationPhase && prepStartTime) {
        // 長時間バックグラウンドからの復帰時に高速スキップ
        const currentPrepSecond = Math.floor((Date.now() - prepStartTime) / 1000);
        if (nextScheduledPrepSecond < currentPrepSecond - 1) {
            nextScheduledPrepSecond = Math.max(1, currentPrepSecond - 1);
        }

        // 準備フェーズ: カウントダウン音をスケジュール（秒1〜9）
        while (nextScheduledPrepSecond <= 9) {
            const wallMs = prepStartTime + nextScheduledPrepSecond * 1000;
            const audioTime = wallMsToAudioTime(wallMs);

            if (audioTime > lookAheadUntil) break;

            if (audioTime >= currentAudioTime - 0.3) {
                scheduleCountdownAt(Math.max(audioTime, currentAudioTime));
            }
            nextScheduledPrepSecond++;
        }
    } else if (timerStartTime) {
        // 長時間バックグラウンドからの復帰時に高速スキップ
        const currentSecond = Math.floor((Date.now() - timerStartTime) / 1000);
        if (nextScheduledSecond < currentSecond - 1) {
            nextScheduledSecond = Math.max(0, currentSecond - 1);
        }

        // メインフェーズ: チック音・ビープ音をスケジュール
        let safety = 0;
        while (safety++ < 100) {
            const wallMs = timerStartTime + nextScheduledSecond * 1000;
            const audioTime = wallMsToAudioTime(wallMs);

            if (audioTime > lookAheadUntil) break;

            if (audioTime >= currentAudioTime - 0.3) {
                if (nextScheduledSecond % intervalSeconds === 0) {
                    scheduleBeepAt(Math.max(audioTime, currentAudioTime));
                } else {
                    scheduleTickAt(Math.max(audioTime, currentAudioTime));
                }
            }
            nextScheduledSecond++;
        }
    }

    // 完了済みノードのメモリクリーンアップ
    if (scheduledNodes.length > 50) {
        scheduledNodes = scheduledNodes.slice(-20);
    }
}

/**
 * requestAnimationFrameベースのUI更新ループ
 * setIntervalよりフレームレートに同期した滑らかな表示更新を実現
 */
function timerUILoop() {
    if (!timerInterval) return;

    // 現在の表示値を実時間から計算（状態遷移はポーリングコールバックで管理）
    if (isPreparationPhase && prepStartTime) {
        const prepElapsed = Math.floor((Date.now() - prepStartTime) / 1000);
        preparationCountdown = Math.max(0, 10 - prepElapsed);
    } else if (timerStartTime) {
        elapsedSeconds = Math.floor((Date.now() - timerStartTime) / 1000);
        currentCount = 1 + Math.floor(elapsedSeconds / intervalSeconds);
    }

    updateTimerDisplay();
    timerRAF = requestAnimationFrame(timerUILoop);
}

function initAudioContext() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('[タイマー] AudioContext初期化完了:', audioContext.state);
        } catch (error) {
            console.error('[タイマー] Web Audio API not supported:', error);
            audioContext = null;
        }
    }
    return audioContext;
}

/**
 * AudioContextを完全に破棄して再作成する
 */
function resetAudioContext() {
    console.log('[タイマー] AudioContextを完全リセット');
    
    // 既存のAudioContextを破棄
    if (audioContext) {
        try {
            audioContext.close().catch(() => {});
        } catch (e) {
            console.warn('[タイマー] AudioContext破棄時エラー:', e);
        }
        audioContext = null;
    }
    
    // サイレント音声も再作成
    stopSilentAudioKeepAlive();
    
    // 新しいAudioContextを作成
    return initAudioContext();
}

/**
 * テスト音を鳴らしてAudioContextが動作することを確認
 */
async function playTestSound() {
    const ctx = resetAudioContext();
    if (!ctx) {
        console.error('[タイマー] AudioContextが利用できません');
        return false;
    }
    
    try {
        // AudioContextを確実に再開
        if (ctx.state === 'suspended') {
            await ctx.resume();
            console.log('[タイマー] AudioContext再開成功');
        }
        
        // 短いテスト音を再生
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.frequency.value = 880; // ビープ音の周波数
        oscillator.type = 'sine';
        
        const volume = getComputedVolume(beepSoundVolume) * 0.8; // 少し小さめ
        gainNode.gain.setValueAtTime(volume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
        
        console.log('[タイマー] テスト音再生成功');
        return true;
    } catch (error) {
        console.error('[タイマー] テスト音再生失敗:', error);
        return false;
    }
}

// ロック画面復帰時にAudioContextを再開し、タイマーの経過を補正する
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // AudioContextがsuspendedなら再開
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log('[タイマー] visibilitychange: AudioContext再開成功');
                // 再開後に音声スケジュールを再校正
                if (timerInterval) {
                    calibrateAudioTimeOffset();
                    scheduleUpcomingAudio();
                }
            }).catch(err => {
                console.error('[タイマー] visibilitychange: AudioContext再開失敗:', err);
            });
        }
        // サイレント音声が停止していたら再開
        if (timerInterval && silentAudio && silentAudio.paused) {
            silentAudio.play().catch(() => {});
        }
        // Wake Lockを再取得（画面復帰時にreleaseされるため）
        if (timerInterval) {
            requestWakeLock();
        }
        // タイマーが動作中なら経過時間を補正し、音声を再スケジュール
        if (timerInterval && timerStartTime && !isPreparationPhase) {
            const now = Date.now();
            const realElapsed = Math.floor((now - timerStartTime) / 1000);
            if (realElapsed > elapsedSeconds) {
                const missed = realElapsed - elapsedSeconds;
                console.log(`[タイマー] 復帰補正: ${missed}秒分を補正`);
                elapsedSeconds = realElapsed;
                currentCount = 1 + Math.floor(elapsedSeconds / intervalSeconds);
                updateTimerDisplay();
            }
            // 音声スケジュールの再校正
            calibrateAudioTimeOffset();
            scheduleUpcomingAudio();
        }
    }
});

// 毎秒の小さな音（チック音）
async function playTickSound() {
    const ctx = initAudioContext();
    if (!ctx) return;

    try {
        // AudioContextがsuspendedの場合は再開を待つ
        if (ctx.state === 'suspended') {
            await ctx.resume();
            console.log('[タイマー] チック音再生前にAudioContext再開');
        }
        
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        // 周波数設定
        oscillator.frequency.value = tickSoundFrequency;
        oscillator.type = 'sine';
        
        // 音量設定（マスターボリューム × 個別ボリューム）
        const computedVolume = getComputedVolume(tickSoundVolume);
        const startVolume = computedVolume;
        const endVolume = Math.max(0.001, computedVolume / 10);
        gainNode.gain.setValueAtTime(startVolume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(endVolume, ctx.currentTime + tickSoundDuration);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + tickSoundDuration);
    } catch (error) {
        console.error('[タイマー] チック音の再生に失敗:', error);
    }
}

// インターバルごとの大きな音（ビープ音）
async function playBeepSound() {
    const ctx = initAudioContext();
    if (!ctx) return;

    try {
        // AudioContextがsuspendedの場合は再開を待つ
        if (ctx.state === 'suspended') {
            await ctx.resume();
            console.log('[タイマー] ビープ音再生前にAudioContext再開');
        }
        
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        // 周波数設定
        oscillator.frequency.value = beepSoundFrequency;
        oscillator.type = 'sine';
        
        // 音量設定（マスターボリューム × 個別ボリューム）
        const computedVolume = getComputedVolume(beepSoundVolume);
        const startVolume = computedVolume;
        const endVolume = Math.max(0.001, computedVolume / 50);
        gainNode.gain.setValueAtTime(startVolume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(endVolume, ctx.currentTime + beepSoundDuration);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + beepSoundDuration);
        
        // 視覚的フィードバック
        const countDisplay = document.querySelector('.count-display');
        if (countDisplay) {
            countDisplay.classList.add('beep');
            setTimeout(() => countDisplay.classList.remove('beep'), 300);
        }
    } catch (error) {
        console.error('[タイマー] ビープ音の再生に失敗:', error);
    }
}

// 準備時間のカウントダウン音
async function playCountdownSound() {
    const ctx = initAudioContext();
    if (!ctx) return;

    try {
        // AudioContextがsuspendedの場合は再開を待つ
        if (ctx.state === 'suspended') {
            await ctx.resume();
            console.log('[タイマー] カウントダウン音再生前にAudioContext再開');
        }
        
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        // 周波数設定
        oscillator.frequency.value = countdownSoundFrequency;
        oscillator.type = 'sine';
        
        // 音量設定（マスターボリューム × 個別ボリューム）
        const computedVolume = getComputedVolume(countdownSoundVolume);
        const startVolume = computedVolume;
        const endVolume = Math.max(0.001, computedVolume / 30);
        gainNode.gain.setValueAtTime(startVolume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(endVolume, ctx.currentTime + countdownSoundDuration);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + countdownSoundDuration);
    } catch (error) {
        console.error('[タイマー] カウントダウン音の再生に失敗:', error);
    }
}

function updateTimerDisplay() {
    const timeDisplay = document.getElementById('time-display');
    const timeLabel = document.getElementById('time-label');
    
    // カウント表示を更新
    timerCount.textContent = currentCount;
    
    if (isPreparationPhase) {
        // 準備時間中
        timeDisplay.classList.add('preparation');
        timeLabel.textContent = '準備時間';
        timerElapsed.textContent = preparationCountdown;
    } else {
        // 経過時間中
        timeDisplay.classList.remove('preparation');
        timeLabel.textContent = '経過時間';
        
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        timerElapsed.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

async function startTimer() {
    if (timerInterval) return; // 既に実行中の場合は何もしない

    console.log('[タイマー] スタートボタンが押されました');

    // インターバル設定を取得
    const intervalInput = document.getElementById('interval-input');
    intervalSeconds = parseInt(intervalInput.value) || 3;

    // AudioContextを初期化して再開（ブラウザのオートプレイポリシー対応）
    const ctx = initAudioContext();
    if (ctx && ctx.state === 'suspended') {
        try {
            await ctx.resume();
            console.log('[タイマー] AudioContext再開成功:', ctx.state);
        } catch (error) {
            console.error('[タイマー] AudioContext再開失敗:', error);
        }
    }

    // ロック画面でもオーディオセッションを維持するためのサイレント音声開始
    startSilentAudioKeepAlive();
    // スクリーンロック防止（対応ブラウザのみ）
    requestWakeLock();

    // ボタンの状態を更新
    timerStartBtn.disabled = true;
    timerStopBtn.disabled = false;
    intervalInput.disabled = true;

    // 準備時間のカウントダウン開始
    isPreparationPhase = true;
    preparationCountdown = 10;
    prepStartTime = Date.now();
    nextScheduledPrepSecond = 1; // 最初のカウントダウン音は1秒後
    updateTimerDisplay();

    // AudioContext時刻の校正
    calibrateAudioTimeOffset();

    console.log('[タイマー] 高精度タイマーを開始します (ポーリング間隔: ' + TIMER_POLL_MS + 'ms)');

    // 200msポーリングで状態更新 + 音声スケジューリング
    timerInterval = setInterval(() => {
        // AudioContextがsuspendedなら自動再開を試みる
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {});
        }

        if (isPreparationPhase) {
            // 実時間ベースで準備カウントダウンを計算
            const prepElapsed = Math.floor((Date.now() - prepStartTime) / 1000);
            preparationCountdown = Math.max(0, 10 - prepElapsed);

            if (preparationCountdown <= 0) {
                // 準備時間終了 → メインフェーズへ移行
                isPreparationPhase = false;
                elapsedSeconds = 0;
                currentCount = 1;  // 0秒時点で1にセット
                timerStartTime = prepStartTime + 10000; // 正確な切り替え時刻

                // AudioContext時刻の校正
                calibrateAudioTimeOffset();
                nextScheduledSecond = 0;

                // 最初のビープ音を即座にスケジュール
                if (audioContext && audioContext.state === 'running') {
                    const firstBeepAudioTime = wallMsToAudioTime(timerStartTime);
                    const now = audioContext.currentTime;
                    scheduleBeepAt(Math.max(firstBeepAudioTime, now));
                    nextScheduledSecond = 1; // 秒0はスケジュール済み
                }

                updateTimerDisplay();
            }
        } else if (timerStartTime) {
            // メインタイマー（実時間ベース）の状態更新
            const realElapsed = Math.floor((Date.now() - timerStartTime) / 1000);
            elapsedSeconds = realElapsed;
            currentCount = 1 + Math.floor(elapsedSeconds / intervalSeconds);
        }

        // 音声の先読みスケジュール
        calibrateAudioTimeOffset();
        scheduleUpcomingAudio();

        // UI更新（rAFのバックアップ）
        updateTimerDisplay();
    }, TIMER_POLL_MS);

    // requestAnimationFrameで滑らかなUI更新
    timerRAF = requestAnimationFrame(timerUILoop);
}

function stopTimer() {
    if (!timerInterval) return;
    
    clearInterval(timerInterval);
    timerInterval = null;
    isPreparationPhase = false;

    // requestAnimationFrameを停止
    if (timerRAF) {
        cancelAnimationFrame(timerRAF);
        timerRAF = null;
    }

    // スケジュール済み音ノードをクリーンアップ
    cancelAllScheduledNodes();

    // サイレント音声とWake Lockを停止
    stopSilentAudioKeepAlive();
    releaseWakeLock();

    // AudioContextを再開（次回の音再生のため）
    const ctx = initAudioContext();
    if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
    }

    // ボタンの状態を更新
    timerStartBtn.disabled = false;
    timerStopBtn.disabled = true;

    const intervalInput = document.getElementById('interval-input');
    intervalInput.disabled = false;

    updateTimerDisplay();
}

async function resetTimer() {
    stopTimer();
    
    currentCount = 0;
    elapsedSeconds = 0;
    preparationCountdown = 10;
    prepStartTime = null;
    nextScheduledSecond = 0;
    nextScheduledPrepSecond = 0;
    updateTimerDisplay();
    
    // AudioContextを完全リセットしてテスト音を再生
    console.log('[タイマー] リセットボタン: AudioContextをリセットしてテスト音再生');
    await playTestSound();
    
    // ボタンの状態を更新
    timerStartBtn.disabled = false;
    timerStopBtn.disabled = true;
}

// タイマーボタンのイベントリスナー
if (timerStartBtn && timerStopBtn && timerResetBtn) {
    timerStartBtn.addEventListener('click', startTimer);
    timerStopBtn.addEventListener('click', stopTimer);
    timerResetBtn.addEventListener('click', resetTimer);

    // タイマーの初期表示を設定
    updateTimerDisplay();
} else {
    console.error('[3秒タイマー] ボタン要素が見つかりません');
}

// ====================================================================
// フリーモード機能
// ====================================================================

// フリーモードの種目リスト（Firestoreから動的に取得）
let freeExercises = {};  // { key: { name: '種目名', rule: 'ルール', icon: 'アイコン', tags: ['タグ'] } }
let freeExercisesLoaded = false;

// 投稿統計キャッシュ（検索・ソート機能用）
let exercisePostStats = {};  // { [exerciseKey]: { totalPosts, recentPosts, lastPostDate } }
let exercisePostStatsTime = null;

// 検索・フィルタ状態
let exerciseFilterState = {
    searchQuery: '',
    filterTags: [],
    sortBy: 'name-asc'
};

// 投稿タブで選択された種目のキー
let selectedPostExerciseKey = null;

// プリセットタグ定義
// 'レイド' は RAID_TAG。付けた種目が夏休みレイドの候補になる
const PRESET_TAGS = [
    '胸', '背中', '肩', '腕', '脚', '腹', '全身', '体幹',
    '自重','ウェイト','3秒1回','1分間','レイド'
];

/**
 * フリーモードの種目リストをFirestoreから取得
 */
async function loadFreeExercises() {
    try {
        const doc = await db.collection('settings_free').doc('exercises').get();
        if (doc.exists) {
            freeExercises = doc.data().exercises || {};
            // 既存の種目にアイコン・タグが未設定の場合、デフォルト値を設定
            Object.keys(freeExercises).forEach(key => {
                if (!freeExercises[key].icon) {
                    freeExercises[key].icon = 'fa-dumbbell';
                }
                if (!Array.isArray(freeExercises[key].tags)) {
                    freeExercises[key].tags = [];
                }
                if (freeExercises[key].excludeFromWeekly === undefined) {
                    freeExercises[key].excludeFromWeekly = false;
                }
            });
        } else {
            freeExercises = {};
        }
        freeExercisesLoaded = true;
        saveFreeExercisesCache();  // 次回の楽観描画用にローカル保存
        console.log('[フリーモード] 種目ロード完了:', Object.keys(freeExercises).length, '種目');
    } catch (error) {
        console.error('[フリーモード] 種目の取得に失敗:', error);
        freeExercises = {};
    }
}

/**
 * フリーモードの種目をFirestoreに保存
 */
async function saveFreeExercises() {
    try {
        await db.collection('settings_free').doc('exercises').set({
            exercises: freeExercises,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('[フリーモード] 種目保存完了');
    } catch (error) {
        console.error('[フリーモード] 種目の保存に失敗:', error);
        throw error;
    }
}

// フリーモード種目用アイコンセット
const freeExerciseIcons = [
    'fa-dumbbell', 'fa-fire', 'fa-person-running', 'fa-shoe-prints', 'fa-stopwatch', 'fa-bolt', 'fa-hand-fist', 'fa-weight-hanging', 'fa-hand-holding', 'fa-crosshairs', 'fa-person-shelter', 'fa-person-falling-burst', 'fa-person-arrow-up-from-line', 'fa-person-arrow-down-to-line', 'fa-heart-pulse', 'fa-rocket', 'fa-water', 'fa-circle', 'fa-square', 'fa-bicycle'
];

/**
 * アイコン選択グリッドを生成する
 * @param {string} containerId - コンテナ要素のID
 * @param {string} hiddenInputId - 選択値を保持するhidden inputのID
 * @param {string} selectedIcon - 初期選択アイコン
 */
function renderIconGrid(containerId, hiddenInputId, selectedIcon = 'fa-dumbbell') {
    const container = document.getElementById(containerId);
    const hiddenInput = document.getElementById(hiddenInputId);
    container.innerHTML = '';
    hiddenInput.value = selectedIcon;

    freeExerciseIcons.forEach(icon => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'icon-grid-btn' + (icon === selectedIcon ? ' selected' : '');
        btn.innerHTML = `<i class="fa-solid ${icon}"></i>`;
        btn.addEventListener('click', () => {
            container.querySelectorAll('.icon-grid-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            hiddenInput.value = icon;
        });
        container.appendChild(btn);
    });
}

/**
 * フリーモードの種目を追加
 * @param {string} name - 種目名
 * @param {string} rule - ルール説明
 * @param {string} icon - アイコンクラス名
 */
async function addFreeExercise(name, rule, icon = 'fa-dumbbell', tags = [], barbarian = false, excludeFromWeekly = false) {
    // キー名を生成（ユニークなID）
    const key = 'free_' + Date.now();
    freeExercises[key] = { 
        name: name, 
        rule: rule, 
        icon: icon,
        tags: tags,
        barbarian: barbarian,
        excludeFromWeekly: excludeFromWeekly,
        createdBy: currentUser ? currentUser.uid : null,
        createdByName: currentUserData ? currentUserData.userName : (currentUser ? currentUser.email : 'Unknown'),
        createdAt: new Date().toISOString()
    };
    await saveFreeExercises();

    // キャッシュクリア
    scoreCache.free = null;
    scoreCacheTime.free = null;
    rankingCache.free = null;
    rankingCacheTime.free = null;

    // UI更新
    updateFreeExerciseUI();
}

/**
 * フリーモードの種目を削除
 * @param {string} key - 種目キー
 */
async function deleteFreeExercise(key) {
    if (!confirm(`種目「${freeExercises[key]?.name}」を削除しますか？\n\nこの操作は取り消せません。`)) return;
    delete freeExercises[key];
    await saveFreeExercises();

    // キャッシュクリア
    scoreCache.free = null;
    scoreCacheTime.free = null;
    rankingCache.free = null;
    rankingCacheTime.free = null;

    // モーダルが開いていれば閉じる
    const editModal = document.getElementById('edit-exercise-modal');
    if (editModal && editModal.style.display === 'block') {
        editModal.style.display = 'none';
    }

    updateFreeExerciseUI();
    alert('種目を削除しました');
}

/**
 * 削除された種目（投稿に残っているが freeExercises に存在しないもの）を検索して復元モーダルを開く
 */
async function openRestoreExercisesModal() {
    const modal = document.getElementById('restore-exercise-modal');
    const statusEl = document.getElementById('restore-exercise-status');
    const listEl = document.getElementById('restore-exercise-list');

    modal.style.display = 'block';
    statusEl.textContent = '削除された種目を検索中...';
    listEl.innerHTML = '<p style="text-align:center;padding:20px;color:#999;"><i class="fa-solid fa-spinner fa-spin"></i></p>';

    try {
        const snapshot = await db.collection('posts_free').get();
        const orphanCount = {};
        snapshot.forEach(doc => {
            const t = doc.data().exerciseType;
            if (t && t.startsWith('free_') && !freeExercises[t]) {
                orphanCount[t] = (orphanCount[t] || 0) + 1;
            }
        });

        const orphanKeys = Object.keys(orphanCount);
        if (orphanKeys.length === 0) {
            statusEl.textContent = '復元できる削除済み種目は見つかりませんでした。';
            listEl.innerHTML = '';
            return;
        }

        statusEl.textContent = `${orphanKeys.length}件の削除済み種目が見つかりました。種目名を入力して復元できます。`;
        listEl.innerHTML = '';

        orphanKeys.sort().forEach(key => {
            const count = orphanCount[key];
            const card = document.createElement('div');
            card.className = 'restore-orphan-card';
            card.dataset.key = key;
            card.innerHTML = `
                <div class="restore-orphan-meta">
                    <span class="restore-orphan-id"><i class="fa-solid fa-key"></i> ${escapeHtml(key)}</span>
                    <span class="restore-orphan-count"><i class="fa-solid fa-chart-bar"></i> ${count}件の投稿</span>
                </div>
                <div class="restore-orphan-form">
                    <input type="text" class="restore-name-input" placeholder="種目名を入力（必須）" maxlength="20">
                    <button class="restore-confirm-btn btn-primary" style="white-space:nowrap;">
                        <i class="fa-solid fa-rotate-left"></i> 復元
                    </button>
                </div>
                <p class="restore-result-msg" style="font-size:13px;margin-top:4px;display:none;"></p>
            `;

            const btn = card.querySelector('.restore-confirm-btn');
            const input = card.querySelector('.restore-name-input');
            const msg = card.querySelector('.restore-result-msg');

            btn.addEventListener('click', async () => {
                const name = input.value.trim();
                if (!name) {
                    input.focus();
                    msg.style.display = 'block';
                    msg.style.color = '#e74c3c';
                    msg.textContent = '種目名を入力してください。';
                    return;
                }
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 復元中...';
                try {
                    freeExercises[key] = {
                        name: name,
                        rule: '',
                        icon: 'fa-dumbbell',
                        tags: [],
                        barbarian: false,
                        createdBy: currentUser ? currentUser.uid : null,
                        createdByName: '（復元）',
                        createdAt: new Date().toISOString()
                    };
                    await saveFreeExercises();
                    scoreCache.free = null;
                    scoreCacheTime.free = null;
                    rankingCache.free = null;
                    rankingCacheTime.free = null;
                    updateFreeExerciseUI();
                    msg.style.display = 'block';
                    msg.style.color = '#27ae60';
                    msg.textContent = `「${name}」として復元しました。`;
                    btn.innerHTML = '<i class="fa-solid fa-check"></i> 復元済み';
                    btn.style.background = '#27ae60';
                    input.disabled = true;
                    card.style.opacity = '0.7';
                } catch (e) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> 復元';
                    msg.style.display = 'block';
                    msg.style.color = '#e74c3c';
                    msg.textContent = '復元に失敗しました。';
                }
            });

            listEl.appendChild(card);
        });

    } catch (e) {
        statusEl.textContent = '検索中にエラーが発生しました。';
        listEl.innerHTML = '';
        console.error('[復元] エラー:', e);
    }
}

/**
 * フリーモードの種目を編集
 * @param {string} key - 種目キー
 * @param {string} name - 新しい種目名
 * @param {string} rule - 新しいルール説明
 * @param {string} icon - 新しいアイコン
 */
async function editFreeExercise(key, name, rule, icon, tags = [], barbarian = false, excludeFromWeekly = false) {
    const existing = freeExercises[key] || {};
    freeExercises[key] = { 
        name, 
        rule, 
        icon,
        tags: tags,
        barbarian: barbarian,
        excludeFromWeekly: excludeFromWeekly,
        // 既存の作成者情報を保持
        createdBy: existing.createdBy || null,
        createdByName: existing.createdByName || 'Unknown',
        createdAt: existing.createdAt || new Date().toISOString()
    };
    await saveFreeExercises();
    updateFreeExerciseUI();
}

/**
 * 編集モーダルを開く
 */
function openEditExerciseModal(key) {
    const ex = freeExercises[key];
    if (!ex) return;
    document.getElementById('edit-exercise-key').value = key;
    document.getElementById('edit-exercise-name').value = ex.name;
    document.getElementById('edit-exercise-rule').value = ex.rule || '';
    renderIconGrid('edit-exercise-icon-grid', 'edit-exercise-icon', ex.icon || 'fa-dumbbell');
    renderTagSelector('edit-exercise-tags', ex.tags || []);
    document.getElementById('edit-exercise-barbarian').checked = ex.barbarian || false;
    document.getElementById('edit-exercise-exclude-weekly').checked = ex.excludeFromWeekly || false;
    document.getElementById('edit-exercise-error').textContent = '';
    document.getElementById('edit-exercise-modal').style.display = 'block';
}

/**
 * フリーモードのUI全体を更新
 */
async function updateFreeExerciseUI() {
    // 投稿統計をバックグラウンドで読み込み（ソート用）
    loadExercisePostStats().catch(err => console.error('[updateFreeExerciseUI] 統計取得エラー:', err));
    updateFreePostDropdown();
    updateFreeRulesTab();
    updateFreeGraphDropdown();
}

/**
 * フリーモード：投稿タブのプルダウンを更新
 */
function updateFreePostDropdown() {
    if (currentMode !== 'free') return;
    const postTab = document.getElementById('post-tab');
    const exercisesGrid = document.getElementById('post-exercises-grid');
    
    // フィルタUIを挿入
    const existingFilter = postTab.querySelector('.exercise-filter-bar');
    if (!existingFilter) {
        const filterBar = createExerciseFilterUI(postTab, () => updateFreePostDropdownContent());
        postTab.insertBefore(filterBar, exercisesGrid);
    }
    
    updateFreePostDropdownContent();
}

/**
 * 投稿タブのカードグリッドを更新（フィルタリング済み）
 */
function updateFreePostDropdownContent() {
    const exercisesGrid = document.getElementById('post-exercises-grid');
    const entries = getFilteredAndSortedExercises(exerciseFilterState);
    
    exercisesGrid.innerHTML = '';
    
    if (exerciseFilterState.sortBy === 'tags-group') {
        const groups = groupExercisesByTag(entries);
        Object.entries(groups).forEach(([tag, groupEntries]) => {
            const groupHeader = document.createElement('div');
            groupHeader.className = 'exercise-tag-section';
            groupHeader.innerHTML = `<h4><i class="fa-solid fa-tag"></i> ${escapeHtml(tag)}</h4>`;
            exercisesGrid.appendChild(groupHeader);
            groupEntries.forEach(([key, ex]) => appendPostItem(exercisesGrid, key, ex));
        });
    } else {
        entries.forEach(([key, ex]) => appendPostItem(exercisesGrid, key, ex));
    }
    
    if (entries.length === 0) {
        if (Object.keys(freeExercises).length === 0) {
            exercisesGrid.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">まだ種目が登録されていません。ルールタブから種目を追加してください。</p>';
        } else {
            exercisesGrid.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;"><i class="fa-solid fa-filter"></i> 該当する種目が見つかりません</p>';
        }
    }
}

/**
 * 投稿タブに1つの種目カードを追加（rule-itemと同じスタイル）
 */
function appendPostItem(container, key, ex) {
    const iconClass = ex.icon || 'fa-dumbbell';
    const isBarbarian = ex.barbarian || false;
    const barbarianBadge = isBarbarian ? '<span class="barbarian-badge"><i class="fa-solid fa-stopwatch"></i> バーバリアン</span>' : '';
    const tagsHtml = (ex.tags && ex.tags.length > 0) 
        ? `<div class="rule-tags">${ex.tags.map(t => `<span class="tag-chip display-only">${escapeHtml(t)}</span>`).join('')}</div>` 
        : '';
    const item = document.createElement('div');
    item.className = 'rule-item post-exercise-entry' + (isBarbarian ? ' barbarian-exercise' : '');
    item.dataset.key = key;
    item.style.cursor = 'pointer';
    item.innerHTML = `
        <div class="post-exercise-entry-info">
            <h3 class="post-entry-title"><i class="fa-solid ${escapeHtml(iconClass)}"></i> ${escapeHtml(ex.name)} ${barbarianBadge}</h3>
            ${tagsHtml}
        </div>
    `;
    
    const openForm = () => {
        item.classList.add('selected');
        selectedPostExerciseKey = key;
        postError.textContent = '';
        
        const inlineForm = document.createElement('div');
        inlineForm.className = 'post-inline-form';
        const placeholderText = isBarbarian ? '秒数を入力' : '回数または秒数';
        inlineForm.innerHTML = `
            <input type="number" class="post-inline-value" placeholder="${placeholderText}" min="0" required>
            <button type="button" class="btn-primary post-inline-submit">投稿する</button>
        `;
        
        // 初期状態: 高さ　0
        inlineForm.style.height = '0';
        inlineForm.style.opacity = '0';
        inlineForm.style.overflow = 'hidden';
        inlineForm.style.transition = 'none';
        item.appendChild(inlineForm);
        
        // 実際の高さを取得してアニメーション
        requestAnimationFrame(() => {
            const h = inlineForm.scrollHeight;
            inlineForm.style.transition = 'height 0.3s ease, opacity 0.3s ease';
            inlineForm.style.height = h + 'px';
            inlineForm.style.opacity = '1';
            inlineForm.addEventListener('transitionend', () => {
                inlineForm.style.height = 'auto';
            }, { once: true });
        });
        
        inlineForm.querySelector('.post-inline-submit').addEventListener('click', (ev) => {
            ev.stopPropagation();
            submitPost(key);
        });
        
        const valueInput = inlineForm.querySelector('.post-inline-value');
        valueInput.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); submitPost(key); }
        });
        valueInput.addEventListener('click', (ev) => ev.stopPropagation());
    };
    
    const closeForm = (card) => {
        const form = card.querySelector('.post-inline-form');
        if (!form) {
            card.classList.remove('selected');
            return Promise.resolve();
        }
        return new Promise(resolve => {
            const currentH = form.scrollHeight;
            form.style.height = currentH + 'px';
            form.style.overflow = 'hidden';
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    form.style.transition = 'height 0.25s ease, opacity 0.25s ease';
                    form.style.height = '0';
                    form.style.opacity = '0';
                    form.addEventListener('transitionend', () => {
                        form.remove();
                        // フォームが完全に消えてからselectedを外す→枠線・背景がCSSトランジションで滑らかに戻る
                        card.classList.remove('selected');
                        resolve();
                    }, { once: true });
                });
            });
        });
    };
    
    item.addEventListener('click', async (e) => {
        if (e.target.closest('.post-inline-form')) return;
        
        if (item.classList.contains('selected')) {
            selectedPostExerciseKey = null;
            closeForm(item);
            return;
        }
        
        // 以前の選択を閉じる
        const openCards = [...document.querySelectorAll('#post-exercises-grid .rule-item.selected')];
        openCards.forEach(c => {
            if (c !== item) closeForm(c);
        });
        
        openForm();
    });
    
    container.appendChild(item);
}

/**
 * フリーモード：ルールタブを更新
 */
function updateFreeRulesTab() {
    if (currentMode !== 'free') return;

    const rulesTab = document.getElementById('rules-tab');
    const rulesList = rulesTab.querySelector('.rules-list');

    // タイトルを変更
    const title = rulesTab.querySelector('h2');
    if (title) title.innerHTML = '<i class="fa-solid fa-clipboard-list"></i> フリーモード種目管理';

    // 倍率の説明と更新ボタンを非表示に
    const rulesDesc = rulesTab.querySelector('.rules-description');
    if (rulesDesc) rulesDesc.style.display = 'none';
    const updateBtn = document.getElementById('update-multipliers-btn');
    if (updateBtn) updateBtn.style.display = 'none';

    // 種目追加ボタン（既存があれば削除して再作成）
    let addBtn = rulesTab.querySelector('.add-exercise-btn');
    if (!addBtn) {
        addBtn = document.createElement('button');
        addBtn.className = 'add-exercise-btn';
        addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> 種目を追加';
        addBtn.addEventListener('click', () => {
            renderIconGrid('free-exercise-icon-grid', 'free-exercise-icon', 'fa-dumbbell');
            renderTagSelector('free-exercise-tags', []);
            document.getElementById('free-exercise-modal').style.display = 'block';
        });
        rulesList.parentNode.insertBefore(addBtn, rulesList);
    }

    // 削除済み種目の復元ボタン
    let restoreBtn = rulesTab.querySelector('.restore-exercise-btn');
    if (!restoreBtn) {
        restoreBtn = document.createElement('button');
        restoreBtn.className = 'restore-exercise-btn';
        restoreBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> 削除済み種目を復元';
        restoreBtn.addEventListener('click', () => openRestoreExercisesModal());
        rulesList.parentNode.insertBefore(restoreBtn, rulesList);
    }

    // フィルタUIをルールリストの直前に挿入（週間チャレンジモードでは表示しない）
    const existingFilter = rulesList.parentNode.querySelector('.exercise-filter-bar');
    if (!existingFilter && currentMode !== 'weekly') {
        const filterBar = createExerciseFilterUI(rulesList.parentNode, () => renderFreeRulesContent());
        rulesList.parentNode.insertBefore(filterBar, rulesList);
    }
    renderFreeRulesContent();
}

/**
 * ルールタブの種目一覧をレンダリング（フィルタリング済み）
 * 評価データを非同期取得してカードに表示する
 */
async function renderFreeRulesContent() {
    const rulesTab = document.getElementById('rules-tab');
    const rulesList = rulesTab.querySelector('.rules-list');
    const entries = getFilteredAndSortedExercises(exerciseFilterState);

    rulesList.innerHTML = '';

    if (entries.length === 0) {
        if (Object.keys(freeExercises).length === 0) {
            rulesList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">まだ種目が登録されていません。上のボタンから種目を追加してください。</p>';
        } else {
            rulesList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;"><i class="fa-solid fa-filter"></i> 該当する種目が見つかりません</p>';
        }
        return;
    }

    // 評価データと投稿実績を並行取得
    const allEntryKeys = entries.map(([k]) => k);
    const [ratingSummaries, userPostedKeys, userRatingMap] = await Promise.all([
        getExerciseRatingSummaries(allEntryKeys),
        getUserPostedExerciseKeys('free'),
        getUserExerciseRatings(allEntryKeys)
    ]);

    function renderEntries(entryList) {
        entryList.forEach(([key, ex]) => {
            const ratingData = ratingSummaries[key] || null;
            const canRate = userPostedKeys.has(key);
            const userRating = canRate ? (userRatingMap[key] || null) : null;
            appendRuleItem(rulesList, key, ex, ratingData, canRate, false, userRating);
        });
    }

    if (exerciseFilterState.sortBy === 'tags-group') {
        const groups = groupExercisesByTag(entries);
        Object.entries(groups).forEach(([tag, groupEntries]) => {
            const groupHeader = document.createElement('div');
            groupHeader.className = 'exercise-tag-section';
            groupHeader.innerHTML = `<h4><i class="fa-solid fa-tag"></i> ${escapeHtml(tag)}</h4>`;
            rulesList.appendChild(groupHeader);
            renderEntries(groupEntries);
        });
    } else {
        renderEntries(entries);
    }

    // カードタップで編集画面を開く（評価ボタン以外）
    rulesList.querySelectorAll('.rule-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.btn-rate-exercise') || e.target.closest('.btn-view-reviews')) return;
            openEditExerciseModal(item.dataset.key);
        });
    });

    // 「評価する」ボタン
    rulesList.querySelectorAll('.btn-rate-exercise').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openRatingModal(btn.dataset.key, btn.dataset.name);
        });
    });

    // 「レビューを見る」ボタン
    rulesList.querySelectorAll('.btn-view-reviews').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const ex = freeExercises[btn.dataset.key];
            openReviewsModal(btn.dataset.key, ex ? ex.name : btn.dataset.key);
        });
    });
}

/**
 * ルールタブに1つの種目カードを追加
 * @param {HTMLElement} container
 * @param {string} key
 * @param {Object} ex
 * @param {Object} [ratingData] - {avgRating, ratingCount} 集計評価（省略時は非表示）
 * @param {boolean} [canRate=false] - 評価ボタンを表示するか
 * @param {boolean} [isWeeklyMode=false] - 週間チャレンジモードか
 * @param {Object|null} [userRating=null] - 自分の既存評価データ（あれば評価済みボタン表示）
 */
function appendRuleItem(container, key, ex, ratingData = null, canRate = false, isWeeklyMode = false, userRating = null) {
    const iconClass = ex.icon || 'fa-dumbbell';
    const isBarbarian = ex.barbarian || false;
    const barbarianBadge = isBarbarian ? '<span class="barbarian-badge"><i class="fa-solid fa-stopwatch"></i> バーバリアン</span>' : '';

    // 作成者表示（作成者評価スコアを含む）
    let createdByHtml = '';
    if (ex.createdByName) {
        // クリエイタースコアは creatorScoreCache から取得（非同期ロード済みの場合のみ表示）
        let creatorScore = '';
        const cachedCreator = creatorScoreCache[ex.createdBy];
        if (cachedCreator && cachedCreator.creatorAvgRating != null && (cachedCreator.creatorRatedExerciseCount || 0) >= 3) {
            const cScore = cachedCreator.creatorAvgRating.toFixed(1);
            creatorScore = ` <span class="creator-score" title="作成者スコア"><i class="fa-solid fa-user-star"></i>${cScore}</span>`;
        }
        createdByHtml = `<span class="created-by-info">追加: ${escapeHtml(ex.createdByName)}${creatorScore}</span>`;
    }

    const tagsHtml = (ex.tags && ex.tags.length > 0) 
        ? `<div class="rule-tags">${ex.tags.map(t => `<span class="tag-chip display-only">${escapeHtml(t)}</span>`).join('')}</div>` 
        : '';

    // 星評価表示（コメントボタンは常に表示）
    const reviewBtn = `<button class="btn-view-reviews" data-key="${escapeHtml(key)}" title="レビューを見る"><i class="fa-solid fa-comments"></i></button>`;
    const starHtml = ratingData
        ? `<div class="rule-rating-row">${renderStarRatingHtml(ratingData.avgRating, ratingData.ratingCount)}${reviewBtn}</div>`
        : `<div class="rule-rating-row"><span class="star-rating no-rating">評価なし</span>${reviewBtn}</div>`;

    // 評価ボタン（評価済みの場合は別スタイル）
    let rateBtn = '';
    if (canRate) {
        if (userRating) {
            rateBtn = `<button class="btn-rate-exercise btn-rate-exercise--rated" data-key="${escapeHtml(key)}" data-name="${escapeHtml(ex.name)}"><i class="fa-solid fa-star-half-stroke"></i> 評価済み (${userRating.rating}★)</button>`;
        } else {
            const btnLabel = isWeeklyMode ? '今週を評価' : '評価する';
            rateBtn = `<button class="btn-rate-exercise" data-key="${escapeHtml(key)}" data-name="${escapeHtml(ex.name)}"><i class="fa-solid fa-star"></i> ${btnLabel}</button>`;
        }
    }

    const item = document.createElement('div');
    item.className = 'rule-item' + (isBarbarian ? ' barbarian-exercise' : '') + (ex.excludeFromWeekly ? ' exercise-excluded-weekly' : '');
    item.dataset.key = key;
    item.style.cursor = isWeeklyMode ? 'default' : 'pointer';
    item.innerHTML = `
        <div class="rule-info">
            <h3><i class="fa-solid ${escapeHtml(iconClass)}"></i> ${escapeHtml(ex.name)} ${barbarianBadge} ${createdByHtml}</h3>
            <p class="rule-detail">${escapeHtml(ex.rule)}</p>
            ${tagsHtml}
            ${starHtml}
            ${rateBtn}
        </div>
    `;
    container.appendChild(item);
}

/**
 * フリーモード：成長グラフのプルダウンを更新
 */
function updateFreeGraphDropdown() {
    if (currentMode !== 'free') return;
    const progressTab = document.getElementById('progress-tab');
    const select = document.getElementById('graph-exercise-type');
    
    // フィルタUIをセレクト直前に挿入（週間チャレンジモードでは表示しない）
    const existingFilter = progressTab.querySelector('.exercise-filter-bar');
    if (!existingFilter && currentMode !== 'weekly') {
        const filterBar = createExerciseFilterUI(progressTab, () => updateFreeGraphDropdownContent());
        progressTab.insertBefore(filterBar, select);
    }
    updateFreeGraphDropdownContent();
}

/**
 * 成長グラフのプルダウン内容を更新（フィルタリング済み）
 */
function updateFreeGraphDropdownContent() {
    const select = document.getElementById('graph-exercise-type');
    const currentVal = select.value;
    const entries = getFilteredAndSortedExercises(exerciseFilterState);
    
    if (exerciseFilterState.sortBy === 'tags-group') {
        select.innerHTML = '';
        const groups = groupExercisesByTag(entries);
        Object.entries(groups).forEach(([tag, groupEntries]) => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = tag;
            groupEntries.forEach(([key, ex]) => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = ex.name;
                optgroup.appendChild(option);
            });
            select.appendChild(optgroup);
        });
    } else {
        select.innerHTML = '';
        entries.forEach(([key, ex]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = ex.name;
            select.appendChild(option);
        });
    }
    
    // 元の選択値を復元
    if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
        select.value = currentVal;
    }
}

/**
 * 現在のログインユーザーが投稿したことがある種目キーの Set を返す
 * @param {'free'|'weekly'} mode
 * @returns {Promise<Set<string>>}
 */
async function getUserPostedExerciseKeys(mode) {
    const user = firebase.auth().currentUser;
    if (!user) return new Set();
    try {
        const collName = (mode === 'weekly' || mode === 'free') ? 'posts_free' : 'posts';
        const snap = await db.collection(collName)
            .where('userId', '==', user.uid)
            .get();
        const keys = new Set();
        snap.docs.forEach(d => {
            const k = d.data().exerciseType;
            if (k) keys.add(k);
        });
        return keys;
    } catch (e) {
        console.warn('[評価] 投稿実績取得失敗:', e);
        return new Set();
    }
}

/**
 * 週間チャレンジで当週に投稿した種目キーの Set を返す
 * @returns {Promise<Set<string>>}
 */
async function getUserWeeklyPostedKeys() {
    const user = firebase.auth().currentUser;
    if (!user || !weeklyChallenge) return new Set();
    try {
        const snap = await db.collection('posts_free')
            .where('userId', '==', user.uid)
            .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(weeklyChallenge.weekStart))
            .where('timestamp', '<', firebase.firestore.Timestamp.fromDate(weeklyChallenge.weekEnd))
            .get();
        const keys = new Set();
        snap.docs.forEach(d => {
            const k = d.data().exerciseType;
            if (k) keys.add(k);
        });
        return keys;
    } catch (e) {
        console.warn('[評価] 週間投稿実績取得失敗:', e);
        return new Set();
    }
}

/**
 * フリーモード入場時のUI初期化
 */
async function initFreeMode() {
    if (!freeExercisesLoaded) {
        await loadFreeExercises();
    }
    updateFreeExerciseUI();
}

/**
 * ノーマル/インターバルモードに戻る時のUI復元
 */
function restoreStandardExerciseUI() {
    // フィルタバーを全タブから削除
    document.querySelectorAll('.exercise-filter-bar').forEach(el => el.remove());
    
    // フィルタ状態をリセット
    exerciseFilterState = { searchQuery: '', filterTags: [], sortBy: 'name-asc' };

    // ルールタブのタイトルを復元
    const rulesTab = document.getElementById('rules-tab');
    const title = rulesTab.querySelector('h2');
    if (title) title.innerHTML = '<i class="fa-solid fa-clipboard-list"></i> 種目ルール';

    // レーダーチャートの凡例注釈を削除
    const annotations = document.querySelector('.chart-legend-annotations');
    if (annotations) annotations.remove();

    // 投稿タブの種目カード・選択をクリアして通常種目を表示
    selectedPostExerciseKey = null;
    const exercisesGrid = document.getElementById('post-exercises-grid');
    exercisesGrid.innerHTML = '';
    
    // 通常モードの5種目をカード表示
    const standardExercises = {
        'pushup': { name: 'プッシュアップ', rule: 'プッシュアップバーを使用。顎がマットにつくまで下げる。', icon: 'fa-dumbbell' },
        'dips': { name: 'ディップス', rule: '顎がストレッチポールにタッチするまで下げる。幅、ポール位置は自由。', icon: 'fa-fire' },
        'squat': { name: '片足スクワット', rule: 'マット3段重ねの上で、片足でしゃがんで立ち上がる。左右の合計回数。', icon: 'fa-shoe-prints' },
        'Lsit': { name: 'Lシット(秒)', rule: 'プッシュアップバーを使って、足を水平に持ち上げてキープする秒数。', icon: 'fa-chair' },
        'pullup': { name: '懸垂(セット)', rule: '順手か逆手で行う。1セットの回数は任意。', icon: 'fa-person-falling' }
    };
    Object.entries(standardExercises).forEach(([key, ex]) => {
        appendPostItem(exercisesGrid, key, ex);
    });

    // 成長グラフプルダウンを復元
    const graphSelect = document.getElementById('graph-exercise-type');
    graphSelect.innerHTML = `
        <option value="pushup">プッシュアップ</option>
        <option value="dips">ディップス</option>
        <option value="squat">片足スクワット</option>
        <option value="Lsit">Lシット（秒）</option>
        <option value="pullup">懸垂(セット)</option>
    `;

    // ルールタブの種目追加ボタンを削除
    const addBtn = rulesTab.querySelector('.add-exercise-btn');
    if (addBtn) addBtn.remove();

    // ルールリストを復元
    const rulesList = rulesTab.querySelector('.rules-list');
    rulesList.innerHTML = `
        <div class="rule-item">
            <div class="rule-info">
                <h3><i class="fa-solid fa-dumbbell"></i> プッシュアップ</h3>
                <p class="rule-detail">プッシュアップバーを使用。顎がマットにつくまで下げる。</p>
            </div>
            <div class="rule-multiplier" style="display:none;">
                <label>倍率：</label>
                <input type="number" id="multiplier-pushup" min="0.1" step="0.1" value="1.0">
            </div>
        </div>
        <div class="rule-item">
            <div class="rule-info">
                <h3><i class="fa-solid fa-fire"></i> ディップス</h3>
                <p class="rule-detail">顎がストレッチポールにタッチするまで下げる。幅、ポール位置は自由。</p>
            </div>
            <div class="rule-multiplier" style="display:none;">
                <label>倍率：</label>
                <input type="number" id="multiplier-dips" min="0.1" step="0.1" value="1.0">
            </div>
        </div>
        <div class="rule-item">
            <div class="rule-info">
                <h3><i class="fa-solid fa-shoe-prints"></i> 片足スクワット</h3>
                <p class="rule-detail">マット3段重ねの上で、片足でしゃがんで立ち上がる。左右の合計回数。</p>
            </div>
            <div class="rule-multiplier" style="display:none;">
                <label>倍率：</label>
                <input type="number" id="multiplier-squat" min="0.1" step="0.1" value="1.0">
            </div>
        </div>
        <div class="rule-item">
            <div class="rule-info">
                <h3><i class="fa-solid fa-stopwatch"></i> Lシット(秒)</h3>
                <p class="rule-detail">プッシュアップバー/ダンベルを使用。秒数で記録。</p>
            </div>
            <div class="rule-multiplier" style="display:none;">
                <label>倍率：</label>
                <input type="number" id="multiplier-Lsit" min="0.1" step="0.1" value="1.0">
            </div>
        </div>
        <div class="rule-item">
            <div class="rule-info">
                <h3><i class="fa-solid fa-person-running"></i> 懸垂(セット)</h3>
                <p class="rule-detail">顎をバーより上に上げる。セット数で記録。1~10セット：5rep、11~20セット：6rep、21~セット：7回。</p>
            </div>
            <div class="rule-multiplier" style="display:none;">
                <label>倍率：</label>
                <input type="number" id="multiplier-pullup" min="0.1" step="0.1" value="1.0">
            </div>
        </div>
    `;

    // multiplierInputsの参照を再設定
    multiplierInputs.pushup = document.getElementById('multiplier-pushup');
    multiplierInputs.dips = document.getElementById('multiplier-dips');
    multiplierInputs.squat = document.getElementById('multiplier-squat');
    multiplierInputs.Lsit = document.getElementById('multiplier-Lsit');
    multiplierInputs.pullup = document.getElementById('multiplier-pullup');
}

/**
 * タグセレクターUIをレンダリング
 * @param {string} containerId - タグセレクターのコンテナ要素のID
 * @param {string[]} selectedTags - 初期選択済みタグ
 */
function renderTagSelector(containerId, selectedTags = []) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const currentSelected = new Set(selectedTags);
    const presetChips = container.querySelector('.tag-preset-chips');
    const selectedList = container.querySelector('.tag-selected-list');
    const freeInput = container.querySelector('.tag-free-input');
    const addBtn = container.querySelector('.tag-add-btn');
    
    // フリータグ（プリセットにないもの）を収集
    const allFreeTags = new Set();
    Object.values(freeExercises).forEach(ex => {
        (ex.tags || []).forEach(tag => {
            if (!PRESET_TAGS.includes(tag)) allFreeTags.add(tag);
        });
    });
    selectedTags.forEach(tag => {
        if (!PRESET_TAGS.includes(tag)) allFreeTags.add(tag);
    });
    
    function renderChips() {
        // プリセットタグ
        presetChips.innerHTML = '';
        PRESET_TAGS.forEach(tag => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'tag-chip' + (currentSelected.has(tag) ? ' selected' : '');
            chip.textContent = tag;
            chip.addEventListener('click', () => {
                if (currentSelected.has(tag)) {
                    currentSelected.delete(tag);
                } else {
                    currentSelected.add(tag);
                }
                renderChips();
            });
            presetChips.appendChild(chip);
        });
        
        // フリータグもプリセットの後に表示
        allFreeTags.forEach(tag => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'tag-chip tag-free' + (currentSelected.has(tag) ? ' selected' : '');
            chip.textContent = tag;
            chip.addEventListener('click', () => {
                if (currentSelected.has(tag)) {
                    currentSelected.delete(tag);
                } else {
                    currentSelected.add(tag);
                }
                renderChips();
            });
            presetChips.appendChild(chip);
        });
        
        // 選択済みタグ表示
        selectedList.innerHTML = '';
        if (currentSelected.size > 0) {
            currentSelected.forEach(tag => {
                const chip = document.createElement('span');
                chip.className = 'tag-chip selected-display';
                chip.innerHTML = `${escapeHtml(tag)} <i class="fa-solid fa-xmark tag-remove"></i>`;
                chip.querySelector('.tag-remove').addEventListener('click', () => {
                    currentSelected.delete(tag);
                    if (!PRESET_TAGS.includes(tag)) allFreeTags.delete(tag);
                    renderChips();
                });
                selectedList.appendChild(chip);
            });
        }
    }
    
    renderChips();
    
    // 既存リスナーを削除して再設定（cloneNodeで古いリスナーを除去）
    const newAddBtn = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(newAddBtn, addBtn);
    
    const newFreeInput = freeInput.cloneNode(true);
    freeInput.parentNode.replaceChild(newFreeInput, freeInput);
    
    // フリータグ追加（新しいDOM要素を参照）
    const handleAddFreeTag = () => {
        const val = newFreeInput.value.trim();
        if (val && val.length <= 10 && !currentSelected.has(val)) {
            currentSelected.add(val);
            if (!PRESET_TAGS.includes(val)) allFreeTags.add(val);
            newFreeInput.value = '';
            renderChips();
        }
    };
    
    newAddBtn.addEventListener('click', handleAddFreeTag);
    newFreeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddFreeTag();
        }
    });
    
    container._getSelectedTags = () => Array.from(currentSelected);
    container._freeInput = newFreeInput;
}

/**
 * タグセレクターから選択済みタグを取得
 * @param {string} containerId - タグセレクターのコンテナ要素のID
 * @returns {string[]}
 */
function getSelectedTags(containerId) {
    const container = document.getElementById(containerId);
    if (!container || !container._getSelectedTags) return [];
    return container._getSelectedTags();
}

// ====================================================================
// 投稿統計の取得（ソート用）
// ====================================================================

/**
 * 投稿統計をFirestoreから取得・キャッシュ
 * @param {boolean} forceRefresh - キャッシュを無視して再取得
 * @returns {Object} { [exerciseKey]: { totalPosts, recentPosts, lastPostDate } }
 */
async function loadExercisePostStats(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && exercisePostStatsTime && (now - exercisePostStatsTime < CACHE_DURATION)) {
        return exercisePostStats;
    }
    
    try {
        const snapshot = await db.collection('posts_free').get();
        const stats = {};
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        snapshot.forEach(doc => {
            const post = doc.data();
            const key = post.exerciseType;
            if (!stats[key]) {
                stats[key] = { totalPosts: 0, recentPosts: 0, lastPostDate: null };
            }
            stats[key].totalPosts++;
            
            const postDate = post.timestamp ? post.timestamp.toDate() : null;
            if (postDate) {
                if (postDate >= oneWeekAgo) {
                    stats[key].recentPosts++;
                }
                if (!stats[key].lastPostDate || postDate > stats[key].lastPostDate) {
                    stats[key].lastPostDate = postDate;
                }
            }
        });
        
        // 自分の最終投稿日も取得
        if (currentUser) {
            snapshot.forEach(doc => {
                const post = doc.data();
                if (post.userId === currentUser.uid) {
                    const key = post.exerciseType;
                    if (!stats[key]) stats[key] = { totalPosts: 0, recentPosts: 0, lastPostDate: null };
                    const postDate = post.timestamp ? post.timestamp.toDate() : null;
                    if (postDate) {
                        if (!stats[key].myLastPostDate || postDate > stats[key].myLastPostDate) {
                            stats[key].myLastPostDate = postDate;
                        }
                    }
                }
            });
        }
        
        exercisePostStats = stats;
        exercisePostStatsTime = now;
        return stats;
    } catch (error) {
        console.error('[投稿統計] 取得エラー:', error);
        return exercisePostStats;
    }
}

// ====================================================================
// フィルタ・ソートロジック
// ====================================================================

/**
 * フリーモード種目をフィルタ・ソートして返す
 * @param {Object} options - { searchQuery, filterTags, sortBy }
 * @returns {Array} [[key, exerciseObj], ...] のフィルタ・ソート済み配列
 */
function getFilteredAndSortedExercises(options = {}) {
    const { searchQuery = '', filterTags = [], sortBy = 'name-asc' } = options;
    
    let entries = Object.entries(freeExercises);
    
    // テキスト検索（種目名・ルール文）
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        entries = entries.filter(([key, ex]) => {
            return (ex.name && ex.name.toLowerCase().includes(q)) ||
                   (ex.rule && ex.rule.toLowerCase().includes(q)) ||
                   (ex.tags && ex.tags.some(tag => tag.toLowerCase().includes(q)));
        });
    }
    
    // タグフィルタ（AND条件）
    if (filterTags.length > 0) {
        entries = entries.filter(([key, ex]) => {
            const exTags = ex.tags || [];
            return filterTags.every(tag => exTags.includes(tag));
        });
    }
    
    // ソート
    switch (sortBy) {
        case 'name-asc':
            entries.sort((a, b) => (a[1].name || '').localeCompare(b[1].name || '', 'ja'));
            break;
        case 'name-desc':
            entries.sort((a, b) => (b[1].name || '').localeCompare(a[1].name || '', 'ja'));
            break;
        case 'created-new':
            entries.sort((a, b) => (b[1].createdAt || '').localeCompare(a[1].createdAt || ''));
            break;
        case 'created-old':
            entries.sort((a, b) => (a[1].createdAt || '').localeCompare(b[1].createdAt || ''));
            break;
        case 'posts-desc':
            entries.sort((a, b) => {
                const sa = (exercisePostStats[a[0]] || {}).totalPosts || 0;
                const sb = (exercisePostStats[b[0]] || {}).totalPosts || 0;
                return sb - sa;
            });
            break;
        case 'trend':
            entries.sort((a, b) => {
                const sa = (exercisePostStats[a[0]] || {}).recentPosts || 0;
                const sb = (exercisePostStats[b[0]] || {}).recentPosts || 0;
                return sb - sa;
            });
            break;
        case 'last-post':
            entries.sort((a, b) => {
                const da = (exercisePostStats[a[0]] || {}).myLastPostDate;
                const db_ = (exercisePostStats[b[0]] || {}).myLastPostDate;
                if (!da && !db_) return 0;
                if (!da) return 1;
                if (!db_) return -1;
                return db_ - da;
            });
            break;
        case 'tags-group':
            // タグ別グループ化: タグごとにまとめる（タグなしは末尾）
            // entries自体はそのまま返し、レンダリング側でグループ化
            break;
    }
    
    return entries;
}

/**
 * タグ別グループ化のためのユーティリティ
 * @param {Array} entries - [[key, ex], ...] 
 * @returns {Object} { 'タグ名': [[key, ex], ...], 'タグなし': [[key, ex], ...] }
 */
function groupExercisesByTag(entries) {
    const groups = {};
    const noTag = [];
    
    entries.forEach(([key, ex]) => {
        const tags = ex.tags || [];
        if (tags.length === 0) {
            noTag.push([key, ex]);
        } else {
            tags.forEach(tag => {
                if (!groups[tag]) groups[tag] = [];
                groups[tag].push([key, ex]);
            });
        }
    });
    
    if (noTag.length > 0) {
        groups['タグなし'] = noTag;
    }
    
    return groups;
}

/**
 * 現在使用中のすべてのタグを取得
 * @returns {string[]}
 */
function getAllUsedTags() {
    const tags = new Set();
    Object.values(freeExercises).forEach(ex => {
        (ex.tags || []).forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b, 'ja'));
}

// ====================================================================
// 共通フィルタUIコンポーネント
// ====================================================================

/**
 * 種目フィルタUIを生成して挿入
 * @param {HTMLElement} targetContainer - UIを挿入する親要素
 * @param {Function} onFilterChange - フィルタ変更時のコールバック
 * @returns {HTMLElement} 生成されたフィルタバー要素
 */
function createExerciseFilterUI(targetContainer, onFilterChange) {
    // 既存のフィルタUIがあれば削除
    const existingFilter = targetContainer.querySelector('.exercise-filter-bar');
    if (existingFilter) existingFilter.remove();
    
    const filterBar = document.createElement('div');
    filterBar.className = 'exercise-filter-bar';
    
    const usedTags = getAllUsedTags();
    
    filterBar.innerHTML = `
        <div class="filter-search-row">
            <div class="filter-search-input-wrapper">
                <i class="fa-solid fa-magnifying-glass filter-search-icon"></i>
                <input type="text" class="filter-search-input" placeholder="種目を検索..." value="${escapeHtml(exerciseFilterState.searchQuery)}">
                <button type="button" class="filter-search-clear" style="display:${exerciseFilterState.searchQuery ? 'block' : 'none'}"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <button type="button" class="filter-toggle-btn${exerciseFilterState.filterTags.length > 0 || exerciseFilterState.sortBy !== 'name-asc' ? ' active' : ''}" title="フィルタ・ソート">
                <i class="fa-solid fa-sliders"></i>
                ${exerciseFilterState.filterTags.length > 0 ? '<span class="filter-badge">' + exerciseFilterState.filterTags.length + '</span>' : ''}
            </button>
        </div>
        <div class="filter-expandable" style="display:none;">
            <div class="filter-sort-row">
                <label><i class="fa-solid fa-arrow-down-wide-short"></i> 並び替え</label>
                <select class="filter-sort-select">
                    <option value="name-asc"${exerciseFilterState.sortBy === 'name-asc' ? ' selected' : ''}>名前順（あ→わ）</option>
                    <option value="name-desc"${exerciseFilterState.sortBy === 'name-desc' ? ' selected' : ''}>名前順（わ→あ）</option>
                    <option value="created-new"${exerciseFilterState.sortBy === 'created-new' ? ' selected' : ''}>作成日（新しい順）</option>
                    <option value="created-old"${exerciseFilterState.sortBy === 'created-old' ? ' selected' : ''}>作成日（古い順）</option>
                    <option value="posts-desc"${exerciseFilterState.sortBy === 'posts-desc' ? ' selected' : ''}>投稿数順</option>
                    <option value="trend"${exerciseFilterState.sortBy === 'trend' ? ' selected' : ''}>トレンド（直近1週間）</option>
                    <option value="last-post"${exerciseFilterState.sortBy === 'last-post' ? ' selected' : ''}>自分の最終投稿日順</option>
                    <option value="tags-group"${exerciseFilterState.sortBy === 'tags-group' ? ' selected' : ''}>タグ別グループ</option>
                </select>
            </div>
            ${usedTags.length > 0 ? `
            <div class="filter-tags-row">
                <label><i class="fa-solid fa-tags"></i> タグで絞り込み</label>
                <div class="filter-tag-chips">
                    ${usedTags.map(tag => `<button type="button" class="tag-chip filter-chip${exerciseFilterState.filterTags.includes(tag) ? ' active' : ''}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join('')}
                </div>
            </div>` : ''}
            <div class="filter-actions-row">
                <button type="button" class="filter-reset-btn"><i class="fa-solid fa-rotate-left"></i> リセット</button>
            </div>
        </div>
    `;
    
    targetContainer.insertBefore(filterBar, targetContainer.firstChild);
    
    // イベント設定
    const searchInput = filterBar.querySelector('.filter-search-input');
    const clearBtn = filterBar.querySelector('.filter-search-clear');
    const toggleBtn = filterBar.querySelector('.filter-toggle-btn');
    const expandable = filterBar.querySelector('.filter-expandable');
    const sortSelect = filterBar.querySelector('.filter-sort-select');
    const resetBtn = filterBar.querySelector('.filter-reset-btn');
    
    let debounceTimer = null;
    searchInput.addEventListener('input', () => {
        clearBtn.style.display = searchInput.value ? 'block' : 'none';
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            exerciseFilterState.searchQuery = searchInput.value.trim();
            onFilterChange();
        }, 200);
    });
    
    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        exerciseFilterState.searchQuery = '';
        onFilterChange();
    });
    
    toggleBtn.addEventListener('click', () => {
        const isHidden = expandable.style.display === 'none';
        expandable.style.display = isHidden ? 'block' : 'none';
        toggleBtn.classList.toggle('expanded', isHidden);
    });
    
    sortSelect.addEventListener('change', () => {
        exerciseFilterState.sortBy = sortSelect.value;
        toggleBtn.classList.toggle('active', exerciseFilterState.filterTags.length > 0 || exerciseFilterState.sortBy !== 'name-asc');
        onFilterChange();
    });
    
    filterBar.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const tag = chip.dataset.tag;
            const idx = exerciseFilterState.filterTags.indexOf(tag);
            if (idx >= 0) {
                exerciseFilterState.filterTags.splice(idx, 1);
                chip.classList.remove('active');
            } else {
                exerciseFilterState.filterTags.push(tag);
                chip.classList.add('active');
            }
            toggleBtn.classList.toggle('active', exerciseFilterState.filterTags.length > 0 || exerciseFilterState.sortBy !== 'name-asc');
            // バッジ更新
            const existingBadge = toggleBtn.querySelector('.filter-badge');
            if (existingBadge) existingBadge.remove();
            if (exerciseFilterState.filterTags.length > 0) {
                const badge = document.createElement('span');
                badge.className = 'filter-badge';
                badge.textContent = exerciseFilterState.filterTags.length;
                toggleBtn.appendChild(badge);
            }
            onFilterChange();
        });
    });
    
    resetBtn.addEventListener('click', () => {
        exerciseFilterState.searchQuery = '';
        exerciseFilterState.filterTags = [];
        exerciseFilterState.sortBy = 'name-asc';
        searchInput.value = '';
        clearBtn.style.display = 'none';
        sortSelect.value = 'name-asc';
        filterBar.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        toggleBtn.classList.remove('active');
        const existingBadge = toggleBtn.querySelector('.filter-badge');
        if (existingBadge) existingBadge.remove();
        onFilterChange();
    });
    
    return filterBar;
}

// フリーモード種目追加モーダルのイベント
document.querySelector('.close-free-exercise-modal').addEventListener('click', () => {
    document.getElementById('free-exercise-modal').style.display = 'none';
    document.getElementById('free-exercise-error').textContent = '';
});

// フリーモード種目編集モーダルのイベント
document.querySelector('.close-edit-exercise-modal').addEventListener('click', () => {
    document.getElementById('edit-exercise-modal').style.display = 'none';
    document.getElementById('edit-exercise-error').textContent = '';
});

// 削除済み種目復元モーダルのイベント
document.querySelector('.close-restore-exercise-modal').addEventListener('click', () => {
    document.getElementById('restore-exercise-modal').style.display = 'none';
});

window.addEventListener('click', (event) => {
    const addModal = document.getElementById('free-exercise-modal');
    if (event.target === addModal) {
        addModal.style.display = 'none';
        document.getElementById('free-exercise-error').textContent = '';
    }
    const editModal = document.getElementById('edit-exercise-modal');
    if (event.target === editModal) {
        editModal.style.display = 'none';
        document.getElementById('edit-exercise-error').textContent = '';
    }
    const restoreModal = document.getElementById('restore-exercise-modal');
    if (event.target === restoreModal) {
        restoreModal.style.display = 'none';
    }
    if (championDetailModal && event.target === championDetailModal) {
        championDetailModal.style.display = 'none';
    }
});

document.getElementById('add-free-exercise-btn').addEventListener('click', async () => {
    const nameInput = document.getElementById('free-exercise-name');
    const ruleInput = document.getElementById('free-exercise-rule');
    const iconInput = document.getElementById('free-exercise-icon');
    const errorEl = document.getElementById('free-exercise-error');

    const name = nameInput.value.trim();
    const rule = ruleInput.value.trim();
    const icon = iconInput.value || 'fa-dumbbell';

    if (!name) {
        errorEl.textContent = '種目名を入力してください';
        return;
    }
    if (name.length > 20) {
        errorEl.textContent = '種目名は20文字以内で入力してください';
        return;
    }

    try {
        const tags = getSelectedTags('free-exercise-tags');
        const barbarian = document.getElementById('free-exercise-barbarian').checked;
        const excludeFromWeekly = document.getElementById('free-exercise-exclude-weekly').checked;
        await addFreeExercise(name, rule, icon, tags, barbarian, excludeFromWeekly);
        nameInput.value = '';
        ruleInput.value = '';
        renderIconGrid('free-exercise-icon-grid', 'free-exercise-icon', 'fa-dumbbell');
        renderTagSelector('free-exercise-tags', []);
        document.getElementById('free-exercise-barbarian').checked = false;
        document.getElementById('free-exercise-exclude-weekly').checked = false;
        errorEl.textContent = '';
        document.getElementById('free-exercise-modal').style.display = 'none';
        alert('種目を追加しました！');
    } catch (error) {
        errorEl.textContent = '種目の追加に失敗しました';
    }
});

document.getElementById('save-edit-exercise-btn').addEventListener('click', async () => {
    const key = document.getElementById('edit-exercise-key').value;
    const nameInput = document.getElementById('edit-exercise-name');
    const ruleInput = document.getElementById('edit-exercise-rule');
    const iconInput = document.getElementById('edit-exercise-icon');
    const errorEl = document.getElementById('edit-exercise-error');

    const name = nameInput.value.trim();
    const rule = ruleInput.value.trim();
    const icon = iconInput.value || 'fa-dumbbell';

    if (!name) {
        errorEl.textContent = '種目名を入力してください';
        return;
    }
    if (name.length > 20) {
        errorEl.textContent = '種目名は20文字以内で入力してください';
        return;
    }

    try {
        const tags = getSelectedTags('edit-exercise-tags');
        const barbarian = document.getElementById('edit-exercise-barbarian').checked;
        const excludeFromWeekly = document.getElementById('edit-exercise-exclude-weekly').checked;
        await editFreeExercise(key, name, rule, icon, tags, barbarian, excludeFromWeekly);
        errorEl.textContent = '';
        document.getElementById('edit-exercise-modal').style.display = 'none';
        alert('種目を更新しました！');
    } catch (error) {
        errorEl.textContent = '種目の更新に失敗しました';
    }
});

// フリーモード種目編集モーダルの削除ボタン
document.getElementById('delete-edit-exercise-btn').addEventListener('click', async () => {
    const key = document.getElementById('edit-exercise-key').value;
    if (key && freeExercises[key]) {
        await deleteFreeExercise(key);
    }
});

/**
 * フリーモードの種目名マッピングを取得
 * @returns {Object} exerciseNamesと同じ形式 { key: name }
 */
function getFreeExerciseNames() {
    const names = {};
    Object.entries(freeExercises).forEach(([key, ex]) => {
        names[key] = ex.name;
    });
    return names;
}

/**
 * フリーモード用の得点計算（倍率なし、値そのまま）
 */
async function getAllUsersScoresFree(forceRefresh = false) {
    try {
        const now = Date.now();
        const mode = 'free';

        if (!forceRefresh && scoreCache[mode] && scoreCacheTime[mode] && (now - scoreCacheTime[mode] < CACHE_DURATION)) {
            return scoreCache[mode];
        }

        if (!freeExercisesLoaded) {
            await loadFreeExercises();
        }

        // posts と users を並列取得（直列ウォーターフォール解消）
        const collectionName = 'posts_free';
        const [postsSnapshot, usersMap] = await Promise.all([
            db.collection(collectionName).get(),
            getUsersMap()
        ]);
        countReads(postsSnapshot.size);

        const usersData = {};
        Object.keys(usersMap).forEach(uid => {
            const data = usersMap[uid];
            usersData[uid] = data.userName || data.email;
        });

        const exerciseKeys = Object.keys(freeExercises);
        const userRecords = {};

        postsSnapshot.forEach(doc => {
            const post = doc.data();
            const userId = post.userId;
            const exerciseType = post.exerciseType;
            const value = post.value;

            if (!userRecords[userId]) {
                userRecords[userId] = {
                    userName: usersData[userId] || 'Unknown',
                    exercises: {},
                    scores: {},
                    totalScore: 0
                };
            }

            // バーバリアン方式: 最小値をベストとする、通常: 最大値をベストとする
            const isBarbarian = freeExercises[exerciseType] && freeExercises[exerciseType].barbarian;
            if (isBarbarian) {
                if (userRecords[userId].exercises[exerciseType] === undefined ||
                    userRecords[userId].exercises[exerciseType] > value) {
                    userRecords[userId].exercises[exerciseType] = value;
                }
            } else {
                if (!userRecords[userId].exercises[exerciseType] ||
                    userRecords[userId].exercises[exerciseType] < value) {
                    userRecords[userId].exercises[exerciseType] = value;
                }
            }
        });

        // %計算（通常: 最高得点を100%、バーバリアン: 最短タイムを100%）
        exerciseKeys.forEach(exercise => {
            const isBarbarian = freeExercises[exercise] && freeExercises[exercise].barbarian;

            if (isBarbarian) {
                // バーバリアン方式: bestTime / selfTime * 100
                let minVal = Infinity;
                Object.values(userRecords).forEach(user => {
                    const val = user.exercises[exercise];
                    if (val !== undefined && val > 0 && val < minVal) minVal = val;
                });

                Object.values(userRecords).forEach(user => {
                    const val = user.exercises[exercise];
                    const pct = (val !== undefined && val > 0 && minVal !== Infinity) ? (minVal / val) * 100 : 0;
                    user.scores[exercise] = pct;
                    user.totalScore += pct;
                });
            } else {
                // 通常方式: selfValue / maxValue * 100
                let maxVal = 0;
                Object.values(userRecords).forEach(user => {
                    const val = user.exercises[exercise] || 0;
                    if (val > maxVal) maxVal = val;
                });

                Object.values(userRecords).forEach(user => {
                    const val = user.exercises[exercise] || 0;
                    const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                    user.scores[exercise] = pct;
                    user.totalScore += pct;
                });
            }
        });

        scoreCache[mode] = userRecords;
        scoreCacheTime[mode] = now;

        return userRecords;
    } catch (error) {
        console.error('[フリーモード] 得点計算エラー:', error);
        throw error;
    }
}

/**
 * フリーモード用レーダーチャート描画（番号付き凡例）
 */
async function loadFreeScoreChart(selectedUserIds = []) {
    try {
        scoreError.textContent = '';
        const usersScores = await getAllUsersScoresFree();
        const exerciseKeys = Object.keys(freeExercises);

        if (selectedUserIds.length === 0) {
            selectedUserIds = Object.keys(usersScores);
        }

        if (exerciseKeys.length === 0) {
            scoreError.textContent = 'フリーモードの種目がまだ登録されていません';
            if (myScoreChart) { myScoreChart.destroy(); myScoreChart = null; }
            return;
        }

        // 総合得点ランキングを先に描画（Chart.js の読み込み/描画に依存させない）
        displayFreeScores(usersScores, exerciseKeys);

        // 番号ラベル（①②③...）を作成
        const circledNumbers = exerciseKeys.map((_, i) => {
            const nums = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩',
                           '⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'];
            return i < nums.length ? nums[i] : `(${i + 1})`;
        });

        const allUserIds = Object.keys(usersScores).sort();
        const getUserColorIndex = (userId) => {
            const index = allUserIds.indexOf(userId);
            return index >= 0 ? index : 0;
        };

        const colors = [
            'rgba(102, 126, 234, 0.6)',
            'rgba(237, 100, 166, 0.6)',
            'rgba(255, 159, 64, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(153, 102, 255, 0.6)',
            'rgba(255, 205, 86, 0.6)'
        ];
        const borderColors = [
            'rgb(102, 126, 234)',
            'rgb(237, 100, 166)',
            'rgb(255, 159, 64)',
            'rgb(75, 192, 192)',
            'rgb(153, 102, 255)',
            'rgb(255, 205, 86)'
        ];

        const datasets = selectedUserIds.map(userId => {
            const user = usersScores[userId];
            if (!user) return null;
            const colorIndex = getUserColorIndex(userId) % colors.length;
            const data = exerciseKeys.map(key => user.scores[key] || 0);
            return {
                label: user.userName,
                data: data,
                backgroundColor: colors[colorIndex],
                borderColor: borderColors[colorIndex],
                borderWidth: 2,
                pointBackgroundColor: borderColors[colorIndex],
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: borderColors[colorIndex]
            };
        }).filter(d => d !== null);

        // Chart.js を遅延ロード（初回のみ取得）
        await ensureChartJs();

        if (myScoreChart) { myScoreChart.destroy(); }

        const ctx = scoreChart.getContext('2d');
        myScoreChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: circledNumbers,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 10, bottom: 10, left: 20, right: 20 } },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { stepSize: 20 }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { font: { size: 13 }, padding: 15, boxWidth: 15, boxHeight: 15 }
                    },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                const idx = context[0].dataIndex;
                                return freeExercises[exerciseKeys[idx]]?.name || '';
                            },
                            label: function(context) {
                                return context.dataset.label + ': ' + context.parsed.r.toFixed(1) + '%';
                            }
                        }
                    }
                }
            }
        });

        // 注釈を表示（レーダーチャートコンテナの外・下に配置）
        let annotationContainer = document.querySelector('.chart-legend-annotations');
        if (!annotationContainer) {
            annotationContainer = document.createElement('div');
            annotationContainer.className = 'chart-legend-annotations';
            const chartContainer = scoreChart.closest('.score-chart-container');
            chartContainer.parentNode.insertBefore(annotationContainer, chartContainer.nextSibling);
        }
        annotationContainer.innerHTML = exerciseKeys.map((key, i) => {
            return `<span class="legend-annotation-item">${circledNumbers[i]} ${escapeHtml(freeExercises[key].name)}</span>`;
        }).join('');

    } catch (error) {
        console.error('[フリーモード] レーダーチャートエラー:', error);
        // 数値ランキングは既に表示済み。チャートのみ失敗した旨を伝える
        scoreError.textContent = '得点グラフの描画に失敗しました（通信状態をご確認ください）';
    }
}

/**
 * フリーモード用の総合得点ランキング表示
 */
function displayFreeScores(usersScores, exerciseKeys) {
    const isWeeklySimulator = currentMode === 'weekly' && weeklySimulatorEnabled;
    const sourceScores = isWeeklySimulator
        ? calculateWeeklySimulatedScores(usersScores, exerciseKeys)
        : usersScores;

    const sortedUsers = Object.entries(sourceScores)
        .sort((a, b) => b[1].totalScore - a[1].totalScore);

    let html = '';
    let currentRank = 1;
    let previousScore = null;
    const rankSnapshot = {};

    sortedUsers.forEach(([userId, userData], index) => {
        const totalScore = userData.totalScore;
        if (previousScore !== null && totalScore !== previousScore) {
            currentRank = index + 1;
        }
        previousScore = totalScore;
        rankSnapshot[userId] = currentRank;

        const prevRank = weeklySimulatorPreviousRanks[userId];
        const movedClass = isWeeklySimulator && weeklySimulatorPendingAnimation && prevRank !== undefined && prevRank !== currentRank
            ? ' rank-shift'
            : '';

        const medal = currentRank === 1 ? '🥇' : currentRank === 2 ? '🥈' : currentRank === 3 ? '🥉' : `${currentRank}.`;

        let breakdownHtml = exerciseKeys.map(key => {
            const ex = freeExercises[key];
            if (!ex) return '';
            const isBarbarian = ex.barbarian || false;
            const valueDisplay = userData.exercises[key] || 0;
            const unitText = isBarbarian ? '秒' : '';
            const barbarianIcon = isBarbarian ? '<i class="fa-solid fa-stopwatch" style="color:#e74c3c;margin-left:2px;font-size:10px;"></i>' : '';
            const baseValue = usersScores?.[userId]?.exercises?.[key] || 0;

            const valueCell = isWeeklySimulator
                ? `<span class="weekly-sim-edit-wrap"><input type="number" min="0" step="1" inputmode="numeric" class="weekly-sim-input" data-user-id="${escapeHtml(userId)}" data-exercise-key="${escapeHtml(key)}" value="${clampWeeklySimulatorValue(valueDisplay, 0)}" data-base-value="${clampWeeklySimulatorValue(baseValue, 0)}"><span class="weekly-sim-unit">${unitText || '回'}</span><span class="weekly-sim-base">${clampWeeklySimulatorValue(baseValue, 0)}${unitText || '回'}</span></span>`
                : `${valueDisplay}${unitText}`;

            return `
                <div class="breakdown-item breakdown-weekly">
                    <span class="breakdown-label">${escapeHtml(ex.name)}${barbarianIcon}</span>
                    <span class="breakdown-num">${valueCell}</span>
                    <span class="breakdown-pct">${(userData.scores[key] || 0).toFixed(1)}%</span>
                </div>
            `;
        }).join('');

        const detailDefaultDisplay = isWeeklySimulator && weeklySimulatorExpandedUserId === userId ? 'block' : 'none';

        const itemClickAttr = isWeeklySimulator ? '' : `onclick="toggleScoreDetails('${escapeHtml(userId)}')"`;
        const headerClickAttr = isWeeklySimulator ? `onclick="toggleScoreDetails('${escapeHtml(userId)}')"` : '';

        html += `
            <div class="total-score-item${movedClass}" data-user-id="${escapeHtml(userId)}" ${itemClickAttr}>
                <div class="score-header" ${headerClickAttr}>
                    <span class="score-rank">${medal}</span>
                    <span class="score-username">${escapeHtml(userData.userName)}</span>
                    ${(userData.streakBonus > 0) ? `<span class="streak-badge" title="連続投稿ボーナス（${userData.streakDays}日連続）">🔥${userData.streakDays} +${userData.streakBonus}</span>` : ''}
                    <span class="score-value">${totalScore.toFixed(1)}%</span>
                </div>
                <div class="score-details" id="score-details-${escapeHtml(userId)}" style="display: ${detailDefaultDisplay};">
                    <div class="score-breakdown">
                        ${breakdownHtml}
                    </div>
                </div>
            </div>
        `;
    });

    totalScoresList.innerHTML = html;
    if (isWeeklySimulator) {
        weeklySimulatorPreviousRanks = rankSnapshot;
        weeklySimulatorPendingAnimation = false;

        if (weeklySimulatorFocusUserId) {
            const focusedItem = totalScoresList.querySelector(`.total-score-item[data-user-id="${weeklySimulatorFocusUserId}"]`);
            if (focusedItem) {
                focusedItem.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            }
            weeklySimulatorFocusUserId = null;
        }
    }
}

/**
 * フリーモード用ユーザーチェックボックス
 */
async function loadFreeUserCheckboxes(forceRefresh = false) {
    try {
        setWeeklySimulatorControlsVisible(false);
        const usersScores = await getAllUsersScoresFree(forceRefresh);

        let html = '';
        Object.keys(usersScores).forEach(userId => {
            const user = usersScores[userId];
            const isCurrentUser = userId === currentUser.uid;
            const checked = isCurrentUser ? 'checked' : '';
            html += `
                <label class="user-checkbox">
                    <input type="checkbox" value="${userId}" ${checked}>
                    <span>${escapeHtml(user.userName)}</span>
                </label>
            `;
        });

        userCheckboxes.innerHTML = html;

        userCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const selectedIds = Array.from(
                    userCheckboxes.querySelectorAll('input[type="checkbox"]:checked')
                ).map(cb => cb.value);
                loadFreeScoreChart(selectedIds);
            });
        });

        loadFreeScoreChart([currentUser.uid]);

    } catch (error) {
        console.error('[フリーモード] チェックボックスエラー:', error);
        scoreError.textContent = 'ユーザーリストの取得に失敗しました';
    }
}

// ====================================================================
// 種目評価システム
// ====================================================================

/** 評価ラベル（1〜5）*/
const RATING_LABELS = {
    1: '2度とやりたくない',
    2: '不良種目',
    3: '悪くない',
    4: '良種目',
    5: 'ぜひまたやりたい'
};

/** 作成者スコアのキャッシュ { [userId]: { creatorAvgRating, creatorRatedExerciseCount } } */
const creatorScoreCache = {};

/**
 * 現在時刻が週末（土日 JST）かどうかを返す
 * @param {Date} [now=new Date()]
 * @returns {boolean}
 */
function isWeekendJST(now = new Date()) {
    const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const jstMs = now.getTime() + JST_OFFSET_MS;
    const jstDate = new Date(jstMs);
    const day = jstDate.getUTCDay(); // 0=日, 6=土
    return day === 0 || day === 6;
}

/**
 * 指定種目の集計評価を取得
 * @param {string} exerciseKey
 * @returns {Promise<{avgRating: number, ratingCount: number, ratingSum: number}|null>}
 */
async function getExerciseRatingSummary(exerciseKey) {
    try {
        const doc = await db.collection('exercise_ratings').doc(exerciseKey).get();
        if (doc.exists) return doc.data();
        return null;
    } catch (e) {
        console.warn('[評価] 集計取得失敗:', e);
        return null;
    }
}

/**
 * 複数種目の集計評価をまとめて取得
 * @param {string[]} keys
 * @returns {Promise<Object>} { [key]: {avgRating, ratingCount, ratingSum} }
 */
async function getExerciseRatingSummaries(keys) {
    if (!keys || keys.length === 0) return {};
    const results = {};
    await Promise.all(keys.map(async key => {
        const data = await getExerciseRatingSummary(key);
        if (data) results[key] = data;
    }));
    return results;
}

/**
 * ログインユーザーの指定種目評価を取得
 * @param {string} exerciseKey
 * @returns {Promise<{rating: number, comment: string, timestamp, updatedAt}|null>}
 */
async function getUserExerciseRating(exerciseKey) {
    const user = firebase.auth().currentUser;
    if (!user) return null;
    try {
        const doc = await db.collection('exercise_ratings').doc(exerciseKey)
            .collection('user_ratings').doc(user.uid).get();
        if (doc.exists) return doc.data();
        return null;
    } catch (e) {
        console.warn('[評価] ユーザー評価取得失敗:', e);
        return null;
    }
}

/**
 * 複数種目の自分の評価を一括取得
 * @param {string[]} exerciseKeys
 * @returns {Promise<Object>} key -> userRatingData のマップ
 */
async function getUserExerciseRatings(exerciseKeys) {
    const user = firebase.auth().currentUser;
    if (!user || !exerciseKeys.length) return {};
    const results = {};
    await Promise.all(exerciseKeys.map(async key => {
        try {
            const doc = await db.collection('exercise_ratings').doc(key)
                .collection('user_ratings').doc(user.uid).get();
            if (doc.exists) results[key] = doc.data();
        } catch (e) {}
    }));
    return results;
}

/**
 * 種目評価を送信（新規 or 更新）
 * バッチ書き込みで個別評価と集計を原子更新する
 * @param {string} exerciseKey
 * @param {number} rating - 1〜5
 * @param {string} comment - 任意（空文字列可）
 */
async function submitExerciseRating(exerciseKey, rating, comment) {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error('ログインが必要です');
    if (rating < 1 || rating > 5) throw new Error('評価は1〜5で入力してください');

    const summaryRef = db.collection('exercise_ratings').doc(exerciseKey);
    const userRatingRef = summaryRef.collection('user_ratings').doc(user.uid);

    // 既存評価を確認（差分更新のため）
    const existingDoc = await userRatingRef.get();
    const prevRating = existingDoc.exists ? (existingDoc.data().rating || 0) : 0;
    const isUpdate = existingDoc.exists;

    const batch = db.batch();

    // 個別評価ドキュメントの書き込み
    const userRatingData = {
        rating,
        comment: comment || '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!isUpdate) {
        userRatingData.timestamp = firebase.firestore.FieldValue.serverTimestamp();
        userRatingData.userId = user.uid;
        userRatingData.userName = (typeof currentUserData !== 'undefined' && currentUserData && currentUserData.userName)
            ? currentUserData.userName
            : (user.email || '匿名');
    }

    if (isUpdate) {
        batch.update(userRatingRef, userRatingData);
    } else {
        batch.set(userRatingRef, userRatingData);
    }

    // 集計ドキュメントの更新
    if (isUpdate) {
        // 既存評価を差し引いて新しい評価を加算
        batch.update(summaryRef, {
            ratingSum: firebase.firestore.FieldValue.increment(rating - prevRating),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        // avgRating はバッチ後に再計算
    } else {
        // 初回評価: increment
        batch.set(summaryRef, {
            ratingCount: firebase.firestore.FieldValue.increment(1),
            ratingSum: firebase.firestore.FieldValue.increment(rating),
            // avgRating はバッチ後のトランザクションで再計算するため、ここでは書かない
            exerciseKey,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }

    await batch.commit();

    // avgRating をトランザクションで正確に更新
    await db.runTransaction(async tx => {
        const summarySnap = await tx.get(summaryRef);
        if (summarySnap.exists) {
            const d = summarySnap.data();
            const count = d.ratingCount || 1;
            const sum = d.ratingSum || rating;
            tx.update(summaryRef, { avgRating: sum / count });
        }
    });

    // 作成者の統計を非同期で更新
    const ex = freeExercises[exerciseKey];
    if (ex && ex.createdBy) {
        recalculateCreatorStats(ex.createdBy).catch(e => console.warn('[評価] 作成者統計更新失敗:', e));
    }

    console.log(`[評価] ${exerciseKey} に ${rating}★ を送信`);
}

/**
 * 指定ユーザーの作成者評価統計を再計算して users/{uid} に保存
 * @param {string} creatorUserId
 */
async function recalculateCreatorStats(creatorUserId) {
    // 作成者の種目を全件取得
    const createdKeys = Object.entries(freeExercises)
        .filter(([, ex]) => ex.createdBy === creatorUserId)
        .map(([key]) => key);

    if (createdKeys.length === 0) return;

    // 各種目の集計評価を取得
    const summaries = await getExerciseRatingSummaries(createdKeys);

    // 評価がついた種目のみを対象に平均計算
    const ratedEntries = Object.entries(summaries).filter(([, s]) => (s.ratingCount || 0) > 0);
    if (ratedEntries.length === 0) {
        await db.collection('users').doc(creatorUserId).update({
            creatorAvgRating: firebase.firestore.FieldValue.delete(),
            creatorRatedExerciseCount: 0
        }).catch(() => {});
        return;
    }

    const avgOfAvgs = ratedEntries.reduce((sum, [, s]) => sum + s.avgRating, 0) / ratedEntries.length;

    await db.collection('users').doc(creatorUserId).set({
        creatorAvgRating: Math.round(avgOfAvgs * 100) / 100,
        creatorRatedExerciseCount: ratedEntries.length
    }, { merge: true });

    console.log(`[評価] 作成者 ${creatorUserId} のスコア更新: ${avgOfAvgs.toFixed(2)}`);
}

/**
 * 自分の評価を削除し、集計を更新する
 * @param {string} exerciseKey
 */
async function deleteExerciseRating(exerciseKey) {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error('ログインが必要です');

    const summaryRef = db.collection('exercise_ratings').doc(exerciseKey);
    const userRatingRef = summaryRef.collection('user_ratings').doc(user.uid);

    const existingDoc = await userRatingRef.get();
    if (!existingDoc.exists) throw new Error('評価が存在しません');
    const prevRating = existingDoc.data().rating || 0;

    const batch = db.batch();
    batch.delete(userRatingRef);
    batch.update(summaryRef, {
        ratingCount: firebase.firestore.FieldValue.increment(-1),
        ratingSum: firebase.firestore.FieldValue.increment(-prevRating),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await batch.commit();

    // avgRating をトランザクションで再計算
    await db.runTransaction(async tx => {
        const summarySnap = await tx.get(summaryRef);
        if (summarySnap.exists) {
            const d = summarySnap.data();
            const count = d.ratingCount || 0;
            if (count <= 0) {
                tx.update(summaryRef, { avgRating: 0, ratingCount: 0, ratingSum: 0 });
            } else {
                tx.update(summaryRef, { avgRating: (d.ratingSum || 0) / count });
            }
        }
    });

    // 作成者の統計を非同期で更新
    const ex = freeExercises[exerciseKey];
    if (ex && ex.createdBy) {
        recalculateCreatorStats(ex.createdBy).catch(e => console.warn('[評価] 作成者統計更新失敗:', e));
    }

    console.log(`[評価] ${exerciseKey} の評価を削除`);
}

/**
 * 指定種目の全ユーザー評価リストを取得
 * @param {string} exerciseKey
 * @returns {Promise<Array>}
 */
async function getExerciseReviews(exerciseKey) {
    try {
        const snap = await db.collection('exercise_ratings').doc(exerciseKey)
            .collection('user_ratings')
            .orderBy('updatedAt', 'desc')
            .get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.warn('[評価] レビューリスト取得失敗:', e);
        return [];
    }
}

/**
 * 種目評価から選出確率の修正係数を算出する
 * @param {{avgRating: number, ratingCount: number}|null} summary
 * @returns {number} 係数（1.0 = 変化なし）
 */
function calcExerciseRatingModifier(summary) {
    if (!summary || (summary.ratingCount || 0) < 3) return 1.0;
    const avg = summary.avgRating;
    if (avg <= 2) return 0.3;
    if (avg >= 4) return 2.0;
    // 2 < avg < 4: 線形補間 (0.3→1.0 @ avg=2〜3, 1.0→2.0 @ avg=3〜4)
    if (avg < 3) return 0.3 + (avg - 2) * 0.7;
    return 1.0 + (avg - 3) * 1.0;
}

/**
 * 作成者評価から選出確率の修正係数を算出する
 * @param {{creatorAvgRating?: number, creatorRatedExerciseCount?: number}|null} creatorData
 * @returns {number} 係数（1.0 = 変化なし）
 */
function calcCreatorRatingModifier(creatorData) {
    if (!creatorData) return 1.0;
    const count = creatorData.creatorRatedExerciseCount || 0;
    if (count < 3) return 1.0;
    const avg = creatorData.creatorAvgRating;
    if (avg == null) return 1.0;
    if (avg <= 2) return 0.6;
    if (avg >= 4) return 1.4;
    return 1.0;
}

/**
 * 星評価のHTML文字列を生成（表示用）
 * @param {number|null} avgRating
 * @param {number} ratingCount
 * @returns {string}
 */
function renderStarRatingHtml(avgRating, ratingCount) {
    if (avgRating == null || ratingCount === 0) {
        return '<span class="star-rating no-rating">評価なし</span>';
    }
    const rounded = Math.round(avgRating * 2) / 2; // 0.5刻みで丸める
    const fullStars = Math.floor(rounded);
    const halfStar = rounded % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

    let starsHtml = '';
    for (let i = 0; i < fullStars; i++) starsHtml += '<i class="fa-solid fa-star"></i>';
    if (halfStar) starsHtml += '<i class="fa-solid fa-star-half-stroke"></i>';
    for (let i = 0; i < emptyStars; i++) starsHtml += '<i class="fa-regular fa-star"></i>';

    return `<span class="star-rating" title="${avgRating.toFixed(1)}点 (${ratingCount}件)">${starsHtml}<span class="rating-value">${avgRating.toFixed(1)}</span><span class="rating-count">(${ratingCount})</span></span>`;
}

// ====================================================================
// 週間チャレンジモード機能
// ====================================================================

/** 週間チャレンジの現在のデータ */
let weeklyChallenge = null;  // { weekStart, weekEnd, exercises, selectionHistory }
let weeklyChallengeLoaded = false;

// ====================================================================
// 週間チャレンジ: localStorage 楽観描画キャッシュ
//   通信が悪い/初回のFirestore応答が遅いときでも、前回開いたときの
//   「今週の3種目」を即座に描画するためのローカルキャッシュ。
//   ・あくまで Firestore 取得までの“つなぎ”。取得完了後は本データで上書きされる。
//   ・週替わりの誤表示を防ぐため、weekStart が現在の週と一致する場合のみ使う。
// ====================================================================
const LS_FREE_EXERCISES = 'growrep_freeExercises_cache';
const LS_WEEKLY_CHALLENGE = 'growrep_weeklyChallenge_cache';

function saveFreeExercisesCache() {
    try {
        localStorage.setItem(LS_FREE_EXERCISES, JSON.stringify(freeExercises || {}));
    } catch (e) { /* 保存不可（容量超過/プライベートモード等）は無視 */ }
}

function saveWeeklyChallengeCache() {
    try {
        if (!weeklyChallenge) return;
        localStorage.setItem(LS_WEEKLY_CHALLENGE, JSON.stringify({
            weekStart: weeklyChallenge.weekStart ? weeklyChallenge.weekStart.getTime() : null,
            weekEnd: weeklyChallenge.weekEnd ? weeklyChallenge.weekEnd.getTime() : null,
            exercises: weeklyChallenge.exercises || [],
            isManualOverride: weeklyChallenge.isManualOverride || false,
            overrideLabel: weeklyChallenge.overrideLabel || null
        }));
    } catch (e) { /* 無視 */ }
}

/**
 * localStorageのキャッシュから「今週の3種目」を即座に仮描画する。
 * Firestore応答前に呼び、通信不良でも3種目が見える状態を作る。
 * 実データ取得後は initWeeklyMode 内の各 update 関数で上書きされる。
 */
function prepaintWeeklyFromCache() {
    try {
        if (currentMode !== 'weekly') return;
        // 既に本データが揃っているなら仮描画は不要
        if (freeExercisesLoaded && weeklyChallengeLoaded) return;

        const exRaw = localStorage.getItem(LS_FREE_EXERCISES);
        const wRaw = localStorage.getItem(LS_WEEKLY_CHALLENGE);
        if (!exRaw || !wRaw) return;

        const exCache = JSON.parse(exRaw);
        const wCache = JSON.parse(wRaw);
        if (!exCache || !wCache || !Array.isArray(wCache.exercises) || wCache.exercises.length === 0) return;

        // 週替わりの誤表示防止: キャッシュが現在の週のものでなければ使わない
        const { start } = getWeekBoundaries();
        if (!wCache.weekStart || Math.abs(wCache.weekStart - start.getTime()) > 60 * 1000) return;

        // 本データ未取得の変数のみ仮設定（*Loaded フラグは立てない＝実取得は継続される）
        if (!freeExercisesLoaded) freeExercises = exCache;
        if (!weeklyChallengeLoaded) {
            weeklyChallenge = {
                weekStart: new Date(wCache.weekStart),
                weekEnd: wCache.weekEnd ? new Date(wCache.weekEnd) : null,
                exercises: wCache.exercises,
                selectionHistory: {},
                isManualOverride: wCache.isManualOverride || false,
                overrideLabel: wCache.overrideLabel || null
            };
        }

        // 同期的に描画できる軽い部分のみ（Firestore読み取りを伴う評価表示等は本フローに任せる）
        updateWeeklyPostDropdown();
        renderWeeklyChallengeInfo();
    } catch (e) { /* 仮描画失敗は無視して本フローに委ねる */ }
}

/**
 * 現在の週の境界日時を返す（JST基準）
 * 週の開始: 直近の日曜17:00 JST (= 日曜08:00 UTC)
 * @param {Date} [now=new Date()]
 * @returns {{ start: Date, end: Date }} UTC基準のDateオブジェクト
 */
function getWeekBoundaries(now = new Date()) {
    const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

    // JSTに変換して計算
    const jstMs = now.getTime() + JST_OFFSET_MS;
    const jstDate = new Date(jstMs);

    const jstDayOfWeek = jstDate.getUTCDay();   // 0=日, 1=月, ..., 6=土
    const jstHour = jstDate.getUTCHours();
    const jstMin = jstDate.getUTCMinutes();
    const jstSec = jstDate.getUTCSeconds();
    const jstMs2 = jstDate.getUTCMilliseconds();

    // 今日のJST午前0時
    const todayJstDayStartMs = jstMs - (jstHour * 3600 + jstMin * 60 + jstSec) * 1000 - jstMs2;

    // 今週の日曜17:00 JST（UTCオフセット適用後）を計算
    let daysBack;
    if (jstDayOfWeek === 0 && jstHour < 17) {
        // 日曜日の17:00より前 → 先週日曜を基点にする
        daysBack = 7;
    } else {
        daysBack = jstDayOfWeek;
    }

    // 直近日曜日のJST午前0時
    const lastSundayJstDayStartMs = todayJstDayStartMs - daysBack * 24 * 60 * 60 * 1000;

    // 直近日曜日の17:00 JST（UTC換算）
    const weekStartJstMs = lastSundayJstDayStartMs + 17 * 60 * 60 * 1000;

    // UTCに戻す
    const weekStartUTC = new Date(weekStartJstMs - JST_OFFSET_MS);
    const weekEndUTC = new Date(weekStartUTC.getTime() + 7 * 24 * 60 * 60 * 1000);

    return { start: weekStartUTC, end: weekEndUTC };
}

/**
 * 指定日時がJST換算で平日（月〜金）か判定
 * @param {Date} date
 * @returns {boolean}
 */
function isWeekdayJST(date) {
    const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const jstDate = new Date(date.getTime() + JST_OFFSET_MS);
    const jstDayOfWeek = jstDate.getUTCDay(); // 0=日, 1=月, ..., 6=土
    return jstDayOfWeek >= 1 && jstDayOfWeek <= 5;
}

// 4種目目（？？？ 枠）の解禁タイミング: 水曜 13:00 JST
const REVEAL_DOW_JST = 3;   // 0=日, 1=月, 2=火, 3=水, ...
const REVEAL_HOUR_JST = 13; // 13時（JST）

/**
 * 4種目目（？？？ 枠）の解禁時刻に達しているかを判定する。
 * 解禁は「水曜 13:00 JST」。週は日曜17:00 JST 起点なので、
 * 解禁区間は 水13:00 〜 次の日曜17:00（＝そのまま週末まで解禁状態）。
 *  - 日(0): 17:00より前はまだ前の週の続き＝解禁済み / 17:00以降は新しい週の開始＝未解禁
 *  - 月(1)・火(2): 未解禁
 *  - 水(3): 13:00以降で解禁
 *  - 木(4)・金(5)・土(6): 解禁済み
 * @param {Date} [date=new Date()]
 * @returns {boolean}
 */
function isRevealUnlockedJST(date = new Date()) {
    const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const jstDate = new Date(date.getTime() + JST_OFFSET_MS);
    const dow = jstDate.getUTCDay();   // 0=日, 1=月, ..., 6=土
    const hour = jstDate.getUTCHours();
    if (dow === 0) return hour < 17;   // 日曜17:00で週が切り替わる（それ以前は前週の解禁済み状態）
    if (dow < REVEAL_DOW_JST) return false;                       // 月・火
    if (dow === REVEAL_DOW_JST) return hour >= REVEAL_HOUR_JST;   // 水は13時以降
    return true;                                                   // 木・金・土
}

/**
 * 週間チャレンジの「今アクティブな種目キー」を返す。
 * - 3種目以下の週: 全種目。
 * - 4種目以上の週: 先頭3種目は常時アクティブ。4種目目以降(末尾)は水曜13:00 JST まで非公開。
 * @param {string[]} exercises - weeklyChallenge.exercises
 * @param {Date} [now=new Date()]
 * @returns {string[]}
 */
function getActiveWeeklyKeys(exercises, now = new Date()) {
    const list = Array.isArray(exercises) ? exercises : [];
    if (list.length <= 3) return list;
    return isRevealUnlockedJST(now) ? list : list.slice(0, 3);
}

// ====================================================================
// チャンプ予想（Feature 4）
// 締切: 火曜24:00 JST（=水曜0:00）。それまで自分の予想を提出/変更できる。
// データ: settings_free/weekly_predictions { weeks: { [weekStartMs]: { [uid]: predictedUid } } }
// ====================================================================

/**
 * 予想受付中か（週起点=日曜17:00 JST 〜 火曜24:00 JST）。
 * @param {Date} [now=new Date()]
 * @returns {boolean}
 */
function isPredictionOpenJST(now = new Date()) {
    const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const jst = new Date(now.getTime() + JST_OFFSET_MS);
    const dow = jst.getUTCDay(); // 0=日..6=土
    const hour = jst.getUTCHours();
    if (dow === 0) return hour >= 17; // 日曜17:00以降
    return dow === 1 || dow === 2;     // 月・火
}

/**
 * 予想ドキュメントの weeks マップを取得する。
 * @returns {Promise<Object>} { [weekStartMs]: { [uid]: predictedUid } }
 */
async function getWeeklyPredictionsMap() {
    try {
        const doc = await db.collection('settings_free').doc('weekly_predictions').get();
        if (doc.exists) return doc.data().weeks || {};
    } catch (e) {
        console.warn('[チャンプ予想] 取得失敗:', e);
    }
    return {};
}

/**
 * 自分の予想を保存（締切前のみ）。
 * @param {number} weekStartMs
 * @param {string} predictedUid
 * @returns {Promise<boolean>} 成功可否
 */
async function saveMyPrediction(weekStartMs, predictedUid) {
    if (!isPredictionOpenJST()) return false;
    if (!currentUser) return false;
    try {
        await db.collection('settings_free').doc('weekly_predictions').set({
            weeks: { [weekStartMs]: { [currentUser.uid]: predictedUid } }
        }, { merge: true });
        return true;
    } catch (e) {
        console.error('[チャンプ予想] 保存失敗:', e);
        return false;
    }
}

/**
 * 指定週の予想と的中者を集計する。
 * @param {number} weekStartMs
 * @param {string} champUserId
 * @returns {Promise<{predictions: Object, correctUserIds: string[]}>}
 */
async function computePredictionResults(weekStartMs, champUserId) {
    const weeks = await getWeeklyPredictionsMap();
    const predictions = weeks[weekStartMs] || {};
    const correctUserIds = Object.entries(predictions)
        .filter(([, predicted]) => predicted === champUserId)
        .map(([uid]) => uid);
    return { predictions, correctUserIds };
}

/**
 * 週間総合得点の集計。4種目以上のアクティブ時は「下位3つ採用（自分の最高%を1つ切り捨て）」。
 * 3種目以下は全件合計（従来と同一）。未実施種目は 0% として下位側に含まれる。
 * @param {number[]} scoreValues - アクティブ各種目の% 配列
 * @param {number} [keep=3] - 採用する下位件数
 * @returns {number}
 */
function sumAdoptedScores(scoreValues, keep = 3) {
    const vals = (scoreValues || []).map(v => (typeof v === 'number' && isFinite(v)) ? v : 0);
    if (vals.length <= keep) return vals.reduce((s, v) => s + v, 0);
    const asc = [...vals].sort((a, b) => a - b);
    return asc.slice(0, keep).reduce((s, v) => s + v, 0); // 下位 keep 件だけ採用
}

/**
 * 日時のJST平日インデックスを返す（月=0, 火=1, ..., 金=4）。土日は -1。
 * @param {Date} date
 * @returns {number}
 */
function weekdayIndexJST(date) {
    const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const dow = new Date(date.getTime() + JST_OFFSET_MS).getUTCDay(); // 0=日..6=土
    return (dow >= 1 && dow <= 5) ? dow - 1 : -1;
}

/**
 * 投稿した平日インデックス集合から「最長連続日数」を返す。
 * 例: {0,1,2,4} → 3（月火水の連続）。
 * @param {Set<number>|number[]} indices
 * @returns {number}
 */
function longestConsecutiveDays(indices) {
    const set = indices instanceof Set ? indices : new Set(indices || []);
    let best = 0;
    let run = 0;
    for (let i = 0; i <= 4; i++) {
        if (set.has(i)) { run += 1; best = Math.max(best, run); }
        else run = 0;
    }
    return best;
}

/**
 * ストリーク加点を算出。連続日数 × perDay を cap で頭打ち。
 * @param {number} streakDays
 * @param {{streakBonusPerDay?:number, streakBonusCap?:number}} cfg
 * @returns {number}
 */
function computeStreakBonus(streakDays, cfg = {}) {
    const perDay = cfg.streakBonusPerDay != null ? cfg.streakBonusPerDay : 3;
    const cap = cfg.streakBonusCap != null ? cfg.streakBonusCap : 15;
    return Math.min(streakDays * perDay, cap);
}

/**
 * 週間チャレンジの選出設定を取得
 * @returns {Promise<Object>} { weightExponent: number }
 */
async function getWeeklyConfig() {
    // 週間チャレンジ改革の各機能はここのデフォルトで OFF/従来動作にしておき、
    // Firestore の weekly_config で明示的に有効化する（段階リリース＆即ロールバック用）。
    const defaults = {
        weightExponent: 2,
        fairnessMode: 'two_stage', // 'two_stage'（作成者公平）| 'legacy'（旧・種目単位）
        normalCount: 2,
        barbarianCount: 1,
        exerciseCount: 4,          // 3=従来 / 4=水曜13時に4種目目追加・下位3採用（それまで？？？表示）
        enableStreak: false,       // 連続投稿ストリーク加点
        streakBonusPerDay: 3,      // 1連続日あたりの加点
        streakBonusCap: 15,        // ストリーク加点の上限
        enablePrediction: false,   // チャンプ予想
    };
    try {
        const doc = await db.collection('settings_free').doc('weekly_config').get();
        if (doc.exists) {
            return { ...defaults, ...doc.data() };
        }
    } catch (e) {
        console.warn('[週間チャレンジ] weekly_config取得失敗、デフォルト使用:', e);
    }
    return defaults;
}

/**
 * 加重ランダムで count 個の種目を選出（偏りを防ぐ）
 * 重み = 1 / (過去選出回数 + 1) ^ weightExponent
 * @param {string[]} allKeys - 全種目キー
 * @param {Object} history - { [key]: 選出回数 }
 * @param {number} count
 * @param {number} weightExponent - 重み指数（大きいほど再選出されにくい）
 * @param {Object} [exerciseRatings={}] - { [key]: {avgRating, ratingCount} } 種目評価集計
 * @param {Object} [creatorData={}] - { [userId]: {creatorAvgRating, creatorRatedExerciseCount} } 作成者データ
 * @returns {string[]}
 */
function selectWeeklyExercises(allKeys, history, count = 3, weightExponent = 2, exerciseRatings = {}, creatorData = {}) {
    if (allKeys.length <= count) return [...allKeys];

    const remaining = [...allKeys];
    const selected = [];

    for (let i = 0; i < count; i++) {
        // 重み = (1 / (過去選出回数 + 1)^e) × 種目評価係数 × 作成者評価係数
        const weights = remaining.map(key => {
            const base = 1 / Math.pow((history[key] || 0) + 1, weightExponent);
            const exRating = calcExerciseRatingModifier(exerciseRatings[key] || null);
            const ex = freeExercises[key];
            const creatorId = ex ? ex.createdBy : null;
            const crRating = calcCreatorRatingModifier(creatorId ? (creatorData[creatorId] || null) : null);
            return Math.max(base * exRating * crRating, 1e-9); // 完全ゼロ回避
        });
        const total = weights.reduce((s, w) => s + w, 0);

        let rand = Math.random() * total;
        for (let j = 0; j < remaining.length; j++) {
            rand -= weights[j];
            if (rand <= 0) {
                selected.push(remaining[j]);
                remaining.splice(j, 1);
                break;
            }
        }
    }

    return selected;
}

/**
 * 種目の作成者ID（擬似含む）を返す。createdBy が無いレガシー/復元種目は
 * key 自体を擬似作成者IDにして「単独作成者」として公平に参加させる。
 * @param {Object} allExercises
 * @param {string} key
 * @returns {string}
 */
function getExerciseCreatorId(allExercises, key) {
    const ex = allExercises && allExercises[key];
    return (ex && ex.createdBy) ? ex.createdBy : `__ex_${key}`;
}

/**
 * 選ばれた種目の作成者選出回数を+1した新しいマップを返す（非破壊）。
 * @param {Object} base - 既存 creatorSelectionHistory
 * @param {string[]} selectedKeys
 * @param {Object} allExercises
 * @returns {Object}
 */
function incrementCreatorHistory(base, selectedKeys, allExercises) {
    const next = { ...(base || {}) };
    (selectedKeys || []).forEach(key => {
        const cid = getExerciseCreatorId(allExercises, key);
        next[cid] = (next[cid] || 0) + 1;
    });
    return next;
}

/**
 * 重み配列から加重ランダムで1件のインデックスを返す（末尾フォールバック付き）。
 * @param {number[]} weights
 * @returns {number} index（weights が空なら -1）
 */
function weightedPickIndex(weights) {
    if (!weights.length) return -1;
    const total = weights.reduce((s, w) => s + w, 0);
    if (total <= 0) return weights.length - 1;
    let rand = Math.random() * total;
    for (let j = 0; j < weights.length; j++) {
        rand -= weights[j];
        if (rand <= 0) return j;
    }
    return weights.length - 1;
}

/**
 * 2段階抽選（作成者→種目）で count 個を選出。
 * Stage1: 作成者を「1/(作成者選出回数+1)^e × 作成者評価」で抽選（種目数は重みに入れない＝公平化の核）。
 * Stage2: その作成者の候補種目を「1/(種目選出回数+1)^e × 種目評価」で1つ抽選。
 * usedCreators に入っている作成者は候補から除外（同一作成者の重複回避）。候補が尽きたら緩和する。
 * @param {string[]} candidateKeys
 * @param {Object} allExercises
 * @param {Object} history - 種目選出回数
 * @param {Object} creatorHistory - 作成者選出回数
 * @param {number} count
 * @param {number} weightExponent
 * @param {Object} exerciseRatings
 * @param {Object} creatorData
 * @param {Set<string>} usedCreators - 破壊的に更新（選ばれた作成者を追加）
 * @returns {string[]}
 */
function selectExercisesTwoStage(candidateKeys, allExercises, history, creatorHistory, count, weightExponent, exerciseRatings, creatorData, usedCreators) {
    if (candidateKeys.length <= count) return [...candidateKeys];

    // 作成者ごとに種目をグルーピング
    const byCreator = {};
    candidateKeys.forEach(key => {
        const cid = getExerciseCreatorId(allExercises, key);
        (byCreator[cid] = byCreator[cid] || []).push(key);
    });

    const selected = [];
    for (let i = 0; i < count; i++) {
        // 未使用作成者の候補。尽きたら usedCreators を無視して緩和
        let creatorIds = Object.keys(byCreator).filter(cid => byCreator[cid].length > 0 && !usedCreators.has(cid));
        if (creatorIds.length === 0) {
            creatorIds = Object.keys(byCreator).filter(cid => byCreator[cid].length > 0);
        }
        if (creatorIds.length === 0) break;

        // Stage1: 作成者抽選
        const creatorWeights = creatorIds.map(cid => {
            const base = 1 / Math.pow((creatorHistory[cid] || 0) + 1, weightExponent);
            // 擬似作成者(__ex_*)は creatorData に無く 1.0 になる
            const crRating = calcCreatorRatingModifier(creatorData[cid] || null);
            return Math.max(base * crRating, 1e-9);
        });
        const cIdx = weightedPickIndex(creatorWeights);
        const creatorId = creatorIds[cIdx];

        // Stage2: その作成者の種目を抽選
        const keys = byCreator[creatorId];
        const keyWeights = keys.map(key => {
            const base = 1 / Math.pow((history[key] || 0) + 1, weightExponent);
            const exRating = calcExerciseRatingModifier(exerciseRatings[key] || null);
            return Math.max(base * exRating, 1e-9);
        });
        const kIdx = weightedPickIndex(keyWeights);
        const chosen = keys[kIdx];

        selected.push(chosen);
        usedCreators.add(creatorId);
        byCreator[creatorId] = keys.filter((_, idx) => idx !== kIdx); // 選んだ種目を除去
    }
    return selected;
}

/**
 * 週間チャレンジを「通常n種目 + バーバリアン1種目」で選出。
 * fairnessMode='two_stage'（既定）は作成者→種目の2段階抽選で作成者間の公平性を担保する。
 * 'legacy' は従来の種目単位加重ランダム。足りない枠は残りプールから補完する。
 * @param {Object} allExercises - freeExercises 全体
 * @param {Object} history - { [key]: 選出回数 }
 * @param {number} weightExponent - 重み指数
 * @param {Object} [exerciseRatings={}] - 種目評価集計
 * @param {Object} [creatorData={}] - 作成者データ
 * @param {Object} [options={}] - { fairnessMode, creatorHistory, normalCount, barbarianCount, revealCount }
 * @returns {string[]} 並び順は [基本normal..., barbarian, 水曜公開の追加normal...]（公開枠は末尾）
 */
function selectWeeklyExercisesWithBarbarianSlot(allExercises, history, weightExponent = 2, exerciseRatings = {}, creatorData = {}, options = {}) {
    const {
        fairnessMode = 'two_stage',
        creatorHistory = {},
        normalCount = 2,
        barbarianCount = 1,
        revealCount = 0, // 水曜13時に追加公開する normal 種目数（末尾に付与）。0=従来3種目
    } = options;
    const targetCount = normalCount + barbarianCount + revealCount;

    const allKeys = Object.keys(allExercises || {}).filter(key => !allExercises[key]?.excludeFromWeekly);
    if (allKeys.length === 0) return [];

    const normalKeys = allKeys.filter(key => !(allExercises[key] && allExercises[key].barbarian));
    const barbarianKeys = allKeys.filter(key => allExercises[key] && allExercises[key].barbarian);

    const usedCreators = new Set();
    const pickNormal = (pool, n) => fairnessMode === 'legacy'
        ? selectWeeklyExercises(pool, history, n, weightExponent, exerciseRatings, creatorData)
        : selectExercisesTwoStage(pool, allExercises, history, creatorHistory, n, weightExponent, exerciseRatings, creatorData, usedCreators);
    const pickBarbarian = (pool, n) => fairnessMode === 'legacy'
        ? selectWeeklyExercises(pool, history, n, weightExponent, exerciseRatings, creatorData)
        : selectExercisesTwoStage(pool, allExercises, history, creatorHistory, n, weightExponent, exerciseRatings, creatorData, usedCreators);

    // 基本枠: normal × normalCount + barbarian × barbarianCount
    const selectedNormal = pickNormal(normalKeys, normalCount);
    const selectedBarbarian = pickBarbarian(barbarianKeys, barbarianCount);

    // 順序を保持しつつ重複排除
    const ordered = [];
    const seen = new Set();
    const pushUnique = (k) => { if (k && !seen.has(k)) { seen.add(k); ordered.push(k); } };
    selectedNormal.forEach(pushUnique);
    selectedBarbarian.forEach(pushUnique);

    // 水曜公開枠: 未選出の normal から revealCount 個を選び「末尾」に付与
    if (revealCount > 0) {
        const remainingNormals = normalKeys.filter(key => !seen.has(key));
        const revealPicks = pickNormal(remainingNormals, revealCount);
        revealPicks.forEach(pushUnique);
    }

    // 総数不足時は残り全種目から補完（従来ロジック）。補完は末尾に足す
    if (ordered.length < targetCount) {
        const remainingKeys = allKeys.filter(key => !seen.has(key));
        const fallback = selectWeeklyExercises(remainingKeys, history, targetCount - ordered.length, weightExponent, exerciseRatings, creatorData);
        fallback.forEach(pushUnique);
    }

    return ordered;
}

/**
 * 進行中の週の種目数が config の exerciseCount に満たない場合、
 * 「既存種目は一切変えず」に不足ぶんの normal 種目を末尾へ追記する。
 * 追記ぶんは水曜13時まで ？？？ 表示になる 4種目目として機能する。
 * 途中で exerciseCount を 3→4 に切り替えても現在の週に反映させるための処理。
 * @param {Object} data - weekly_challenge ドキュメントのデータ（破壊的に更新される）
 * @returns {Promise<string[]>} 追記後の exercises 配列
 */
async function maybeUpgradeCurrentWeekExercises(data) {
    const existing = Array.isArray(data.exercises) ? data.exercises : [];
    try {
        if (existing.length === 0) return existing; // 種目未設定の週は対象外

        const cfg = await getWeeklyConfig();
        const target = cfg.exerciseCount || 3;
        if (existing.length >= target) return existing; // 既に足りている

        if (!freeExercisesLoaded) await loadFreeExercises();
        const need = target - existing.length;

        // 追記候補は「除外でない・バーバリアンでない・未選出」の normal 種目
        const normalPool = Object.keys(freeExercises).filter(k =>
            freeExercises[k] && !freeExercises[k].excludeFromWeekly &&
            !freeExercises[k].barbarian && !existing.includes(k));
        if (normalPool.length === 0) return existing; // 追記できる normal がない

        const weightExponent = cfg.weightExponent || 2;
        const history = data.selectionHistory || {};
        const creatorHistory = data.creatorSelectionHistory || {};
        const fairnessMode = cfg.fairnessMode || 'two_stage';

        let picks;
        if (fairnessMode === 'legacy') {
            picks = selectWeeklyExercises(normalPool, history, need, weightExponent);
        } else {
            // 既存3種目の作成者を除外シードにして、同一作成者の重複を避けつつ追記
            const usedCreators = new Set(existing.map(k => getExerciseCreatorId(freeExercises, k)));
            picks = selectExercisesTwoStage(normalPool, freeExercises, history, creatorHistory, need, weightExponent, {}, {}, usedCreators);
        }
        if (!picks || picks.length === 0) return existing;

        const newExercises = [...existing, ...picks]; // 既存を先頭のまま末尾へ追記
        const newHistory = { ...history };
        picks.forEach(k => { newHistory[k] = (newHistory[k] || 0) + 1; });
        const newCreatorHistory = incrementCreatorHistory(creatorHistory, picks, freeExercises);

        await db.collection('settings_free').doc('weekly_challenge').set({
            exercises: newExercises,
            selectionHistory: newHistory,
            creatorSelectionHistory: newCreatorHistory,
            upgradedToCountAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // ローカルの data / キャッシュへ反映
        data.exercises = newExercises;
        data.selectionHistory = newHistory;
        data.creatorSelectionHistory = newCreatorHistory;
        rankingCache.weekly = null; rankingCacheTime.weekly = null;
        scoreCache.weekly = null; scoreCacheTime.weekly = null;
        console.log('[週間チャレンジ] 既存週に種目を追記（既存は不変・水曜13時まで？？？）:', picks);
        return newExercises;
    } catch (e) {
        console.warn('[週間チャレンジ] 種目数アップグレード失敗（既存のまま継続）:', e);
        return existing;
    }
}

/**
 * 今週の週間チャレンジ設定を取得/更新する
 * - settings_free/weekly_challenge から読み込む
 * - 古ければ新しい3種目を選出してFirestoreに保存
 * @returns {Promise<Object>} weeklyChallenge
 */
async function getOrUpdateWeeklyChallenge() {
    const { start: weekStart, end: weekEnd } = getWeekBoundaries();
    // 夏休み休止週。種目を選出せず、選出履歴にも手を付けない
    const paused = isWeeklyPausedWeekStart(weekStart);
    const setPausedChallenge = (selectionHistory, creatorSelectionHistory) => {
        weeklyChallenge = {
            weekStart: weekStart,
            weekEnd: weekEnd,
            exercises: [],
            selectionHistory: selectionHistory || {},
            creatorSelectionHistory: creatorSelectionHistory || {},
            paused: true,
            pauseLabel: WEEKLY_PAUSE_LABEL
        };
        weeklyChallengeLoaded = true;
        return weeklyChallenge;
    };

    try {
        const doc = await db.collection('settings_free').doc('weekly_challenge').get();

        if (doc.exists) {
            const data = doc.data();
            const savedWeekStart = data.weekStart ? data.weekStart.toDate() : null;

            // 同じ週かどうか確認（1分の誤差許容）
            if (savedWeekStart && Math.abs(savedWeekStart.getTime() - weekStart.getTime()) < 60 * 1000) {
                if (paused) {
                    console.log('[週間チャレンジ] 夏休み休止週のため種目を選出しません');
                    return setPausedChallenge(data.selectionHistory, data.creatorSelectionHistory);
                }
                // exerciseCount を途中で増やした場合、既存種目を変えずに不足ぶんを追記
                const upgradedExercises = await maybeUpgradeCurrentWeekExercises(data);
                weeklyChallenge = {
                    weekStart,
                    weekEnd,
                    exercises: upgradedExercises,
                    selectionHistory: data.selectionHistory || {},
                    creatorSelectionHistory: data.creatorSelectionHistory || {},
                    isManualOverride: data.isManualOverride || false,
                    overrideLabel: data.overrideLabel || null
                };
                weeklyChallengeLoaded = true;
                console.log('[週間チャレンジ] 既存チャレンジを使用:', weeklyChallenge.exercises);
                return weeklyChallenge;
            }
        }

        // 新しい週: 種目を選出してFirestoreに保存
        // まず前の週のデータを履歴に保存し、チャンプを集計する
        if (doc.exists) {
            const prevData = doc.data();
            const prevWeekStart = prevData.weekStart ? prevData.weekStart.toDate() : null;
            if (prevWeekStart && prevData.exercises && prevData.exercises.length > 0) {
                const prevWeekEnd = prevData.weekEnd ? prevData.weekEnd.toDate() : null;
                if (prevWeekEnd) {
                    await saveWeeklyChallengeHistory({
                        weekStart: prevWeekStart,
                        weekEnd: prevWeekEnd,
                        exercises: prevData.exercises
                    });
                    await finalizeWeeklyChampion({
                        weekStart: prevWeekStart,
                        weekEnd: prevWeekEnd,
                        exercises: prevData.exercises
                    });
                }
            }
        }

        if (!freeExercisesLoaded) {
            await loadFreeExercises();
        }

        const existingHistory = (doc.exists && doc.data().selectionHistory) ? doc.data().selectionHistory : {};
        const existingCreatorHistory = (doc.exists && doc.data().creatorSelectionHistory) ? doc.data().creatorSelectionHistory : {};

        // 休止週: 前週の確定だけ済ませ、今週は種目を選出しない。
        // 選出履歴はそのまま持ち越すので、再開週の公平性に影響しない
        if (paused) {
            await db.collection('settings_free').doc('weekly_challenge').set({
                weekStart: firebase.firestore.Timestamp.fromDate(weekStart),
                weekEnd: firebase.firestore.Timestamp.fromDate(weekEnd),
                exercises: [],
                selectionHistory: existingHistory,
                creatorSelectionHistory: existingCreatorHistory,
                isManualOverride: false,
                overrideLabel: null,
                paused: true,
                pauseLabel: WEEKLY_PAUSE_LABEL,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            rankingCache.weekly = null;
            rankingCacheTime.weekly = null;
            scoreCache.weekly = null;
            scoreCacheTime.weekly = null;
            console.log('[週間チャレンジ] 夏休み休止週として保存しました');
            return setPausedChallenge(existingHistory, existingCreatorHistory);
        }

        // 手動上書き設定を確認（管理者が事前に来週の種目を指定している場合）
        const overrideDoc = await db.collection('settings_free').doc('weekly_override').get();
        if (overrideDoc.exists) {
            const overrideData = overrideDoc.data();

            // 無効化済み・空の override はスキップして自動選出へ
            if (overrideData.invalidated || !overrideData.exercises || overrideData.exercises.length === 0) {
                console.log('[週間チャレンジ] weekly_override は無効です。自動選出を実行します。');
                // fall through to auto-selection below

            // targetWeekStart が設定されている場合、現在の週と一致するか確認
            } else if (overrideData.targetWeekStart) {
                const targetDate = overrideData.targetWeekStart.toDate();
                if (Math.abs(targetDate.getTime() - weekStart.getTime()) >= 60 * 1000) {
                    // 対象週が現在の週と一致しない（期限切れ）→ 無効化して通常選出へ
                    console.warn('[週間チャレンジ] weekly_override の対象週が現在の週と一致しないため無視します。対象週:', targetDate, '現在の週:', weekStart);
                    await db.collection('settings_free').doc('weekly_override').set({ invalidated: true });
                    // fall through to auto-selection below
                } else {
                    // 対象週が一致 → オーバーライドを適用
                    const selectedExercises = overrideData.exercises || [];
                    const newHistory = { ...existingHistory };
                    selectedExercises.forEach(key => { newHistory[key] = (newHistory[key] || 0) + 1; });
                    const newCreatorHistory = incrementCreatorHistory(existingCreatorHistory, selectedExercises, freeExercises);
                    await db.collection('settings_free').doc('weekly_challenge').set({
                        weekStart: firebase.firestore.Timestamp.fromDate(weekStart),
                        weekEnd: firebase.firestore.Timestamp.fromDate(weekEnd),
                        exercises: selectedExercises,
                        selectionHistory: newHistory,
                        creatorSelectionHistory: newCreatorHistory,
                        isManualOverride: true,
                        overrideLabel: overrideData.label || '特別イベント',
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    await db.collection('settings_free').doc('weekly_override').set({ invalidated: true });
                    weeklyChallenge = {
                        weekStart, weekEnd,
                        exercises: selectedExercises,
                        selectionHistory: newHistory,
                        creatorSelectionHistory: newCreatorHistory,
                        isManualOverride: true,
                        overrideLabel: overrideData.label || '特別イベント'
                    };
                    weeklyChallengeLoaded = true;
                    rankingCache.weekly = null;
                    rankingCacheTime.weekly = null;
                    scoreCache.weekly = null;
                    scoreCacheTime.weekly = null;
                    console.log('[週間チャレンジ] 手動上書き設定を使用:', selectedExercises);
                    return weeklyChallenge;
                }
            } else {
                // targetWeekStart なし（旧形式）→ 後方互換のためそのまま適用
                const selectedExercises = overrideData.exercises || [];
                const newHistory = { ...existingHistory };
                selectedExercises.forEach(key => { newHistory[key] = (newHistory[key] || 0) + 1; });
                const newCreatorHistory = incrementCreatorHistory(existingCreatorHistory, selectedExercises, freeExercises);
                await db.collection('settings_free').doc('weekly_challenge').set({
                    weekStart: firebase.firestore.Timestamp.fromDate(weekStart),
                    weekEnd: firebase.firestore.Timestamp.fromDate(weekEnd),
                    exercises: selectedExercises,
                    selectionHistory: newHistory,
                    creatorSelectionHistory: newCreatorHistory,
                    isManualOverride: true,
                    overrideLabel: overrideData.label || '特別イベント',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                await db.collection('settings_free').doc('weekly_override').set({ invalidated: true });
                weeklyChallenge = {
                    weekStart, weekEnd,
                    exercises: selectedExercises,
                    selectionHistory: newHistory,
                    creatorSelectionHistory: newCreatorHistory,
                    isManualOverride: true,
                    overrideLabel: overrideData.label || '特別イベント'
                };
                weeklyChallengeLoaded = true;
                rankingCache.weekly = null;
                rankingCacheTime.weekly = null;
                scoreCache.weekly = null;
                scoreCacheTime.weekly = null;
                console.log('[週間チャレンジ] 手動上書き設定を使用（旧形式）:', selectedExercises);
                return weeklyChallenge;
            }
        }

        // 週間チャレンジ設定（重み指数）を取得
        const weeklyConfig = await getWeeklyConfig();
        const weightExponent = weeklyConfig.weightExponent || 2;

        // 評価データを取得（種目評価 + 作成者評価）
        const allKeys = Object.keys(freeExercises || {});
        const exerciseRatings = await getExerciseRatingSummaries(allKeys);
        const creatorUserIds = [...new Set(allKeys.map(k => freeExercises[k]?.createdBy).filter(Boolean))];
        const creatorDataMap = {};
        if (creatorUserIds.length > 0) {
            await Promise.all(creatorUserIds.map(async uid => {
                try {
                    const uDoc = await db.collection('users').doc(uid).get();
                    if (uDoc.exists) creatorDataMap[uid] = uDoc.data();
                } catch (e) { /* 取得失敗は無視 */ }
            }));
        }

        const selectedExercises = selectWeeklyExercisesWithBarbarianSlot(
            freeExercises,
            existingHistory,
            weightExponent,
            exerciseRatings,
            creatorDataMap,
            {
                fairnessMode: weeklyConfig.fairnessMode || 'two_stage',
                creatorHistory: existingCreatorHistory,
                normalCount: weeklyConfig.normalCount || 2,
                barbarianCount: weeklyConfig.barbarianCount || 1,
                // exerciseCount>=4 で水曜公開の追加normalを1枠付与（末尾）
                revealCount: Math.max(0, (weeklyConfig.exerciseCount || 3) - 3),
            }
        );

        // 選出履歴を更新（種目単位 + 作成者単位）
        const newHistory = { ...existingHistory };
        selectedExercises.forEach(key => {
            newHistory[key] = (newHistory[key] || 0) + 1;
        });
        const newCreatorHistory = incrementCreatorHistory(existingCreatorHistory, selectedExercises, freeExercises);

        await db.collection('settings_free').doc('weekly_challenge').set({
            weekStart: firebase.firestore.Timestamp.fromDate(weekStart),
            weekEnd: firebase.firestore.Timestamp.fromDate(weekEnd),
            exercises: selectedExercises,
            selectionHistory: newHistory,
            creatorSelectionHistory: newCreatorHistory,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        weeklyChallenge = {
            weekStart,
            weekEnd,
            exercises: selectedExercises,
            selectionHistory: newHistory,
            creatorSelectionHistory: newCreatorHistory
        };
        weeklyChallengeLoaded = true;

        // 週が変わったのでキャッシュをクリア
        rankingCache.weekly = null;
        rankingCacheTime.weekly = null;
        scoreCache.weekly = null;
        scoreCacheTime.weekly = null;

        console.log('[週間チャレンジ] 新しいチャレンジを設定:', selectedExercises);
        return weeklyChallenge;

    } catch (error) {
        console.error('[週間チャレンジ] チャレンジの取得/更新に失敗:', error);
        weeklyChallenge = { weekStart, weekEnd, exercises: [], selectionHistory: {} };
        weeklyChallengeLoaded = true;
        return weeklyChallenge;
    }
}

/**
 * 今週の3種目を { key: { name, rule } } 形式で返す
 * @returns {Object}
 */
function getWeeklyExercisesObject() {
    if (!weeklyChallenge || weeklyChallenge.exercises.length === 0) return {};
    const result = {};
    weeklyChallenge.exercises.forEach(key => {
        if (freeExercises[key]) {
            result[key] = freeExercises[key];
        }
    });
    return result;
}

/**
 * 今週の3種目の名前マッピングを返す { key: name }
 * @returns {Object}
 */
function getWeeklyExerciseNames() {
    const obj = getWeeklyExercisesObject();
    const names = {};
    Object.entries(obj).forEach(([key, ex]) => { names[key] = ex.name; });
    return names;
}

/**
 * 週間チャレンジ情報を #weekly-challenge-info に表示
 */
function renderWeeklyChallengeInfo() {
    const infoEl = document.getElementById('weekly-challenge-info');
    if (!infoEl) return;

    // 夏休み休止週。種目が無いのは「未登録」ではないので別表示にする
    if (weeklyChallenge && weeklyChallenge.paused) {
        const JST_OFFSET = 9 * 60 * 60 * 1000;
        const pauseWeekStartJST = new Date(weeklyChallenge.weekStart.getTime() + JST_OFFSET);
        const pauseMon = new Date(pauseWeekStartJST.getTime() + 1 * 24 * 60 * 60 * 1000);
        const pauseFri = new Date(pauseWeekStartJST.getTime() + 5 * 24 * 60 * 60 * 1000);
        const dayNamesJa = ['日','月','火','水','木','金','土'];
        const fmtJa = (d) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${dayNamesJa[d.getUTCDay()]})`;
        infoEl.style.display = 'block';
        infoEl.className = 'weekly-challenge-info weekly-paused-info';
        infoEl.innerHTML = `
            <h3><i class="fa-solid fa-umbrella-beach"></i> ${escapeHtml(weeklyChallenge.pauseLabel || WEEKLY_PAUSE_LABEL)}</h3>
            <div class="weekly-challenge-period"><i class="fa-solid fa-calendar"></i> ${fmtJa(pauseMon)} 〜 ${fmtJa(pauseFri)}</div>
            <p class="weekly-paused-note">${escapeHtml(WEEKLY_PAUSE_NOTE)}${escapeHtml(WEEKLY_PAUSE_RESUME_NOTE)}</p>
            <p class="weekly-paused-raid"><i class="fa-solid fa-dragon"></i> この期間は${escapeHtml(RAID_MODE_LABEL)}「${escapeHtml(RAID_TITLE)}」を開催中。デイリーミッションタブから参戦できます。</p>
        `;
        return;
    }

    if (!weeklyChallenge || weeklyChallenge.exercises.length === 0) {
        infoEl.style.display = 'block';
        infoEl.className = 'weekly-challenge-info';
        infoEl.innerHTML = '<p class="weekly-no-challenge">フリーモードに種目が登録されていません。まずフリーモードで種目を追加してください。</p>';
        return;
    }

    const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const weekStartJST = new Date(weeklyChallenge.weekStart.getTime() + JST_OFFSET_MS);

    // 第◯週の計算（その年の1/1から数えて何週目か）
    const monJST = new Date(weekStartJST.getTime() + 1 * 24 * 60 * 60 * 1000);
    const yearStart = new Date(Date.UTC(monJST.getUTCFullYear(), 0, 1));
    const diffMs = monJST.getTime() - yearStart.getTime();
    const weekNumber = Math.ceil((diffMs / (24 * 60 * 60 * 1000) + 1) / 7);

    // 月曜〜金曜の日付範囲を表示
    const friJST = new Date(weekStartJST.getTime() + 5 * 24 * 60 * 60 * 1000);

    const dayNames = ['日','月','火','水','木','金','土'];
    const formatDate = (d) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${dayNames[d.getUTCDay()]})`;

    const activeKeys = getActiveWeeklyKeys(weeklyChallenge.exercises);
    const hiddenCount = weeklyChallenge.exercises.length - activeKeys.length;

    // 4枠すべて表示。未解禁（水曜公開枠）は種目名を ？？？ でマスク表示。
    const exercisesHtml = weeklyChallenge.exercises.map(key => {
        const isHidden = !activeKeys.includes(key);
        if (isHidden) {
            return `<div class="weekly-challenge-exercise-item weekly-reveal-teaser">🔒 ？？？<span class="reveal-note">水曜13時解禁</span></div>`;
        }
        const ex = freeExercises[key];
        if (!ex) return '';
        return `<div class="weekly-challenge-exercise-item">🏋️ ${escapeHtml(ex.name)}</div>`;
    }).join('');

    // 未解禁枠がある場合の補足
    const teaserHtml = hiddenCount > 0
        ? `<div class="weekly-reveal-hint">水曜13時に ？？？ が解禁！ 得点は4種目中の下位3種目の合計で競います。</div>`
        : '';

    const nextWeekEndJST = new Date(weeklyChallenge.weekEnd.getTime() + JST_OFFSET_MS);

    const overrideBadge = weeklyChallenge.isManualOverride
        ? `<span class="barbarian-badge" style="background:linear-gradient(135deg,#667eea,#764ba2);margin-left:6px"><i class="fa-solid fa-star"></i> ${escapeHtml(weeklyChallenge.overrideLabel || '特別イベント')}</span>`
        : '';

    infoEl.style.display = 'block';
    infoEl.className = 'weekly-challenge-info';
    infoEl.innerHTML = `
        <h3><i class="fa-solid fa-trophy"></i> 今週のチャレンジ${overrideBadge}</h3>
        <div class="weekly-challenge-period"><i class="fa-solid fa-calendar"></i> 第${weekNumber}週：${formatDate(monJST)} 〜 ${formatDate(friJST)}</div>
        <div class="weekly-challenge-exercises">${exercisesHtml}${teaserHtml}</div>
        <div class="weekly-challenge-next">次回発表: ${formatDate(nextWeekEndJST)} 17:00</div>
    `;
}

/**
 * チャンプ予想ウィジェットを #weekly-challenge-info の直後に描画（Feature 4）。
 * enablePrediction が有効なときのみ表示。締切（火曜24:00 JST）前は選択・提出可、以降はロック表示。
 */
async function renderPredictionWidget() {
    if (currentMode !== 'weekly') return;
    const info = document.getElementById('weekly-challenge-info');
    if (!info || !weeklyChallenge || !currentUser) return;

    let container = document.getElementById('weekly-prediction-widget');

    // 休止週はチャンプが出ないので予想も受け付けない
    const cfg = await getWeeklyConfig();
    if (weeklyChallenge.paused || !cfg.enablePrediction) {
        if (container) container.remove();
        return;
    }

    if (!container) {
        container = document.createElement('div');
        container.id = 'weekly-prediction-widget';
        container.className = 'weekly-prediction-widget';
        info.parentNode.insertBefore(container, info.nextSibling);
    }

    const weekStartMs = weeklyChallenge.weekStart.getTime();
    const [weeks, usersMap] = await Promise.all([getWeeklyPredictionsMap(), getUsersMap()]);
    const myPred = (weeks[weekStartMs] && weeks[weekStartMs][currentUser.uid]) || '';
    const open = isPredictionOpenJST();

    // 候補ユーザー（自分含む全員）
    const userEntries = Object.entries(usersMap)
        .map(([uid, u]) => ({ uid, name: u.userName || u.email || 'Unknown' }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    if (open) {
        const options = ['<option value="">-- 優勝者を予想 --</option>']
            .concat(userEntries.map(u => `<option value="${escapeHtml(u.uid)}" ${u.uid === myPred ? 'selected' : ''}>${escapeHtml(u.name)}</option>`))
            .join('');
        container.innerHTML = `
            <div class="prediction-title"><i class="fa-solid fa-crystal-ball"></i> 今週のチャンプ予想 <span class="prediction-deadline">〜火曜締切</span></div>
            <div class="prediction-controls">
                <select id="prediction-select" class="prediction-select">${options}</select>
                <button id="prediction-submit" class="prediction-submit">予想を保存</button>
            </div>
            <div id="prediction-status" class="prediction-status">${myPred ? '現在の予想: ' + escapeHtml((usersMap[myPred] && (usersMap[myPred].userName || usersMap[myPred].email)) || myPred) : '未提出'}</div>
        `;
        const submitBtn = container.querySelector('#prediction-submit');
        submitBtn.addEventListener('click', async () => {
            const sel = container.querySelector('#prediction-select');
            const val = sel.value;
            const statusEl = container.querySelector('#prediction-status');
            if (!val) { statusEl.textContent = '予想する相手を選んでください'; return; }
            submitBtn.disabled = true;
            const ok = await saveMyPrediction(weekStartMs, val);
            submitBtn.disabled = false;
            statusEl.textContent = ok
                ? '予想を保存しました: ' + ((usersMap[val] && (usersMap[val].userName || usersMap[val].email)) || val)
                : '保存に失敗しました（締切を過ぎている可能性があります）';
        });
    } else {
        // 締切後: 自分の予想と、全員の予想を読み取り専用で表示
        const weekPreds = weeks[weekStartMs] || {};
        const listHtml = userEntries
            .filter(u => weekPreds[u.uid])
            .map(u => {
                const predName = (usersMap[weekPreds[u.uid]] && (usersMap[weekPreds[u.uid]].userName || usersMap[weekPreds[u.uid]].email)) || weekPreds[u.uid];
                return `<li>${escapeHtml(u.name)} → <strong>${escapeHtml(predName)}</strong></li>`;
            }).join('');
        container.innerHTML = `
            <div class="prediction-title"><i class="fa-solid fa-lock"></i> チャンプ予想（締切済み）</div>
            <div class="prediction-status">${myPred ? 'あなたの予想: ' + escapeHtml((usersMap[myPred] && (usersMap[myPred].userName || usersMap[myPred].email)) || myPred) : 'あなたは未提出でした'}</div>
            ${listHtml ? `<ul class="prediction-list">${listHtml}</ul>` : ''}
        `;
    }
}

// 週間ランキングの前回値をローカル保存するキー（週が変わったら破棄）
const WEEKLY_RANKING_LS_KEY = 'growrep_weekly_ranking_v1';

/**
 * 週間ランキング集計結果をlocalStorageへ保存（次回起動時の先行表示用）
 * @param {Date} weekStart
 * @param {Object} rankings
 */
function saveWeeklyRankingToLocal(weekStart, rankings) {
    try {
        localStorage.setItem(WEEKLY_RANKING_LS_KEY, JSON.stringify({
            weekStartMs: weekStart.getTime(),
            rankings
        }));
    } catch (e) {
        // 容量超過やプライベートモード等は無視（先行表示は任意機能のため）
    }
}

/**
 * localStorageから今週分の週間ランキングを取得（週が異なれば無効）
 * @param {Date} weekStart
 * @returns {Object|null}
 */
function loadWeeklyRankingFromLocal(weekStart) {
    try {
        const raw = localStorage.getItem(WEEKLY_RANKING_LS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.weekStartMs !== weekStart.getTime()) return null;
        return parsed.rankings || null;
    } catch (e) {
        return null;
    }
}

/**
 * 週間チャレンジ: ランキング読み込み
 * @param {boolean} forceRefresh
 */
async function loadWeeklyRanking(forceRefresh = false) {
    const now = Date.now();

    if (!weeklyChallengeLoaded) {
        await getOrUpdateWeeklyChallenge();
    }

    if (weeklyChallenge && weeklyChallenge.paused) {
        rankingList.innerHTML = `<p class="weekly-paused-inline"><i class="fa-solid fa-umbrella-beach"></i> ${escapeHtml(WEEKLY_PAUSE_NOTE)}${escapeHtml(WEEKLY_PAUSE_RESUME_NOTE)}</p>`;
        renderWeeklyChallengeInfo();
        return;
    }

    if (!weeklyChallenge || weeklyChallenge.exercises.length === 0) {
        rankingList.innerHTML = '<p class="weekly-no-challenge">フリーモードに種目がまだ登録されていません。</p>';
        renderWeeklyChallengeInfo();
        return;
    }

    const { weekStart, weekEnd } = weeklyChallenge;
    // 水曜公開枠は解禁までランキングに出さない
    const exercises = getActiveWeeklyKeys(weeklyChallenge.exercises);

    // メモリキャッシュが有効ならそれを使用
    if (!forceRefresh && rankingCache.weekly && rankingCacheTime.weekly && (now - rankingCacheTime.weekly < CACHE_DURATION)) {
        console.log('[週間チャレンジ] ランキングキャッシュを使用');
        renderWeeklyChallengeInfo();
        renderRanking(rankingCache.weekly);
        return;
    }

    // stale-while-revalidate: 前回保存値があれば先に即描画し、通信待ちの空白を防ぐ
    if (!forceRefresh) {
        const stale = loadWeeklyRankingFromLocal(weekStart);
        if (stale) {
            console.log('[週間チャレンジ] 前回値を先行表示（裏で最新を取得）');
            renderWeeklyChallengeInfo();
            renderRanking(stale);
        }
    }

    try {
        // 今週分のみ取得（全期間スキャンを回避）。種目・平日の絞り込みはクライアント側で実施。
        const snapshot = await db.collection('posts_free')
            .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(weekStart))
            .where('timestamp', '<', firebase.firestore.Timestamp.fromDate(weekEnd))
            .get();
        countReads(snapshot.size);

        const rankings = {};
        exercises.forEach(key => { rankings[key] = {}; });

        snapshot.forEach(doc => {
            const post = doc.data();
            if (!post.timestamp) return;

            const postDate = post.timestamp.toDate();

            // 今週範囲内か
            if (postDate < weekStart || postDate >= weekEnd) return;

            // 平日（月〜金 JST）か
            if (!isWeekdayJST(postDate)) return;

            // 今週の3種目か
            if (!exercises.includes(post.exerciseType)) return;

            const { userId, exerciseType, value } = post;
            if (!rankings[exerciseType]) rankings[exerciseType] = {};

            // バーバリアン方式の場合は最小値をベストとする
            const isBarbarian = freeExercises[exerciseType] && freeExercises[exerciseType].barbarian;
            if (isBarbarian) {
                if (!rankings[exerciseType][userId] || rankings[exerciseType][userId].value > value) {
                    rankings[exerciseType][userId] = {
                        value,
                        userId,
                        email: post.userEmail
                    };
                }
            } else {
                if (!rankings[exerciseType][userId] || rankings[exerciseType][userId].value < value) {
                    rankings[exerciseType][userId] = {
                        value,
                        userId,
                        email: post.userEmail
                    };
                }
            }
        });

        rankingCache.weekly = rankings;
        rankingCacheTime.weekly = now;
        saveWeeklyRankingToLocal(weekStart, rankings);

        console.log('[週間チャレンジ] ランキング集計完了');
        renderWeeklyChallengeInfo();
        await renderRanking(rankings);

    } catch (error) {
        console.error('[週間チャレンジ] ランキング読み込みエラー:', error);
        rankingList.innerHTML = '<p style="text-align:center; color:#e74c3c;">ランキングの読み込みに失敗しました</p>';
    }
}

/**
 * 週間チャレンジ: 全ユーザーのスコア計算
 * フリーモードと同構造だが今週・平日・3種目フィルタあり
 */
async function getAllUsersScoresWeekly(forceRefresh = false) {
    try {
        const now = Date.now();

        if (!forceRefresh && scoreCache.weekly && scoreCacheTime.weekly && (now - scoreCacheTime.weekly < CACHE_DURATION)) {
            return scoreCache.weekly;
        }

        if (!weeklyChallengeLoaded) {
            await getOrUpdateWeeklyChallenge();
        }

        if (!freeExercisesLoaded) {
            await loadFreeExercises();
        }

        const { weekStart, weekEnd, exercises } = weeklyChallenge;
        // 水曜公開枠を考慮したアクティブ種目のみを集計対象にする（解禁前は先頭3種目）
        const exerciseKeys = getActiveWeeklyKeys(exercises).filter(k => freeExercises[k]);

        // posts（今週分のみ）と users・設定を並列取得（直列ウォーターフォール＋全期間スキャンを解消）
        const [postsSnapshot, usersMap, weeklyConfig] = await Promise.all([
            db.collection('posts_free')
                .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(weekStart))
                .where('timestamp', '<', firebase.firestore.Timestamp.fromDate(weekEnd))
                .get(),
            getUsersMap(),
            getWeeklyConfig()
        ]);
        countReads(postsSnapshot.size);

        const usersData = {};
        Object.keys(usersMap).forEach(uid => {
            const data = usersMap[uid];
            usersData[uid] = data.userName || data.email;
        });

        const userRecords = {};

        postsSnapshot.forEach(doc => {
            const post = doc.data();
            if (!post.timestamp) return;

            const postDate = post.timestamp.toDate();

            // 今週の平日かつ今週の3種目のみ
            if (postDate < weekStart || postDate >= weekEnd) return;
            if (!isWeekdayJST(postDate)) return;
            if (!exerciseKeys.includes(post.exerciseType)) return;

            const { userId, exerciseType, value } = post;

            if (!userRecords[userId]) {
                userRecords[userId] = {
                    userName: usersData[userId] || 'Unknown',
                    exercises: {},
                    scores: {},
                    totalScore: 0,
                    postedDays: new Set() // ストリーク算出用の平日インデックス
                };
            }

            // ストリーク用: 投稿した平日インデックスを記録
            const dIdx = weekdayIndexJST(postDate);
            if (dIdx >= 0) userRecords[userId].postedDays.add(dIdx);

            // バーバリアン方式: 最小値をベストとする、通常: 最大値をベストとする
            const isBarbarian = freeExercises[exerciseType] && freeExercises[exerciseType].barbarian;
            if (isBarbarian) {
                if (userRecords[userId].exercises[exerciseType] === undefined ||
                    userRecords[userId].exercises[exerciseType] > value) {
                    userRecords[userId].exercises[exerciseType] = value;
                }
            } else {
                if (!userRecords[userId].exercises[exerciseType] ||
                    userRecords[userId].exercises[exerciseType] < value) {
                    userRecords[userId].exercises[exerciseType] = value;
                }
            }
        });

        // %計算（通常: 最高得点を100%、バーバリアン: 最短タイムを100%）
        exerciseKeys.forEach(exercise => {
            const isBarbarian = freeExercises[exercise] && freeExercises[exercise].barbarian;

            if (isBarbarian) {
                // バーバリアン方式: bestTime / selfTime * 100
                let minVal = Infinity;
                Object.values(userRecords).forEach(user => {
                    const val = user.exercises[exercise];
                    if (val !== undefined && val > 0 && val < minVal) minVal = val;
                });

                Object.values(userRecords).forEach(user => {
                    const val = user.exercises[exercise];
                    const pct = (val !== undefined && val > 0 && minVal !== Infinity) ? (minVal / val) * 100 : 0;
                    user.scores[exercise] = pct;
                });
            } else {
                // 通常方式: selfValue / maxValue * 100
                let maxVal = 0;
                Object.values(userRecords).forEach(user => {
                    const val = user.exercises[exercise] || 0;
                    if (val > maxVal) maxVal = val;
                });

                Object.values(userRecords).forEach(user => {
                    const val = user.exercises[exercise] || 0;
                    const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                    user.scores[exercise] = pct;
                });
            }
        });

        // 総合得点を集計（4種目以上のアクティブ時は下位3つ採用＝自分の最高%を1つ切り捨て）
        // ストリーク加点が有効なら連続投稿日数に応じたボーナスを分離集計し、合計に加える
        const streakEnabled = !!weeklyConfig.enableStreak;
        Object.values(userRecords).forEach(user => {
            const baseTotal = sumAdoptedScores(exerciseKeys.map(k => user.scores[k] || 0));
            user.streakDays = longestConsecutiveDays(user.postedDays);
            user.streakBonus = streakEnabled ? computeStreakBonus(user.streakDays, weeklyConfig) : 0;
            user.totalScore = baseTotal + user.streakBonus;
        });

        scoreCache.weekly = userRecords;
        scoreCacheTime.weekly = now;

        return userRecords;

    } catch (error) {
        console.error('[週間チャレンジ] スコア計算エラー:', error);
        return {};
    }
}

/**
 * 週間チャレンジ: 得点タブのユーザーチェックボックスを表示
 */
async function loadWeeklyUserCheckboxes(forceRefresh = false) {
    try {
        setWeeklySimulatorControlsVisible(true);
        const usersScores = await getAllUsersScoresWeekly(forceRefresh);
        const exerciseKeys = weeklyChallenge ? getActiveWeeklyKeys(weeklyChallenge.exercises).filter(k => freeExercises[k]) : [];
        weeklySimulatorBaseScores = usersScores;
        weeklySimulatorExerciseKeys = exerciseKeys;

        let html = '';
        Object.keys(usersScores).forEach(userId => {
            const user = usersScores[userId];
            const isCurrentUser = userId === currentUser.uid;
            const checked = isCurrentUser ? 'checked' : '';
            html += `
                <label class="user-checkbox">
                    <input type="checkbox" value="${userId}" ${checked}>
                    <span>${escapeHtml(user.userName)}</span>
                </label>
            `;
        });

        userCheckboxes.innerHTML = html;

        userCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const selectedIds = Array.from(
                    userCheckboxes.querySelectorAll('input[type="checkbox"]:checked')
                ).map(cb => cb.value);
                loadWeeklyScoreChart(selectedIds, exerciseKeys, usersScores);
            });
        });

        loadWeeklyScoreChart([currentUser.uid], exerciseKeys, usersScores);

    } catch (error) {
        console.error('[週間チャレンジ] チェックボックスエラー:', error);
        scoreError.textContent = 'ユーザーリストの取得に失敗しました';
    }
}

/**
 * 週間チャレンジ: レーダーチャートと総合得点を描画
 */
async function loadWeeklyScoreChart(selectedUserIds, exerciseKeys, usersScores) {
    if (!usersScores) {
        usersScores = await getAllUsersScoresWeekly(false);
    }
    if (!exerciseKeys) {
        exerciseKeys = weeklyChallenge ? getActiveWeeklyKeys(weeklyChallenge.exercises).filter(k => freeExercises[k]) : [];
    }
    weeklySimulatorBaseScores = usersScores;
    weeklySimulatorExerciseKeys = exerciseKeys;

    try {
        scoreError.textContent = '';

        if (selectedUserIds.length === 0) {
            selectedUserIds = Object.keys(usersScores);
        }

        if (exerciseKeys.length === 0) {
            scoreError.textContent = '今週のチャレンジ種目がまだ設定されていません';
            if (myScoreChart) { myScoreChart.destroy(); myScoreChart = null; }
            return;
        }

        // 総合得点ランキングを先に描画する。
        // Chart.js の読み込み/描画に依存させないことで、通信が悪くても得点は即表示される。
        displayFreeScores(usersScores, exerciseKeys);

        const circledNumbers = exerciseKeys.map((_, i) => {
            const nums = ['①','②','③'];
            return i < nums.length ? nums[i] : `(${i + 1})`;
        });

        const allUserIds = Object.keys(usersScores).sort();
        const getUserColorIndex = (userId) => {
            const index = allUserIds.indexOf(userId);
            return index >= 0 ? index : 0;
        };

        const colors = [
            'rgba(247, 151, 30, 0.6)',
            'rgba(237, 100, 166, 0.6)',
            'rgba(102, 126, 234, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(153, 102, 255, 0.6)',
            'rgba(255, 205, 86, 0.6)'
        ];
        const borderColors = [
            'rgb(247, 151, 30)',
            'rgb(237, 100, 166)',
            'rgb(102, 126, 234)',
            'rgb(75, 192, 192)',
            'rgb(153, 102, 255)',
            'rgb(255, 205, 86)'
        ];

        const datasets = selectedUserIds.map(userId => {
            const user = usersScores[userId];
            if (!user) return null;
            const colorIndex = getUserColorIndex(userId) % colors.length;
            const data = exerciseKeys.map(key => user.scores[key] || 0);
            return {
                label: user.userName,
                data,
                backgroundColor: colors[colorIndex],
                borderColor: borderColors[colorIndex],
                borderWidth: 2,
                pointBackgroundColor: borderColors[colorIndex],
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: borderColors[colorIndex]
            };
        }).filter(d => d !== null);

        // Chart.js を遅延ロード（初回のみ取得）
        await ensureChartJs();

        if (myScoreChart) { myScoreChart.destroy(); }

        const ctx = scoreChart.getContext('2d');
        myScoreChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: circledNumbers,
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 10, bottom: 10, left: 20, right: 20 } },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { display: false },
                        grid: { color: 'rgba(0,0,0,0.1)' },
                        pointLabels: { font: { size: 16 } }
                    }
                },
                plugins: {
                    legend: { position: 'top' }
                }
            }
        });

        // 凡例注釈（種目番号↔名前の対応）
        let annotationContainer = document.querySelector('.chart-legend-annotations');
        if (!annotationContainer) {
            annotationContainer = document.createElement('div');
            annotationContainer.className = 'chart-legend-annotations';
            const chartContainer = scoreChart.closest('.score-chart-container');
            chartContainer.parentNode.insertBefore(annotationContainer, chartContainer.nextSibling);
        }
        annotationContainer.innerHTML = exerciseKeys.map((key, i) => {
            const ex = freeExercises[key];
            if (!ex) return '';
            return `<span class="legend-annotation-item">${circledNumbers[i]} ${escapeHtml(ex.name)}</span>`;
        }).join('');

    } catch (error) {
        console.error('[週間チャレンジ] チャートエラー:', error);
        // 得点の数値ランキングは既に表示済み。チャートのみ失敗した旨を伝える
        scoreError.textContent = '得点グラフの描画に失敗しました（通信状態をご確認ください）';
    }
}

/**
 * 週間チャレンジモード入場時のUI初期化
 */
async function initWeeklyMode() {
    // まずローカルキャッシュから今週の3種目を即描画（通信不良でも“まず出る”）
    prepaintWeeklyFromCache();

    if (!freeExercisesLoaded) {
        await loadFreeExercises();
    }
    await getOrUpdateWeeklyChallenge();
    saveWeeklyChallengeCache();  // 次回の楽観描画用にローカル保存
    // 投稿タブのロック判定にデイリーミッションのクリア状況が要るので先に解決する。
    // 失敗しても未取得のまま進める（＝ロックしない）ので投稿を止めてしまうことはない。
    if (!dailyMissionState) {
        try {
            await loadDailyMissionState();
        } catch (e) {
            console.warn('[週間チャレンジ] デイリーミッションの状態取得に失敗（ロック判定はスキップ）:', e);
        }
    }
    updateWeeklyPostDropdown();
    updateWeeklyRulesTab();
    updateWeeklyGraphDropdown();
    renderWeeklyChallengeInfo();
    renderPredictionWidget().catch(() => { /* 予想UIは任意機能。失敗しても本体に影響させない */ });

    // 現在の週の履歴を保存（チャンプ集計用）
    if (weeklyChallenge && weeklyChallenge.exercises.length > 0) {
        saveWeeklyChallengeHistory(weeklyChallenge);
    }

    // 過去週の詳細データをセッション中1回だけバックフィル
    // 重い全期間集計のため、ここでawaitすると3種目表示・ランキング表示がブロックされる。
    // 表示に必須ではないので、ブロックせず後追い（非同期）で実行する。
    if (!weeklyChampionBackfillDoneInSession) {
        weeklyChampionBackfillDoneInSession = true;
        checkAndFinalizePassedWeeks().catch(err => {
            console.warn('[週間チャレンジ] 過去週バックフィルに失敗:', err);
        });
    }
}

/**
 * 週間チャレンジ: 投稿タブのプルダウンを今週の3種目に更新
 */
function updateWeeklyPostDropdown() {
    if (currentMode !== 'weekly') return;
    // 種目カードを出さずに抜けるルート（休止週など）に備えて未描画へ戻しておく
    weeklyPostLockRendered = null;
    const postTab = document.getElementById('post-tab');
    const exercisesGrid = document.getElementById('post-exercises-grid');

    // 週間チャレンジではフィルタUIを削除
    const existingFilter = postTab.querySelector('.exercise-filter-bar');
    if (existingFilter) existingFilter.remove();

    exercisesGrid.innerHTML = '';

    if (weeklyChallenge && weeklyChallenge.paused) {
        exercisesGrid.innerHTML = `<p class="weekly-paused-inline"><i class="fa-solid fa-umbrella-beach"></i> ${escapeHtml(WEEKLY_PAUSE_NOTE)}${escapeHtml(WEEKLY_PAUSE_RESUME_NOTE)}<br>この期間は${escapeHtml(RAID_TITLE)}中です。デイリーミッションタブから投稿できます。</p>`;
        return;
    }

    if (!weeklyChallenge || weeklyChallenge.exercises.length === 0) {
        exercisesGrid.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">今週のチャレンジ種目はまだ設定されていません。</p>';
        return;
    }

    // 4枠すべて表示。未解禁の水曜公開枠は ？？？ のロックカード（投稿不可）で表示する
    const activeKeys = getActiveWeeklyKeys(weeklyChallenge.exercises);
    // 今日のデイリーミッションが未クリアなら、解禁済みの枠もまとめてロックする
    const dailyLocked = isWeeklyPostLockedByDailyMission();
    weeklyPostLockRendered = dailyLocked;
    if (dailyLocked) appendDailyMissionLockNotice(exercisesGrid);
    weeklyChallenge.exercises.forEach(key => {
        if (!activeKeys.includes(key)) {
            appendLockedPostItem(exercisesGrid);
            return;
        }
        const ex = freeExercises[key];
        if (!ex) return;
        if (dailyLocked) {
            appendDailyLockedPostItem(exercisesGrid, key, ex);
            return;
        }
        appendPostItem(exercisesGrid, key, ex);
    });
}

/** 投稿タブに描画済みのロック状態（true/false）。未描画なら null。 */
let weeklyPostLockRendered = null;

/**
 * 週間チャレンジの投稿が「その日のデイリーミッション未クリア」でロックされているか。
 *
 * ⚠️ 判定できないときは必ず false（＝投稿できる）を返す。通信失敗や読み込み前に
 *    ロックしてしまうと、クリア済みの人まで投稿できなくなるため。
 * - ミッション自体が無い日（レイド前メンテナンス）はロックしない
 * - レイド開催日の cleared は「今日1回でも積んだか」なので、そのまま条件に使う
 * @returns {boolean}
 */
function isWeeklyPostLockedByDailyMission() {
    if (!dailyMissionState) return false;
    if (dailyMissionState.maintenance) return false;
    return !dailyMissionState.cleared;
}

/**
 * 投稿タブの先頭に「デイリーミッションをクリアすると解禁」の案内を差し込む。
 * @param {HTMLElement} container
 */
function appendDailyMissionLockNotice(container) {
    const note = document.createElement('p');
    note.className = 'daily-lock-notice';
    note.innerHTML = '<i class="fa-solid fa-lock"></i> 今日のデイリーミッションをクリアすると、今週のチャレンジ種目に投稿できます。';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'daily-lock-jump';
    btn.innerHTML = '<i class="fa-solid fa-bullseye"></i> デイリーミッションへ';
    btn.addEventListener('click', () => switchToDailyMissionTab());
    note.appendChild(document.createElement('br'));
    note.appendChild(btn);
    container.appendChild(note);
}

/**
 * 投稿タブに「デイリーミッション未クリアのため投稿不可」のロックカードを追加する。
 * 種目名は隠さない（水曜解禁枠と違い、伏せる理由が無いため）。
 * @param {HTMLElement} container
 * @param {string} key
 * @param {Object} ex - freeExercises[key]
 */
function appendDailyLockedPostItem(container, key, ex) {
    const iconClass = ex.icon || 'fa-dumbbell';
    const item = document.createElement('div');
    item.className = 'rule-item post-exercise-entry weekly-locked-entry daily-locked-entry';
    item.dataset.key = key;
    item.setAttribute('aria-disabled', 'true');
    item.innerHTML = `
        <div class="post-exercise-entry-info">
            <h3 class="post-entry-title"><i class="fa-solid ${escapeHtml(iconClass)}"></i> ${escapeHtml(ex.name)} <span class="locked-note"><i class="fa-solid fa-lock"></i> ミッション未クリア</span></h3>
            <div class="locked-desc">今日のデイリーミッションをクリアすると投稿できます。</div>
        </div>
    `;
    item.addEventListener('click', () => switchToDailyMissionTab());
    container.appendChild(item);
}

/**
 * 投稿タブに「水曜13:00 JST まで未解禁」の ？？？ ロックカードを追加する（クリック・投稿不可）。
 * @param {HTMLElement} container
 */
function appendLockedPostItem(container) {
    const item = document.createElement('div');
    item.className = 'rule-item post-exercise-entry weekly-locked-entry';
    item.setAttribute('aria-disabled', 'true');
    item.innerHTML = `
        <div class="post-exercise-entry-info">
            <h3 class="post-entry-title"><i class="fa-solid fa-lock"></i> ？？？ <span class="locked-note">水曜13時解禁</span></h3>
            <div class="locked-desc">水曜13時になると4種目目が解禁され、投稿できるようになります。</div>
        </div>
    `;
    container.appendChild(item);
}

/**
 * ルールタブに「水曜13:00 JST まで未解禁」の ？？？ ロックカードを追加する（種目名・ルールをマスク）。
 * @param {HTMLElement} container
 */
function appendLockedRuleItem(container) {
    const item = document.createElement('div');
    item.className = 'rule-item weekly-locked-entry';
    item.setAttribute('aria-disabled', 'true');
    item.innerHTML = `
        <h3><i class="fa-solid fa-lock"></i> ？？？ <span class="locked-note">水曜13時解禁</span></h3>
        <p class="rule-description locked-desc">水曜13時に解禁される4種目目です。ルールは解禁までのお楽しみ。</p>
    `;
    container.appendChild(item);
}

/**
 * 週間チャレンジ: ルールタブを今週の3種目（読み取り専用）で更新
 * 週末（土日JST）には評価ボタンも表示する
 */
async function updateWeeklyRulesTab() {
    if (currentMode !== 'weekly') return;

    const rulesTab = document.getElementById('rules-tab');
    const rulesList = rulesTab.querySelector('.rules-list');

    // フィルタバーを削除（週間チャレンジでは不要）
    const existingFilter = rulesTab.querySelector('.exercise-filter-bar');
    if (existingFilter) existingFilter.remove();

    const title = rulesTab.querySelector('h2');
    if (title) title.innerHTML = '<i class="fa-solid fa-clipboard-list"></i> 今週のチャレンジ種目';

    // 倍率説明・更新ボタンを非表示
    const rulesDesc = rulesTab.querySelector('.rules-description');
    if (rulesDesc) rulesDesc.style.display = 'none';
    const updateBtn = document.getElementById('update-multipliers-btn');
    if (updateBtn) updateBtn.style.display = 'none';

    // 種目追加・復元ボタンがあれば削除（フリーモードからの復帰時）
    const addBtn = rulesTab.querySelector('.add-exercise-btn');
    if (addBtn) addBtn.remove();
    const restoreBtn = rulesTab.querySelector('.restore-exercise-btn');
    if (restoreBtn) restoreBtn.remove();

    // 今週の3種目を読み取り専用で表示
    rulesList.innerHTML = '';

    if (weeklyChallenge && weeklyChallenge.paused) {
        rulesList.innerHTML = `<p class="weekly-paused-inline"><i class="fa-solid fa-umbrella-beach"></i> ${escapeHtml(WEEKLY_PAUSE_NOTE)}${escapeHtml(WEEKLY_PAUSE_RESUME_NOTE)}<br>この期間は${escapeHtml(RAID_TITLE)}中です。デイリーミッションタブから参戦できます。</p>`;
        const pausedBanner = rulesTab.querySelector('.weekly-rating-banner');
        if (pausedBanner) pausedBanner.remove();
        return;
    }

    if (!weeklyChallenge || weeklyChallenge.exercises.length === 0) {
        rulesList.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">今週のチャレンジ種目がまだ設定されていません。</p>';
        return;
    }

    const weekend = isWeekendJST();

    // 週末バナー表示制御
    let weekendBanner = rulesTab.querySelector('.weekly-rating-banner');
    if (weekend) {
        if (!weekendBanner) {
            weekendBanner = document.createElement('div');
            weekendBanner.className = 'weekly-rating-banner';
            weekendBanner.innerHTML = '<i class="fa-solid fa-star"></i> 今週のチャレンジが終了しました！種目を評価できます。';
            rulesList.parentNode.insertBefore(weekendBanner, rulesList);
        }
    } else {
        if (weekendBanner) weekendBanner.remove();
    }

    // 評価データ・投稿実績・自分の評価を取得（未解禁の水曜公開枠は ？？？ 表示）
    const activeKeys = getActiveWeeklyKeys(weeklyChallenge.exercises);
    const [ratingSummaries, userPostedKeys, userRatingMap] = await Promise.all([
        getExerciseRatingSummaries(activeKeys),
        getUserPostedExerciseKeys('free'),
        getUserExerciseRatings(activeKeys)
    ]);

    // 4枠すべて表示。未解禁枠は名前・ルールを ？？？ でマスク（評価ボタンなし）
    weeklyChallenge.exercises.forEach(key => {
        if (!activeKeys.includes(key)) {
            appendLockedRuleItem(rulesList);
            return;
        }
        const ex = freeExercises[key];
        if (!ex) return;
        const ratingData = ratingSummaries[key] || null;
        // 評価ボタン表示条件: 過去に投稿済み（フリーモードと同様）
        const canRate = userPostedKeys.has(key);
        const userRating = canRate ? (userRatingMap[key] || null) : null;
        appendRuleItem(rulesList, key, ex, ratingData, canRate, true, userRating);
    });

    // 「評価する」ボタン
    rulesList.querySelectorAll('.btn-rate-exercise').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openRatingModal(btn.dataset.key, btn.dataset.name);
        });
    });

    // 「レビューを見る」ボタン
    rulesList.querySelectorAll('.btn-view-reviews').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const ex = freeExercises[btn.dataset.key];
            openReviewsModal(btn.dataset.key, ex ? ex.name : btn.dataset.key);
        });
    });
}

/**
 * 週間チャレンジ: 成長グラフのプルダウンを今週の3種目に更新
 */
function updateWeeklyGraphDropdown() {
    if (currentMode !== 'weekly') return;
    const select = document.getElementById('graph-exercise-type');
    select.innerHTML = '';

    if (!weeklyChallenge || weeklyChallenge.exercises.length === 0) return;

    getActiveWeeklyKeys(weeklyChallenge.exercises).forEach(key => {
        const ex = freeExercises[key];
        if (!ex) return;
        const option = document.createElement('option');
        option.value = key;
        option.textContent = ex.name;
        select.appendChild(option);
    });
}

// ====================================================================
// 夏休み特別モード「レイド」
// ⚠️ web/src/lib/raid-mode.ts の「ミラー」。両アプリが同じ Firestore の
//    settings_free/daily_mission と posts_free を共有するため、日程表
//    （RAID_SCHEDULE）・種目解決ルール・休止週キーは必ず同じにすること。
//
// レイドは「その日の指定種目を、全員の合計で目標回数まで積み上げる」催し。
// 通常のデイリーミッション（一人ひとり別の目標回数を抽選）とは違い、
// 個人目標の抽選は行わず、チーム合計だけを見る。
// ====================================================================

// バナーやバッジに出す催しの名前
const RAID_MODE_LABEL = '夏休み特別モード';
// デイリーの枠に出す特殊モード名
const RAID_TITLE = 'レイド開催';

// この種目はレイド向け、と種目側で宣言するためのタグ。
// 名前からの推測より確実なので、付いていればこちらを優先する
const RAID_TAG = 'レイド';

// レイド開始前にメンテナンス表示を出す日（JST 日付キー）。
// この日はデイリーミッションを止め、翌0:00からのレイド開始だけを告知する
const RAID_MAINTENANCE_DATE_KEYS = ['2026-08-08'];

// レイド初日・最終日（表示用。実際の判定は RAID_SCHEDULE の有無で行う）
const RAID_START_DATE_KEY = '2026-08-09';
const RAID_END_DATE_KEY = '2026-08-16';

// 週間チャレンジを休止する週。値は「週の起点（日曜17:00 JST）」の JST 日付キー。
// 2026-08-09 の週 = 月〜金が 8/10〜8/14（夏休み週）
const WEEKLY_PAUSE_WEEK_KEYS = ['2026-08-09'];
const WEEKLY_PAUSE_LABEL = '夏休み休止';
const WEEKLY_PAUSE_NOTE = '夏休みのため、今週の週間チャレンジはお休みです。種目の選出も得点集計もありません。';
const WEEKLY_PAUSE_RESUME_NOTE = '再開は 8/17(月) の週から。';

// 3日通算ブロック「複合種目総合1」の識別子・種目名・名前ヒント。
// ブロックの3日はすべてこの種目。表記ゆれ（数字なし・「総合」なし）でも
// 拾えるように短い候補を後ろに置く
const RAID_BLOCK_TOTAL_1 = 'total1';
const RAID_BLOCK_TOTAL_1_TITLE = '複合種目総合1';
const RAID_BLOCK_TOTAL_1_HINTS = ['複合種目総合1', '複合種目総合', '複合種目'];
// 1セットの中身。数えるのは回数ではなく**セット数**なので、
// 何をもって1と数えるのかがカードに出ていないと数字の意味が伝わらない
const RAID_BLOCK_TOTAL_1_SET = '1セット＝腕立て10回→バックエクステンション10回→クラップクランチ10回→スクワット20回';

/**
 * レイドの日程表。
 * nameHints は登録種目の「名前」に対する部分一致候補（優先順）。
 * フリー種目のキーは 'free_<timestamp>' で環境ごとに違うため名前で引き当てる。
 * blockId が付いた日は通算ブロック（RAID_BLOCKS）の一部で、1日で完結しない。
 * ⚠️ 一致する種目が無い日はレイドを行わず、通常のデイリーミッションに戻る。
 * @type {Array<{dateKey: string, day: number, blockId?: string, nameHints: string[], goal: number, label: string}>}
 */
const RAID_SCHEDULE = [
    // 初日は開催済み。人数割に変えると確定した結果が動いてしまうので固定のまま
    // 「腕立て」だけだと派生種目（腕立てジャンプ等）も拾うので、素の種目に付きやすい名前を先に見る
    { dateKey: '2026-08-09', day: 1, nameHints: ['プッシュアップ', '腕立て伏せ', '腕立て', 'push'], goal: 1000, label: '開幕戦。全員で1000回（この日だけ固定目標）。' },
    { dateKey: '2026-08-10', day: 2, nameHints: ['スクワット', 'squat'], perPerson: 200, label: '脚の日。数で押し切ろう。' },
    { dateKey: '2026-08-11', day: 3, nameHints: ['懸垂', 'チンニング', 'プルアップ', 'pull'], perPerson: 100, label: '背中の日。1回の重みがいちばん大きい。' },
    { dateKey: '2026-08-12', day: 4, nameHints: ['クラップクランチ', 'クラップ', 'clap crunch', 'clap'], perPerson: 200, label: '腹の日。すきま時間で積み上げ。' },
    { dateKey: '2026-08-13', day: 5, nameHints: ['ディップス(レイド)', 'ディップス（レイド）', 'ディップス', 'dip'], perPerson: 120, label: '胸と二の腕。押す種目でもう一押し。' },
    // 8/14〜8/16 は「複合種目総合1」の3日通算ブロック。
    // 3日とも同じ種目・同じ1人あたりで、体力も進捗も3日ぶんをひとまとめに見る。
    // 数えるのはセット数。1人1日30セット＝3日で90セットから始めて、
    // 軽ければ管理画面で2日目以降だけ上げられる（日ごとの数字がそのまま合算される）
    { dateKey: '2026-08-14', day: 6, blockId: RAID_BLOCK_TOTAL_1, nameHints: RAID_BLOCK_TOTAL_1_HINTS, perPerson: 30, label: `3日通算の1日目。${RAID_BLOCK_TOTAL_1_SET}。` },
    { dateKey: '2026-08-15', day: 7, blockId: RAID_BLOCK_TOTAL_1, nameHints: RAID_BLOCK_TOTAL_1_HINTS, perPerson: 30, label: `3日通算の2日目。折り返し。${RAID_BLOCK_TOTAL_1_SET}。` },
    { dateKey: '2026-08-16', day: 8, blockId: RAID_BLOCK_TOTAL_1, nameHints: RAID_BLOCK_TOTAL_1_HINTS, perPerson: 30, label: `3日通算の最終日。ここまでの合計で討伐判定。${RAID_BLOCK_TOTAL_1_SET}。` }
];

// レイド全体の日数
const RAID_TOTAL_DAYS = RAID_SCHEDULE.length;

/**
 * 通算ブロック：複数日をひとつの種目でつなぎ、その期間の**合計**で
 * 1体のボスを削る単位。日ごとに区切らないので、前の日に積んだぶんは
 * 最終日まで残る（1日だけ出られなかった人も置いていかれない）。
 *
 * ブロックの日は個別の目標を持たず、体力も進捗率も討伐判定もブロック全体で1つ。
 * ただし積み上げ得点（RAID_POINTS_PER_DAY）はこれまでどおり日ごとに分け合う。
 * @type {Array<{id: string, title: string, dateKeys: string[], label: string}>}
 */
const RAID_BLOCKS = [
    {
        id: RAID_BLOCK_TOTAL_1,
        title: RAID_BLOCK_TOTAL_1_TITLE,
        dateKeys: ['2026-08-14', '2026-08-15', '2026-08-16'],
        label: `3日通算。1種目を最終日まで積み上げて、1体のボスを削り切る。数えるのはセット数（${RAID_BLOCK_TOTAL_1_SET}）。`
    }
];

/**
 * id からブロック設定を引く
 * @param {string|null} blockId
 * @returns {Object|null}
 */
function getRaidBlock(blockId) {
    if (!blockId) return null;
    return RAID_BLOCKS.find(b => b.id === blockId) || null;
}

/**
 * その日が属する通算ブロック。単独開催の日は null
 * @param {string} dateKey
 * @returns {Object|null}
 */
function getRaidBlockForDate(dateKey) {
    const config = getRaidDayConfig(dateKey);
    return config ? getRaidBlock(config.blockId) : null;
}

/**
 * ブロックに属する日の設定（日付順）
 * @param {Object} block
 * @returns {Array<Object>}
 */
function getRaidBlockDayConfigs(block) {
    return RAID_SCHEDULE.filter(d => d.blockId === block.id);
}

/**
 * ブロックの中で何日目か（1始まり）。含まれない日は0
 * @param {Object} block
 * @param {string} dateKey
 * @returns {number}
 */
function raidBlockDayIndex(block, dateKey) {
    return block.dateKeys.indexOf(dateKey) + 1;
}

/**
 * 管理画面での上書きをブロックの各日に反映する（非破壊）
 * @param {Object} block
 * @param {Object|null} goalOverrides
 * @returns {{block: Object, dayConfigs: Array<Object>}}
 */
function planRaidBlock(block, goalOverrides) {
    return {
        block: block,
        dayConfigs: getRaidBlockDayConfigs(block).map(c => applyRaidGoalOverride(c, goalOverrides))
    };
}

/**
 * ブロックのボスの体力＝各日の目標の合計。
 * 人数は「ブロック初日に確定した1つ」を全日に使う。日ごとに数え直すと
 * 期間の途中で体力が動いて、積み上げた割合の意味が変わってしまうため
 * @param {Object} plan - planRaidBlock の結果
 * @param {number} memberCount
 * @returns {number}
 */
function resolveRaidBlockGoal(plan, memberCount) {
    return plan.dayConfigs.reduce((sum, config) => sum + resolveRaidGoal(config, memberCount), 0);
}

/**
 * 1人あたりの通算目標。全日が人数割のときだけ意味を持つので、
 * 固定目標の日が混ざるブロックでは null（＝合計だけを見せる）
 * @param {Object} plan
 * @returns {number|null}
 */
function raidBlockPerPerson(plan) {
    if (plan.dayConfigs.some(c => c.perPerson == null)) return null;
    return plan.dayConfigs.reduce((sum, c) => sum + (c.perPerson || 0), 0);
}

/**
 * ブロックの目標がコードの既定か、1日でも管理画面で上書きされているか
 * @param {Object} plan
 * @returns {string}
 */
function raidBlockGoalSource(plan) {
    return plan.dayConfigs.some(c => c.goalSource === 'override') ? 'override' : 'default';
}

/**
 * その日の設定値（固定目標なら goal、人数割なら perPerson）。
 * 管理画面はこの数字を編集し、上書きも同じ意味で保存する
 * @param {Object} config
 * @returns {number}
 */
function raidConfiguredValue(config) {
    return (config.perPerson != null ? config.perPerson : config.goal) || 0;
}

/**
 * その日が「ログイン人数 × 1人あたり」で目標を出す日か
 * @param {Object} config
 * @returns {boolean}
 */
function isPerPersonRaidDay(config) {
    return config.perPerson != null;
}

/**
 * その日のレイドボスの体力（＝みんなで積み上げる目標）。
 * 人数割の日は「前日にログインした人数 × 1人あたり」。人数が0でも
 * 1人ぶんは残す（体力0で即討伐、という見え方を避けるため）
 * @param {Object} config
 * @param {number} memberCount
 * @returns {number}
 */
function resolveRaidGoal(config, memberCount) {
    if (config.perPerson != null) {
        return config.perPerson * Math.max(1, Math.round(memberCount) || 0);
    }
    return config.goal || 0;
}

/**
 * 前日のJST日付キー
 * @param {string} dateKey
 * @returns {string}
 */
function getPreviousDateKey(dateKey) {
    const { start } = getDailyBoundariesJST(dateKey);
    // 当日0:00 JST の1ms前 ＝ 前日23:59:59.999 JST
    return getDailyDateKeyJST(new Date(start.getTime() - 1));
}

/**
 * sinceDateKey 以降にアプリを開いた形跡があるユーザー数
 * @param {Object} usersMap
 * @param {string} sinceDateKey
 * @returns {number}
 */
function countActiveUsersSince(usersMap, sinceDateKey) {
    return Object.values(usersMap || {}).filter(
        u => !!u && !!u.lastActiveDateKey && u.lastActiveDateKey >= sinceDateKey
    ).length;
}

/**
 * ボスの体力を決める人数（＝前日のログイン人数）を解決する。
 *
 * 当日のログイン人数だと日中ずっと体力が動いて数字が定まらないので、
 * 前日ぶんを使って0:00の時点で確定させる。
 *
 * 前日の人数は開催中に記録したものを使う（users.lastActiveDateKey は
 * 最後に開いた日しか持たないため、後から「前日ログインしていた人」を
 * 数え直すことはできない）。記録が無い日は「前日以降にアプリを開いた人数」で
 * 概算する——前日に開いた人はたいてい当日以降も開くので近い数になる
 * @param {string} dateKey
 * @param {Object} memberCounts
 * @param {Object} usersMap
 * @returns {{count: number, dateKey: string, source: string}}
 */
function resolveRaidMemberCount(dateKey, memberCounts, usersMap) {
    const prevKey = getPreviousDateKey(dateKey);
    const recorded = (memberCounts || {})[prevKey];
    if (typeof recorded === 'number' && recorded > 0) {
        return { count: recorded, dateKey: prevKey, source: 'recorded' };
    }
    return {
        count: Math.max(1, countActiveUsersSince(usersMap, prevKey)),
        dateKey: prevKey,
        source: 'estimated'
    };
}

/**
 * 保存済みの人数を、日程表にある日・妥当な整数だけに絞る
 * @param {*} raw - raid_config.memberCounts
 * @returns {Object} 日付キー→人数
 */
function sanitizeRaidMemberCounts(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    const scheduled = new Set(RAID_SCHEDULE.map(d => d.dateKey));
    Object.keys(raw).forEach(dateKey => {
        if (!scheduled.has(dateKey)) return;
        const n = Number(raw[dateKey]);
        if (!isFinite(n)) return;
        const count = Math.round(n);
        if (count < 1 || count > 1000) return;
        out[dateKey] = count;
    });
    return out;
}

// --------------------------------------------------------------------
// 0時発表 → 7時入力開始
// --------------------------------------------------------------------

// 入力を受け付け始める時刻（JST）。それまでは種目だけ見えている
const RAID_INPUT_OPEN_HOUR_JST = 7;
// この日以降は「0時発表・7時入力開始」で運用する。
// 初日（8/9）はすでに走り出しているので、途中で入力を止めない
const RAID_INPUT_GATE_FROM_DATE_KEY = '2026-08-10';
// なぜ発表と入力開始をずらすのか。画面にそのまま出す説明
const RAID_INPUT_GATE_NOTE = '種目は0:00に発表、入力できるのは7:00からです。前の晩のうちに今日なにをやるか分かるようにしつつ、'
    + '深夜のうちに先に積んだ人が有利にならないよう、朝いちで全員が同じスタートラインに立つためです。';

/**
 * その日が「7時から入力」の対象か（初日は対象外）
 * @param {string} dateKey
 * @returns {boolean}
 */
function isRaidInputGatedDay(dateKey) {
    return dateKey >= RAID_INPUT_GATE_FROM_DATE_KEY;
}

/**
 * その日の入力開始時刻（7:00 JST）をUTCのDateで返す
 * @param {string} dateKey
 * @returns {Date}
 */
function getRaidInputOpenAt(dateKey) {
    const { start } = getDailyBoundariesJST(dateKey);
    return new Date(start.getTime() + RAID_INPUT_OPEN_HOUR_JST * 60 * 60 * 1000);
}

/**
 * いま入力を受け付けてよいか。ゲート対象外の日（初日）は常に true
 * @param {string} dateKey
 * @param {Date} now
 * @returns {boolean}
 */
function isRaidInputOpen(dateKey, now = new Date()) {
    if (!isRaidInputGatedDay(dateKey)) return true;
    return now.getTime() >= getRaidInputOpenAt(dateKey).getTime();
}

// 1日ぶんの持ち点。その日の合計に対する貢献度（％）をそのまま点にするので、
// 参加者の点を全部足すとちょうどこの数になる（誰も投稿しなければ0）
const RAID_POINTS_PER_DAY = 100;

// 管理者が目標回数を上書きする Firestore ドキュメント（settings_free/）
// ⚠️ admin.html の「夏休みレイド」セクションと同じドキュメント名・形状にすること
const RAID_CONFIG_DOC = 'raid_config';
// 目標回数として受け付ける範囲。桁を打ち間違えても壊れないように上限を置く
const RAID_GOAL_MIN = 1;
const RAID_GOAL_MAX = 1000000;

/**
 * Firestoreから読んだ上書き設定を、信用できる形に整える。
 * 日程表に無い日付・数値でない値・範囲外は落とす（管理画面の入力ミスや
 * 古い日程表の残骸で、その日のレイドが壊れないようにするため）
 * @param {*} raw - raid_config.goals
 * @returns {Object} 日付キー→目標回数
 */
function sanitizeRaidGoalOverrides(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    const scheduled = new Set(RAID_SCHEDULE.map(d => d.dateKey));
    Object.keys(raw).forEach(dateKey => {
        if (!scheduled.has(dateKey)) return;
        const n = Number(raw[dateKey]);
        if (!isFinite(n)) return;
        const goal = Math.round(n);
        if (goal < RAID_GOAL_MIN || goal > RAID_GOAL_MAX) return;
        out[dateKey] = goal;
    });
    return out;
}

/**
 * 管理画面での上書きを日程表に反映した設定を返す（非破壊）。
 * 上書きが無い日はコードの既定値をそのまま使う
 * @param {Object} config - RAID_SCHEDULE の1件
 * @param {Object|null} overrides - 日付キー→目標回数
 * @returns {Object}
 */
function applyRaidGoalOverride(config, overrides) {
    const override = (overrides || {})[config.dateKey];
    if (typeof override !== 'number') {
        return Object.assign({}, config, { goalSource: 'default' });
    }
    // 上書きの数字は「その日の設定値」＝人数割の日なら1人あたり、
    // 固定の日なら合計。どちらを差し替えるかは日程表側の形で決まる
    if (config.perPerson != null) {
        return Object.assign({}, config, { perPerson: override, goalSource: 'override' });
    }
    return Object.assign({}, config, { goal: override, goalSource: 'override' });
}

/**
 * Firestoreから読んだ種目の指定を、信用できる形に整える。
 * 日程表に無い日付・種目キーでない値は落とす。
 * 「その種目が今も登録されているか」は resolveRaidExerciseKey 側で見る
 * （消された種目を指していたら名前ヒントに落とすため）
 * @param {*} raw - raid_config.exercises
 * @returns {Object} 日付キー→種目キー
 */
function sanitizeRaidExerciseOverrides(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    const scheduled = new Set(RAID_SCHEDULE.map(d => d.dateKey));
    Object.keys(raw).forEach(dateKey => {
        if (!scheduled.has(dateKey)) return;
        const value = raw[dateKey];
        if (typeof value !== 'string' || value === '') return;
        out[dateKey] = value;
    });
    return out;
}

/**
 * 管理画面で設定された上書き（目標回数・種目）を読む。
 * 読めなければ空（＝コードの既定）で進める。ここで失敗して
 * レイドごと落とすより、既定の設定で開催を続けたほうが害が小さい
 * @returns {Promise<{goals: Object, exercises: Object}>}
 */
async function getRaidOverrides() {
    try {
        const snap = await db.collection('settings_free').doc(RAID_CONFIG_DOC).get();
        if (!snap.exists) return { goals: {}, exercises: {}, memberCounts: {} };
        const data = snap.data() || {};
        return {
            goals: sanitizeRaidGoalOverrides(data.goals),
            exercises: sanitizeRaidExerciseOverrides(data.exercises),
            memberCounts: sanitizeRaidMemberCounts(data.memberCounts)
        };
    } catch (e) {
        console.warn('[レイド] 管理画面の設定を読めませんでした（既定で続行）:', e);
        return { goals: {}, exercises: {}, memberCounts: {} };
    }
}

/**
 * その日のログイン人数を記録する（増えたときだけ書く）。
 * 目標が人数で決まるようになったため、過去の日の目標を成績表で
 * 再現するには当日の人数が要る。lastActiveDateKey は最後のログイン日しか
 * 持たないので、開催中に見えた最大人数をここで残しておく
 * @param {string} dateKey
 * @param {number} memberCount
 * @param {Object} known - 既に保存されている人数
 * @returns {Promise<void>}
 */
async function recordRaidMemberCount(dateKey, memberCount, known) {
    if (!(memberCount > 0)) return;
    if ((known[dateKey] || 0) >= memberCount) return;
    try {
        await db.collection('settings_free').doc(RAID_CONFIG_DOC).set({
            memberCounts: { [dateKey]: memberCount }
        }, { merge: true });
    } catch (e) {
        // 書けなくても当日の表示は出せる（成績表の目標が投稿者数基準になるだけ）
        console.warn('[レイド] 人数の記録に失敗:', e);
    }
}

/**
 * その日がレイド開始前のメンテナンス日か
 * @param {string} dateKey
 * @returns {boolean}
 */
function isRaidMaintenanceDay(dateKey) {
    return RAID_MAINTENANCE_DATE_KEYS.indexOf(dateKey) >= 0;
}

/**
 * その日のレイド設定。レイド期間外なら null
 * @param {string} dateKey
 * @returns {Object|null}
 */
function getRaidDayConfig(dateKey) {
    return RAID_SCHEDULE.find(d => d.dateKey === dateKey) || null;
}

/**
 * その日にレイドで使える種目か（バーバリアンは短いほど良い＝合計で競えない）
 * @param {Object} exercises
 * @param {string} key
 * @returns {boolean}
 */
function isRaidEligibleExercise(exercises, key) {
    const ex = (exercises || {})[key];
    return !!ex && !ex.barbarian;
}

/**
 * 「レイド」タグが付いているか
 * @param {Object} exercises
 * @param {string} key
 * @returns {boolean}
 */
function hasRaidTag(exercises, key) {
    const ex = (exercises || {})[key];
    return !!ex && Array.isArray(ex.tags) && ex.tags.indexOf(RAID_TAG) >= 0;
}

/**
 * 候補の中から名前ヒントで1件選ぶ。
 * ⚠️ 部分一致の中では**名前が短いものを優先**する。「腕立て」で引くと
 *    「腕立てジャンプ」のような派生種目も一致してしまい、キー順で先に
 *    出たほうが勝つと意図しない種目になる（実際に初日で踏んだ）。
 *    余計な語が付いていない＝名前が短いほうが素の種目、という前提で選ぶ。
 *    名前の長さが並んだらキー昇順にして、どの端末でも同じ種目に決める。
 * @param {Object} config - RAID_SCHEDULE の1件
 * @param {Object} exercises
 * @param {string[]} keys - 候補キー
 * @returns {string|null}
 */
function pickRaidKeyByNameHints(config, exercises, keys) {
    const nameOf = (key) => exercises[key].name || '';
    for (let i = 0; i < config.nameHints.length; i++) {
        const needle = config.nameHints[i].toLowerCase();
        const matches = keys
            .filter(key => nameOf(key).toLowerCase().includes(needle))
            .sort((a, b) => nameOf(a).length - nameOf(b).length || a.localeCompare(b));
        if (matches.length > 0) return matches[0];
    }
    return null;
}

/**
 * レイドの種目を登録種目から引き当てる。優先順は次のとおり。
 *
 * 1. pinned : 管理画面でその日の種目が指定されていればそれ（最優先）
 * 2. tag    : 「レイド」タグが付いた種目に絞って名前ヒントで選ぶ
 *             （名前からの推測より、種目側の宣言のほうが確実なため）
 * 3. name   : タグ付きに該当が無ければ、全種目から名前ヒントで選ぶ
 *             （タグを1つも付けていない環境でも動かすためのフォールバック）
 *
 * @param {Object} config - RAID_SCHEDULE の1件
 * @param {Object} exercises - freeExercises
 * @param {Object|null} exerciseOverrides - 日付キー→種目キー（管理画面での指定）
 * @returns {{key: string|null, source: string|null}} どれにも当たらなければ key は null
 */
function resolveRaidExercise(config, exercises, exerciseOverrides) {
    const pinned = (exerciseOverrides || {})[config.dateKey];
    if (pinned && isRaidEligibleExercise(exercises, pinned)) {
        return { key: pinned, source: 'pinned' };
    }

    const eligible = Object.keys(exercises || {}).filter(key => isRaidEligibleExercise(exercises, key));

    const tagged = eligible.filter(key => hasRaidTag(exercises, key));
    const byTag = pickRaidKeyByNameHints(config, exercises, tagged);
    if (byTag) return { key: byTag, source: 'tag' };

    const byName = pickRaidKeyByNameHints(config, exercises, eligible);
    if (byName) return { key: byName, source: 'name' };

    return { key: null, source: null };
}

/**
 * 種目キーだけが要るとき用の薄いラッパ
 * @param {Object} config
 * @param {Object} exercises
 * @param {Object|null} exerciseOverrides
 * @returns {string|null}
 */
function resolveRaidExerciseKey(config, exercises, exerciseOverrides) {
    return resolveRaidExercise(config, exercises, exerciseOverrides).key;
}

/**
 * 週の起点（日曜17:00 JST）がレイドによる週間チャレンジ休止週か
 * @param {Date|null} weekStart
 * @returns {boolean}
 */
function isWeeklyPausedWeekStart(weekStart) {
    if (!weekStart) return false;
    return WEEKLY_PAUSE_WEEK_KEYS.indexOf(getDailyDateKeyJST(weekStart)) >= 0;
}

/**
 * レイドの進捗（全員の合計）を組み立てる。
 * 並ぶのは通常のデイリーミッションと同じ「今日ログインした人」＋投稿済みの人。
 * 個人目標の抽選は無いので、達成判定はチーム合計だけを見る。
 *
 * 通算ブロックの日は blockPlan を渡す。totals は「ブロック開始日から今日まで」の
 * 通算、todayTotals は当日ぶんで、体力・達成判定はブロック全体で行う
 * @param {{usersMap: Object, dateKey: string, totals: Object, myUserId: string, config: Object, memberCounts: Object, blockPlan: Object, todayTotals: Object}} input
 * @returns {Object}
 */
function buildRaidProgress({ usersMap, dateKey, totals, myUserId, config, memberCounts, blockPlan, todayTotals }) {
    const today = todayTotals || totals;
    const rows = Object.keys(usersMap || {})
        .filter(userId => isDailyActiveUser(usersMap[userId], userId, dateKey, totals, myUserId))
        .map(userId => {
            const u = usersMap[userId] || {};
            return {
                userId: userId,
                userName: u.userName || u.email || '名無しさん',
                value: Number(totals[userId]) || 0,
                isMe: userId === myUserId
            };
        });

    const totalValue = rows.reduce((sum, r) => sum + r.value, 0);
    const contributors = rows
        .map(r => Object.assign({}, r, { share: totalValue > 0 ? r.value / totalValue : 0 }))
        .sort((a, b) => b.value - a.value
            || a.userName.localeCompare(b.userName)
            || a.userId.localeCompare(b.userId));

    // ボスの体力は「前日ログインした人数 × 1人あたり」。
    // 当日の人数だと日中ずっと動いてしまうので、前日ぶんで0:00に確定させる。
    // 通算ブロックの日は「ブロック初日の前日」で数え、期間中ずっと同じ体力にする
    const goalDateKey = blockPlan ? blockPlan.block.dateKeys[0] : dateKey;
    const members = resolveRaidMemberCount(goalDateKey, memberCounts, usersMap);
    const perPerson = blockPlan
        ? raidBlockPerPerson(blockPlan)
        : (config.perPerson != null ? config.perPerson : null);
    const goal = blockPlan
        ? resolveRaidBlockGoal(blockPlan, members.count)
        : resolveRaidGoal(config, members.count);
    const block = blockPlan ? {
        id: blockPlan.block.id,
        title: blockPlan.block.title,
        label: blockPlan.block.label,
        startDateKey: blockPlan.block.dateKeys[0],
        endDateKey: blockPlan.block.dateKeys[blockPlan.block.dateKeys.length - 1],
        dayCount: blockPlan.block.dateKeys.length,
        dayIndex: raidBlockDayIndex(blockPlan.block, dateKey),
        perPersonTotal: perPerson
    } : null;
    return {
        day: config.day,
        totalDays: RAID_TOTAL_DAYS,
        goal: goal,
        goalSource: blockPlan ? raidBlockGoalSource(blockPlan) : (config.goalSource || 'default'),
        perPerson: perPerson,
        memberCount: members.count,
        memberCountDateKey: perPerson != null ? members.dateKey : null,
        memberCountSource: perPerson != null ? members.source : null,
        label: config.label,
        block: block,
        totalValue: totalValue,
        todayValue: rows.reduce((sum, r) => sum + (Number(today[r.userId]) || 0), 0),
        remaining: Math.max(0, goal - totalValue),
        percent: goal > 0 ? Math.min(100, Math.round((totalValue / goal) * 100)) : 0,
        cleared: goal > 0 && totalValue >= goal,
        myValue: Number(totals[myUserId]) || 0,
        myTodayValue: Number(today[myUserId]) || 0,
        contributors: contributors,
        activeCount: contributors.filter(c => c.value > 0).length
    };
}

/**
 * 貢献バーの長さ（0〜1）。いちばん多い人が満杯になるように正規化する
 * @param {number} value
 * @param {number} maxValue
 * @returns {number}
 */
function raidContributionRatio(value, maxValue) {
    if (!(maxValue > 0)) return 0;
    return Math.min(1, Math.max(0, value / maxValue));
}

// --------------------------------------------------------------------
// 週の積み上げ得点（レイドモードの成績表）
// --------------------------------------------------------------------

/**
 * 投稿を「レイドの日 × ユーザー」で合計する。
 * その日の種目に一致する投稿だけを数える（種目が決まっていない日は空）
 * @param {Array<{userId:string, exerciseType:string, value:number, date:Date}>} posts
 * @param {Object} dayExerciseKeys - 日付キー→その日の種目キー
 * @returns {Object} 日付キー→userId→合計回数
 */
function bucketRaidTotals(posts, dayExerciseKeys) {
    const out = {};
    (posts || []).forEach(post => {
        if (!post || !post.date) return;
        const dateKey = getDailyDateKeyJST(post.date);
        const exerciseKey = dayExerciseKeys[dateKey];
        if (!exerciseKey || post.exerciseType !== exerciseKey) return;
        const v = Number(post.value) || 0;
        if (v <= 0) return;
        if (!out[dateKey]) out[dateKey] = {};
        out[dateKey][post.userId] = (out[dateKey][post.userId] || 0) + v;
    });
    return out;
}

/**
 * 表示名の解決（一覧に無いユーザーでも空欄にしない）
 * @param {Object} usersMap
 * @param {string} userId
 * @returns {string}
 */
function raidUserName(usersMap, userId) {
    const u = (usersMap || {})[userId] || {};
    return u.userName || u.email || '名無しさん';
}

/**
 * 1日ぶんの結果を組み立てる。
 * 点は「その日の合計に対する貢献度」なので、参加者の点の合計は
 * 誰か1人でも投稿していれば必ず RAID_POINTS_PER_DAY になる
 * @param {Object} config - RAID_SCHEDULE の1件（目標は上書き適用後）
 * @param {string|null} exerciseKey
 * @param {Object} totals - userId→合計回数
 * @param {Object} usersMap
 * @param {string} myUserId
 * @returns {Object}
 */
function buildRaidDayResult(config, exerciseKey, totals, usersMap, myUserId, recordedMemberCount) {
    const rows = Object.keys(totals || {})
        .map(userId => ({ userId: userId, value: Number(totals[userId]) || 0 }))
        .filter(r => r.value > 0);
    const totalValue = rows.reduce((sum, r) => sum + r.value, 0);

    const entries = rows.map(r => {
        const share = totalValue > 0 ? r.value / totalValue : 0;
        return {
            userId: r.userId,
            userName: raidUserName(usersMap, r.userId),
            value: r.value,
            share: share,
            points: share * RAID_POINTS_PER_DAY,
            isMe: r.userId === myUserId
        };
    }).sort((a, b) => b.points - a.points
        || a.userName.localeCompare(b.userName)
        || a.userId.localeCompare(b.userId));

    // 目標の掛け算に使う人数。開催中に記録したログイン人数を使い、
    // 記録が無ければ「実際に投稿した人数」で代用する（過去の日の
    // ログイン状況はもう復元できないため、分かる範囲でいちばん近い数）
    const memberCount = (recordedMemberCount && recordedMemberCount > 0)
        ? recordedMemberCount
        : entries.length;
    // 通算ブロックの日は1日ぶんの目標を持たない。ここで per-day の目標を作ると
    // 「その日だけで未達」という、ブロックには存在しない判定が画面に出てしまう
    const inBlock = !!config.blockId;
    const goal = inBlock ? 0 : resolveRaidGoal(config, memberCount);

    return {
        dateKey: config.dateKey,
        day: config.day,
        exerciseKey: exerciseKey,
        goal: goal,
        perPerson: (!inBlock && config.perPerson != null) ? config.perPerson : null,
        memberCount: memberCount,
        totalValue: totalValue,
        cleared: goal > 0 && totalValue >= goal,
        blockId: config.blockId || null,
        entries: entries
    };
}

/**
 * ブロックの日ごとの結果を通算にまとめる。
 * 回数は期間の合計、点は日ごとに分け合ったものの合計。
 * 討伐判定はここでだけ行う（1日ごとには判定しない）
 * @param {Object} plan - planRaidBlock の結果
 * @param {Array<Object>} dayResults - ブロックに属する日の結果（日付順・今日までのぶん）
 * @param {number} memberCount - ブロック初日の前日に記録したログイン人数
 * @param {Object} usersMap
 * @param {string} myUserId
 * @returns {Object}
 */
function buildRaidBlockResult(plan, dayResults, memberCount, usersMap, myUserId) {
    const acc = {};
    (dayResults || []).forEach(day => {
        day.entries.forEach(e => {
            if (!acc[e.userId]) acc[e.userId] = { value: 0, points: 0 };
            acc[e.userId].value += e.value;
            acc[e.userId].points += e.points;
        });
    });

    const totalValue = Object.keys(acc).reduce((sum, userId) => sum + acc[userId].value, 0);
    const entries = Object.keys(acc).map(userId => ({
        userId: userId,
        userName: raidUserName(usersMap, userId),
        value: acc[userId].value,
        share: totalValue > 0 ? acc[userId].value / totalValue : 0,
        points: acc[userId].points,
        isMe: userId === myUserId
    })).sort((a, b) => b.value - a.value
        || a.userName.localeCompare(b.userName)
        || a.userId.localeCompare(b.userId));

    const goal = resolveRaidBlockGoal(plan, memberCount);
    // 最後に種目が決まっている日のものを代表にする（3日とも同じ種目のため）
    const withExercise = dayResults.filter(d => !!d.exerciseKey);
    const exerciseKey = withExercise.length > 0
        ? withExercise[withExercise.length - 1].exerciseKey
        : null;

    return {
        id: plan.block.id,
        title: plan.block.title,
        label: plan.block.label,
        startDateKey: plan.block.dateKeys[0],
        endDateKey: plan.block.dateKeys[plan.block.dateKeys.length - 1],
        dayCount: plan.block.dateKeys.length,
        playedDays: dayResults.length,
        exerciseKey: exerciseKey,
        goal: goal,
        perPersonTotal: raidBlockPerPerson(plan),
        memberCount: memberCount,
        totalValue: totalValue,
        percent: goal > 0 ? Math.min(100, Math.round((totalValue / goal) * 100)) : 0,
        cleared: goal > 0 && totalValue >= goal,
        entries: entries
    };
}

/**
 * 日ごとの結果を足し上げて成績表にする。
 * 同点は同順位（1,2,2,4…）。並び順は点の高い順で、
 * 同点なら名前・IDで安定させる（どの端末でも同じ並びにするため）
 * @param {Array<Object>} dayResults
 * @param {Object} usersMap
 * @param {string} myUserId
 * @returns {Array<Object>}
 */
function buildRaidStandings(dayResults, usersMap, myUserId) {
    const acc = {};
    (dayResults || []).forEach(day => {
        day.entries.forEach(e => {
            if (!acc[e.userId]) {
                acc[e.userId] = {
                    userId: e.userId,
                    userName: raidUserName(usersMap, e.userId),
                    totalPoints: 0,
                    activeDays: 0,
                    perDay: {},
                    rank: 0,
                    isMe: e.userId === myUserId
                };
            }
            const row = acc[e.userId];
            row.totalPoints += e.points;
            row.activeDays += 1;
            row.perDay[day.dateKey] = e.points;
        });
    });

    const list = Object.values(acc).sort((a, b) => b.totalPoints - a.totalPoints
        || a.userName.localeCompare(b.userName)
        || a.userId.localeCompare(b.userId));

    // 同点は同順位。次の順位は人数ぶん飛ばす（競技順位）
    let rank = 0;
    let prev = null;
    list.forEach((row, i) => {
        if (prev === null || Math.abs(row.totalPoints - prev) > 1e-9) {
            rank = i + 1;
        }
        prev = row.totalPoints;
        row.rank = rank;
    });
    return list;
}

/**
 * 点の表示。小数1桁（整数なら小数を出さない）
 * @param {number} points
 * @returns {string}
 */
function formatRaidPoints(points) {
    const n = Number(points) || 0;
    const rounded = Math.round(n * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * レイド期間の投稿をまとめて取り、日ごとの結果と積み上げ得点を作る。
 * 期間ぶんを1クエリで引いて手元で日別に振り分けるので、
 * 日数が増えても読み取りは1回のまま（複合インデックスも要らない）
 * @param {Date} now
 * @returns {Promise<{days: Array<Object>, standings: Array<Object>, playedDays: number}>}
 */
async function loadRaidScoreboard(now = new Date()) {
    const todayKey = getDailyDateKeyJST(now);
    // まだ来ていない日は集計しない（0点の行が並ぶだけなので）
    const played = RAID_SCHEDULE.filter(d => d.dateKey <= todayKey);
    if (played.length === 0) {
        return { days: [], blocks: [], standings: [], playedDays: 0 };
    }

    if (!freeExercisesLoaded) {
        await loadFreeExercises();
    }

    const overrides = await getRaidOverrides();
    const exerciseKeyByDate = {};
    const resolved = played.map(config => {
        const key = resolveRaidExerciseKey(config, freeExercises, overrides.exercises);
        if (key) exerciseKeyByDate[config.dateKey] = key;
        return { config: applyRaidGoalOverride(config, overrides.goals), key: key };
    });

    // 期間の投稿を1クエリで取得（timestampの単一フィールド範囲検索のみ）
    const rangeStart = getDailyBoundariesJST(played[0].dateKey).start;
    const rangeEnd = getDailyBoundariesJST(played[played.length - 1].dateKey).end;
    let posts = [];
    try {
        const snap = await db.collection('posts_free')
            .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(rangeStart))
            .where('timestamp', '<', firebase.firestore.Timestamp.fromDate(rangeEnd))
            .get();
        posts = snap.docs.map(d => {
            const p = d.data() || {};
            return {
                userId: p.userId,
                exerciseType: p.exerciseType,
                value: Number(p.value) || 0,
                // timestamp未確定（serverTimestamp反映待ち）の投稿は日を決められない
                date: p.timestamp && p.timestamp.toDate ? p.timestamp.toDate() : null
            };
        }).filter(p => !!p.date);
    } catch (e) {
        console.warn('[レイド] 得点の集計に失敗:', e);
    }

    const totalsByDay = bucketRaidTotals(posts, exerciseKeyByDate);

    let usersMap = {};
    try {
        usersMap = await getUsersMap();
    } catch (e) {
        console.warn('[レイド] ユーザー一覧の取得に失敗:', e);
    }
    const users = Object.assign({}, usersMap);
    const myUserId = currentUser ? currentUser.uid : '';
    if (myUserId && !users[myUserId]) users[myUserId] = {};

    const days = resolved.map(r => buildRaidDayResult(
        r.config, r.key, totalsByDay[r.config.dateKey] || {}, users, myUserId,
        // ボスの体力は前日のログイン人数で決まる
        overrides.memberCounts[getPreviousDateKey(r.config.dateKey)]
    ));

    // 通算ブロックは日ごとに区切らず、開催済みの日をまとめて1体ぶんにする
    const blocks = RAID_BLOCKS.map(block => {
        const blockDays = days.filter(d => d.blockId === block.id);
        if (blockDays.length === 0) return null;
        const members = resolveRaidMemberCount(block.dateKeys[0], overrides.memberCounts, users);
        return buildRaidBlockResult(
            planRaidBlock(block, overrides.goals), blockDays, members.count, users, myUserId
        );
    }).filter(b => !!b);

    return {
        days: days.slice().reverse(),
        blocks: blocks.slice().reverse(),
        standings: buildRaidStandings(days, users, myUserId),
        playedDays: days.length
    };
}

// ====================================================================
// デイリーミッション機能
// ⚠️ web/src/lib/daily-mission.ts / daily-mission-engine.ts の「ミラー」。
//    両アプリが同じ settings_free/daily_mission と posts_free を共有し、
//    目標回数はシードから各自で再計算する。日付キー・シード文字列・
//    分布定数を変更する場合は必ず web 側も同じに更新すること。
// ====================================================================

// 直近何日分の種目を再選出から避けるか
const DAILY_RECENT_AVOID = 5;

// 目標回数の分布パラメータ（対数正規。ただし log 空間で上下の σ を変えられる）。
// σ上 = σ下 なら純粋な対数正規そのもので、右に裾を引く形はそのまま。
// σ上を少し小さくしてあるのは、飛び抜けて多い回数を引いたときの絶望を減らすため。
// σ は倍率に対する広がりなのでピーク回数によらず一定（対数正規のスケール不変性）。
const DAILY_SIGMA_LOW = 0.34;
const DAILY_SIGMA_HIGH = 0.26;
// 下側に振れる確率（＝密度が繋がるための面積比）
const DAILY_LOW_WEIGHT = DAILY_SIGMA_LOW / (DAILY_SIGMA_LOW + DAILY_SIGMA_HIGH);
// 抽選結果を丸め込む範囲（ピーク比）
const DAILY_MIN_RATIO = 0.45;
const DAILY_MAX_RATIO = 2.0;
// 何があっても下回らない回数
const DAILY_REPS_FLOOR = 5;
// 過去に投稿が無い種目のピーク回数
const DAILY_REPS_DEFAULT_PEAK = 30;
// 投稿がある種目のピーク＝過去最高回数のこの割合
// クリア判定はその日の合計なので、1回の最高記録をそのまま目安にできる
const DAILY_PEAK_BEST_RATIO = 1.0;

// 今日のミッション状態 { dateKey, exerciseKey, target, totalValue, cleared, participants }
let dailyMissionState = null;
// 起動時の自動遷移を一度だけ行うためのフラグ
let dailyMissionAutoNavDone = false;
// メンテナンス告知・入力解禁のカウントダウン用インターバルID（対象が消えたら止める）
let raidCountdownTimer = null;
// 積み上げ得点の集計結果キャッシュ（タブを開き直すたびに再集計しない）
let raidScoreboardCache = null;

/**
 * JSTの暦日を YYYY-MM-DD で返す
 * @param {Date} now
 * @returns {string}
 */
function getDailyDateKeyJST(now = new Date()) {
    const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const jst = new Date(now.getTime() + JST_OFFSET_MS);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
    const d = String(jst.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * 日付キーに対応するUTCの1日境界を返す
 * @param {string} dateKey - 'YYYY-MM-DD'
 * @returns {{ start: Date, end: Date }}
 */
function getDailyBoundariesJST(dateKey) {
    const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const [y, m, d] = dateKey.split('-').map(Number);
    const startJstMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
    const start = new Date(startJstMs - JST_OFFSET_MS);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
}

/**
 * FNV-1a 32bit ハッシュ
 * @param {string} str
 * @returns {number} uint32
 */
function hashStringToSeed(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/**
 * mulberry32 PRNG（同じシードなら常に同じ列）
 * @param {number} seed
 * @returns {() => number} [0,1) を返す関数
 */
function createSeededRandom(seed) {
    let a = seed >>> 0;
    return function next() {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Box-Muller法で標準正規乱数
 * @param {() => number} rand
 * @returns {number}
 */
function seededNormal(rand) {
    // u1 = 0 だと log が -Infinity になるため下限を入れる
    const u1 = Math.max(rand(), 1e-12);
    const u2 = rand();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * その種目の過去最高回数からピーク回数を決める。
 * 投稿が一度も無い種目は既定値（30）。
 * @param {number} bestValue
 * @returns {number}
 */
function resolveDailyPeak(bestValue) {
    const best = Number(bestValue) || 0;
    if (best <= 0) return DAILY_REPS_DEFAULT_PEAK;
    return Math.max(DAILY_REPS_FLOOR, Math.round(best * DAILY_PEAK_BEST_RATIO));
}

/**
 * 保存済みの過去最高回数を、今日のその種目のものとして信用できるときだけ返す。
 *
 * 種目とセットで照合するのは、ドキュメントを merge で書いているため。
 * bestValue を書かない旧バージョンが日付をまたぐと dateKey / exerciseKey だけが
 * 新しくなり、前日の別種目の bestValue が残ったまま「今日のピーク」として
 * 読まれてしまう。日付も見るのは、同じ種目が後日また選ばれたときに
 * 古い締めの値を使わないため。
 * @param {Object} saved - settings_free/daily_mission の内容
 * @param {string} dateKey
 * @param {string} exerciseKey
 * @returns {number|null} 信用できないときは null
 */
function readCachedBestValue(saved, dateKey, exerciseKey) {
    const s = saved || {};
    if (typeof s.bestValue !== 'number' || !isFinite(s.bestValue)) return null;
    if (s.bestValue < 0) return null;
    if (s.bestValueKey !== exerciseKey) return null;
    if (s.bestValueDateKey !== dateKey) return null;
    return s.bestValue;
}

/**
 * log空間での分布の中心。最頻値がちょうど peak になるよう σ下² だけ右にずらす
 * （対数正規の最頻値 = exp(μ - σ²)）。
 * @param {number} peak
 * @returns {number}
 */
function dailyLogCenter(peak) {
    const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
    return Math.log(p) + DAILY_SIGMA_LOW * DAILY_SIGMA_LOW;
}

/**
 * 目標回数が取りうる範囲
 * @param {number} peak
 * @returns {{min: number, max: number}}
 */
function dailyRepsBounds(peak) {
    const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
    const min = Math.max(DAILY_REPS_FLOOR, Math.round(p * DAILY_MIN_RATIO));
    const max = Math.max(min + 1, Math.round(p * DAILY_MAX_RATIO));
    return { min: min, max: max };
}

/**
 * ユーザー×日付×種目で決まる目標回数。ピークを最頻値に右へ裾を引く対数正規で、
 * 上側の σ だけ小さくして大きい数字を出にくくしてある。
 * シードから毎回同じ値を再計算できるため保存不要（リロードしても変わらない）。
 * @param {string} userId
 * @param {string} dateKey
 * @param {string} exerciseKey
 * @param {number} peak - その日の分布のピーク回数
 * @returns {number}
 */
function generateDailyMissionTarget(userId, dateKey, exerciseKey, peak = DAILY_REPS_DEFAULT_PEAK) {
    const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
    const rand = createSeededRandom(hashStringToSeed(`daily-reps|${userId}|${dateKey}|${exerciseKey}`));
    const center = dailyLogCenter(p);
    // どちら側に振れるかは面積比（σ下:σ上）で決める＝境目で密度が繋がる
    const side = rand();
    const z = Math.abs(seededNormal(rand));
    const y = side < DAILY_LOW_WEIGHT ? center - DAILY_SIGMA_LOW * z : center + DAILY_SIGMA_HIGH * z;
    const bounds = dailyRepsBounds(p);
    return Math.min(bounds.max, Math.max(bounds.min, Math.round(Math.exp(y))));
}

/**
 * 当日の投稿から userId→合計回数 を作る。
 * デイリーミッションは「その日に取り組んだ回数の合計」で達成を判定するので、
 * 週間チャレンジ（ベスト記録）とは違い最大値ではなく足し上げる。
 * @param {Array<Object>} posts
 * @param {string} exerciseKey
 * @returns {Object} userId → 合計
 */
function sumDailyTotals(posts, exerciseKey) {
    const totals = {};
    (posts || []).forEach(post => {
        if (!post || post.exerciseType !== exerciseKey) return;
        const v = Number(post.value) || 0;
        if (v <= 0) return;
        totals[post.userId] = (totals[post.userId] || 0) + v;
    });
    return totals;
}

/**
 * バーバリアン以外のフリー種目キー（安定ソート済み）
 * @param {Object} exercises
 * @returns {string[]}
 */
function getDailyMissionCandidates(exercises) {
    return Object.keys(exercises || {})
        .filter(key => exercises[key] && !exercises[key].barbarian)
        .sort();
}

/**
 * その日の種目を決定。日付キーのみをシードにするので、複数クライアントが
 * 同時に生成しても（候補が同じなら）同じ種目になる。
 * @param {string} dateKey
 * @param {Object} exercises
 * @param {string[]} recentKeys - 直近で出題済みのキー（避ける）
 * @returns {string|null}
 */
function pickDailyMissionExercise(dateKey, exercises, recentKeys = []) {
    const candidates = getDailyMissionCandidates(exercises);
    if (candidates.length === 0) return null;

    const avoid = new Set(recentKeys);
    let pool = candidates.filter(key => !avoid.has(key));
    if (pool.length === 0) pool = candidates;

    const rand = createSeededRandom(hashStringToSeed(`daily-mission|${dateKey}`));
    const idx = Math.min(pool.length - 1, Math.floor(rand() * pool.length));
    return pool[idx];
}

/**
 * 直近履歴の更新（非破壊・先頭が最新）
 * @param {string[]} recentKeys
 * @param {string} exerciseKey
 * @returns {string[]}
 */
function pushRecentMissionKeys(recentKeys, exerciseKey) {
    return [exerciseKey, ...(recentKeys || []).filter(k => k !== exerciseKey)].slice(0, DAILY_RECENT_AVOID);
}

// --------------------------------------------------------------------
// 分布グラフ（みんなの目標を1枚に並べる）
// --------------------------------------------------------------------

/**
 * 目標回数の確率密度（対数正規。中心より上だけ σ が小さい）。
 * 最頻値はちょうどピークで、ampを掛けているので全区間の積分が1になる。
 * 目標は保存せずシードから再計算できるので、他ユーザーの回数も
 * Firestoreを読まずに全員分ローカルで求められる。
 * @param {number} x
 * @param {number} peak
 * @returns {number}
 */
function dailyTargetPdf(x, peak) {
    if (!(x > 0)) return 0;
    const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
    const d = Math.log(x) - dailyLogCenter(p);
    const s = d < 0 ? DAILY_SIGMA_LOW : DAILY_SIGMA_HIGH;
    const amp = Math.sqrt(2 / Math.PI) / (DAILY_SIGMA_LOW + DAILY_SIGMA_HIGH);
    return (amp / x) * Math.exp(-(d * d) / (2 * s * s));
}

/**
 * 標準正規分布の累積分布。誤差関数は Abramowitz-Stegun 7.1.26 近似。
 * @param {number} z
 * @returns {number}
 */
function standardNormalCdf(z) {
    const sign = z < 0 ? -1 : 1;
    const a = Math.abs(z) / Math.SQRT2;
    const t = 1 / (1 + 0.3275911 * a);
    const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
    const erf = 1 - poly * Math.exp(-a * a);
    return 0.5 * (1 + sign * erf);
}

/**
 * 目標回数の累積分布（丸め前の連続値ベース）
 * @param {number} x
 * @param {number} peak
 * @returns {number}
 */
function dailyTargetCdf(x, peak) {
    if (!(x > 0)) return 0;
    const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
    const d = Math.log(x) - dailyLogCenter(p);
    if (d <= 0) return 2 * DAILY_LOW_WEIGHT * standardNormalCdf(d / DAILY_SIGMA_LOW);
    return DAILY_LOW_WEIGHT + 2 * (1 - DAILY_LOW_WEIGHT) * (standardNormalCdf(d / DAILY_SIGMA_HIGH) - 0.5);
}

/**
 * その目標回数を引く確率。丸めた結果がその整数になる幅（±0.5）の面積で、
 * 上下限はそこへ丸め込まれる裾ぶんも含める（合計するとちょうど1になる）。
 * @param {number} target
 * @param {number} peak
 * @returns {number} 0〜1
 */
function dailyTargetProbability(target, peak) {
    const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
    const bounds = dailyRepsBounds(p);
    let prob;
    if (target <= bounds.min) prob = dailyTargetCdf(bounds.min + 0.5, p);
    else if (target >= bounds.max) prob = 1 - dailyTargetCdf(bounds.max - 0.5, p);
    else prob = dailyTargetCdf(target + 0.5, p) - dailyTargetCdf(target - 0.5, p);
    return Math.min(1, Math.max(0, prob));
}

/**
 * 確率をラベル用の短い文字列に
 * @param {number} probability - 0〜1
 * @returns {string}
 */
function formatDailyProbability(probability) {
    const pct = (Number(probability) || 0) * 100;
    if (pct <= 0) return '0%';
    if (pct < 0.1) return '<0.1%';
    return `${pct.toFixed(1)}%`;
}

/**
 * 分布カーブの点列。yはピークが1になるよう正規化する。
 * @param {number} xMin
 * @param {number} xMax
 * @param {number} peak
 * @param {number} steps
 * @returns {Array<{x: number, y: number}>}
 */
function buildDailyDistributionCurve(xMin, xMax, peak, steps = 96) {
    const top = dailyTargetPdf(peak, peak);
    const points = [];
    for (let i = 0; i <= steps; i++) {
        const x = xMin + ((xMax - xMin) * i) / steps;
        points.push({ x: x, y: top > 0 ? dailyTargetPdf(x, peak) / top : 0 });
    }
    return points;
}

// 目盛りの刻み候補（小さい順）
const DAILY_AXIS_STEPS = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];
// 目盛りの本数の上限。これを超えないいちばん細かい刻みを選ぶ
const DAILY_AXIS_MAX_TICKS = 9;

/**
 * グラフのx軸の窓（描画範囲と目盛りの刻み）。
 * 0からではなく抽選されうる範囲だけを映す（0起点だと分布が右端に寄る）。
 * ピークは種目ごとに大きく変わるので、刻みは本数が増えすぎないものを選ぶ。
 * @param {number} lo
 * @param {number} hi
 * @returns {{min: number, max: number, step: number}}
 */
function dailyAxisWindow(lo, hi) {
    for (let i = 0; i < DAILY_AXIS_STEPS.length; i++) {
        const step = DAILY_AXIS_STEPS[i];
        // 端に点が乗らないよう、両側を1目盛りぶん外へ広げる
        const min = Math.max(0, (Math.ceil(lo / step) - 1) * step);
        const max = (Math.floor(hi / step) + 1) * step;
        if ((max - min) / step <= DAILY_AXIS_MAX_TICKS - 1) return { min: min, max: max, step: step };
    }
    const step = DAILY_AXIS_STEPS[DAILY_AXIS_STEPS.length - 1];
    return { min: 0, max: Math.max(step, Math.ceil(hi / step) * step), step: step };
}

/**
 * その日のグラフに載せるユーザーか。今日ログインした人だけを対象にし、
 * 自分と「今日すでに投稿した人」は lastActiveDateKey の書き込み有無に
 * 関わらず必ず含める。
 * @param {Object} user - users ドキュメント
 * @param {string} userId
 * @param {string} dateKey
 * @param {Object} totals - userId → 当日の合計回数
 * @param {string} myUserId
 * @returns {boolean}
 */
function isDailyActiveUser(user, userId, dateKey, totals, myUserId) {
    if (userId === myUserId) return true;
    if ((totals[userId] || 0) > 0) return true;
    return (user || {}).lastActiveDateKey === dateKey;
}

/**
 * その日ログインしたユーザーの目標を算出して並べる（目標が小さい順）
 * @param {Object} input
 * @param {Object} input.usersMap - userId → { userName, email, lastActiveDateKey }
 * @param {string} input.dateKey
 * @param {string} input.exerciseKey
 * @param {Object} input.totals - userId → 当日の合計回数
 * @param {string} input.myUserId
 * @param {number} input.peak
 * @returns {Array<Object>}
 */
function buildDailyParticipants({ usersMap, dateKey, exerciseKey, totals, myUserId, peak }) {
    return Object.keys(usersMap || {})
        .filter(userId => isDailyActiveUser(usersMap[userId], userId, dateKey, totals, myUserId))
        .map(userId => {
            const u = usersMap[userId] || {};
            const target = generateDailyMissionTarget(userId, dateKey, exerciseKey, peak);
            const totalValue = totals[userId] || 0;
            return {
                userId: userId,
                userName: u.userName || u.email || '名無しさん',
                target: target,
                probability: dailyTargetProbability(target, peak),
                totalValue: totalValue,
                cleared: totalValue >= target,
                isMe: userId === myUserId
            };
        })
        .sort((a, b) => a.target - b.target || a.userId.localeCompare(b.userId));
}

/**
 * その日みんなで目指す合計回数。今は「全員が自分の目標をやり切った状態」＝
 * 個人目標の合計。将来レイドミッション（その日だけ全員で合計◯回を目指す）を
 * 入れるときは、ここが差し替え口になる（表示側はこの数字しか見ていない）。
 * ⚠️ web版 daily-mission.ts: resolveDailyTeamGoal のミラー
 * @param {Array<Object>} participants
 * @returns {number}
 */
function resolveDailyTeamGoal(participants) {
    return (participants || []).reduce((sum, p) => sum + (Number(p.target) || 0), 0);
}

/**
 * みんなの合計と一人ひとりの貢献を組み立てる。
 * 個人の達成判定と同じく「その日の投稿の合計」を足し上げるだけなので、
 * 分布グラフと同じ participants から追加のFirestore読み取り無しで作れる。
 * ⚠️ web版 daily-mission.ts: buildDailyTeamProgress のミラー
 * @param {Array<Object>} participants
 * @returns {Object} { totalValue, goal, remaining, percent, cleared, contributors, activeCount }
 */
function buildDailyTeamProgress(participants) {
    const list = participants || [];
    const totalValue = list.reduce((sum, p) => sum + (Number(p.totalValue) || 0), 0);
    const goal = resolveDailyTeamGoal(list);
    const contributors = list
        .map(p => {
            const value = Number(p.totalValue) || 0;
            return {
                userId: p.userId,
                userName: p.userName,
                value: value,
                target: p.target,
                cleared: p.cleared,
                isMe: p.isMe,
                share: totalValue > 0 ? value / totalValue : 0
            };
        })
        .sort((a, b) => b.value - a.value || a.target - b.target || a.userId.localeCompare(b.userId));

    return {
        totalValue: totalValue,
        goal: goal,
        remaining: Math.max(0, goal - totalValue),
        percent: goal > 0 ? Math.min(100, Math.round((totalValue / goal) * 100)) : 0,
        cleared: goal > 0 && totalValue >= goal,
        contributors: contributors,
        activeCount: contributors.filter(c => c.value > 0).length
    };
}

/**
 * 貢献バーの長さ（0〜1）。いちばん多い人が満杯になるように正規化する。
 * 割合そのものを幅にすると人数が増えたとき全員が細くなって差が見えない。
 * ⚠️ web版 daily-mission.ts: dailyContributionRatio のミラー
 * @param {number} value
 * @param {number} maxValue
 * @returns {number}
 */
function dailyContributionRatio(value, maxValue) {
    if (!(maxValue > 0)) return 0;
    return Math.min(1, Math.max(0, value / maxValue));
}

// グラフ上のラベルで表示する名前の最大文字数（長い名前は省略する）
const DAILY_LABEL_NAME_MAX = 6;

/**
 * 長い表示名を省略
 * @param {string} name
 * @param {number} max
 * @returns {string}
 */
function truncateLabelName(name, max = DAILY_LABEL_NAME_MAX) {
    const n = name || '';
    return n.length > max ? n.slice(0, max) + '…' : n;
}

/**
 * ラベルが重ならないように段（レーン）へ割り当てる。
 * 位置の昇順に、その段の右端と実際の幅で衝突判定し、空いている最小の段へ置く。
 * どの段にも入らなければ新しい段を開く（= 段さえ増やせば必ず重ならない）。
 * @param {number[]} positions - 各ラベルの中心x
 * @param {number[]} widths - 各ラベルの幅（positionsと同じ並び）
 * @param {number} maxLanes - 段の上限。超える場合だけ最も余裕のある段に相乗りする
 * @param {number} gap - ラベル間に空ける最小の余白
 * @returns {number[]} 入力順に対応した段番号
 */
function assignLabelLanes(positions, widths, maxLanes = 8, gap = 4) {
    const order = positions
        .map((x, i) => ({ x: x, i: i }))
        .sort((a, b) => a.x - b.x || a.i - b.i);
    const laneRight = [];
    const lanes = new Array(positions.length).fill(0);

    order.forEach(({ x, i }) => {
        const half = (widths[i] || 0) / 2;
        const left = x - half;

        let lane = 0;
        for (; lane < laneRight.length; lane++) {
            if (left >= laneRight[lane] + gap) break;
        }
        if (lane === laneRight.length && laneRight.length >= maxLanes) {
            // 段を増やせないので最も右端が手前の段へ（この場合だけ重なりうる）
            lane = 0;
            for (let l = 1; l < laneRight.length; l++) {
                if (laneRight[l] < laneRight[lane]) lane = l;
            }
        }
        laneRight[lane] = x + half;
        lanes[i] = lane;
    });
    return lanes;
}

/**
 * 使用された段数（= 最大段番号+1）
 * @param {number[]} lanes
 * @returns {number}
 */
function usedLaneCount(lanes) {
    return lanes.length === 0 ? 0 : Math.max.apply(null, lanes) + 1;
}

/**
 * 種目名から単位を推測（種目データに単位情報がないため）
 * @param {string} exerciseName
 * @returns {string}
 */
function guessExerciseUnit(exerciseName) {
    const name = exerciseName || '';
    if (name.includes('秒')) return '秒';
    if (name.includes('セット')) return 'セット';
    if (name.includes('分')) return '分';
    return '回';
}

/**
 * 回数を3桁区切りに（みんなの合計は4桁を超えるので読みづらくなる）。
 * toLocaleString はロケール依存で両アプリの見た目がズレうるので使わない。
 * ⚠️ web版 daily-mission.ts: formatDailyCount のミラー
 * @param {number} value
 * @returns {string}
 */
function formatDailyCount(value) {
    const n = Math.round(Number(value) || 0);
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 日付キーを「7/26(日)」形式に
 * @param {string} dateKey
 * @returns {string}
 */
function formatDailyDateLabel(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return `${m}/${d}(${dayNames[dow]})`;
}

/**
 * 今日のミッションを取得。未生成なら生成して保存する（冪等）。
 * 選出は日付キーだけをシードにする決定的処理なので、保存に失敗しても
 * 全ユーザーで同じ種目になり表示は破綻しない。
 * @param {Object} exercises
 * @param {Date} now
 * @returns {Promise<{dateKey: string, exerciseKey: string}|null>}
 */
async function getOrCreateDailyMission(exercises, now = new Date(), presetOverrides) {
    const dateKey = getDailyDateKeyJST(now);
    const ref = db.collection('settings_free').doc('daily_mission');

    let saved = {};
    try {
        const snap = await ref.get();
        if (snap.exists) saved = snap.data() || {};
    } catch (e) {
        console.warn('[デイリーミッション] 取得失敗、ローカル生成にフォールバック:', e);
    }

    // レイド開催日: 個人目標の抽選も過去最高回数の集計も要らないので先に返す。
    // 種目が引き当てられない（対象の種目が未登録）日は通常のミッションに戻す
    const scheduledRaid = getRaidDayConfig(dateKey);
    if (scheduledRaid) {
        // 種目・目標回数とも管理画面で上書きできる。毎回読み直すので、
        // 開催中に変更してもリロードだけで全員に反映される
        const raidOverrides = presetOverrides || await getRaidOverrides();
        const raidKey = resolveRaidExerciseKey(scheduledRaid, exercises, raidOverrides.exercises);
        if (raidKey) {
            const raidConfig = applyRaidGoalOverride(scheduledRaid, raidOverrides.goals);
            // 書き込みは日付が変わった1回だけ（recentKeys を毎回積み増さないため）
            if (saved.dateKey !== dateKey) {
                const prevKeys = Array.isArray(saved.recentKeys) ? saved.recentKeys : [];
                try {
                    await ref.set({
                        dateKey: dateKey,
                        exerciseKey: raidKey,
                        raidDay: raidConfig.day,
                        raidGoal: raidConfig.goal,
                        recentKeys: pushRecentMissionKeys(prevKeys, raidKey),
                        // 個人目標を使わない日なので、前日のピーク情報は残さず潰す
                        peak: null,
                        bestValue: null,
                        bestValueKey: null,
                        bestValueDateKey: null,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                } catch (e) {
                    console.warn('[レイド] 保存失敗（表示は続行）:', e);
                }
            }
            return {
                dateKey: dateKey,
                exerciseKey: raidKey,
                peak: 0,
                bestValue: 0,
                peakSource: 'default',
                raid: raidConfig
            };
        }
        console.warn('[レイド] 対象種目が見つからないため通常のデイリーミッションで進めます:', scheduledRaid.nameHints);
    }

    // 過去最高回数を引く。引けなかったら null を返す（0 と区別する）。
    // 失敗を 0 として保存すると、その日いっぱい既定ピークのまま固定されてしまう
    const resolveBest = async (key) => {
        try {
            return await getExerciseBestValue(key, getDailyBoundariesJST(dateKey).start);
        } catch (e) {
            console.warn('[デイリーミッション] 過去最高回数の取得に失敗:', e);
            return null;
        }
    };

    // 過去最高回数を「どの種目・どの日の値か」とセットで書くためのフィールド。
    // 引けなかったときは古い値を残さず null で潰し、次の読み込みで引き直させる
    const bestFields = (key, bestValue) => (bestValue == null
        ? { bestValue: null, bestValueKey: null, bestValueDateKey: null, peak: null }
        : {
            bestValue: bestValue,
            bestValueKey: key,
            bestValueDateKey: dateKey,
            peak: resolveDailyPeak(bestValue)
        });

    // 当日分が既にあり、その種目が今も存在すればそれを使う
    if (saved.dateKey === dateKey && saved.exerciseKey && exercises[saved.exerciseKey]) {
        const savedKey = saved.exerciseKey;
        // 今日のこの種目の値だと確認できたときだけキャッシュを使う。
        // 別種目・別日の値や旧バージョンの書き込みは信用せず引き直す
        const cached = readCachedBestValue(saved, dateKey, savedKey);
        if (cached != null) {
            return toDailyMission(dateKey, savedKey, cached);
        }
        const savedBest = await resolveBest(savedKey);
        try {
            await ref.set(bestFields(savedKey, savedBest), { merge: true });
        } catch (e) {
            // 書けなくても各端末で同じ値を再計算できる
        }
        return toDailyMission(dateKey, savedKey, savedBest || 0);
    }

    const recentKeys = Array.isArray(saved.recentKeys) ? saved.recentKeys : [];
    const exerciseKey = pickDailyMissionExercise(dateKey, exercises, recentKeys);
    if (!exerciseKey) return null;

    const bestValue = await resolveBest(exerciseKey);

    try {
        await ref.set(Object.assign({
            dateKey: dateKey,
            exerciseKey: exerciseKey,
            recentKeys: pushRecentMissionKeys(recentKeys, exerciseKey),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, bestFields(exerciseKey, bestValue)), { merge: true });
    } catch (e) {
        console.warn('[デイリーミッション] 保存失敗（表示は続行）:', e);
    }

    return toDailyMission(dateKey, exerciseKey, bestValue || 0);
}

/**
 * その種目の過去最高回数（ユーザーをまたいだ全投稿の最大値）。
 * 当日ぶんは除外する。含めると、その日の投稿でピークが動いて
 * 全員の目標が途中で変わってしまうため。
 * exerciseType の等値だけで引き（複合インデックス不要）、日付は手元で絞る。
 * @param {string} exerciseKey
 * @param {Date} before - この時刻より前の投稿だけを見る
 * @returns {Promise<number>}
 */
async function getExerciseBestValue(exerciseKey, before) {
    const snap = await db.collection('posts_free')
        .where('exerciseType', '==', exerciseKey)
        .get();
    let best = 0;
    snap.docs.forEach(d => {
        const post = d.data() || {};
        const ts = post.timestamp && post.timestamp.toDate ? post.timestamp.toDate() : null;
        // timestamp 未確定（serverTimestamp 反映待ち）＝ついさっきの投稿なので除外
        if (!ts || ts >= before) return;
        const v = Number(post.value) || 0;
        if (v > best) best = v;
    });
    return best;
}

/**
 * 保存済みの値・過去最高から、その日のミッション情報を組み立てる
 * @param {string} dateKey
 * @param {string} exerciseKey
 * @param {number} bestValue
 * @returns {{dateKey: string, exerciseKey: string, peak: number, bestValue: number, peakSource: string}}
 */
function toDailyMission(dateKey, exerciseKey, bestValue) {
    const best = Number(bestValue) || 0;
    return {
        dateKey: dateKey,
        exerciseKey: exerciseKey,
        peak: resolveDailyPeak(best),
        bestValue: best,
        peakSource: best > 0 ? 'best' : 'default'
    };
}

/**
 * その日の「全ユーザー」の合計回数を userId→合計 で返す。
 * 1回で目標に届かなくても、その日の投稿を積み上げて達成できる。
 * timestampの単一フィールド範囲検索だけで済ませ（複合インデックス不要）、
 * exerciseType の絞り込みはクライアント側で行う。1クエリで全員分そろう。
 * @param {string} dateKey
 * @param {string} exerciseKey
 * @returns {Promise<Object>}
 */
async function getDailyMissionTotals(dateKey, exerciseKey) {
    const { start, end } = getDailyBoundariesJST(dateKey);
    const snap = await db.collection('posts_free')
        .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(start))
        .where('timestamp', '<', firebase.firestore.Timestamp.fromDate(end))
        .get();
    return sumDailyTotals(snap.docs.map(d => d.data()), exerciseKey);
}

/**
 * 期間ぶんの投稿を日ごと・ユーザーごとに合計する。
 * 通算ブロックの進捗は「開始日から今日まで」の合計なので、その日ぶんだけを
 * 引く getDailyMissionTotals では足りない。timestampの単一フィールド範囲検索
 * 1回で期間ぶんを取り、手元で振り分ける
 * @param {string} fromDateKey
 * @param {string} throughDateKey
 * @param {Object} exerciseKeyByDate - 日付キー→その日の種目キー（載っていない日は数えない）
 * @returns {Promise<{cumulative: Object, byDay: Object}>}
 */
async function getRaidRangeTotals(fromDateKey, throughDateKey, exerciseKeyByDate) {
    const start = getDailyBoundariesJST(fromDateKey).start;
    const end = getDailyBoundariesJST(throughDateKey).end;
    const snap = await db.collection('posts_free')
        .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(start))
        .where('timestamp', '<', firebase.firestore.Timestamp.fromDate(end))
        .get();
    const posts = snap.docs.map(d => {
        const p = d.data() || {};
        return {
            userId: p.userId,
            exerciseType: p.exerciseType,
            value: Number(p.value) || 0,
            // timestamp未確定（serverTimestamp反映待ち）の投稿は日を決められない
            date: p.timestamp && p.timestamp.toDate ? p.timestamp.toDate() : null
        };
    }).filter(p => !!p.date);

    const byDay = bucketRaidTotals(posts, exerciseKeyByDate);
    const cumulative = {};
    Object.keys(byDay).forEach(dateKey => {
        Object.keys(byDay[dateKey]).forEach(userId => {
            cumulative[userId] = (cumulative[userId] || 0) + byDay[dateKey][userId];
        });
    });
    return { cumulative: cumulative, byDay: byDay };
}

/**
 * ミッション本体＋自分の達成状況＋全員の目標を解決し、dailyMissionState に格納する。
 * 目標はシードから決まるので、他ユーザーの回数を保存・取得する必要はない。
 * @returns {Promise<Object|null>}
 */
async function loadDailyMissionState() {
    if (!currentUser) return null;
    if (!freeExercisesLoaded) {
        await loadFreeExercises();
    }

    // レイド開始前のメンテナンス日はミッションを出さず、告知だけを返す
    const maintenanceDateKey = getDailyDateKeyJST();
    if (isRaidMaintenanceDay(maintenanceDateKey)) {
        dailyMissionState = {
            dateKey: maintenanceDateKey,
            exerciseKey: '',
            target: 0,
            totalValue: 0,
            // 未クリア扱いにして、タブのドット・起動時の自動遷移で告知を届ける
            cleared: false,
            probability: 0,
            peak: 0,
            bestValue: 0,
            peakSource: 'default',
            participants: [],
            raid: null,
            maintenance: true
        };
        return dailyMissionState;
    }

    // レイド日は設定と人数記録の両方でこれを使うので、1回だけ読む
    const raidDayOverrides = getRaidDayConfig(maintenanceDateKey)
        ? await getRaidOverrides()
        : { goals: {}, exercises: {}, memberCounts: {} };

    const mission = await getOrCreateDailyMission(freeExercises, new Date(), raidDayOverrides);
    if (!mission) {
        dailyMissionState = null;
        return null;
    }

    // 全ユーザーを取得して一覧を作る（載るのは今日ログインした人だけ）
    let usersMap = {};
    try {
        usersMap = await getUsersMap();
    } catch (e) {
        console.warn('[デイリーミッション] ユーザー一覧の取得に失敗:', e);
    }
    // 自分がusersMapに無い場合（初回ログイン直後など）も必ず並べる
    const users = Object.assign({}, usersMap);
    if (!users[currentUser.uid]) users[currentUser.uid] = {};

    // レイド開催日: 個人目標は無く、全員の合計だけで達成を判定する
    if (mission.raid) {
        // 通算ブロックの日は、ブロック開始日から今日までを積み上げて見る
        const block = getRaidBlockForDate(mission.dateKey);
        const blockPlan = block ? planRaidBlock(block, raidDayOverrides.goals) : null;
        let raidTotals = {};
        let todayTotals = null;
        try {
            if (block) {
                // ブロックの各日の種目は管理画面で日ごとに指定できるので、日ごとに引き当てる
                const keyByDate = {};
                getRaidBlockDayConfigs(block)
                    .filter(c => c.dateKey <= mission.dateKey)
                    .forEach(c => {
                        const key = resolveRaidExerciseKey(c, freeExercises, raidDayOverrides.exercises);
                        if (key) keyByDate[c.dateKey] = key;
                    });
                const range = await getRaidRangeTotals(block.dateKeys[0], mission.dateKey, keyByDate);
                raidTotals = range.cumulative;
                todayTotals = range.byDay[mission.dateKey] || {};
            } else {
                raidTotals = await getDailyMissionTotals(mission.dateKey, mission.exerciseKey);
            }
        } catch (e) {
            console.warn('[レイド] 集計に失敗:', e);
        }
        const raid = buildRaidProgress({
            usersMap: users,
            dateKey: mission.dateKey,
            totals: raidTotals,
            myUserId: currentUser.uid,
            config: mission.raid,
            memberCounts: raidDayOverrides.memberCounts,
            blockPlan: blockPlan,
            todayTotals: todayTotals
        });
        // 翌日のボス体力に使うので、今日ログインした人数を毎日残す
        // （固定目標の日でも、その翌日が人数割なら必要になる）
        recordRaidMemberCount(
            mission.dateKey,
            countActiveUsersSince(users, mission.dateKey),
            raidDayOverrides.memberCounts
        ).catch(() => { /* 記録は任意。失敗しても表示に影響させない */ });
        dailyMissionState = {
            dateKey: mission.dateKey,
            exerciseKey: mission.exerciseKey,
            target: 0,
            totalValue: raid.myValue,
            // レイド中の「クリア済み」は自分が今日1回でも積んだか（タブのドット用）。
            // 通算ブロックでも見るのは今日ぶん——前の日の積み上げで今日の催促が
            // 消えてしまうと、通算のいちばん大事な「毎日積む」が伝わらない
            cleared: raid.myTodayValue > 0,
            probability: 0,
            peak: 0,
            bestValue: 0,
            peakSource: 'default',
            participants: [],
            raid: raid,
            maintenance: false
        };
        return dailyMissionState;
    }

    const target = generateDailyMissionTarget(
        currentUser.uid, mission.dateKey, mission.exerciseKey, mission.peak
    );

    let totals = {};
    try {
        totals = await getDailyMissionTotals(mission.dateKey, mission.exerciseKey);
    } catch (e) {
        console.warn('[デイリーミッション] クリア判定に失敗:', e);
    }

    const participants = buildDailyParticipants({
        usersMap: users,
        dateKey: mission.dateKey,
        exerciseKey: mission.exerciseKey,
        totals: totals,
        myUserId: currentUser.uid,
        peak: mission.peak
    });

    const totalValue = totals[currentUser.uid] || 0;
    dailyMissionState = {
        dateKey: mission.dateKey,
        exerciseKey: mission.exerciseKey,
        target: target,
        totalValue: totalValue,
        cleared: totalValue >= target,
        probability: dailyTargetProbability(target, mission.peak),
        peak: mission.peak,
        bestValue: mission.bestValue,
        peakSource: mission.peakSource,
        participants: participants,
        raid: null,
        maintenance: false
    };
    return dailyMissionState;
}

// 分布グラフのviewBox座標系（web版 DistributionChart.tsx と同一）
const DIST_W = 360;
const DIST_PAD_X = 12;
const DIST_LANE_H = 20;
const DIST_LANE_TOP = 6;
const DIST_MAX_LANES = 12;
const DIST_PEAK_GAP = 18;  // ラベル段とカーブの間（「ピーク30」の見出しを置く）
const DIST_CURVE_H = 132;
const DIST_AXIS_H = 26;

/**
 * ラベル幅の目安（衝突判定とはみ出し防止用）
 * ⚠️ web版 DistributionChart.tsx: labelWidth と同じ式にすること（見た目がズレる）。
 */
function dailyLabelWidth(p) {
    return (p.cleared ? 11 : 0)
        + truncateLabelName(p.userName).length * 10
        + 4
        + String(p.target).length * 6.5
        + 4
        + formatDailyProbability(p.probability).length * 5.2
        + 6;
}

/**
 * みんなの目標の分布グラフSVGを組み立てる
 * @param {Array<Object>} participants
 * @param {string} unit
 * @param {number} peak - その日の分布のピーク回数
 * @returns {string} SVGのHTML
 */
function renderDailyDistributionSvg(participants, unit, peak) {
    if (!participants || participants.length === 0) return '';

    // 目盛りは抽選されうる範囲だけを映す（0から描くと分布が右端に寄る）
    const targets = participants.map(p => p.target);
    const bounds = dailyRepsBounds(peak);
    const win = dailyAxisWindow(
        Math.min.apply(null, [bounds.min].concat(targets)),
        Math.max.apply(null, [bounds.max].concat(targets))
    );
    const xMin = win.min;
    const xMax = win.max;
    const step = win.step;
    const toX = (v) => DIST_PAD_X + ((v - xMin) / (xMax - xMin)) * (DIST_W - DIST_PAD_X * 2);

    // ラベル段数に応じてグラフの高さを決める（重なりを段で解消するため）
    const widths = participants.map(dailyLabelWidth);
    const xs = participants.map(p => toX(p.target));
    // 左右端からのはみ出し防止で内側へ寄せてから段を決める。
    // 寄せた後の位置で判定しないと、端のラベルが隣と重なってしまう。
    const labelXs = xs.map((x, i) => Math.min(Math.max(x, widths[i] / 2 + 2), DIST_W - widths[i] / 2 - 2));
    const lanes = assignLabelLanes(labelXs, widths, DIST_MAX_LANES);
    const laneCount = Math.max(1, usedLaneCount(lanes));
    const curveTop = DIST_LANE_TOP + laneCount * DIST_LANE_H + DIST_PEAK_GAP;
    const baseY = curveTop + DIST_CURVE_H;
    const H = baseY + DIST_AXIS_H;

    const curve = buildDailyDistributionCurve(xMin, xMax, peak).map(pt => ({
        x: toX(pt.x),
        y: baseY - pt.y * DIST_CURVE_H
    }));

    const area = `M ${toX(xMin)} ${baseY} `
        + curve.map(pt => `L ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`).join(' ')
        + ` L ${toX(xMax)} ${baseY} Z`;
    const line = `M ${curve[0].x.toFixed(2)} ${curve[0].y.toFixed(2)} `
        + curve.slice(1).map(pt => `L ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`).join(' ');

    // カーブ上のyを線形補間で引く（点をカーブに乗せるため）
    const curveYAt = (value) => {
        const x = toX(value);
        for (let i = 1; i < curve.length; i++) {
            if (curve[i].x >= x) {
                const a = curve[i - 1];
                const b = curve[i];
                const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
                return a.y + (b.y - a.y) * t;
            }
        }
        return baseY;
    };

    let ticksHtml = '';
    for (let v = xMin; v <= xMax; v += step) {
        const x = toX(v).toFixed(2);
        ticksHtml += `<line x1="${x}" y1="${curveTop}" x2="${x}" y2="${baseY}" class="dm-grid"></line>`
            + `<text x="${x}" y="${baseY + 14}" class="dm-tick">${v}</text>`;
    }

    const peakX = toX(peak).toFixed(2);

    let pointsHtml = '';
    participants.forEach((p, i) => {
        const x = xs[i];
        const labelX = labelXs[i];
        const labelY = DIST_LANE_TOP + lanes[i] * DIST_LANE_H + DIST_LANE_H / 2;
        const dotY = curveYAt(p.target);
        const cls = p.isMe ? 'dm-me' : (p.cleared ? 'dm-done' : 'dm-todo');
        const r = p.isMe ? 5.5 : 4;

        pointsHtml += `<g class="${cls}">`
            + `<polyline points="${labelX.toFixed(2)},${(labelY + 8).toFixed(2)} ${x.toFixed(2)},${(dotY - 6).toFixed(2)} ${x.toFixed(2)},${dotY.toFixed(2)}" class="dm-connector"></polyline>`
            + `<circle cx="${x.toFixed(2)}" cy="${dotY.toFixed(2)}" r="${r}" class="dm-dot"></circle>`
            + (p.cleared ? `<circle cx="${x.toFixed(2)}" cy="${dotY.toFixed(2)}" r="${p.isMe ? 9 : 7.5}" class="dm-ring"></circle>` : '')
            + `<text x="${labelX.toFixed(2)}" y="${labelY.toFixed(2)}" class="dm-name">`
            + `${p.cleared ? '✓ ' : ''}${escapeHtml(truncateLabelName(p.userName))}`
            + `<tspan class="dm-value"> ${p.target}</tspan>`
            + `<tspan class="dm-prob"> ${escapeHtml(formatDailyProbability(p.probability))}</tspan></text>`
            + `</g>`;
    });

    return `
        <svg class="daily-dist-svg" viewBox="0 0 ${DIST_W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="みんなの目標回数の分布">
            <defs>
                <linearGradient id="dmArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" class="dm-area-top"></stop>
                    <stop offset="100%" class="dm-area-bottom"></stop>
                </linearGradient>
            </defs>
            ${ticksHtml}
            <text x="${DIST_W - DIST_PAD_X}" y="${H - 2}" class="dm-axis-unit">${escapeHtml(unit)}</text>
            <path d="${area}" fill="url(#dmArea)"></path>
            <path d="${line}" class="dm-curve"></path>
            <line x1="${peakX}" y1="${curveTop}" x2="${peakX}" y2="${baseY}" class="dm-peak-line"></line>
            <text x="${peakX}" y="${curveTop - 5}" class="dm-peak-label">ピーク${peak}</text>
            <line x1="${DIST_PAD_X}" y1="${baseY}" x2="${DIST_W - DIST_PAD_X}" y2="${baseY}" class="dm-axis"></line>
            ${pointsHtml}
        </svg>
    `;
}

/**
 * みんなの合計カードのHTMLを組み立てる
 * ⚠️ web版 DailyMissionView.tsx の「みんなの合計」ブロックと同じ構成にすること
 * @param {Array<Object>} participants
 * @param {string} unit
 * @returns {string} HTML（対象がいなければ空文字）
 */
function renderDailyTeamTotalCard(participants, unit) {
    if (!participants || participants.length === 0) return '';
    const team = buildDailyTeamProgress(participants);
    // 先頭が最多貢献者（貢献の多い順に並んでいる）
    const maxValue = team.contributors.length > 0 ? team.contributors[0].value : 0;

    const rowsHtml = team.contributors.map(c => {
        const width = (dailyContributionRatio(c.value, maxValue) * 100).toFixed(1);
        return `<li class="daily-team-row${c.isMe ? ' is-me' : ''}">`
            + `<span class="daily-team-name">${c.cleared ? '<i class="fa-solid fa-circle-check"></i>' : ''}${escapeHtml(c.userName)}</span>`
            + `<span class="daily-team-bar"><span class="daily-team-bar-fill${c.cleared ? ' cleared' : ''}" style="width:${width}%"></span></span>`
            + `<span class="daily-team-value">${formatDailyCount(c.value)}<span class="daily-team-target">/${c.target}</span></span>`
            + `</li>`;
    }).join('');

    return `
        <div class="daily-dist-card daily-team-card${team.cleared ? ' cleared' : ''}">
            <div class="daily-dist-head">
                <span><i class="fa-solid fa-people-group"></i> みんなの合計</span>
                <span class="daily-dist-count">${team.activeCount}/${team.contributors.length} 人が投稿</span>
            </div>
            <div class="daily-team-total">
                <span class="daily-team-total-value">${formatDailyCount(team.totalValue)}</span>
                <span class="daily-team-total-goal">/ ${formatDailyCount(team.goal)}${escapeHtml(unit)}</span>
            </div>
            <div class="daily-mission-progress">
                <div class="daily-mission-bar"><div class="daily-mission-bar-fill" style="width:${team.percent}%"></div></div>
                <div class="daily-mission-progress-text">
                    <span>${team.percent}%</span>
                    <span>${team.cleared ? 'みんなの目標を達成！' : `あと ${formatDailyCount(team.remaining)}${escapeHtml(unit)}`}</span>
                </div>
            </div>
            <ul class="daily-team-list">${rowsHtml}</ul>
            <p class="daily-dist-note">今日ログインした人ぜんぶの合計。目標はみんなの目標を足した数字です。</p>
        </div>
    `;
}

/**
 * レイド開始前のメンテナンス告知カードのHTMLを組み立てる
 * ⚠️ web版 DailyMissionView.tsx のメンテナンス表示と同じ構成にすること
 * @param {string} dateKey
 * @returns {string} HTML
 */
function renderRaidMaintenanceCard(dateKey) {
    return `
        <div class="daily-mission-card raid-maintenance-card">
            <div class="daily-mission-badge raid-maintenance-badge">
                <i class="fa-solid fa-screwdriver-wrench"></i> メンテナンス中
            </div>
            <div class="daily-mission-date">${escapeHtml(formatDailyDateLabel(dateKey))}</div>
            <p class="raid-maintenance-lead">
                本日のデイリーミッションはお休みです。<br>
                明日 0:00 から${escapeHtml(RAID_MODE_LABEL)}がはじまります。
            </p>
            <div class="raid-countdown-box">
                <span class="raid-countdown-label"><i class="fa-solid fa-dragon"></i> ${escapeHtml(RAID_TITLE)} まで</span>
                <span class="raid-countdown" id="raid-countdown">まもなく</span>
            </div>
            <ul class="raid-maintenance-list">
                <li><i class="fa-solid fa-people-group"></i> 毎日ひとつの種目をピックアップ。<strong>その日にやった全員ぶんの回数を合計</strong>して目標に挑みます。</li>
                <li><i class="fa-solid fa-dumbbell"></i> 1日目は<strong>全員で腕立て1,000回</strong>。</li>
                <li><i class="fa-solid fa-calendar-week"></i> 来週は夏休みのため、週間チャレンジは1週間お休み（種目の選出なし）。</li>
            </ul>
        </div>
    `;
}

/**
 * 指定時刻までのカウントダウンを1秒ごとに更新する。
 * 対象の要素が消えたら（タブ切り替え・日付変更）自動で止まる。
 * 0になったら onZero を1度だけ呼ぶ（入力解禁の画面差し替え用）。
 * @param {number} targetMs - 目標時刻（epoch ms）
 * @param {string} elementId - 書き込む要素のID
 * @param {Function} [onZero]
 */
function startRaidCountdown(targetMs, elementId = 'raid-countdown', onZero) {
    if (raidCountdownTimer) {
        clearInterval(raidCountdownTimer);
        raidCountdownTimer = null;
    }
    let fired = false;
    const tick = () => {
        const el = document.getElementById(elementId);
        if (!el) {
            clearInterval(raidCountdownTimer);
            raidCountdownTimer = null;
            return;
        }
        const diff = Math.max(0, targetMs - Date.now());
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.textContent = `${h}時間${String(m).padStart(2, '0')}分${String(s).padStart(2, '0')}秒`;
        if (diff <= 0 && !fired) {
            fired = true;
            clearInterval(raidCountdownTimer);
            raidCountdownTimer = null;
            if (typeof onZero === 'function') onZero();
        }
    };
    tick();
    raidCountdownTimer = setInterval(tick, 1000);
}

/**
 * レイドの投稿セクション（入力解禁前はロック表示）のHTMLを組み立てる
 * ⚠️ web版 DailyMissionView.tsx の投稿ブロックと同じ構成にすること
 * @param {string} dateKey
 * @param {string} unit
 * @returns {string} HTML
 */
function renderRaidPostSection(dateKey, unit) {
    if (!isRaidInputOpen(dateKey)) {
        return `
            <div class="daily-mission-post raid-locked-post">
                <h3><i class="fa-solid fa-lock"></i> 入力開始まで</h3>
                <div class="raid-countdown-box">
                    <span class="raid-countdown-label"><i class="fa-solid fa-clock"></i> 7:00 まで</span>
                    <span class="raid-countdown" id="raid-open-countdown">まもなく</span>
                </div>
                <p class="daily-mission-note">${escapeHtml(RAID_INPUT_GATE_NOTE)}</p>
            </div>
        `;
    }
    const gateNote = isRaidInputGatedDay(dateKey)
        ? `<p class="daily-mission-note raid-gate-note"><i class="fa-solid fa-circle-info"></i> ${escapeHtml(RAID_INPUT_GATE_NOTE)}</p>`
        : '';
    const postBlock = getRaidBlockForDate(dateKey);
    return `
        <div class="daily-mission-post">
            <h3><i class="fa-solid fa-pen-to-square"></i> 記録を投稿</h3>
            <div class="daily-mission-input-row">
                <input type="number" id="daily-mission-value" placeholder="${escapeHtml(unit)}数" min="1" max="10000">
                <span class="daily-mission-unit">${escapeHtml(unit)}</span>
                <button type="button" class="btn-primary" id="daily-mission-submit">投稿する</button>
            </div>
            <p class="daily-mission-note">何回かに分けてもOK。投稿するとすぐレイドの${postBlock ? `${postBlock.dateKeys.length}日通算` : '合計'}に加算されます（フリーモードの記録としても集計されます）。</p>
            ${gateNote}
            <p id="daily-mission-error" class="error-message"></p>
        </div>
    `;
}

/**
 * レイドの貢献一覧カードのHTMLを組み立てる
 * ⚠️ web版 DailyMissionView.tsx の「みんなの貢献」ブロックと同じ構成にすること
 * @param {Object} raid - buildRaidProgress の結果
 * @param {string} unit
 * @returns {string} HTML
 */
function renderRaidContributionCard(raid, unit) {
    // 先頭が最多貢献者（貢献の多い順に並んでいる）
    const maxValue = raid.contributors.length > 0 ? raid.contributors[0].value : 0;
    const block = raid.block;
    const rowsHtml = raid.contributors.map(c => {
        const width = (raidContributionRatio(c.value, maxValue) * 100).toFixed(1);
        return `<li class="daily-team-row${c.isMe ? ' is-me' : ''}">`
            + `<span class="daily-team-name">${escapeHtml(c.userName)}</span>`
            + `<span class="daily-team-bar"><span class="daily-team-bar-fill" style="width:${width}%"></span></span>`
            + `<span class="daily-team-value">${formatDailyCount(c.value)}<span class="daily-team-target"> ${Math.round(c.share * 100)}%</span></span>`
            + `</li>`;
    }).join('');

    const note = block
        ? `並ぶのは今日ログインした人と、この${block.dayCount}日間で投稿した人。回数と％は${escapeHtml(formatRaidMonthDay(block.startDateKey))}からの通算です。`
            + `あなたの通算は ${formatDailyCount(raid.myValue)}${escapeHtml(unit)}（うち今日 ${formatDailyCount(raid.myTodayValue)}${escapeHtml(unit)}）。`
        : `並ぶのは今日ログインした人だけ。右の％はみんなの合計に占める割合です。あなたの今日の合計は ${formatDailyCount(raid.myValue)}${escapeHtml(unit)}。`;

    return `
        <div class="daily-dist-card daily-team-card">
            <div class="daily-dist-head">
                <span><i class="fa-solid fa-people-group"></i> みんなの貢献${block ? `（${block.dayCount}日通算）` : ''}</span>
                <span class="daily-dist-count">${raid.activeCount}/${raid.contributors.length} 人が参加</span>
            </div>
            <ul class="daily-team-list">${rowsHtml}</ul>
            <p class="daily-dist-note">${note}</p>
        </div>
    `;
}

/**
 * 日付キーを「8/14」形式にする（レイドの文言用）
 * @param {string} dateKey
 * @returns {string}
 */
function formatRaidMonthDay(dateKey) {
    const parts = String(dateKey || '').split('-');
    if (parts.length !== 3) return String(dateKey || '');
    return `${Number(parts[1])}/${Number(parts[2])}`;
}

/**
 * レイド開催中のミッションカードのHTMLを組み立てる
 * ⚠️ web版 DailyMissionView.tsx のレイド表示と同じ構成にすること
 * @param {Object} state - dailyMissionState（raid あり）
 * @param {Object} ex - 種目
 * @param {string} unit
 * @returns {string} HTML
 */
function renderRaidCard(state, ex, unit) {
    const raid = state.raid;
    const block = raid.block;
    const badgeLabel = raid.cleared
        ? '討伐完了'
        : (block
            ? `通算 ${block.dayIndex} / ${block.dayCount}日目（Day ${raid.day}）`
            : `Day ${raid.day} / ${RAID_TOTAL_DAYS}`);
    const formulaText = block
        ? `${escapeHtml(formatRaidMonthDay(block.startDateKey))}の前日にログインした ${raid.memberCount}人 × 1人${raid.perPerson}${escapeHtml(unit)}（${block.dayCount}日通算）`
        : `昨日ログインした ${raid.memberCount}人 × 1人${raid.perPerson}${escapeHtml(unit)}`;
    const goalNote = block
        ? `<p class="raid-goal-note"><i class="fa-solid fa-users"></i> ボスの体力は<strong>ブロック開始の前日のログイン人数</strong>で決まります。${block.dayCount}日間ずっと同じ体力なので、積み上げた割合の意味も途中で変わりません。</p>`
        : `<p class="raid-goal-note"><i class="fa-solid fa-users"></i> ボスの体力は<strong>前日のログイン人数</strong>で決まります。0:00の時点で決まるので、今日どれだけ人が増えても体力は動きません。</p>`;
    return `
        <div class="daily-mission-card raid-card${raid.cleared ? ' cleared' : ''}">
            <div class="daily-mission-badge raid-badge">
                <i class="fa-solid ${raid.cleared ? 'fa-circle-check' : 'fa-dragon'}"></i>
                ${badgeLabel}
            </div>
            <div class="daily-mission-date">${escapeHtml(formatDailyDateLabel(state.dateKey))}</div>
            <div class="daily-mission-exercise">
                <span class="daily-mission-icon"><i class="fa-solid ${escapeHtml(ex.icon || 'fa-dumbbell')}"></i></span>
                <span class="daily-mission-name">${escapeHtml(ex.name || state.exerciseKey)}</span>
            </div>
            <div class="daily-mission-target raid-goal">
                <span class="daily-mission-target-label"><i class="fa-solid fa-dragon"></i> レイドボスの体力${block ? `（${block.dayCount}日通算）` : ''}</span>
                <span class="daily-mission-target-value">${formatDailyCount(raid.goal)}<span class="daily-mission-target-unit">${escapeHtml(unit)}</span></span>
                ${raid.perPerson != null ? `<span class="daily-mission-target-prob">${formulaText}</span>` : ''}
                <span class="daily-mission-target-prob">${escapeHtml(raid.label)}</span>
            </div>
            ${raid.perPerson != null ? goalNote : ''}
            <div class="daily-team-total">
                <span class="daily-team-total-value">${formatDailyCount(raid.totalValue)}</span>
                <span class="daily-team-total-goal">/ ${formatDailyCount(raid.goal)}${escapeHtml(unit)}${block ? `（うち今日 ${formatDailyCount(raid.todayValue)}${escapeHtml(unit)}）` : ''}</span>
            </div>
            <div class="daily-mission-progress">
                <div class="daily-mission-bar"><div class="daily-mission-bar-fill" style="width:${raid.percent}%"></div></div>
                <div class="daily-mission-progress-text">
                    <span>${raid.percent}%</span>
                    <span>${raid.cleared ? '討伐完了！' : `残り体力 ${formatDailyCount(raid.remaining)}${escapeHtml(unit)}`}</span>
                </div>
            </div>
            ${ex.rule ? `<p class="daily-mission-rule">${escapeHtml(ex.rule)}</p>` : ''}
        </div>
    `;
}

/**
 * デイリーミッションタブを描画する
 * @param {boolean} forceRefresh - Firestoreから再取得する
 */
async function renderDailyMissionTab(forceRefresh = false) {
    const container = document.getElementById('daily-mission-content');
    if (!container) return;

    if (forceRefresh || !dailyMissionState) {
        container.innerHTML = '<p style="text-align:center;color:#999;padding:24px;"><i class="fa-solid fa-circle-notch fa-spin"></i> 読み込み中...</p>';
        try {
            await loadDailyMissionState();
        } catch (e) {
            console.error('[デイリーミッション] 読み込みエラー:', e);
            container.innerHTML = '<p style="text-align:center;color:#999;padding:24px;">読み込みに失敗しました。更新ボタンをお試しください。</p>';
            return;
        }
    }

    onDailyMissionStateChanged();

    if (!dailyMissionState) {
        container.innerHTML = '<p style="text-align:center;color:#999;padding:24px;"><i class="fa-solid fa-dumbbell"></i> 対象になる種目がまだありません。ルールタブから追加してください。</p>';
        return;
    }

    // レイド開始前のメンテナンス日はミッションを出さず、告知だけ表示する
    if (dailyMissionState.maintenance) {
        container.innerHTML = renderRaidMaintenanceCard(dailyMissionState.dateKey);
        startRaidCountdown(getDailyBoundariesJST(RAID_START_DATE_KEY).start.getTime());
        return;
    }

    const { exerciseKey, target, totalValue, cleared, dateKey, peak, bestValue, peakSource, probability } = dailyMissionState;
    const ex = freeExercises[exerciseKey] || {};
    const unit = guessExerciseUnit(ex.name || '');

    // レイド開催中は個人目標も分布グラフも無く、みんなの合計だけを見る
    if (dailyMissionState.raid) {
        const raid = dailyMissionState.raid;
        container.innerHTML = `
            <div class="raid-lead">
                <span class="raid-lead-badge"><i class="fa-solid fa-dragon"></i> ${escapeHtml(RAID_MODE_LABEL)}</span>
                ${raid.block
                    ? `ここからの${raid.block.dayCount}日（${escapeHtml(formatRaidMonthDay(raid.block.startDateKey))}〜${escapeHtml(formatRaidMonthDay(raid.block.endDateKey))}）は「${escapeHtml(raid.block.title)}」の1種目だけ。日ごとに区切らず、<strong>${raid.block.dayCount}日間の合計</strong>で1体のボスを削り切ります。前の日に積んだぶんは最終日まで残ります。`
                    : '今日の種目を全員で積み上げて、レイドボスの体力を削り切ります。個人の目標回数はありません。'}
            </div>

            ${renderRaidCard(dailyMissionState, ex, unit)}

            ${renderRaidContributionCard(raid, unit)}

            ${renderRaidPostSection(dailyMissionState.dateKey, unit)}
        `;
        if (isRaidInputOpen(dailyMissionState.dateKey)) {
            bindDailyMissionPostForm();
        } else {
            // 7:00になったら自動で入力フォームに差し替える（リロード不要）
            startRaidCountdown(
                getRaidInputOpenAt(dailyMissionState.dateKey).getTime(),
                'raid-open-countdown',
                () => renderDailyMissionTab(true)
            );
        }
        return;
    }
    const percent = Math.min(100, Math.round((totalValue / target) * 100));
    const remaining = Math.max(0, target - totalValue);
    const participants = dailyMissionState.participants || [];
    const clearedCount = participants.filter(p => p.cleared).length;

    container.innerHTML = `
        <div class="daily-mission-card${cleared ? ' cleared' : ''}">
            <div class="daily-mission-badge">
                <i class="fa-solid ${cleared ? 'fa-circle-check' : 'fa-fire'}"></i>
                ${cleared ? 'クリア済み' : '挑戦中'}
            </div>
            <div class="daily-mission-date">${escapeHtml(formatDailyDateLabel(dateKey))}</div>
            <div class="daily-mission-exercise">
                <span class="daily-mission-icon"><i class="fa-solid ${escapeHtml(ex.icon || 'fa-dumbbell')}"></i></span>
                <span class="daily-mission-name">${escapeHtml(ex.name || exerciseKey)}</span>
            </div>
            <div class="daily-mission-target">
                <span class="daily-mission-target-label">あなたの目標</span>
                <span class="daily-mission-target-value">${target}<span class="daily-mission-target-unit">${escapeHtml(unit)}</span></span>
                <span class="daily-mission-target-prob">この数字を引く確率 ${escapeHtml(formatDailyProbability(probability))}</span>
            </div>
            <div class="daily-mission-progress">
                <div class="daily-mission-bar"><div class="daily-mission-bar-fill" style="width:${percent}%"></div></div>
                <div class="daily-mission-progress-text">
                    <span>今日の合計 ${totalValue}${escapeHtml(unit)}</span>
                    <span>${cleared ? '達成！' : `あと ${remaining}${escapeHtml(unit)}`}</span>
                </div>
            </div>
            ${ex.rule ? `<p class="daily-mission-rule">${escapeHtml(ex.rule)}</p>` : ''}
        </div>

        ${renderDailyTeamTotalCard(participants, unit)}

        ${participants.length > 0 ? `
        <div class="daily-dist-card">
            <div class="daily-dist-head">
                <span><i class="fa-solid fa-chart-simple"></i> みんなの目標</span>
                <span class="daily-dist-count">${clearedCount}/${participants.length} 人クリア</span>
            </div>
            ${renderDailyDistributionSvg(participants, unit, peak)}
            <p class="daily-dist-note">並ぶのは今日ログインした人だけ。名前の横の％は、その回数を引く確率です。目標は ${peak}${escapeHtml(unit)} をピークに、大きい側を狭めた分布から一人ひとり抽選されます${peakSource === 'best' ? `（ピークはこの種目の過去最高 ${bestValue}${escapeHtml(unit)}）` : '（この種目はまだ投稿が無いので 30 がピーク）'}。</p>
        </div>
        ` : ''}

        <div class="daily-mission-post">
            <h3><i class="fa-solid fa-pen-to-square"></i> 記録を投稿</h3>
            <div class="daily-mission-input-row">
                <input type="number" id="daily-mission-value" placeholder="${escapeHtml(unit)}数" min="1" max="10000">
                <span class="daily-mission-unit">${escapeHtml(unit)}</span>
                <button type="button" class="btn-primary" id="daily-mission-submit">投稿する</button>
            </div>
            <p class="daily-mission-note">その日の投稿を合計して判定するので、何回かに分けてもOK。この投稿はフリーモードの記録としても集計されます。</p>
            <p id="daily-mission-error" class="error-message"></p>
        </div>
    `;

    bindDailyMissionPostForm();
}

/**
 * 積み上げ得点タブを描画する
 * ⚠️ web版 RaidScoreView.tsx と同じ構成にすること
 * @param {boolean} forceRefresh - Firestoreから再取得する
 */
async function renderRaidScoreTab(forceRefresh = false) {
    const container = document.getElementById('raid-score-content');
    if (!container) return;

    if (forceRefresh || !raidScoreboardCache) {
        container.innerHTML = '<p style="text-align:center;color:#999;padding:24px;"><i class="fa-solid fa-circle-notch fa-spin"></i> 集計中...</p>';
        try {
            raidScoreboardCache = await loadRaidScoreboard();
        } catch (e) {
            console.error('[レイド] 得点の読み込みエラー:', e);
            container.innerHTML = '<p style="text-align:center;color:#999;padding:24px;">読み込みに失敗しました。更新ボタンをお試しください。</p>';
            return;
        }
    }

    const board = raidScoreboardCache;
    if (!board || board.playedDays === 0) {
        container.innerHTML = '<p style="text-align:center;color:#999;padding:24px;"><i class="fa-solid fa-dragon"></i> レイドはまだ始まっていません。</p>';
        return;
    }

    const maxPoints = board.standings.length > 0 ? board.standings[0].totalPoints : 0;
    const standingsHtml = board.standings.length === 0
        ? '<p style="text-align:center;color:#999;padding:16px;">まだ誰も投稿していません。</p>'
        : board.standings.map(s => {
            const width = (raidContributionRatio(s.totalPoints, maxPoints) * 100).toFixed(1);
            const medal = s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : '';
            return `<li class="raid-rank-row${s.isMe ? ' is-me' : ''}">
                <span class="raid-rank-no">${medal || s.rank}</span>
                <span class="raid-rank-name">${escapeHtml(s.userName)}<span class="raid-rank-days">${s.activeDays}日参加</span></span>
                <span class="raid-rank-bar"><span class="raid-rank-bar-fill" style="width:${width}%"></span></span>
                <span class="raid-rank-pt">${formatRaidPoints(s.totalPoints)}<span class="raid-rank-pt-unit">点</span></span>
            </li>`;
        }).join('');

    const daysHtml = board.days.map(d => {
        const ex = d.exerciseKey ? (freeExercises[d.exerciseKey] || {}) : {};
        const unit = guessExerciseUnit(ex.name || '');
        const topHtml = d.entries.length === 0
            ? '<span class="raid-day-empty">投稿なし</span>'
            : d.entries.slice(0, 3).map(e =>
                `<span class="raid-day-top${e.isMe ? ' is-me' : ''}">${escapeHtml(truncateLabelName(e.userName))} ${formatRaidPoints(e.points)}点</span>`
            ).join('');
        // 通算ブロックの日は1日ぶんの目標を持たないので、合計だけを出す
        const status = d.blockId
            ? '通算に加算'
            : (d.cleared ? '<i class="fa-solid fa-circle-check"></i> 討伐' : `${Math.min(100, Math.round(d.goal > 0 ? d.totalValue / d.goal * 100 : 0))}%`);
        const total = d.blockId
            ? `${formatDailyCount(d.totalValue)}${escapeHtml(unit)}`
            : `${formatDailyCount(d.totalValue)} / ${formatDailyCount(d.goal)}${escapeHtml(unit)}${d.perPerson != null ? `<span class="raid-day-formula">（${d.memberCount}人×${d.perPerson}）</span>` : ''}`;
        return `<div class="raid-day-card${d.cleared ? ' cleared' : ''}">
            <div class="raid-day-head">
                <span class="raid-day-label">Day ${d.day} <span class="raid-day-date">${escapeHtml(formatDailyDateLabel(d.dateKey))}</span></span>
                <span class="raid-day-status">${status}</span>
            </div>
            <div class="raid-day-body">
                <span class="raid-day-ex"><i class="fa-solid ${escapeHtml(ex.icon || 'fa-dumbbell')}"></i> ${escapeHtml(ex.name || '種目未定')}</span>
                <span class="raid-day-total">${total}</span>
            </div>
            <div class="raid-day-tops">${topHtml}</div>
        </div>`;
    }).join('');

    // 通算ブロック（例：複合種目総合1）は期間ぶんをまとめて1枚のカードにする
    const blocksHtml = (board.blocks || []).map(b => {
        const ex = b.exerciseKey ? (freeExercises[b.exerciseKey] || {}) : {};
        const unit = guessExerciseUnit(ex.name || '');
        const topHtml = b.entries.length === 0
            ? '<span class="raid-day-empty">投稿なし</span>'
            : b.entries.slice(0, 3).map(e =>
                `<span class="raid-day-top${e.isMe ? ' is-me' : ''}">${escapeHtml(truncateLabelName(e.userName))} ${formatDailyCount(e.value)}${escapeHtml(unit)}</span>`
            ).join('');
        return `<div class="daily-dist-card">
            <div class="daily-dist-head">
                <span><i class="fa-solid fa-layer-group"></i> ${escapeHtml(b.title)}（${b.dayCount}日通算）</span>
                <span class="daily-dist-count">${b.playedDays}/${b.dayCount} 日終了</span>
            </div>
            <div class="raid-day-list">
                <div class="raid-day-card${b.cleared ? ' cleared' : ''}">
                    <div class="raid-day-head">
                        <span class="raid-day-label">${escapeHtml(formatDailyDateLabel(b.startDateKey))} <span class="raid-day-date">〜${escapeHtml(formatDailyDateLabel(b.endDateKey))}</span></span>
                        <span class="raid-day-status">${b.cleared ? '<i class="fa-solid fa-circle-check"></i> 討伐' : `${b.percent}%`}</span>
                    </div>
                    <div class="raid-day-body">
                        <span class="raid-day-ex"><i class="fa-solid ${escapeHtml(ex.icon || 'fa-dumbbell')}"></i> ${escapeHtml(ex.name || '種目未定')}</span>
                        <span class="raid-day-total">${formatDailyCount(b.totalValue)} / ${formatDailyCount(b.goal)}${escapeHtml(unit)}${b.perPersonTotal != null ? `<span class="raid-day-formula">（${b.memberCount}人×${b.perPersonTotal}）</span>` : ''}</span>
                    </div>
                    <div class="raid-day-tops">${topHtml}</div>
                </div>
            </div>
            <p class="daily-dist-note">${escapeHtml(b.label)}日ごとに区切らず、期間の合計で討伐判定をします（得点はこれまでどおり日ごとに分け合います）。</p>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div class="raid-score-lead">
            <span class="raid-lead-badge"><i class="fa-solid fa-dragon"></i> ${escapeHtml(RAID_MODE_LABEL)}</span>
            その日の合計に占める貢献度（％）をそのまま点にして、開催期間ぶん積み上げます。
            1日の持ち点は${RAID_POINTS_PER_DAY}点で、参加した人で分け合う形です。
            たくさんやった人ほど点は増えますが、少人数の日に参加するほど1回あたりの重みも大きくなります。
        </div>

        <div class="daily-dist-card">
            <div class="daily-dist-head">
                <span><i class="fa-solid fa-ranking-star"></i> 積み上げ得点</span>
                <span class="daily-dist-count">${board.playedDays}/${RAID_TOTAL_DAYS} 日終了</span>
            </div>
            <ul class="raid-rank-list">${standingsHtml}</ul>
        </div>

        ${blocksHtml}

        <div class="daily-dist-card">
            <div class="daily-dist-head">
                <span><i class="fa-solid fa-calendar-day"></i> 日ごとの結果</span>
            </div>
            <div class="raid-day-list">${daysHtml}</div>
            <p class="daily-dist-note">各日の上位3人と、その日の点を表示しています。</p>
        </div>
    `;
}

/**
 * デイリーミッション（レイド含む）の投稿フォームにハンドラを付ける
 */
function bindDailyMissionPostForm() {
    const submitBtn = document.getElementById('daily-mission-submit');
    const valueInput = document.getElementById('daily-mission-value');
    if (!submitBtn || !valueInput) return;
    submitBtn.addEventListener('click', submitDailyMissionPost);
    valueInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            submitDailyMissionPost();
        }
    });
}

/**
 * デイリーミッションの記録を投稿する（モードに関わらず posts_free へ）
 */
async function submitDailyMissionPost() {
    const errorEl = document.getElementById('daily-mission-error');
    const valueInput = document.getElementById('daily-mission-value');
    if (!dailyMissionState || !valueInput) return;

    const value = parseInt(valueInput.value);
    if (!value || value <= 0 || isNaN(value) || value > 10000) {
        errorEl.textContent = '回数または秒数を正しく入力してください（1〜10000）';
        return;
    }

    // 画面を開いたまま日付をまたいだ場合などに備え、送信時にも解禁を確認する
    if (dailyMissionState.raid && !isRaidInputOpen(dailyMissionState.dateKey)) {
        errorEl.textContent = 'レイドの入力は7:00からです。';
        renderDailyMissionTab(false);
        return;
    }

    try {
        await db.collection('posts_free').add({
            userId: currentUser.uid,
            userEmail: currentUser.email,
            exerciseType: dailyMissionState.exerciseKey,
            value: value,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            likes: [],
            comments: []
        });

        // 積み上げ得点も投稿で変わるので破棄する
        raidScoreboardCache = null;
        // posts_free は free/weekly の両モードが共有するため両方のキャッシュを破棄
        ['free', 'weekly'].forEach(mode => {
            rankingCache[mode] = null;
            rankingCacheTime[mode] = null;
            scoreCache[mode] = null;
            scoreCacheTime[mode] = null;
            progressCache[mode] = {};
            postsCache[mode] = null;
            postsCacheTime[mode] = null;
        });

        errorEl.textContent = '';
        valueInput.value = '';

        const wasCleared = dailyMissionState.cleared;
        const wasRaidCleared = !!(dailyMissionState.raid && dailyMissionState.raid.cleared);
        // 再取得して「その日の合計」で達成を判定し直す
        await renderDailyMissionTab(true);

        const st = dailyMissionState;
        const unit = st ? guessExerciseUnit((freeExercises[st.exerciseKey] || {}).name || '') : '回';
        // レイドは個人目標が無いので、みんなの合計で知らせる
        if (st && st.raid) {
            const raid = st.raid;
            if (raid.cleared && !wasRaidCleared) {
                alert('レイド討伐完了！ おつかれさま 🎉');
            } else if (raid.cleared) {
                alert(`投稿しました！（みんなの合計 ${formatDailyCount(raid.totalValue)}${unit}）`);
            } else {
                alert(`投稿しました！（みんなであと ${formatDailyCount(raid.remaining)}${unit}）`);
            }
            return;
        }
        if (!wasCleared && st && st.cleared) {
            alert('デイリーミッション達成！おつかれさま 🎉');
        } else if (st && !st.cleared) {
            alert(`投稿しました！（合計 ${st.totalValue}${unit} / あと ${Math.max(0, st.target - st.totalValue)}${unit}）`);
        } else {
            alert(`投稿しました！（合計 ${st ? st.totalValue : value}${unit}）`);
        }
    } catch (error) {
        errorEl.textContent = '投稿に失敗しました。もう一度お試しください。';
        console.error('[デイリーミッション] 投稿エラー:', error);
    }
}

/**
 * デイリーミッションの状態が変わったあとのUI反映をまとめて行う。
 * 週間チャレンジの投稿ロックはクリア状況に連動するので、ここで作り直す。
 */
function onDailyMissionStateChanged() {
    updateDailyMissionBadge();
    if (currentMode !== 'weekly') return;
    // 入力中のカードを閉じてしまわないよう、ロック状態が変わったときだけ作り直す
    if (isWeeklyPostLockedByDailyMission() === weeklyPostLockRendered) return;
    updateWeeklyPostDropdown();
}

/**
 * 未クリアならタブボタンに赤ドットを表示する
 */
function updateDailyMissionBadge() {
    const pending = !!(dailyMissionState && !dailyMissionState.cleared);
    document.querySelectorAll('.tab-btn[data-tab="daily"] .daily-mission-dot').forEach(dot => {
        dot.style.display = pending ? 'block' : 'none';
    });
}

/**
 * デイリーミッションタブに切り替える
 */
function switchToDailyMissionTab() {
    const btn = document.querySelector(`.tab-btn[data-tab="daily"][data-mode="${currentMode}"]`);
    if (btn) btn.click();
}

/**
 * 起動時、今日のミッションが未クリアならデイリーミッションタブを開く。
 * 一度きり（以降ユーザーの操作を妨げない）。
 */
async function maybeOpenDailyMissionOnStart() {
    if (dailyMissionAutoNavDone) return;
    if (currentMode !== 'free' && currentMode !== 'weekly' && currentMode !== 'raid') return;
    dailyMissionAutoNavDone = true;

    try {
        await loadDailyMissionState();
    } catch (e) {
        console.warn('[デイリーミッション] 起動時チェック失敗:', e);
        return;
    }

    onDailyMissionStateChanged();
    if (dailyMissionState && !dailyMissionState.cleared) {
        switchToDailyMissionTab();
    }
}

// ====================================================================
// 歴代チャンプ機能
// ====================================================================

/**
 * 指定日が年初から数えて第何週目かを計算する
 * @param {Date} date - UTC Date（JST変換済みであること想定）
 * @returns {number} 週番号
 */
function getWeekNumberOfYear(date) {
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const diffMs = date.getTime() - yearStart.getTime();
    return Math.ceil((diffMs / (24 * 60 * 60 * 1000) + 1) / 7);
}

/**
 * 週開始日時から歴代チャンプdocIdを作成
 * @param {Date} weekStart
 * @returns {{ docId: string, year: number, weekNumber: number, monJST: Date, friJST: Date }}
 */
function buildChampionDocMeta(weekStart) {
    const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const monJST = new Date(weekStart.getTime() + JST_OFFSET_MS + 1 * 24 * 60 * 60 * 1000);
    const friJST = new Date(weekStart.getTime() + JST_OFFSET_MS + 5 * 24 * 60 * 60 * 1000);
    const weekNumber = getWeekNumberOfYear(monJST);
    const year = monJST.getUTCFullYear();
    const docId = `${year}_W${String(weekNumber).padStart(2, '0')}`;
    return { docId, year, weekNumber, monJST, friJST };
}

/**
 * 週間表示ラベルを作成
 * @param {Date} monJST
 * @param {Date} friJST
 * @returns {string}
 */
function formatWeeklyPeriodLabel(monJST, friJST) {
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const formatDate = (d) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${dayNames[d.getUTCDay()]})`;
    return `${formatDate(monJST)} 〜 ${formatDate(friJST)}`;
}

/**
 * その週のチャンプ確定時刻（JST土曜0:00）をUTC Dateで取得
 * @param {Date} weekStart
 * @returns {Date|null}
 */
function getChampionDecisionTimeUTC(weekStart) {
    if (!weekStart || !(weekStart instanceof Date)) return null;
    const { monJST } = buildChampionDocMeta(weekStart);
    return new Date(monJST.getTime() + 5 * 24 * 60 * 60 * 1000); // 土曜0:00 JST
}

/**
 * その週のチャンプが確定済みか
 * @param {Date} weekStart
 * @param {Date} [now]
 * @returns {boolean}
 */
function isChampionWeekDecided(weekStart, now = new Date()) {
    const decisionTime = getChampionDecisionTimeUTC(weekStart);
    if (!decisionTime) return true;
    return now.getTime() >= decisionTime.getTime();
}

/**
 * 対象週の種目別Top5・総合チャンプ情報を作成
 * @param {Object} weeklyData - { weekStart, weekEnd, exercises }
 * @param {Object} options
 * @returns {Promise<Object|null>}
 */
async function buildWeeklyChampionPayload(weeklyData, options = {}) {
    const { postsSnapshot: externalPostsSnapshot = null, usersSnapshot: externalUsersSnapshot = null } = options;
    const { weekStart, weekEnd, exercises } = weeklyData;

    if (!freeExercisesLoaded) {
        await loadFreeExercises();
    }

    const exerciseKeys = (exercises || []).filter(k => freeExercises[k]);
    if (exerciseKeys.length === 0) return null;

    const weeklyConfig = await getWeeklyConfig();
    const streakEnabled = !!weeklyConfig.enableStreak;

    const postsSnapshot = externalPostsSnapshot || await db.collection('posts_free').get();
    const usersSnapshot = externalUsersSnapshot || await db.collection('users').get();

    const usersData = {};
    usersSnapshot.forEach(doc => {
        const data = doc.data();
        usersData[doc.id] = data.userName || data.email;
    });

    const userRecords = {};

    postsSnapshot.forEach(doc => {
        const post = doc.data();
        if (!post.timestamp) return;

        const postDate = post.timestamp.toDate();
        if (postDate < weekStart || postDate >= weekEnd) return;
        if (!isWeekdayJST(postDate)) return;
        if (!exerciseKeys.includes(post.exerciseType)) return;

        const { userId, exerciseType, value } = post;
        const numericValue = Number(value) || 0;
        if (numericValue <= 0) return;

        if (!userRecords[userId]) {
            userRecords[userId] = {
                userName: usersData[userId] || post.userEmail || 'Unknown',
                exercises: {},
                scores: {},
                totalScore: 0,
                postedDays: new Set()
            };
        }

        const dIdx = weekdayIndexJST(postDate);
        if (dIdx >= 0) userRecords[userId].postedDays.add(dIdx);

        // バーバリアン方式: 最小値をベストとする
        const isBarbarian = freeExercises[exerciseType] && freeExercises[exerciseType].barbarian;
        if (isBarbarian) {
            if (!userRecords[userId].exercises[exerciseType] || userRecords[userId].exercises[exerciseType] > numericValue) {
                userRecords[userId].exercises[exerciseType] = numericValue;
            }
        } else {
            if (!userRecords[userId].exercises[exerciseType] || userRecords[userId].exercises[exerciseType] < numericValue) {
                userRecords[userId].exercises[exerciseType] = numericValue;
            }
        }
    });

    const exerciseTop5 = {};
    const exerciseRecords = {};

    exerciseKeys.forEach(exerciseKey => {
        const isBarbarian = freeExercises[exerciseKey] && freeExercises[exerciseKey].barbarian;
        const leaderboard = Object.entries(userRecords)
            .map(([userId, user]) => ({
                userId,
                userName: user.userName,
                value: Number(user.exercises[exerciseKey] || 0)
            }))
            .filter(item => item.value > 0)
            .sort((a, b) => {
                // バーバリアン: 昇順（短いタイムが上位）、通常: 降順
                const diff = isBarbarian ? (a.value - b.value) : (b.value - a.value);
                if (Math.abs(diff) > RANKING_TIE_EPSILON) return diff;
                return a.userId.localeCompare(b.userId);
            });

        const bestValue = leaderboard.length > 0 ? leaderboard[0].value : 0;
        const top5 = [];
        let previousValue = null;
        let currentRank = 0;

        leaderboard.slice(0, 5).forEach((entry, index) => {
            if (previousValue !== null && Math.abs(entry.value - previousValue) <= RANKING_TIE_EPSILON) {
                // 同率順位(競技順位): rank据え置き
            } else {
                currentRank = index + 1;
            }
            previousValue = entry.value;

            // バーバリアン: bestTime / selfTime * 100, 通常: selfValue / maxValue * 100
            const percent = isBarbarian
                ? (bestValue > 0 ? (bestValue / entry.value) * 100 : 0)
                : (bestValue > 0 ? (entry.value / bestValue) * 100 : 0);
            top5.push({
                rank: currentRank,
                userId: entry.userId,
                userName: entry.userName,
                value: entry.value,
                percent,
                champion: currentRank === 1
            });
        });

        exerciseTop5[exerciseKey] = {
            name: freeExercises[exerciseKey] ? freeExercises[exerciseKey].name : exerciseKey,
            maxValue: bestValue,
            barbarian: isBarbarian || false,
            top5
        };

        exerciseRecords[exerciseKey] = {
            name: freeExercises[exerciseKey] ? freeExercises[exerciseKey].name : exerciseKey,
            value: 0
        };
    });

    // %計算（各種目1位を100%、バーバリアンは反転）
    exerciseKeys.forEach(exerciseKey => {
        const isBarbarian = freeExercises[exerciseKey] && freeExercises[exerciseKey].barbarian;
        const bestValue = exerciseTop5[exerciseKey] ? exerciseTop5[exerciseKey].maxValue : 0;
        Object.values(userRecords).forEach(user => {
            const userValue = Number(user.exercises[exerciseKey] || 0);
            let percent;
            if (isBarbarian) {
                percent = (userValue > 0 && bestValue > 0) ? (bestValue / userValue) * 100 : 0;
            } else {
                percent = bestValue > 0 ? (userValue / bestValue) * 100 : 0;
            }
            user.scores[exerciseKey] = percent;
        });
    });

    // 総合得点を集計（確定週は全種目対象。4種目以上なら下位3つ採用＝最高%を1つ切り捨て）＋ストリーク加点
    Object.values(userRecords).forEach(user => {
        user.streakDays = longestConsecutiveDays(user.postedDays);
        user.streakBonus = streakEnabled ? computeStreakBonus(user.streakDays, weeklyConfig) : 0;
        user.totalScore = sumAdoptedScores(exerciseKeys.map(k => user.scores[k] || 0)) + user.streakBonus;
    });

    const championCandidates = Object.entries(userRecords)
        .map(([userId, user]) => ({
            userId,
            userName: user.userName,
            totalScore: user.totalScore,
            exercises: user.exercises,
            scores: user.scores
        }))
        .sort((a, b) => {
            if (Math.abs(b.totalScore - a.totalScore) > RANKING_TIE_EPSILON) return b.totalScore - a.totalScore;
            return a.userId.localeCompare(b.userId);
        });

    const champion = championCandidates[0] || null;
    if (!champion) return null;

    exerciseKeys.forEach(exerciseKey => {
        exerciseRecords[exerciseKey].value = Number(champion.exercises[exerciseKey] || 0);
    });

    const championBreakdown = {};
    exerciseKeys.forEach(exerciseKey => {
        const detail = exerciseTop5[exerciseKey] || { top5: [] };
        const championInExercise = detail.top5.find(item => item.userId === champion.userId);
        championBreakdown[exerciseKey] = {
            value: Number(champion.exercises[exerciseKey] || 0),
            percent: Number(champion.scores[exerciseKey] || 0),
            rank: championInExercise ? championInExercise.rank : null
        };
    });

    return {
        champUserId: champion.userId,
        champUserName: champion.userName,
        champTotalScore: champion.totalScore,
        exercises: exerciseRecords,
        exerciseTop5,
        championBreakdown
    };
}

/**
 * loadPostsで取得済みのキャッシュから擬似Snapshotを作成
 * @param {Array} cachedPosts
 * @returns {{ postsSnapshot: Object, usersSnapshot: Object }}
 */
function buildPseudoSnapshotsFromCachedPosts(cachedPosts) {
    const safePosts = Array.isArray(cachedPosts) ? cachedPosts : [];

    const userNameMap = {};
    safePosts.forEach(postItem => {
        if (!postItem || !postItem.data || !postItem.data.userId) return;
        const userId = postItem.data.userId;
        if (!userNameMap[userId]) {
            userNameMap[userId] = postItem.userName || postItem.data.userEmail || 'Unknown';
        }
    });

    const postsSnapshot = {
        forEach: (callback) => {
            safePosts.forEach(postItem => {
                callback({
                    data: () => postItem.data
                });
            });
        }
    };

    const usersSnapshot = {
        forEach: (callback) => {
            Object.entries(userNameMap).forEach(([userId, userName]) => {
                callback({
                    id: userId,
                    data: () => ({ userName, email: userName })
                });
            });
        }
    };

    return { postsSnapshot, usersSnapshot };
}

/**
 * 歴代チャンプの集計・保存処理
 * 各週の集計期間終了後に、最も得点の高かったユーザーをチャンピオンとして記録する
 * @param {Object} weeklyData - { weekStart, weekEnd, exercises }
 * @returns {Promise<void>}
 */
async function finalizeWeeklyChampion(weeklyData, options = {}) {
    try {
        const {
            upsertDetails = false,
            postsSnapshot = null,
            usersSnapshot = null,
            detailSource = 'finalizeWeeklyChampion_v2',
            allowUndecided = false
        } = options;

        const { weekStart, weekEnd, exercises } = weeklyData;
        if (!allowUndecided && !isChampionWeekDecided(weekStart)) {
            console.log('[歴代チャンプ] 未確定週のため記録をスキップ');
            return;
        }

        const { docId, year, weekNumber, monJST, friJST } = buildChampionDocMeta(weekStart);

        // 既に記録済みか確認
        const existingDoc = await db.collection('weekly_champions').doc(docId).get();
        if (existingDoc.exists && !upsertDetails) {
            console.log(`[歴代チャンプ] ${docId} は既に記録済み`);
            return;
        }

        const championPayload = await buildWeeklyChampionPayload(
            { weekStart, weekEnd, exercises },
            { postsSnapshot, usersSnapshot }
        );
        if (!championPayload) return;

        // チャンプ予想の的中集計（enablePrediction 有効時のみ意味を持つ。無効でも安全に空集計）
        let predictionResults = null;
        try {
            const { predictions, correctUserIds } = await computePredictionResults(weekStart.getTime(), championPayload.champUserId);
            if (Object.keys(predictions).length > 0) {
                predictionResults = { predictions, correctUserIds };
            }
        } catch (e) {
            console.warn('[チャンプ予想] 集計スキップ:', e);
        }

        const baseData = {
            year,
            weekNumber,
            weekStart: firebase.firestore.Timestamp.fromDate(weekStart),
            weekEnd: firebase.firestore.Timestamp.fromDate(weekEnd),
            periodLabel: formatWeeklyPeriodLabel(monJST, friJST),
            champUserId: championPayload.champUserId,
            champUserName: championPayload.champUserName,
            champTotalScore: championPayload.champTotalScore,
            exercises: championPayload.exercises,
            schemaVersion: 2,
            rankingMethod: 'competition',
            scoringBase: 'exercise_top_is_100',
            exerciseTop5: championPayload.exerciseTop5,
            championBreakdown: championPayload.championBreakdown,
            predictionResults, // { predictions:{uid:predictedUid}, correctUserIds:[] } | null
            detailGeneratedAt: firebase.firestore.FieldValue.serverTimestamp(),
            detailSource
        };

        if (existingDoc.exists) {
            await db.collection('weekly_champions').doc(docId).set({
                ...baseData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log(`[歴代チャンプ] ${docId} の詳細データを更新`);
        } else {
            await db.collection('weekly_champions').doc(docId).set({
                ...baseData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log(`[歴代チャンプ] ${docId} チャンプ記録完了: ${championPayload.champUserName}`);
        }

    } catch (error) {
        console.error('[歴代チャンプ] チャンプ記録エラー:', error);
    }
}

/**
 * 歴代チャンプの1件データをメモリキャッシュに反映
 * @param {string} docId
 * @param {Object} data
 */
function upsertChampionHistoryCache(docId, data) {
    const index = championsHistoryCache.findIndex(item => item.id === docId);
    if (index >= 0) {
        championsHistoryCache[index] = { id: docId, ...data };
    } else {
        championsHistoryCache.push({ id: docId, ...data });
    }
}

/**
 * 詳細不足時に1回だけ再取得して補完
 * @param {Object} champData
 * @returns {Promise<Object|null>}
 */
async function ensureChampionDetailData(champData) {
    if (!champData || !champData.id) return null;
    if (champData.exerciseTop5 && champData.schemaVersion >= 2) return champData;

    if (championDetailRetryMap[champData.id]) {
        return championsHistoryCache.find(item => item.id === champData.id) || champData;
    }
    championDetailRetryMap[champData.id] = true;

    try {
        let weekStart = champData.weekStart && typeof champData.weekStart.toDate === 'function'
            ? champData.weekStart.toDate()
            : null;
        let weekEnd = champData.weekEnd && typeof champData.weekEnd.toDate === 'function'
            ? champData.weekEnd.toDate()
            : null;
        let exercises = Object.keys(champData.exercises || {});

        // まずは他タブで取得済みの投稿キャッシュから補完を試行（Firebase追加アクセスなし）
        const cachedPosts = postsCache.weekly || postsCache.free;
        if (weekStart && weekEnd && Array.isArray(exercises) && exercises.length > 0 && Array.isArray(cachedPosts) && cachedPosts.length > 0) {
            const pseudoSnapshots = buildPseudoSnapshotsFromCachedPosts(cachedPosts);
            await finalizeWeeklyChampion(
                { weekStart, weekEnd, exercises },
                {
                    upsertDetails: true,
                    postsSnapshot: pseudoSnapshots.postsSnapshot,
                    usersSnapshot: pseudoSnapshots.usersSnapshot,
                    detailSource: 'cache_rebuild_v1'
                }
            );

            const refreshedDocByCache = await db.collection('weekly_champions').doc(champData.id).get();
            if (refreshedDocByCache.exists) {
                const refreshedDataByCache = refreshedDocByCache.data();
                if (refreshedDataByCache.exerciseTop5) {
                    upsertChampionHistoryCache(champData.id, refreshedDataByCache);
                    return { id: champData.id, ...refreshedDataByCache };
                }
            }
        }

        const historyDoc = await db.collection('weekly_challenge_history').doc(champData.id).get();
        if (historyDoc.exists) {
            const historyData = historyDoc.data();
            if (historyData.weekStart && typeof historyData.weekStart.toDate === 'function') {
                weekStart = historyData.weekStart.toDate();
            }
            if (historyData.weekEnd && typeof historyData.weekEnd.toDate === 'function') {
                weekEnd = historyData.weekEnd.toDate();
            }
            if (Array.isArray(historyData.exercises) && historyData.exercises.length > 0) {
                exercises = historyData.exercises;
            }
        }

        if (!weekStart || !weekEnd || !Array.isArray(exercises) || exercises.length === 0) {
            return championsHistoryCache.find(item => item.id === champData.id) || champData;
        }

        await finalizeWeeklyChampion(
            { weekStart, weekEnd, exercises },
            { upsertDetails: true, detailSource: 'detail_retry_v1' }
        );

        const refreshedDoc = await db.collection('weekly_champions').doc(champData.id).get();
        if (refreshedDoc.exists) {
            const refreshedData = refreshedDoc.data();
            upsertChampionHistoryCache(champData.id, refreshedData);
            return { id: champData.id, ...refreshedData };
        }
    } catch (error) {
        console.error('[歴代チャンプ] 詳細補完エラー:', error);
    }

    return championsHistoryCache.find(item => item.id === champData.id) || champData;
}

/**
 * 種目詳細モーダルを描画
 * @param {Object} champData
 * @param {string} exerciseKey
 */
function renderChampionDetailModal(champData, exerciseKey) {
    if (!championDetailModal || !championDetailRankings || !championDetailTitle || !championDetailSubtitle) return;

    const exerciseDetail = champData.exerciseTop5 && champData.exerciseTop5[exerciseKey]
        ? champData.exerciseTop5[exerciseKey]
        : null;

    const weekText = typeof champData.weekNumber === 'number' ? `第${champData.weekNumber}週` : '該当週';
    const exerciseName = exerciseDetail && exerciseDetail.name
        ? exerciseDetail.name
        : (freeExercises[exerciseKey] ? freeExercises[exerciseKey].name : exerciseKey);

    championDetailTitle.textContent = `${weekText} ${exerciseName} 詳細`;
    championDetailSubtitle.textContent = champData.periodLabel || '';

    if (!exerciseDetail || !Array.isArray(exerciseDetail.top5) || exerciseDetail.top5.length === 0) {
        championDetailRankings.innerHTML = '<p class="champ-detail-empty">この週の詳細データが不足しています。</p>';
        championDetailModal.style.display = 'block';
        return;
    }

    const isBarbarian = (exerciseDetail && exerciseDetail.barbarian) || 
        (freeExercises[exerciseKey] && freeExercises[exerciseKey].barbarian) || false;
    const unitText = isBarbarian ? '秒' : '回';

    const rowsHtml = exerciseDetail.top5.map(item => {
        const championBadge = item.champion ? '<span class="champ-mini-badge">種目別チャンプ</span>' : '';
        return `
            <div class="champ-detail-row">
                <div class="champ-detail-rank">${item.rank}位</div>
                <div class="champ-detail-user">${escapeHtml(item.userName)} ${championBadge}</div>
                <div class="champ-detail-value">${Math.round(item.value)}${unitText}</div>
                <div class="champ-detail-percent">${Math.round(item.percent)}%</div>
            </div>
        `;
    }).join('');

    championDetailRankings.innerHTML = `
        <div class="champ-detail-header-row">
            <div>順位</div>
            <div>ユーザー</div>
            <div>${unitText}</div>
            <div>点数(%)</div>
        </div>
        ${rowsHtml}
    `;
    championDetailModal.style.display = 'block';
}

/**
 * 種目詳細モーダルを開く
 * @param {string} docId
 * @param {string} exerciseKey
 */
async function openChampionExerciseDetail(docId, exerciseKey) {
    let champData = championsHistoryCache.find(item => item.id === docId);
    if (!champData) return;

    if (!champData.exerciseTop5 || !champData.exerciseTop5[exerciseKey]) {
        champData = await ensureChampionDetailData(champData);
    }

    renderChampionDetailModal(champData, exerciseKey);
}

/**
 * 歴代チャンプタブのクリック/モーダルイベントをバインド
 */
function setupChampionDetailEvents() {
    if (championDetailEventsBound) return;

    const championsList = document.getElementById('champions-list');
    if (championsList) {
        championsList.addEventListener('click', async (event) => {
            const trigger = event.target.closest('.js-champ-detail-trigger');
            if (!trigger) return;

            const docId = trigger.getAttribute('data-doc-id');
            const exerciseKey = trigger.getAttribute('data-exercise-key');
            if (!docId || !exerciseKey) return;

            await openChampionExerciseDetail(docId, exerciseKey);
        });
    }

    if (closeChampionDetailModal) {
        closeChampionDetailModal.addEventListener('click', () => {
            if (championDetailModal) championDetailModal.style.display = 'none';
        });
    }

    championDetailEventsBound = true;
}

/**
 * 過去の週でまだチャンプが記録されていないものを自動集計する
 */
async function checkAndFinalizePassedWeeks() {
    try {
        const historySnap = await db.collection('weekly_challenge_history')
            .orderBy(firebase.firestore.FieldPath.documentId(), 'asc')
            .get();
        if (historySnap.empty) return;

        const champsSnap = await db.collection('weekly_champions').get();
        const champMap = new Map();
        champsSnap.forEach(doc => {
            champMap.set(doc.id, doc.data());
        });

        let postsSnapshot = null;
        let usersSnapshot = null;
        let updatedCount = 0;

        for (const historyDoc of historySnap.docs) {
            const historyData = historyDoc.data();
            const champData = champMap.get(historyDoc.id) || null;

            const weekStartDate = historyData.weekStart && typeof historyData.weekStart.toDate === 'function'
                ? historyData.weekStart.toDate()
                : null;
            if (!weekStartDate || !isChampionWeekDecided(weekStartDate)) {
                continue;
            }

            // 履歴の種目ズレを自己修復: 確定チャンプ記録（正）と種目が違えば、履歴をチャンプに合わせる。
            // （週途中で種目が変わると saveWeeklyChallengeHistory の既存ガードで履歴が古いまま固定されるため。
            //   この履歴は下のバックフィルやダービー集計の入力になるので、先に正しておく）
            if (champData && champData.exercises && typeof champData.exercises === 'object') {
                const champKeys = Object.keys(champData.exercises);
                const histKeys = Array.isArray(historyData.exercises) ? historyData.exercises : [];
                const differs = champKeys.length > 0
                    && (histKeys.length !== champKeys.length || champKeys.some(k => !histKeys.includes(k)));
                if (differs) {
                    try {
                        await db.collection('weekly_challenge_history').doc(historyDoc.id).set({
                            exercises: champKeys,
                            reconciledFromChampion: true,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                        historyData.exercises = champKeys; // 以降の処理にも反映
                        console.log(`[歴代チャンプ] 履歴 ${historyDoc.id} の種目をチャンプ記録に合わせて補正`);
                    } catch (e) {
                        console.warn('[歴代チャンプ] 履歴補正に失敗:', historyDoc.id, e);
                    }
                }
            }

            const hasDetail = !!(champData && champData.schemaVersion >= 2 && champData.exerciseTop5);
            if (hasDetail) continue;

            if (!historyData.weekStart || !historyData.weekEnd || !Array.isArray(historyData.exercises) || historyData.exercises.length === 0) {
                continue;
            }

            if (!postsSnapshot) {
                postsSnapshot = await db.collection('posts_free').get();
            }
            if (!usersSnapshot) {
                usersSnapshot = await db.collection('users').get();
            }

            await finalizeWeeklyChampion({
                weekStart: weekStartDate,
                weekEnd: historyData.weekEnd.toDate(),
                exercises: historyData.exercises
            }, {
                upsertDetails: true,
                postsSnapshot,
                usersSnapshot,
                detailSource: 'backfill_v1'
            });
            updatedCount += 1;
        }

        if (updatedCount > 0) {
            console.log(`[歴代チャンプ] バックフィル更新: ${updatedCount}週`);
        }

    } catch (error) {
        console.error('[歴代チャンプ] 過去週チェックエラー:', error);
    }
}

/**
 * 週が変わった時に前の週のチャレンジ情報を履歴に保存する
 */
async function saveWeeklyChallengeHistory(weeklyData) {
    try {
        const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
        const monJST = new Date(weeklyData.weekStart.getTime() + JST_OFFSET_MS + 1 * 24 * 60 * 60 * 1000);
        const weekNumber = getWeekNumberOfYear(monJST);
        const year = monJST.getUTCFullYear();
        const docId = `${year}_W${String(weekNumber).padStart(2, '0')}`;

        const existingDoc = await db.collection('weekly_challenge_history').doc(docId).get();
        if (existingDoc.exists) return; // 既に保存済み

        await db.collection('weekly_challenge_history').doc(docId).set({
            weekStart: firebase.firestore.Timestamp.fromDate(weeklyData.weekStart),
            weekEnd: firebase.firestore.Timestamp.fromDate(weeklyData.weekEnd),
            exercises: weeklyData.exercises,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[歴代チャンプ] 週間チャレンジ履歴を保存: ${docId}`);
    } catch (error) {
        console.error('[歴代チャンプ] 履歴保存エラー:', error);
    }
}

/**
 * 歴代チャンプタブのデータを読み込んで表示
 */
async function loadChampionsHistory() {
    const championsList = document.getElementById('champions-list');
    if (!championsList) return;

    championsList.innerHTML = '<p style="text-align:center; padding:20px;">読み込み中...</p>';

    try {
        // ドキュメントID（例: 2026_W01）で降順ソート（複合インデックス不要）
        const snapshot = await db.collection('weekly_champions')
            .orderBy(firebase.firestore.FieldPath.documentId(), 'desc')
            .get();

        if (snapshot.empty) {
            championsList.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">歴代データ無し</p>';
            return;
        }

        const now = new Date();
        const visibleDocs = snapshot.docs.filter(doc => {
            const data = doc.data();
            const weekStartDate = data.weekStart && typeof data.weekStart.toDate === 'function'
                ? data.weekStart.toDate()
                : null;
            return isChampionWeekDecided(weekStartDate, now);
        });

        if (visibleDocs.length === 0) {
            championsList.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">確定済みの歴代チャンプはまだありません</p>';
            championsHistoryCache = [];
            return;
        }

        setupChampionDetailEvents();

        championsHistoryCache = visibleDocs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        let html = '';
        visibleDocs.forEach(doc => {
            const data = doc.data();
            const exercisesEntries = Object.entries(data.exercises || {});
            const exercisesHtml = exercisesEntries.map(([exerciseKey, ex]) => {
                const value = Number(ex.value || 0);
                const isBarbarian = freeExercises[exerciseKey] && freeExercises[exerciseKey].barbarian;
                const iconClass = isBarbarian ? 'fa-stopwatch' : 'fa-dumbbell';
                const unitText = isBarbarian ? '秒' : '';
                return `<button class="champ-exercise-item js-champ-detail-trigger" data-doc-id="${escapeHtml(doc.id)}" data-exercise-key="${escapeHtml(exerciseKey)}"><i class="fa-solid ${iconClass}"></i> ${escapeHtml(ex.name)}: <strong>${Math.round(value)}${unitText}</strong></button>`;
            }).join('');

            html += `
                <div class="champ-card">
                    <div class="champ-header">
                        <span class="champ-week"><i class="fa-solid fa-crown"></i> 第${data.weekNumber}週チャンプ</span>
                        <span class="champ-period">${escapeHtml(data.periodLabel || '')}</span>
                    </div>
                    <div class="champ-body">
                        <div class="champ-user"><i class="fa-solid fa-user"></i> ${escapeHtml(data.champUserName)}</div>
                        <div class="champ-score">総合得点: ${Math.round(data.champTotalScore)}pt</div>
                        <div class="champ-exercises">${exercisesHtml}</div>
                    </div>
                </div>
            `;
        });

        championsList.innerHTML = html;

    } catch (error) {
        console.error('[歴代チャンプ] データ読み込みエラー:', error);
        const errorMessage = error.message || 'エラー詳細不明';
        const errorCode = error.code ? ` (コード: ${error.code})` : '';
        championsList.innerHTML = `<p style="text-align:center; color:#e74c3c; padding:20px;">データの読み込みに失敗しました<br><span style="font-size:0.85em; color:#999;">エラー: ${escapeHtml(errorMessage)}${escapeHtml(errorCode)}</span></p>`;
    }
}

// ====================================================================
// 月間ダービー機能
// ====================================================================

/** 月間ダービーのChart.jsインスタンス */
let derbyChart = null;

/**
 * 指定年月のダービー開始日（その月の最初の月曜、UTC日付で管理）と終了日（次の月のダービー開始前日）を返す
 * @param {number} year
 * @param {number} month 1-indexed
 * @returns {{ derbyStart: Date, derbyEnd: Date }}
 */
function getMonthlyDerbyBounds(year, month) {
    function firstMondayUTC(y, m) {
        // 月初1日 UTC midnight
        const d = new Date(Date.UTC(y, m - 1, 1));
        const dow = d.getUTCDay(); // 0=日,1=月,...,6=土
        // 月曜まで何日追加するか: 月曜(1)なら0, それ以外は (8-dow)%7
        const daysToMon = (8 - dow) % 7;
        return new Date(d.getTime() + daysToMon * 86400000);
    }

    const derbyStart = firstMondayUTC(year, month);

    let ny = year, nm = month + 1;
    if (nm > 12) { nm = 1; ny++; }
    const nextDerbyStart = firstMondayUTC(ny, nm);

    // 終了日 = 次のダービー開始前日（日曜）
    const derbyEnd = new Date(nextDerbyStart.getTime() - 86400000);

    return { derbyStart, derbyEnd };
}

/**
 * 今日（JST）が属する月間ダービーの年月を返す
 * @returns {{ year: number, month: number }}
 */
function getCurrentDerbyYearMonth() {
    const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const jstNow = new Date(Date.now() + JST_OFFSET_MS);
    let year = jstNow.getUTCFullYear();
    let month = jstNow.getUTCMonth() + 1;

    // 今日がその月のダービー開始前かチェック
    const { derbyStart } = getMonthlyDerbyBounds(year, month);
    const todayUTC = new Date(Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()));
    if (todayUTC < derbyStart) {
        // 前月のダービーがまだ進行中
        month--;
        if (month < 1) { month = 12; year--; }
    }

    return { year, month };
}

/**
 * 月間ダービーのデータを計算する
 * @param {number} year
 * @param {number} month
 * @returns {Promise<Object>}
 */
async function computeMonthlyDerbyData(year, month) {
    const { derbyStart, derbyEnd } = getMonthlyDerbyBounds(year, month);

    // posts_free / users / 履歴 / チャンプ記録 を一括取得
    const [postsSnap, usersSnap, historySnap, champsSnap] = await Promise.all([
        db.collection('posts_free').get(),
        db.collection('users').get(),
        db.collection('weekly_challenge_history')
            .orderBy(firebase.firestore.FieldPath.documentId(), 'asc')
            .get(),
        db.collection('weekly_champions').get()
    ]);

    const usersData = {};
    usersSnap.forEach(doc => {
        const d = doc.data();
        usersData[doc.id] = d.userName || d.email || 'Unknown';
    });

    // 確定チャンプ記録の種目（正）。history は週途中の種目変更でズレることがあるため、
    // chamption がある週はそちらの種目を真とする。
    const champExByDoc = {};
    champsSnap.forEach(doc => {
        const d = doc.data();
        if (d && d.exercises && typeof d.exercises === 'object') {
            const keys = Object.keys(d.exercises);
            if (keys.length > 0) champExByDoc[doc.id] = keys;
        }
    });

    if (!freeExercisesLoaded) await loadFreeExercises();

    // ダービー期間に含まれる週を収集
    const derbyWeeks = [];

    historySnap.forEach(doc => {
        const data = doc.data();
        if (!data.weekStart || !data.exercises) return;
        const weekStart = data.weekStart.toDate();
        const weekEnd = data.weekEnd ? data.weekEnd.toDate()
            : new Date(weekStart.getTime() + 7 * 86400000);

        const { monJST } = buildChampionDocMeta(weekStart);
        // monJST はJST-based "fakeUTC"なので、UTC日付として抽出して比較
        const monDay = new Date(Date.UTC(monJST.getUTCFullYear(), monJST.getUTCMonth(), monJST.getUTCDate()));

        if (monDay >= derbyStart && monDay <= derbyEnd) {
            // チャンプ記録があればその種目（正）を優先
            const exercises = champExByDoc[doc.id]
                || (Array.isArray(data.exercises) ? data.exercises : []);
            derbyWeeks.push({
                docId: doc.id,
                weekStart,
                weekEnd,
                exercises,
                monJST
            });
        }
    });

    // 今週が同期間内であれば追加（historyに未登録の場合）。
    // 休止週は種目が無く得点も出ないので、ダービーの週としては数えない
    if (weeklyChallenge && weeklyChallenge.weekStart && !weeklyChallenge.paused) {
        const { monJST } = buildChampionDocMeta(weeklyChallenge.weekStart);
        const monDay = new Date(Date.UTC(monJST.getUTCFullYear(), monJST.getUTCMonth(), monJST.getUTCDate()));
        if (monDay >= derbyStart && monDay <= derbyEnd) {
            const currentDocId = buildChampionDocMeta(weeklyChallenge.weekStart).docId;
            if (!derbyWeeks.find(w => w.docId === currentDocId)) {
                derbyWeeks.push({
                    docId: currentDocId,
                    weekStart: weeklyChallenge.weekStart,
                    weekEnd: weeklyChallenge.weekEnd,
                    exercises: weeklyChallenge.exercises || [],
                    monJST
                });
            }
        }
    }

    // 週の順にソート
    derbyWeeks.sort((a, b) => a.weekStart - b.weekStart);

    // 各週のスコアを計算
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const fmtD = d => `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${dayNames[d.getUTCDay()]})`;

    const weeklyResults = [];

    for (let i = 0; i < derbyWeeks.length; i++) {
        const week = derbyWeeks[i];
        const { weekStart, weekEnd, exercises, monJST } = week;
        const exerciseKeys = exercises.filter(k => freeExercises[k]);

        const userRecords = {};

        postsSnap.forEach(doc => {
            const post = doc.data();
            if (!post.timestamp) return;
            const postDate = post.timestamp.toDate();
            if (postDate < weekStart || postDate >= weekEnd) return;
            if (!isWeekdayJST(postDate)) return;
            if (!exerciseKeys.includes(post.exerciseType)) return;

            const { userId, exerciseType, value } = post;
            const numVal = Number(value) || 0;
            if (numVal <= 0) return;

            if (!userRecords[userId]) {
                userRecords[userId] = {
                    userId,
                    userName: usersData[userId] || post.userEmail || 'Unknown',
                    exercises: {},
                    scores: {},
                    totalScore: 0
                };
            }

            const isBarbarian = freeExercises[exerciseType] && freeExercises[exerciseType].barbarian;
            if (isBarbarian) {
                if (userRecords[userId].exercises[exerciseType] === undefined ||
                    userRecords[userId].exercises[exerciseType] > numVal) {
                    userRecords[userId].exercises[exerciseType] = numVal;
                }
            } else {
                if (userRecords[userId].exercises[exerciseType] === undefined ||
                    userRecords[userId].exercises[exerciseType] < numVal) {
                    userRecords[userId].exercises[exerciseType] = numVal;
                }
            }
        });

        // 得点（%）計算
        exerciseKeys.forEach(exKey => {
            const isBarbarian = freeExercises[exKey] && freeExercises[exKey].barbarian;
            if (isBarbarian) {
                let minVal = Infinity;
                Object.values(userRecords).forEach(u => {
                    const v = u.exercises[exKey];
                    if (v !== undefined && v > 0 && v < minVal) minVal = v;
                });
                Object.values(userRecords).forEach(u => {
                    const v = u.exercises[exKey];
                    const pct = (v !== undefined && v > 0 && minVal !== Infinity) ? (minVal / v) * 100 : 0;
                    u.scores[exKey] = pct;
                    u.totalScore += pct;
                });
            } else {
                let maxVal = 0;
                Object.values(userRecords).forEach(u => {
                    const v = u.exercises[exKey] || 0;
                    if (v > maxVal) maxVal = v;
                });
                Object.values(userRecords).forEach(u => {
                    const v = u.exercises[exKey] || 0;
                    const pct = maxVal > 0 ? (v / maxVal) * 100 : 0;
                    u.scores[exKey] = pct;
                    u.totalScore += pct;
                });
            }
        });

        // 順位付け
        const rankList = Object.values(userRecords).sort((a, b) => {
            if (Math.abs(b.totalScore - a.totalScore) > 0.001) return b.totalScore - a.totalScore;
            return a.userId.localeCompare(b.userId);
        });
        let prevScore = null, prevRank = 0;
        rankList.forEach((user, idx) => {
            if (prevScore !== null && Math.abs(user.totalScore - prevScore) <= 0.001) {
                user.rank = prevRank;
            } else {
                user.rank = idx + 1;
                prevRank = idx + 1;
            }
            prevScore = user.totalScore;
        });

        const friJST = new Date(monJST.getTime() + 4 * 86400000);
        weeklyResults.push({
            docId: week.docId,
            weekNum: i + 1,
            weekLabel: `第${i + 1}週 (${fmtD(monJST)}〜${fmtD(friJST)})`,
            exerciseKeys,
            exerciseNames: Object.fromEntries(exerciseKeys.map(k => [k, freeExercises[k] ? freeExercises[k].name : k])),
            exerciseIsBarbarian: Object.fromEntries(exerciseKeys.map(k => [k, !!(freeExercises[k] && freeExercises[k].barbarian)])),
            scores: userRecords,
            rankList
        });
    }

    // ユーザー別集計
    const userSummary = {};
    weeklyResults.forEach((week, wi) => {
        Object.entries(week.scores).forEach(([uid, user]) => {
            if (!userSummary[uid]) {
                userSummary[uid] = {
                    userId: uid,
                    userName: user.userName,
                    total: 0,
                    weeklyScores: new Array(weeklyResults.length).fill(0)
                };
            }
            userSummary[uid].weeklyScores[wi] = user.totalScore;
            userSummary[uid].total += user.totalScore;
        });
    });

    // ダービー完了判定と月間チャンプ選出
    let isDerbyComplete = false;
    let monthlyChamp = null;
    if (derbyWeeks.length > 0) {
        const lastWeek = derbyWeeks[derbyWeeks.length - 1];
        isDerbyComplete = isChampionWeekDecided(lastWeek.weekStart);
    }
    if (isDerbyComplete && Object.keys(userSummary).length > 0) {
        const champCandidates = Object.values(userSummary).sort((a, b) => {
            if (Math.abs(b.total - a.total) > 0.001) return b.total - a.total;
            return a.userId.localeCompare(b.userId);
        });
        monthlyChamp = champCandidates[0];
    }

    return { weeks: weeklyResults, userSummary, derbyStart, derbyEnd, year, month, isDerbyComplete, monthlyChamp };
}

/**
 * 月選択ドロップダウンHTMLを生成（直近6か月分）
 */
function buildDerbyMonthSelectorHtml(currentYear, currentMonth) {
    const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const jstNow = new Date(Date.now() + JST_OFFSET_MS);
    const thisYear = jstNow.getUTCFullYear();
    const thisMonth = jstNow.getUTCMonth() + 1;

    let options = '';
    for (let i = 0; i < 6; i++) {
        let y = thisYear, m = thisMonth - i;
        while (m <= 0) { m += 12; y--; }
        const sel = (y === currentYear && m === currentMonth) ? 'selected' : '';
        options += `<option value="${y}-${m}" ${sel}>${y}年${m}月</option>`;
    }
    return `<div class="derby-month-selector"><label><i class="fa-solid fa-calendar"></i> 期間: <select id="derby-month-select">${options}</select></label></div>`;
}

/**
 * 月間ダービーのデータ部分を描画する（セレクターを除くデータエリアのみ）
 */
async function renderMonthlyDerbyData(dataWrap, data, year, month) {
    const { weeks, userSummary, derbyStart, derbyEnd, isDerbyComplete, monthlyChamp } = data;

    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const fmtD = d => `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${dayNames[d.getUTCDay()]})`;
    const periodLabel = `${fmtD(derbyStart)} 〜 ${fmtD(derbyEnd)}`;

    // 月間チャンプバナー（全週確定済み時のみ）
    let champBannerHtml = '';
    if (isDerbyComplete && monthlyChamp) {
        champBannerHtml = `<div class="derby-champ-banner"><span class="derby-champ-label">${year}年${month}月チャンプ</span><i class="fa-solid fa-crown derby-champ-crown"></i><span class="derby-champ-name">${escapeHtml(monthlyChamp.userName)}</span><span class="derby-champ-score">${Math.round(monthlyChamp.total)}pt</span></div>`;
    }

    let html = champBannerHtml;
    html += `<div class="derby-header"><span class="derby-title">${year}年${month}月ダービー</span><span class="derby-period">${escapeHtml(periodLabel)}</span></div>`;

    if (weeks.length === 0) {
        html += `<p class="derby-empty">${year}年${month}月のダービーデータはまだありません</p>`;
        dataWrap.innerHTML = html;
        return;
    }

    const sortedUsers = Object.values(userSummary).sort((a, b) => b.total - a.total);

    if (sortedUsers.length === 0) {
        html += `<p class="derby-empty">まだ参加者がいません</p>`;
        dataWrap.innerHTML = html;
        return;
    }

    const WEEK_COLORS = ['#667eea', '#f7971e', '#43e97b', '#f5576c', '#a855f7', '#0ea5e9'];
    const firstPlaceTotal = sortedUsers[0].total;

    const chartHeight = Math.max(180, sortedUsers.length * 44 + 60);
    html += `<div class="derby-chart-wrap" style="position:relative;height:${chartHeight}px;margin:10px 0 16px;"><canvas id="derby-chart"></canvas></div>`;

    // 週別詳細テーブル
    html += `<div class="derby-details">`;
    weeks.forEach(week => {
        const exCols = week.exerciseKeys.map(k => {
            const barb = week.exerciseIsBarbarian[k] ? '(秒)' : '(回)';
            return `<th class="derby-th-ex">${escapeHtml(week.exerciseNames[k])}<br><small>${barb}</small></th>`;
        }).join('');

        const rows = week.rankList.map(user => {
            const exCells = week.exerciseKeys.map(k => {
                const val = user.exercises[k];
                const score = Math.round(user.scores[k] || 0);
                if (val === undefined) return `<td class="derby-td-na">-</td>`;
                return `<td class="derby-td-val">${Math.round(val)}<br><small class="derby-score-pt">${score}pt</small></td>`;
            }).join('');
            return `<tr>
                <td class="derby-td-rank">${user.rank}位</td>
                <td class="derby-td-name">${escapeHtml(user.userName)}</td>
                ${exCells}
                <td class="derby-td-total">${Math.round(user.totalScore)}pt</td>
            </tr>`;
        }).join('');

        html += `<div class="derby-week-section">
            <div class="derby-week-header"><i class="fa-solid fa-calendar-week" style="color:${WEEK_COLORS[(week.weekNum - 1) % WEEK_COLORS.length]};margin-right:5px;"></i>${escapeHtml(week.weekLabel)}</div>
            <div class="derby-table-wrap"><table class="derby-week-table">
                <thead><tr><th>順位</th><th>ユーザー</th>${exCols}<th>合計</th></tr></thead>
                <tbody>${rows}</tbody>
            </table></div>
        </div>`;
    });
    html += `</div>`;

    dataWrap.innerHTML = html;

    // Chart.js 横積み上げ棒グラフ
    const chartCanvas = document.getElementById('derby-chart');
    if (chartCanvas) {
        if (derbyChart) { derbyChart.destroy(); derbyChart = null; }

        const labels = sortedUsers.map((u, i) => `${i + 1}位 ${u.userName}`);

        // 通常の週ごとデータセット
        const datasets = weeks.map((week, wi) => ({
            label: `第${week.weekNum}週`,
            data: sortedUsers.map(u => Math.round((u.weeklyScores[wi] || 0) * 10) / 10),
            backgroundColor: WEEK_COLORS[wi % WEEK_COLORS.length],
            borderColor: '#fff',
            borderWidth: 1,
            borderRadius: 3
        }));

        // 1位との差分セグメント（ダービー継続中のみ表示）
        if (!isDerbyComplete && firstPlaceTotal > 0 && sortedUsers.length > 1) {
            datasets.push({
                label: '__gap__',
                data: sortedUsers.map(u => {
                    const gap = firstPlaceTotal - u.total;
                    return gap > 0.05 ? Math.round(gap * 10) / 10 : null;
                }),
                backgroundColor: 'rgba(220, 53, 69, 0.08)',
                borderWidth: 0,
                borderRadius: 3,
                hoverBackgroundColor: 'rgba(220, 53, 69, 0.22)'
            });
        }

        // 1位ライン描画用インラインプラグイン（ダービー継続中のみ）
        const capturedFirstPlace = isDerbyComplete ? -1 : firstPlaceTotal;
        const firstPlaceLinePlugin = {
            id: 'derbyFirstPlaceLine',
            afterDraw(chart) {
                if (capturedFirstPlace <= 0) return;
                const ctx = chart.ctx;
                const xScale = chart.scales.x;
                const x = xScale.getPixelForValue(capturedFirstPlace);
                if (!x || x < chart.chartArea.left || x > chart.chartArea.right) return;
                ctx.save();
                ctx.strokeStyle = 'rgba(220, 53, 69, 0.85)';
                ctx.setLineDash([6, 4]);
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(x, chart.chartArea.top);
                ctx.lineTo(x, chart.chartArea.bottom);
                ctx.stroke();
                ctx.restore();
            }
        };

        // Chart.js を遅延ロード（初回のみ取得）。数値データ(dataWrap)は上で描画済み。
        await ensureChartJs();

        derbyChart = new Chart(chartCanvas.getContext('2d'), {
            type: 'bar',
            data: { labels, datasets },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        title: { display: true, text: '得点 (pt)', font: { size: 10 } },
                        ticks: { font: { size: 10 } }
                    },
                    y: {
                        stacked: true,
                        ticks: { font: { size: 11 } }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { size: 11 }, boxWidth: 14, padding: 10,
                            filter: item => item.text !== '__gap__'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                if (ctx.raw === null || ctx.raw === undefined) return null;
                                if (ctx.dataset.label === '__gap__') return `1位との差: ${ctx.raw}pt`;
                                return `${ctx.dataset.label}: ${ctx.raw}pt`;
                            },
                            footer: items => {
                                const nonGap = items.filter(i => i.dataset.label !== '__gap__' && i.raw !== null);
                                const total = nonGap.reduce((s, i) => s + (i.raw || 0), 0);
                                if (total > 0) return `合計: ${Math.round(total)}pt`;
                            }
                        }
                    }
                }
            },
            plugins: [firstPlaceLinePlugin]
        });
    }
}

/**
 * 月選択イベントをバインド
 */
function setupDerbyMonthSelectorEvents(selectorWrap) {
    const sel = selectorWrap.querySelector('#derby-month-select');
    if (sel) {
        sel.addEventListener('change', () => {
            const [y, m] = sel.value.split('-').map(Number);
            loadMonthlyDerby(y, m);
        });
    }
}

/**
 * 月間ダービータブを読み込んで表示（セレクターは初回のみ生成し再利用）
 * @param {number} [year]
 * @param {number} [month]
 */
async function loadMonthlyDerby(year, month) {
    const container = document.getElementById('derby-content');
    if (!container) return;

    if (!weeklyChallengeLoaded) await getOrUpdateWeeklyChallenge();
    if (!freeExercisesLoaded) await loadFreeExercises();

    if (!year || !month) {
        const cur = getCurrentDerbyYearMonth();
        year = cur.year;
        month = cur.month;
    }

    // セレクターラップを初回のみ生成、以降は使い回す
    let selectorWrap = container.querySelector('#derby-selector-wrap');
    let dataWrap = container.querySelector('#derby-data');

    if (!selectorWrap) {
        container.innerHTML = '<div id="derby-selector-wrap"></div><div id="derby-data"></div>';
        selectorWrap = container.querySelector('#derby-selector-wrap');
        dataWrap = container.querySelector('#derby-data');
    }

    // セレクターを更新（選択月を正しく反映）
    selectorWrap.innerHTML = buildDerbyMonthSelectorHtml(year, month);
    setupDerbyMonthSelectorEvents(selectorWrap);

    // スクロール位置を保存してからローディング表示
    const savedScrollY = window.scrollY;
    dataWrap.innerHTML = '<p style="text-align:center;padding:20px;color:#999;">読み込み中...</p>';

    try {
        const data = await computeMonthlyDerbyData(year, month);
        renderMonthlyDerbyData(dataWrap, data, year, month);
    } catch (error) {
        console.error('[月間ダービー] エラー:', error);
        const msg = escapeHtml(error.message || 'エラー詳細不明');
        dataWrap.innerHTML = `<p style="text-align:center;color:#e74c3c;padding:20px;">データの読み込みに失敗しました<br><small>${msg}</small></p>`;
    } finally {
        // スクロール位置を復元
        window.scrollTo({ top: savedScrollY, behavior: 'instant' });
    }
}

// ====================================================================
// 評価モーダル・レビューモーダル UI 制御
// ====================================================================

/** 評価モーダルで選択中の値 */
let ratingModalSelectedValue = 0;
let ratingModalExerciseKey = '';

/**
 * 評価モーダルを開く
 * @param {string} exerciseKey
 * @param {string} exerciseName
 */
async function openRatingModal(exerciseKey, exerciseName) {
    ratingModalExerciseKey = exerciseKey;
    ratingModalSelectedValue = 0;

    const modal = document.getElementById('exercise-rating-modal');
    document.getElementById('rating-modal-exercise-name').textContent = exerciseName;
    document.getElementById('rating-comment-input').value = '';
    document.getElementById('rating-comment-count').textContent = '0';
    document.getElementById('rating-submit-error').textContent = '';
    document.getElementById('rating-existing-info').textContent = '';
    const submitBtn = document.getElementById('submit-rating-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> 評価を送信';

    // 星ボタン初期化
    updateStarDisplay(0);
    document.getElementById('rating-label-text').textContent = '（未選択）';

    modal.style.display = 'block';

    // 既存評価があれば表示
    const existing = await getUserExerciseRating(exerciseKey);
    if (existing) {
        ratingModalSelectedValue = existing.rating;
        updateStarDisplay(existing.rating);
        document.getElementById('rating-label-text').textContent = RATING_LABELS[existing.rating] || '';
        document.getElementById('rating-comment-input').value = existing.comment || '';
        document.getElementById('rating-comment-count').textContent = (existing.comment || '').length;
        document.getElementById('rating-existing-info').textContent = `現在の評価: ★${existing.rating} （更新できます）`;
        document.getElementById('submit-rating-btn').disabled = false;
    }
}

/**
 * 星ボタンの表示を更新
 * @param {number} value - 0〜5
 */
function updateStarDisplay(value) {
    document.querySelectorAll('#exercise-rating-modal .star-btn').forEach(btn => {
        const v = parseInt(btn.dataset.value);
        btn.classList.toggle('selected', v <= value);
    });
}

/**
 * レビュー閲覧モーダルを開く
 * @param {string} exerciseKey
 * @param {string} exerciseName
 */
async function openReviewsModal(exerciseKey, exerciseName) {
    const modal = document.getElementById('exercise-reviews-modal');
    document.getElementById('reviews-modal-exercise-name').textContent = exerciseName;
    document.getElementById('reviews-summary').innerHTML = '<p style="text-align:center;color:#999;">読み込み中...</p>';
    document.getElementById('reviews-list').innerHTML = '';
    modal.style.display = 'block';

    const [summary, reviews] = await Promise.all([
        getExerciseRatingSummary(exerciseKey),
        getExerciseReviews(exerciseKey)
    ]);

    // 集計サマリー
    const summaryEl = document.getElementById('reviews-summary');
    if (summary && summary.ratingCount > 0) {
        summaryEl.innerHTML = `
            <div class="reviews-summary-big">
                ${renderStarRatingHtml(summary.avgRating, summary.ratingCount)}
                <span class="reviews-avg-num">${summary.avgRating.toFixed(1)}</span>
                <span class="reviews-count-label">${summary.ratingCount}件の評価</span>
            </div>
        `;
    } else {
        summaryEl.innerHTML = '<p style="text-align:center;color:#999;">まだ評価がありません</p>';
    }

    // レビュー一覧
    const listEl = document.getElementById('reviews-list');
    if (reviews.length === 0) {
        listEl.innerHTML = '<p style="text-align:center;color:#999;padding:12px;">コメントはありません</p>';
        return;
    }

    // users コレクションからユーザー名を一括取得して上書き
    const userIds = [...new Set(reviews.map(r => r.userId).filter(Boolean))];
    if (userIds.length > 0) {
        try {
            const userDocs = await Promise.all(userIds.map(uid => db.collection('users').doc(uid).get()));
            const userNameMap = {};
            userDocs.forEach(doc => { if (doc.exists) userNameMap[doc.id] = doc.data().userName; });
            reviews.forEach(r => {
                if (r.userId && userNameMap[r.userId]) r.userName = userNameMap[r.userId];
            });
        } catch (e) { /* 取得失敗時は既存の userName をそのまま使用 */ }
    }

    const currentUid = firebase.auth().currentUser ? firebase.auth().currentUser.uid : null;
    // モーダルに exerciseKey/Name を保存（削除後の再描画用）
    modal.dataset.exerciseKey = exerciseKey;
    modal.dataset.exerciseName = exerciseName;

    listEl.innerHTML = reviews.map(r => {
        const stars = '★'.repeat(r.rating || 0) + '☆'.repeat(5 - (r.rating || 0));
        const label = RATING_LABELS[r.rating] || '';
        const comment = r.comment ? `<p class="review-comment">${escapeHtml(r.comment)}</p>` : '';
        const date = r.updatedAt ? new Date(r.updatedAt.seconds * 1000).toLocaleDateString('ja-JP') : '';
        const isOwn = currentUid && r.userId === currentUid;
        const deleteBtn = isOwn
            ? `<button class="btn-delete-review" data-key="${escapeHtml(exerciseKey)}"><i class="fa-solid fa-trash"></i> 削除</button>`
            : '';
        return `
            <div class="review-item${isOwn ? ' review-item-own' : ''}">
                <div class="review-header">
                    <span class="review-stars">${escapeHtml(stars)}</span>
                    <span class="review-label">${escapeHtml(label)}</span>
                    <span class="review-date">${escapeHtml(date)}</span>
                    ${deleteBtn}
                </div>
                <span class="review-username">${escapeHtml(r.userName || '匿名')}</span>
                ${comment}
            </div>
        `;
    }).join('');

    // 削除ボタンのイベント
    listEl.querySelectorAll('.btn-delete-review').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('この評価を削除しますか？')) return;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 削除中...';
            try {
                await deleteExerciseRating(btn.dataset.key);
                await openReviewsModal(modal.dataset.exerciseKey, modal.dataset.exerciseName);
                if (currentMode === 'free') renderFreeRulesContent();
                if (currentMode === 'weekly') updateWeeklyRulesTab();
            } catch (e) {
                alert('削除に失敗しました: ' + (e.message || ''));
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-trash"></i> 削除';
            }
        });
    });
}

// ====================================================================
// 評価モーダル・レビューモーダル イベントリスナー
// ====================================================================

// 評価モーダルを閉じる
document.querySelector('.close-rating-modal')?.addEventListener('click', () => {
    document.getElementById('exercise-rating-modal').style.display = 'none';
});
document.getElementById('exercise-rating-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('exercise-rating-modal')) {
        document.getElementById('exercise-rating-modal').style.display = 'none';
    }
});

// レビューモーダルを閉じる
document.querySelector('.close-reviews-modal')?.addEventListener('click', () => {
    document.getElementById('exercise-reviews-modal').style.display = 'none';
});
document.getElementById('exercise-reviews-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('exercise-reviews-modal')) {
        document.getElementById('exercise-reviews-modal').style.display = 'none';
    }
});

// 星ボタンのクリック
document.querySelectorAll('#exercise-rating-modal .star-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => updateStarDisplay(parseInt(btn.dataset.value)));
    btn.addEventListener('mouseleave', () => updateStarDisplay(ratingModalSelectedValue));
    btn.addEventListener('click', () => {
        ratingModalSelectedValue = parseInt(btn.dataset.value);
        updateStarDisplay(ratingModalSelectedValue);
        document.getElementById('rating-label-text').textContent = RATING_LABELS[ratingModalSelectedValue] || '';
        document.getElementById('submit-rating-btn').disabled = false;
    });
});

// コメント文字数カウント
document.getElementById('rating-comment-input')?.addEventListener('input', (e) => {
    document.getElementById('rating-comment-count').textContent = e.target.value.length;
});

// 評価送信
document.getElementById('submit-rating-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('submit-rating-btn');
    const errEl = document.getElementById('rating-submit-error');
    errEl.textContent = '';
    if (!ratingModalSelectedValue) {
        errEl.textContent = '評価を選択してください';
        return;
    }
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 送信中...';
    try {
        const comment = document.getElementById('rating-comment-input').value.trim();
        await submitExerciseRating(ratingModalExerciseKey, ratingModalSelectedValue, comment);
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> 評価を送信';
        document.getElementById('exercise-rating-modal').style.display = 'none';
        // ルールタブを再レンダリングして評価を反映
        if (currentMode === 'free') renderFreeRulesContent();
        if (currentMode === 'weekly') updateWeeklyRulesTab();
    } catch (e) {
        errEl.textContent = e.message || '送信に失敗しました';
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> 評価を送信';
    }
});


// ====================================================================
// 特別イベントウィーク（ユーザー提案 → 3人の承認/否認 → 週間チャレンジ上書き）
//
// 3人ぶんの回答が揃った時点で結果が確定する（全員承認なら成立、1人でも
// 否認していれば却下）。否認には理由コメントが必須で、確定後に提案者へ
// 結果ポップアップで返す。
//
// ⚠️ web/src/lib/special-event.ts / special-event-engine.ts の「ミラー」。
//    両アプリが同じ special_event_proposals と settings_free/weekly_override
//    を読み書きするため、フィールド形状・週境界・承認条件を変えたら
//    必ずもう片方も同じに更新すること。
// ====================================================================

const SPECIAL_EVENT_COL = 'special_event_proposals';
/** 提案に必要な種目数。週間チャレンジの exerciseCount と揃えている。 */
const SPECIAL_EVENT_EXERCISE_COUNT = 4;
/** 提案に必要な承認者の人数。全員が承認して初めて成立する。 */
const SPECIAL_EVENT_APPROVER_COUNT = 3;
/** 開始日として選べる週数（次週の月曜から4週分）。 */
const SPECIAL_EVENT_WEEK_CHOICES = 4;
/** 承認者候補とみなす「直近の投稿」の日数。この期間に1回でも投稿があれば候補。 */
const SPECIAL_EVENT_ACTIVE_DAYS = 5;
/** 否認理由コメントの最大文字数。提案者へのポップアップで読み切れる長さ。 */
const SPECIAL_EVENT_COMMENT_MAX = 200;
const SPECIAL_EVENT_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SPECIAL_EVENT_DAY_MS = 24 * 60 * 60 * 1000;
/** 承認者候補・週別提案状況のキャッシュ寿命（users のキャッシュと同じ5分）。 */
const SPECIAL_EVENT_CACHE_MS = 5 * 60 * 1000;

// 提案フォームの選択状態
let specialEventDraft = { exercises: [], weekIndex: -1, approvers: [] };
let specialEventWeeks = [];
let specialEventCandidates = null;
let specialEventWeekUsage = {};
// 承認ポップアップの状態
let specialEventQueue = [];
let specialEventQueueIndex = 0;
let specialEventMandatory = false;
let specialEventStartCheckDone = false;
// 否認理由の入力状態（「否認する」を押すと入力欄が開く）
let specialEventRejecting = false;
let specialEventComment = '';
// 承認依頼をすべて答え終わった後にやること（起動時に結果ポップアップへ繋ぐ）
let specialEventAfterApproval = null;
// 提案者向け結果ポップアップの状態
let specialEventResultQueue = [];
let specialEventResultIndex = 0;

/**
 * 提案できる週の一覧。開始日は月曜のみ・次週の月曜から4週分。
 * 週境界は既存の週間チャレンジと同じ「日曜17:00 JST」起点。
 */
function getSpecialEventProposableWeeks(now = new Date(), count = SPECIAL_EVENT_WEEK_CHOICES) {
    const { start } = getWeekBoundaries(now);
    const weeks = [];
    for (let i = 1; i <= count; i++) {
        const weekStart = new Date(start.getTime() + i * SPECIAL_EVENT_WEEK_MS);
        const { monJST, friJST } = buildChampionDocMeta(weekStart);
        const y = monJST.getUTCFullYear();
        const m = String(monJST.getUTCMonth() + 1).padStart(2, '0');
        const d = String(monJST.getUTCDate()).padStart(2, '0');
        weeks.push({
            weekStart,
            mondayKey: `${y}-${m}-${d}`,
            periodLabel: formatWeeklyPeriodLabel(monJST, friJST),
            weeksAhead: i
        });
    }
    return weeks;
}

/** 対象週の開始前で、まだ weekly_override に反映できるか。 */
function isSpecialEventWeekUpcoming(targetWeekStart, now = new Date()) {
    return targetWeekStart instanceof Date && targetWeekStart.getTime() > now.getTime();
}

/**
 * 承認者全員の回答から提案のステータスを求める。
 *
 * 全員（SPECIAL_EVENT_APPROVER_COUNT 人）の回答が揃うまでは pending のまま。
 * 揃った時点で、1人でも否認していれば rejected、全員承認なら approved。
 * 早い者勝ちで打ち切らないのは、提案者に3人ぶんの結果（否認理由を含む）を
 * まとめて返すため。
 */
function resolveSpecialEventStatus(approverIds, responses) {
    const ids = approverIds || [];
    const res = responses || {};
    if (ids.length === 0) return 'pending';
    if (!ids.every(uid => res[uid] && res[uid].decision)) return 'pending';
    return ids.some(uid => res[uid].decision === 'rejected') ? 'rejected' : 'approved';
}

/**
 * 否認理由コメントの入力チェック。エラー文言（問題なければ null）を返す。
 * 否認は必ず一言そえてもらう（提案者が次に活かせるようにするため）。
 */
function validateSpecialEventComment(decision, comment) {
    if (decision !== 'rejected') return null;
    const trimmed = (comment || '').trim();
    if (!trimmed) return '否認する場合は理由を入力してください';
    if (trimmed.length > SPECIAL_EVENT_COMMENT_MAX) {
        return `理由は${SPECIAL_EVENT_COMMENT_MAX}文字以内で入力してください`;
    }
    return null;
}

/** 保存用に整えたコメント。承認時は空文字（Firestore に undefined を渡さない）。 */
function normalizeSpecialEventComment(decision, comment) {
    if (decision !== 'rejected') return '';
    return (comment || '').trim().slice(0, SPECIAL_EVENT_COMMENT_MAX);
}

/**
 * この提案について、そのユーザーにポップアップで聞くべきか。
 * 承認か否認を選ぶまで true を返し続けるので、回答漏れが起きない。
 */
function needsSpecialEventResponse(proposal, userId, now = new Date()) {
    if (!proposal || proposal.status !== 'pending') return false;
    if (!(proposal.approverIds || []).includes(userId)) return false;
    // 他の誰かが先に否認していても、3人ぶんの意見を集めるので最後まで聞く
    if (proposal.responses && proposal.responses[userId]) return false;
    return isSpecialEventWeekUpcoming(proposal.targetWeekStart, now);
}

/**
 * 提案者に結果ポップアップを出すべきか。
 * 3人の回答が揃って status が確定し、まだ本人が確認していない提案が対象。
 *
 * 自分で取り下げた提案は結果を知らせる意味がないので出さない
 * （出すと「否認されました」と同じ見た目で驚かせてしまう）。
 */
function needsSpecialEventResultNotice(proposal, userId) {
    if (!proposal || proposal.proposerId !== userId) return false;
    if (proposal.status === 'pending') return false;
    if (proposal.status === 'withdrawn') return false;
    return !proposal.resultSeenAt;
}

/**
 * 提案者が自分でこの提案を取り下げられるか。
 *
 * 取り下げられるのは「自分の提案」かつ「まだ回答が揃っていない（pending）」もの
 * だけ。確定してからでは weekly_override に反映済みかもしれないので触らせない。
 * 承認者が何人か回答済みでも、揃うまでは取り下げてよい。
 */
function canWithdrawSpecialEventProposal(proposal, userId) {
    if (!proposal || !userId || proposal.proposerId !== userId) return false;
    return proposal.status === 'pending';
}

/** 承認者ごとの回答一覧（提案時に選んだ順）。結果ポップアップの明細に使う。 */
function listSpecialEventDecisions(proposal) {
    return (proposal.approverIds || []).map(uid => {
        const res = (proposal.responses || {})[uid];
        return {
            userId: uid,
            userName: (proposal.approverNames || {})[uid] || '名無しさん',
            decision: (res && res.decision) || null,
            comment: res && res.decision === 'rejected' ? (res.comment || '') : ''
        };
    });
}

/** 否認した人だけを抜き出す（提案者に見せる否認理由の一覧）。 */
function listSpecialEventRejections(proposal) {
    return listSpecialEventDecisions(proposal).filter(d => d.decision === 'rejected');
}

/** 「承認2/3」のような進捗サマリ。 */
function summarizeSpecialEventResponses(approverIds, responses) {
    let approved = 0;
    let rejected = 0;
    (approverIds || []).forEach(uid => {
        const d = responses && responses[uid] ? responses[uid].decision : null;
        if (d === 'approved') approved++;
        else if (d === 'rejected') rejected++;
    });
    const total = (approverIds || []).length;
    return { approved, rejected, pending: total - approved - rejected, total };
}

/** Firestore ドキュメントを画面で使う形に整える。 */
function toSpecialEventProposal(id, data) {
    const approverIds = data.approverIds || [];
    const responses = data.responses || {};
    return {
        id,
        proposerId: data.proposerId || '',
        proposerName: data.proposerName || '名無しさん',
        exercises: data.exercises || [],
        exerciseNames: data.exerciseNames || [],
        targetWeekStart: data.targetWeekStart ? data.targetWeekStart.toDate() : new Date(0),
        mondayKey: data.mondayKey || '',
        periodLabel: data.periodLabel || '',
        label: data.label || '特別イベントウィーク',
        approverIds,
        approverNames: data.approverNames || {},
        responses,
        status: data.status || resolveSpecialEventStatus(approverIds, responses),
        resultSeenAt: data.resultSeenAt ? data.resultSeenAt.toDate() : null,
        withdrawnAt: data.withdrawnAt ? data.withdrawnAt.toDate() : null
    };
}

/** 自分が承認者になっている提案（対象週の新しい順）。 */
async function loadSpecialEventProposalsForApprover(userId) {
    // array-contains 単体なら自動インデックスで済むので status はクライアント側で絞る
    const snap = await db.collection(SPECIAL_EVENT_COL)
        .where('approverIds', 'array-contains', userId)
        .get();
    return snap.docs
        .map(d => toSpecialEventProposal(d.id, d.data()))
        .sort((a, b) => b.targetWeekStart.getTime() - a.targetWeekStart.getTime());
}

/** 自分が出した提案（対象週の新しい順）。 */
async function loadMySpecialEventProposals(userId) {
    const snap = await db.collection(SPECIAL_EVENT_COL)
        .where('proposerId', '==', userId)
        .get();
    return snap.docs
        .map(d => toSpecialEventProposal(d.id, d.data()))
        .sort((a, b) => b.targetWeekStart.getTime() - a.targetWeekStart.getTime());
}

/**
 * 対象週ごとの既存提案（開始日の選択肢に「申請中 / 確定済み」を出すため）。
 * mondayKeys を渡すとその週だけを引く（コレクション全件スキャンを避ける）。
 */
let specialEventWeekUsageCache = null; // { at, key, data }

async function loadSpecialEventProposalsByWeek(mondayKeys) {
    // Firestore の in は最大10件。提案できるのは4週分なので通常はそのまま収まる。
    const keys = Array.isArray(mondayKeys) ? mondayKeys.slice(0, 10) : null;
    const cacheKey = keys ? keys.join(',') : '*';
    if (specialEventWeekUsageCache
        && specialEventWeekUsageCache.key === cacheKey
        && Date.now() - specialEventWeekUsageCache.at < SPECIAL_EVENT_CACHE_MS) {
        return specialEventWeekUsageCache.data;
    }

    let ref = db.collection(SPECIAL_EVENT_COL);
    if (keys && keys.length > 0) ref = ref.where('mondayKey', 'in', keys);
    const snap = await ref.get();
    const byWeek = {};
    snap.docs.forEach(d => {
        const p = toSpecialEventProposal(d.id, d.data());
        if (!p.mondayKey) return;
        const slot = byWeek[p.mondayKey] || { pending: 0, approved: 0 };
        if (p.status === 'pending') slot.pending++;
        else if (p.status === 'approved') slot.approved++;
        byWeek[p.mondayKey] = slot;
    });
    specialEventWeekUsageCache = { at: Date.now(), key: cacheKey, data: byWeek };
    return byWeek;
}

/** 承認者候補の判定に使う「これ以降の投稿」の境界時刻。 */
function getSpecialEventActiveSince(now = new Date(), days = SPECIAL_EVENT_ACTIVE_DAYS) {
    return new Date(now.getTime() - days * SPECIAL_EVENT_DAY_MS);
}

/** ユーザーごとの直近投稿数のキャッシュ（モーダルの開き直しでサーバー往復を省く）。 */
let specialEventPostCountsCache = null; // { at, counts }

async function fetchSpecialEventRecentPostCounts(now = new Date()) {
    const since = getSpecialEventActiveSince(now);
    const snap = await db.collection('posts_free')
        .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(since))
        .get();

    const counts = {};
    snap.forEach(doc => {
        const post = doc.data();
        if (!post.userId || !post.timestamp) return;
        if (!(Number(post.value) > 0)) return;
        counts[post.userId] = (counts[post.userId] || 0) + 1;
    });
    specialEventPostCountsCache = { at: Date.now(), counts };
    return counts;
}

/**
 * 承認者候補（過去 SPECIAL_EVENT_ACTIVE_DAYS 日以内に1回でも投稿した人。
 * 自分とゲストは除く）。種目や曜日では絞らないので1クエリで済む。
 */
async function loadSpecialEventApproverCandidates(userId, now = new Date()) {
    const build = (counts, usersMap) => Object.keys(counts)
        .filter(uid => uid !== userId && !(usersMap[uid] && usersMap[uid].isGuest))
        .map(uid => ({
            userId: uid,
            userName: (usersMap[uid] && usersMap[uid].userName) || '名無しさん',
            postCount: counts[uid]
        }))
        .sort((a, b) => b.postCount - a.postCount || a.userName.localeCompare(b.userName));

    const usersMap = await getUsersMap();
    if (specialEventPostCountsCache
        && Date.now() - specialEventPostCountsCache.at < SPECIAL_EVENT_CACHE_MS) {
        const cached = build(specialEventPostCountsCache.counts, usersMap);
        // 人数が足りない時だけは、誰かが投稿した直後でも提案できるよう取り直す
        if (cached.length >= SPECIAL_EVENT_APPROVER_COUNT) return cached;
    }
    return build(await fetchSpecialEventRecentPostCounts(now), usersMap);
}

/**
 * 提案フォームで使うデータを先読みする（マイページ表示時など）。
 * 失敗しても無視する。ボタンを押した時にはキャッシュ済みで即表示できる。
 */
function prefetchSpecialEventProposalData() {
    if (!specialEventPostCountsCache
        || Date.now() - specialEventPostCountsCache.at >= SPECIAL_EVENT_CACHE_MS) {
        fetchSpecialEventRecentPostCounts().catch(() => {});
    }
    const keys = getSpecialEventProposableWeeks().map(w => w.mondayKey);
    loadSpecialEventProposalsByWeek(keys).catch(() => {});
}

/**
 * Firestore の permission-denied を、原因の分かる日本語にして返す。
 *
 * special_event_proposals は後から足したコレクションなので、
 * firestore.rules を本番へデプロイし忘れていると「ルール未定義＝全拒否」で
 * 落ちる。素の "Missing or insufficient permissions." のままだと
 * 何が悪いのか分からないため、対処法まで書いて投げ直す。
 */
function toSpecialEventError(e, fallbackMessage) {
    if (e && e.code === 'permission-denied') {
        return new Error(
            'Firestore に拒否されました。firestore.rules が本番に反映されていない可能性があります'
            + '（./scripts/deploy-firestore-rules.sh を実行してください）'
        );
    }
    return e instanceof Error ? e : new Error(fallbackMessage || '処理に失敗しました');
}

/** 提案を作成する。種目の組み合わせに制限はない（タイムアタックは何個でも可）。 */
async function createSpecialEventProposal(exercises, week, approvers) {
    if (!currentUser) throw new Error('ログインが必要です');
    if (exercises.length !== SPECIAL_EVENT_EXERCISE_COUNT) {
        throw new Error(`種目を${SPECIAL_EVENT_EXERCISE_COUNT}種類選んでください`);
    }
    if (new Set(exercises).size !== exercises.length) throw new Error('同じ種目は選べません');
    if (!week) throw new Error('開始日を選んでください');
    if (approvers.length !== SPECIAL_EVENT_APPROVER_COUNT) {
        throw new Error(`承認者を${SPECIAL_EVENT_APPROVER_COUNT}人選んでください`);
    }
    if (new Set(approvers.map(a => a.userId)).size !== approvers.length) {
        throw new Error('同じ人を複数選べません');
    }
    if (!isSpecialEventWeekUpcoming(week.weekStart)) {
        throw new Error('開始日が過ぎています。読み込み直してください');
    }

    const proposerName = (currentUserData && currentUserData.userName) || currentUser.email || '名無しさん';
    const approverNames = {};
    approvers.forEach(a => { approverNames[a.userId] = a.userName; });

    try {
        await db.collection(SPECIAL_EVENT_COL).add({
            proposerId: currentUser.uid,
            proposerName,
            exercises,
            exerciseNames: exercises.map(k => (freeExercises[k] && freeExercises[k].name) || k),
            targetWeekStart: firebase.firestore.Timestamp.fromDate(week.weekStart),
            mondayKey: week.mondayKey,
            periodLabel: week.periodLabel,
            label: `特別イベント（${proposerName}提案）`,
            approverIds: approvers.map(a => a.userId),
            approverNames,
            responses: {},
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.error('[特別イベント] 提案の作成に失敗:', e);
        throw toSpecialEventError(e, '提案の送信に失敗しました');
    }
    specialEventWeekUsageCache = null;
}

/**
 * 承認済みの提案を weekly_override に反映する。
 * 対象週が始まる前だけ書き込む（過ぎていたら反映しない）。
 */
async function applyApprovedSpecialEventProposal(proposal, now = new Date()) {
    if (!isSpecialEventWeekUpcoming(proposal.targetWeekStart, now)) return false;
    await db.collection('settings_free').doc('weekly_override').set({
        exercises: proposal.exercises,
        label: proposal.label,
        targetWeekStart: firebase.firestore.Timestamp.fromDate(proposal.targetWeekStart),
        invalidated: false,
        setAt: firebase.firestore.FieldValue.serverTimestamp(),
        setBy: proposal.proposerId,
        source: 'special_event_proposal',
        proposalId: proposal.id
    });
    return true;
}

/**
 * 承認/否認を記録する。3人の回答が揃い、全員承認だった時だけ
 * weekly_override へ反映する。同時回答に備えてトランザクションで
 * 読み直してから書く。
 *
 * 否認の場合は理由コメントが必須（提案者へのポップアップで表示する）。
 */
async function respondToSpecialEventProposal(proposalId, decision, comment = '') {
    if (!currentUser) throw new Error('ログインが必要です');
    const invalidComment = validateSpecialEventComment(decision, comment);
    if (invalidComment) throw new Error(invalidComment);
    const ref = db.collection(SPECIAL_EVENT_COL).doc(proposalId);

    let nextStatus;
    try {
        nextStatus = await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) throw new Error('提案が見つかりません');
            const data = snap.data();
            const approverIds = data.approverIds || [];
            if (!approverIds.includes(currentUser.uid)) throw new Error('この提案の承認者ではありません');
            const current = data.status || 'pending';
            if (current !== 'pending') return current;

            const responses = Object.assign({}, data.responses || {});
            responses[currentUser.uid] = {
                decision,
                at: firebase.firestore.Timestamp.now(),
                comment: normalizeSpecialEventComment(decision, comment)
            };
            const status = resolveSpecialEventStatus(approverIds, responses);
            tx.update(ref, {
                responses,
                status,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return status;
        });
    } catch (e) {
        console.error('[特別イベント] 承認/否認の記録に失敗:', e);
        throw toSpecialEventError(e, '回答の送信に失敗しました');
    }
    specialEventWeekUsageCache = null;

    if (nextStatus === 'approved') {
        const snap = await ref.get();
        if (snap.exists) await applyApprovedSpecialEventProposal(toSpecialEventProposal(snap.id, snap.data()));
    }
    return nextStatus;
}

/**
 * 自分の提案を取り下げる（pending → withdrawn）。
 *
 * 承認者の回答が1つでも入っている途中でも取り下げてよい。ただし3人ぶんが
 * 揃って status が確定したあとは触らせない（weekly_override へ反映済みの
 * 可能性があるため）。取り下げと同時に別の承認者が回答して確定する競合が
 * あるので、トランザクションで status を読み直してから書く。
 */
async function withdrawSpecialEventProposal(proposalId) {
    if (!currentUser) throw new Error('ログインが必要です');
    const ref = db.collection(SPECIAL_EVENT_COL).doc(proposalId);
    try {
        await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) throw new Error('提案が見つかりません');
            const proposal = toSpecialEventProposal(snap.id, snap.data());
            if (proposal.proposerId !== currentUser.uid) {
                throw new Error('自分が出した提案だけ取り下げられます');
            }
            if (proposal.status === 'withdrawn') return; // 二重クリックは成功扱い
            if (!canWithdrawSpecialEventProposal(proposal, currentUser.uid)) {
                throw new Error('すでに承認者全員の回答が揃っているため取り下げられません');
            }
            tx.update(ref, {
                status: 'withdrawn',
                withdrawnAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
    } catch (e) {
        console.error('[特別イベント] 提案の取り下げに失敗:', e);
        throw toSpecialEventError(e, '提案の取り下げに失敗しました');
    }
    // 取り下げた週は「申請中」ではなくなるので、選択肢の表示を作り直させる
    specialEventWeekUsageCache = null;
}

/**
 * 提案者が結果ポップアップを確認したことを記録する。
 * これを書いた提案は二度とポップアップに出てこない。
 */
async function markSpecialEventResultSeen(proposalId) {
    await db.collection(SPECIAL_EVENT_COL).doc(proposalId).update({
        resultSeenAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

// --------------------------------------------------------------------
// UI
// --------------------------------------------------------------------
function specialEventModalEl() {
    return document.getElementById('special-event-modal');
}

function openSpecialEventModal(title, icon, bodyHtml, { dismissible = true } = {}) {
    const modal = specialEventModalEl();
    if (!modal) return;
    document.getElementById('special-event-title').innerHTML =
        `<i class="fa-solid ${icon}"></i> ${escapeHtml(title)}`;
    document.getElementById('special-event-body').innerHTML = bodyHtml;
    const closeBtn = document.getElementById('special-event-close');
    if (closeBtn) closeBtn.style.display = dismissible ? '' : 'none';
    modal.dataset.dismissible = dismissible ? '1' : '0';
    modal.style.display = 'block';
}

function closeSpecialEventModal() {
    const modal = specialEventModalEl();
    if (!modal) return;
    modal.style.display = 'none';
    specialEventMandatory = false;
}

function specialEventStatusBadge(proposal) {
    if (proposal.status === 'approved') return '<span class="se-badge se-badge-ok">承認済み</span>';
    if (proposal.status === 'rejected') return '<span class="se-badge se-badge-ng">否認</span>';
    if (proposal.status === 'withdrawn') return '<span class="se-badge se-badge-off">取り下げ済み</span>';
    // 3人ぶん揃って初めて結果が決まるので、進捗は「回答した人数」で出す
    const s = summarizeSpecialEventResponses(proposal.approverIds, proposal.responses);
    return `<span class="se-badge se-badge-wait">回答待ち ${s.approved + s.rejected}/${s.total}</span>`;
}

/** 週間チャレンジの対象になる種目だけを候補にする。 */
function getSpecialEventPickableKeys() {
    return Object.keys(freeExercises)
        .filter(k => freeExercises[k] && !freeExercises[k].excludeFromWeekly)
        .sort((a, b) => (freeExercises[a].name || a).localeCompare(freeExercises[b].name || b));
}

async function openSpecialEventProposalModal() {
    if (!currentUser) return;
    if (currentUser.email === GUEST_EMAIL) {
        alert('ゲストアカウントからは提案できません');
        return;
    }
    if (!freeExercisesLoaded) await loadFreeExercises();

    specialEventDraft = { exercises: [], weekIndex: -1, approvers: [] };
    specialEventWeeks = getSpecialEventProposableWeeks();
    specialEventCandidates = null;
    specialEventWeekUsage = {};

    openSpecialEventModal('特別イベントを提案', 'fa-wand-magic-sparkles',
        '<p class="se-muted">読み込み中...</p>');

    // 承認者候補と週の提案状況は独立に描画する（片方の遅れでもう片方を待たせない）
    const mondayKeys = specialEventWeeks.map(w => w.mondayKey);
    loadSpecialEventProposalsByWeek(mondayKeys)
        .then(usage => {
            specialEventWeekUsage = usage;
            if (specialEventCandidates !== null) renderSpecialEventProposalForm();
        })
        .catch(e => {
            // 「申請中あり」のタグが出ないだけなので、提案自体は続けられる
            console.warn('[特別イベント] 週別の提案状況の取得に失敗:', e);
        });

    try {
        specialEventCandidates = await loadSpecialEventApproverCandidates(currentUser.uid);
    } catch (e) {
        console.error('[特別イベント] 承認者候補の取得に失敗:', e);
        specialEventCandidates = [];
    }
    renderSpecialEventProposalForm();
}

function renderSpecialEventProposalForm(errorMessage = '') {
    const pickable = getSpecialEventPickableKeys();
    const selectedEx = specialEventDraft.exercises;
    const selectedApprovers = specialEventDraft.approvers;
    const candidates = specialEventCandidates || [];

    const exerciseHtml = pickable.length === 0
        ? '<p class="se-muted">選べる種目がありません</p>'
        : pickable.map(key => {
            const ex = freeExercises[key];
            const on = selectedEx.includes(key);
            const order = selectedEx.indexOf(key) + 1;
            const full = !on && selectedEx.length >= SPECIAL_EVENT_EXERCISE_COUNT;
            const badge = ex.barbarian ? '<span class="se-ta">タイムアタック</span>' : '';
            return `
                <button type="button" class="se-pick${on ? ' se-pick-on' : ''}" data-se-exercise="${escapeHtml(key)}"${full ? ' disabled' : ''}>
                    <span class="se-pick-icon">${on ? order : `<i class="fa-solid ${escapeHtml(ex.icon || 'fa-dumbbell')}"></i>`}</span>
                    <span class="se-pick-body">
                        <span class="se-pick-name">${escapeHtml(ex.name || key)}${badge}</span>
                        <span class="se-pick-rule">${escapeHtml(ex.rule || '')}</span>
                    </span>
                </button>`;
        }).join('');

    const weekHtml = specialEventWeeks.map((w, i) => {
        const on = specialEventDraft.weekIndex === i;
        const usage = specialEventWeekUsage[w.mondayKey];
        let tag = '';
        if (usage && usage.approved) tag = '<span class="se-badge se-badge-ok">確定済みあり</span>';
        else if (usage && usage.pending) tag = '<span class="se-badge se-badge-wait">申請中あり</span>';
        return `
            <button type="button" class="se-week${on ? ' se-week-on' : ''}" data-se-week="${i}">
                <span class="se-week-main">
                    <span class="se-week-monday">${escapeHtml(w.mondayKey)} (月)</span>
                    <span class="se-week-period">${escapeHtml(w.periodLabel)}</span>
                </span>
                ${tag}
            </button>`;
    }).join('');

    let approverHtml;
    if (specialEventCandidates === null) {
        approverHtml = '<p class="se-muted">読み込み中...</p>';
    } else if (candidates.length < SPECIAL_EVENT_APPROVER_COUNT) {
        approverHtml = `<p class="se-warn"><i class="fa-solid fa-triangle-exclamation"></i> 過去${SPECIAL_EVENT_ACTIVE_DAYS}日の投稿者が${SPECIAL_EVENT_APPROVER_COUNT}人に届いていないため、いまは提案できません（現在${candidates.length}人）</p>`;
    } else {
        approverHtml = `<div class="se-chips">${candidates.map(c => {
            const on = selectedApprovers.includes(c.userId);
            const full = !on && selectedApprovers.length >= SPECIAL_EVENT_APPROVER_COUNT;
            return `<button type="button" class="se-chip${on ? ' se-chip-on' : ''}" data-se-approver="${escapeHtml(c.userId)}"${full ? ' disabled' : ''}>${on ? '<i class="fa-solid fa-check"></i> ' : ''}${escapeHtml(c.userName)}<span class="se-chip-count">${c.postCount}投稿</span></button>`;
        }).join('')}</div>`;
    }

    const ready = selectedEx.length === SPECIAL_EVENT_EXERCISE_COUNT
        && specialEventDraft.weekIndex >= 0
        && selectedApprovers.length === SPECIAL_EVENT_APPROVER_COUNT;

    document.getElementById('special-event-body').innerHTML = `
        <p class="se-lead">承認者${SPECIAL_EVENT_APPROVER_COUNT}人全員が承認すると、その週の週間チャレンジがこの${SPECIAL_EVENT_EXERCISE_COUNT}種目に差し替わります。</p>

        <div class="se-section-head">
            <span class="se-section-title"><i class="fa-solid fa-dumbbell"></i> 種目</span>
            <span class="se-counter">${selectedEx.length}/${SPECIAL_EVENT_EXERCISE_COUNT}</span>
        </div>
        <p class="se-muted">組み合わせは自由です。自動選出とは違い、タイムアタック種目は何個選んでも構いません（0個でも可）</p>
        <div class="se-pick-list">${exerciseHtml}</div>

        <div class="se-section-head">
            <span class="se-section-title"><i class="fa-solid fa-calendar-day"></i> 開始日（月曜）</span>
        </div>
        <div class="se-week-list">${weekHtml}</div>

        <div class="se-section-head">
            <span class="se-section-title"><i class="fa-solid fa-user-check"></i> 承認者</span>
            <span class="se-counter">${selectedApprovers.length}/${SPECIAL_EVENT_APPROVER_COUNT}</span>
        </div>
        <p class="se-muted">過去${SPECIAL_EVENT_ACTIVE_DAYS}日以内に投稿した人から選べます</p>
        ${approverHtml}

        ${errorMessage ? `<p class="error-message">${escapeHtml(errorMessage)}</p>` : ''}
        <button id="se-submit-btn" class="btn-primary"${ready ? '' : ' disabled'}><i class="fa-solid fa-paper-plane"></i> 送信する</button>
    `;

    document.querySelectorAll('[data-se-exercise]').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.seExercise;
            const list = specialEventDraft.exercises;
            const at = list.indexOf(key);
            if (at >= 0) list.splice(at, 1);
            else if (list.length < SPECIAL_EVENT_EXERCISE_COUNT) list.push(key);
            renderSpecialEventProposalForm();
        });
    });
    document.querySelectorAll('[data-se-week]').forEach(btn => {
        btn.addEventListener('click', () => {
            specialEventDraft.weekIndex = parseInt(btn.dataset.seWeek, 10);
            renderSpecialEventProposalForm();
        });
    });
    document.querySelectorAll('[data-se-approver]').forEach(btn => {
        btn.addEventListener('click', () => {
            const uid = btn.dataset.seApprover;
            const list = specialEventDraft.approvers;
            const at = list.indexOf(uid);
            if (at >= 0) list.splice(at, 1);
            else if (list.length < SPECIAL_EVENT_APPROVER_COUNT) list.push(uid);
            renderSpecialEventProposalForm();
        });
    });

    const submitBtn = document.getElementById('se-submit-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 送信中...';
            try {
                const week = specialEventWeeks[specialEventDraft.weekIndex];
                const approvers = specialEventDraft.approvers.map(uid => ({
                    userId: uid,
                    userName: (specialEventCandidates.find(c => c.userId === uid) || {}).userName || '名無しさん'
                }));
                await createSpecialEventProposal(specialEventDraft.exercises, week, approvers);
                closeSpecialEventModal();
                alert('特別イベントを提案しました。承認を待ちましょう');
            } catch (e) {
                renderSpecialEventProposalForm(e.message || '送信に失敗しました');
            }
        });
    }
}

/** 承認依頼と自分の提案の一覧。 */
async function openSpecialEventInboxModal() {
    if (!currentUser) return;
    openSpecialEventModal('イベント承認', 'fa-user-check', '<p class="se-muted">読み込み中...</p>');

    let inbox = [];
    let mine = [];
    try {
        [inbox, mine] = await Promise.all([
            loadSpecialEventProposalsForApprover(currentUser.uid),
            loadMySpecialEventProposals(currentUser.uid)
        ]);
    } catch (e) {
        document.getElementById('special-event-body').innerHTML =
            `<p class="error-message">${escapeHtml(e.message || '読み込みに失敗しました')}</p>`;
        return;
    }

    const pending = inbox.filter(p => needsSpecialEventResponse(p, currentUser.uid));
    const answered = inbox.filter(p => !pending.includes(p));

    const rowHtml = (p, sub) => `
        <div class="se-row">
            <span class="se-row-main">
                <span class="se-row-title">${escapeHtml(p.periodLabel)}</span>
                <span class="se-row-sub">${escapeHtml(sub)}</span>
            </span>
            ${specialEventStatusBadge(p)}
        </div>`;

    let html = `
        <div class="se-section-head">
            <span class="se-section-title"><i class="fa-solid fa-bell"></i> 未回答の依頼</span>
            ${pending.length ? `<span class="se-counter">${pending.length}件</span>` : ''}
        </div>`;
    if (pending.length === 0) {
        html += '<p class="se-muted">承認待ちの依頼はありません</p>';
    } else {
        html += pending.map(p => rowHtml(p, `${p.proposerName} さんの提案 / ${p.exerciseNames.join('・')}`)).join('');
        html += '<button id="se-open-approval-btn" class="btn-primary"><i class="fa-solid fa-check-double"></i> 内容を確認して回答する</button>';
    }

    if (answered.length) {
        html += `
            <div class="se-section-head">
                <span class="se-section-title"><i class="fa-solid fa-clock-rotate-left"></i> 回答済みの依頼</span>
            </div>`;
        html += answered.map(p => {
            const mineDecision = p.responses[currentUser.uid];
            const you = mineDecision
                ? (mineDecision.decision === 'rejected'
                    ? `あなた: 否認（${mineDecision.comment || '理由なし'}）`
                    : 'あなた: 承認')
                : '未回答';
            return rowHtml(p, `${p.proposerName} さんの提案 / ${you}`);
        }).join('');
    }

    html += `
        <div class="se-section-head">
            <span class="se-section-title"><i class="fa-solid fa-paper-plane"></i> 自分の提案</span>
        </div>`;
    html += mine.length === 0
        ? '<p class="se-muted">まだ提案していません</p>'
        : mine.map(p => {
            const row = rowHtml(p, `承認者: ${p.approverIds.map(uid => p.approverNames[uid] || '名無しさん').join('・')}`);
            // 回答が揃う前なら、提案者はここから取り下げられる
            if (canWithdrawSpecialEventProposal(p, currentUser.uid)) {
                return row + specialEventWithdrawHtml(p);
            }
            // 否認された提案は、結果ポップアップを閉じたあとでもここから理由を読み返せる
            if (p.status !== 'rejected') return row;
            const comments = listSpecialEventRejections(p).map(d => `
                <div class="se-comment-card">
                    <span class="se-comment-who"><i class="fa-solid fa-comment-dots"></i> ${escapeHtml(d.userName)}の否認理由</span>
                    <span class="se-comment-text">${escapeHtml(d.comment || '（理由の記載がありません）')}</span>
                </div>`).join('');
            return row + comments;
        }).join('');

    document.getElementById('special-event-body').innerHTML = html;

    const openBtn = document.getElementById('se-open-approval-btn');
    if (openBtn) {
        openBtn.addEventListener('click', () => openSpecialEventApprovalModal(pending, false));
    }
    bindSpecialEventWithdrawButtons();
}

/**
 * 「取り下げる」ボタンと、その場に開く確認ブロック。
 * 押し間違いで提案が消えないよう、確認を挟んでから書き込む。
 */
function specialEventWithdrawHtml(proposal) {
    const id = escapeHtml(proposal.id);
    return `
        <div class="se-withdraw">
            <button type="button" class="se-withdraw-btn" data-se-wd-open="${id}">
                <i class="fa-solid fa-rotate-left"></i> 取り下げる
            </button>
            <div class="se-withdraw-confirm" data-se-wd-confirm="${id}" hidden>
                <span class="se-withdraw-ask">この提案を取り下げますか？（承認者への依頼も取り消されます）</span>
                <div class="se-withdraw-actions">
                    <button type="button" class="se-withdraw-yes" data-se-wd-yes="${id}">
                        <i class="fa-solid fa-check"></i> 取り下げる
                    </button>
                    <button type="button" class="se-withdraw-no" data-se-wd-no="${id}">やめる</button>
                </div>
                <p class="se-withdraw-error" data-se-wd-error="${id}" hidden></p>
            </div>
        </div>`;
}

function bindSpecialEventWithdrawButtons() {
    const body = document.getElementById('special-event-body');
    if (!body) return;

    const confirmOf = id => body.querySelector(`[data-se-wd-confirm="${id}"]`);
    const openOf = id => body.querySelector(`[data-se-wd-open="${id}"]`);

    body.querySelectorAll('[data-se-wd-open]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.seWdOpen;
            btn.hidden = true;
            const box = confirmOf(id);
            if (box) box.hidden = false;
        });
    });

    body.querySelectorAll('[data-se-wd-no]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.seWdNo;
            const box = confirmOf(id);
            if (box) box.hidden = true;
            const open = openOf(id);
            if (open) open.hidden = false;
        });
    });

    body.querySelectorAll('[data-se-wd-yes]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.seWdYes;
            const errorEl = body.querySelector(`[data-se-wd-error="${id}"]`);
            if (errorEl) errorEl.hidden = true;
            const noBtn = body.querySelector(`[data-se-wd-no="${id}"]`);
            btn.disabled = true;
            if (noBtn) noBtn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 取り下げ中...';
            try {
                await withdrawSpecialEventProposal(id);
                // 一覧を取り直して「取り下げ済み」の状態で開き直す
                await openSpecialEventInboxModal();
            } catch (e) {
                // 取り下げと同時に回答が揃った場合はここに来る。理由をそのまま見せる
                btn.disabled = false;
                if (noBtn) noBtn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-check"></i> 取り下げる';
                if (errorEl) {
                    errorEl.textContent = e.message || '提案の取り下げに失敗しました';
                    errorEl.hidden = false;
                }
            }
        });
    });
}

/**
 * 承認依頼ポップアップ。mandatory=true（起動時の通知）では
 * 承認/否認を選ぶまで閉じられない。
 */
async function openSpecialEventApprovalModal(proposals, mandatory) {
    if (!proposals || proposals.length === 0) return;
    if (!freeExercisesLoaded) await loadFreeExercises();
    specialEventQueue = proposals;
    specialEventQueueIndex = 0;
    specialEventMandatory = !!mandatory;
    specialEventRejecting = false;
    specialEventComment = '';
    renderSpecialEventApproval();
}

function renderSpecialEventApproval(errorMessage = '') {
    const proposal = specialEventQueue[specialEventQueueIndex];
    if (!proposal) {
        closeSpecialEventModal();
        return;
    }
    const summary = summarizeSpecialEventResponses(proposal.approverIds, proposal.responses);

    const rulesHtml = proposal.exercises.map((key, i) => {
        const ex = freeExercises[key];
        const name = (ex && ex.name) || proposal.exerciseNames[i] || key;
        const badge = ex && ex.barbarian ? '<span class="se-ta">タイムアタック</span>' : '';
        return `
            <li class="se-rule-item">
                <span class="se-rule-icon"><i class="fa-solid ${escapeHtml((ex && ex.icon) || 'fa-dumbbell')}"></i></span>
                <span class="se-rule-body">
                    <span class="se-rule-name">${escapeHtml(name)}${badge}</span>
                    <span class="se-rule-text">${escapeHtml((ex && ex.rule) || 'ルールの記載がありません')}</span>
                </span>
            </li>`;
    }).join('');

    const bodyHtml = `
        ${specialEventQueue.length > 1 ? `<p class="se-progress">${specialEventQueueIndex + 1} / ${specialEventQueue.length} 件</p>` : ''}
        <p class="se-lead"><strong>${escapeHtml(proposal.proposerName)}</strong> さんから特別イベントウィークの提案が届いています。内容を確認して承認/否認を選んでください。</p>

        <div class="se-period-card">
            <i class="fa-solid fa-calendar-day"></i>
            <span>
                <span class="se-period-label">対象週</span>
                <span class="se-period-value">${escapeHtml(proposal.periodLabel)}</span>
            </span>
        </div>

        <div class="se-section-head">
            <span class="se-section-title"><i class="fa-solid fa-dumbbell"></i> 種目とルール</span>
        </div>
        <ol class="se-rule-list">${rulesHtml}</ol>

        <p class="se-muted">回答状況: 承認 ${summary.approved} / 否認 ${summary.rejected} / 未回答 ${summary.pending}（${escapeHtml(proposal.approverIds.map(uid => proposal.approverNames[uid] || '名無しさん').join('・'))}）</p>

        ${specialEventRejecting ? `
            <div class="se-section-head">
                <span class="se-section-title"><i class="fa-solid fa-comment-dots"></i> 否認する理由（必須）</span>
                <span class="se-counter" id="se-comment-count">${specialEventComment.trim().length}/${SPECIAL_EVENT_COMMENT_MAX}</span>
            </div>
            <textarea id="se-comment" class="se-comment-input" rows="3" maxlength="${SPECIAL_EVENT_COMMENT_MAX}"
                placeholder="例: この週は出張で参加できない人が多そうなので、別の週にしてほしいです">${escapeHtml(specialEventComment)}</textarea>
            <p class="se-muted">入力した理由は、3人の回答が揃ったあとに提案者へ通知されます</p>
        ` : ''}

        ${errorMessage ? `<p class="error-message">${escapeHtml(errorMessage)}</p>` : ''}
        ${specialEventRejecting ? `
            <div class="se-actions">
                <button id="se-cancel-reject-btn" class="btn-secondary"><i class="fa-solid fa-arrow-left"></i> やめる</button>
                <button id="se-reject-btn" class="btn-primary"><i class="fa-solid fa-xmark"></i> この理由で否認する</button>
            </div>
        ` : `
            <div class="se-actions">
                <button id="se-open-reject-btn" class="btn-secondary"><i class="fa-solid fa-xmark"></i> 否認する</button>
                <button id="se-approve-btn" class="btn-primary"><i class="fa-solid fa-check"></i> 承認する</button>
            </div>
        `}
        ${specialEventMandatory ? '<p class="se-muted se-center">承認か否認を選ぶまで、アプリを開くたびにこの確認が表示されます</p>' : ''}
    `;

    openSpecialEventModal('特別イベントの承認', 'fa-wand-magic-sparkles', bodyHtml, {
        dismissible: !specialEventMandatory
    });

    const commentInput = document.getElementById('se-comment');
    if (commentInput) {
        commentInput.focus();
        // 再描画（エラー表示など）でも入力済みの続きから打てるよう末尾へ
        commentInput.setSelectionRange(commentInput.value.length, commentInput.value.length);
        commentInput.addEventListener('input', () => {
            specialEventComment = commentInput.value;
            const counter = document.getElementById('se-comment-count');
            if (counter) counter.textContent = `${specialEventComment.trim().length}/${SPECIAL_EVENT_COMMENT_MAX}`;
        });
    }

    const respond = async (decision) => {
        const comment = decision === 'rejected' ? specialEventComment : '';
        const invalid = validateSpecialEventComment(decision, comment);
        if (invalid) {
            renderSpecialEventApproval(invalid);
            return;
        }
        document.querySelectorAll('.se-actions button').forEach(b => { b.disabled = true; });
        const target = document.getElementById(decision === 'approved' ? 'se-approve-btn' : 'se-reject-btn');
        if (target) target.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 送信中...';
        try {
            const status = await respondToSpecialEventProposal(proposal.id, decision, comment);
            if (status === 'approved') {
                alert(`${proposal.periodLabel} の特別イベントが決定しました！`);
            }
            specialEventQueueIndex++;
            specialEventRejecting = false;
            specialEventComment = '';
            if (specialEventQueueIndex < specialEventQueue.length) {
                renderSpecialEventApproval();
            } else {
                closeSpecialEventModal();
                // 起動時チェックから来た場合は、続けて自分の提案の結果を出す
                const after = specialEventAfterApproval;
                specialEventAfterApproval = null;
                if (after) after();
            }
        } catch (e) {
            renderSpecialEventApproval(e.message || '送信に失敗しました');
        }
    };

    document.getElementById('se-approve-btn')?.addEventListener('click', () => respond('approved'));
    document.getElementById('se-reject-btn')?.addEventListener('click', () => respond('rejected'));
    document.getElementById('se-open-reject-btn')?.addEventListener('click', () => {
        specialEventRejecting = true;
        renderSpecialEventApproval();
    });
    document.getElementById('se-cancel-reject-btn')?.addEventListener('click', () => {
        specialEventRejecting = false;
        renderSpecialEventApproval();
    });
}

/**
 * 提案者向けの結果ポップアップ。3人ぶんの回答が揃った自分の提案について、
 * 結果（否認なら理由コメント）を表示する。「確認しました」を押すまで閉じない。
 */
function openSpecialEventResultModal(proposals) {
    if (!proposals || proposals.length === 0) return;
    specialEventResultQueue = proposals;
    specialEventResultIndex = 0;
    renderSpecialEventResult();
}

function renderSpecialEventResult(errorMessage = '') {
    const proposal = specialEventResultQueue[specialEventResultIndex];
    if (!proposal) {
        closeSpecialEventModal();
        return;
    }
    const approved = proposal.status === 'approved';
    const decisions = listSpecialEventDecisions(proposal);
    const rejections = decisions.filter(d => d.decision === 'rejected');

    const commentsHtml = rejections.map(d => `
        <div class="se-comment-card">
            <span class="se-comment-who"><i class="fa-solid fa-user"></i> ${escapeHtml(d.userName)}</span>
            <span class="se-comment-text">${escapeHtml(d.comment || '（理由の記載がありません）')}</span>
        </div>`).join('');

    const decisionsHtml = decisions.map(d => {
        const badge = d.decision === 'approved'
            ? '<span class="se-badge se-badge-ok">承認</span>'
            : d.decision === 'rejected'
                ? '<span class="se-badge se-badge-ng">否認</span>'
                : '<span class="se-badge se-badge-wait">未回答</span>';
        return `
            <div class="se-row">
                <span class="se-row-main"><span class="se-row-title">${escapeHtml(d.userName)}</span></span>
                ${badge}
            </div>`;
    }).join('');

    const bodyHtml = `
        ${specialEventResultQueue.length > 1 ? `<p class="se-progress">${specialEventResultIndex + 1} / ${specialEventResultQueue.length} 件</p>` : ''}

        <div class="${approved ? 'se-result-ok' : 'se-result-ng'}">
            <i class="fa-solid ${approved ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>
            <span class="se-result-title">${approved ? '承認されました' : '否認されました'}</span>
            <span class="se-result-sub">${escapeHtml(approved
                ? `${proposal.periodLabel} の週間チャレンジが、あなたの提案した種目に差し替わります`
                : `${proposal.periodLabel} の提案は見送りになりました`)}</span>
        </div>

        <div class="se-period-card">
            <i class="fa-solid fa-dumbbell"></i>
            <span>
                <span class="se-period-label">提案した種目</span>
                <span class="se-period-value">${escapeHtml(proposal.exerciseNames.join('・'))}</span>
            </span>
        </div>

        ${!approved && rejections.length ? `
            <div class="se-section-head">
                <span class="se-section-title"><i class="fa-solid fa-comment-dots"></i> 否認の理由</span>
                <span class="se-counter">${rejections.length}件</span>
            </div>
            ${commentsHtml}
        ` : ''}

        <div class="se-section-head">
            <span class="se-section-title"><i class="fa-solid fa-user-check"></i> 承認者の回答</span>
        </div>
        ${decisionsHtml}

        ${errorMessage ? `<p class="error-message">${escapeHtml(errorMessage)}</p>` : ''}
        <button id="se-result-ok-btn" class="btn-primary"><i class="fa-solid fa-check"></i> 確認しました</button>
    `;

    // 結果を読まずに閉じられると否認理由が伝わらないので、閉じるボタンは出さない
    openSpecialEventModal('特別イベントの結果', 'fa-clipboard-check', bodyHtml, { dismissible: false });

    document.getElementById('se-result-ok-btn')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 送信中...';
        try {
            await markSpecialEventResultSeen(proposal.id);
        } catch (err) {
            // 既読化に失敗しても結果は読めているので先へ進む（次回もう一度出るだけ）
            console.warn('[特別イベント] 結果の既読化に失敗:', err);
        }
        specialEventResultIndex++;
        if (specialEventResultIndex < specialEventResultQueue.length) {
            renderSpecialEventResult();
        } else {
            closeSpecialEventModal();
        }
    });
}

/**
 * 起動時のポップアップ。
 *   1. 自分あての未回答の提案（承認/否認を選ぶまで毎回表示される）
 *   2. そのあと、3人の回答が揃った自分の提案の結果（否認なら理由つき）
 */
async function maybeShowSpecialEventApprovalOnStart() {
    if (specialEventStartCheckDone || !currentUser) return;
    specialEventStartCheckDone = true;
    try {
        const [inbox, mine] = await Promise.all([
            loadSpecialEventProposalsForApprover(currentUser.uid),
            loadMySpecialEventProposals(currentUser.uid)
        ]);
        const pending = inbox
            .filter(p => needsSpecialEventResponse(p, currentUser.uid))
            .sort((a, b) => a.targetWeekStart.getTime() - b.targetWeekStart.getTime());
        const results = mine
            .filter(p => needsSpecialEventResultNotice(p, currentUser.uid))
            .sort((a, b) => a.targetWeekStart.getTime() - b.targetWeekStart.getTime());

        if (pending.length > 0) {
            // 承認依頼を全部答え終えてから結果を出す（モーダルは1枚しかない）
            specialEventAfterApproval = results.length
                ? () => openSpecialEventResultModal(results)
                : null;
            await openSpecialEventApprovalModal(pending, true);
        } else if (results.length > 0) {
            openSpecialEventResultModal(results);
        }
    } catch (e) {
        // 提案機能が落ちても本体は動かす
        console.warn('[特別イベント] 起動時チェック失敗:', e);
    }
}

// --------------------------------------------------------------------
// イベントリスナー
// --------------------------------------------------------------------
document.getElementById('special-event-close')?.addEventListener('click', closeSpecialEventModal);
specialEventModalEl()?.addEventListener('click', (e) => {
    // 起動時の承認依頼は回答するまで閉じさせない
    if (e.target === specialEventModalEl() && specialEventModalEl().dataset.dismissible !== '0') {
        closeSpecialEventModal();
    }
});
document.getElementById('special-event-propose-btn')?.addEventListener('click', () => {
    if (profileModal) profileModal.style.display = 'none';
    openSpecialEventProposalModal();
});
document.getElementById('special-event-approve-btn')?.addEventListener('click', () => {
    if (profileModal) profileModal.style.display = 'none';
    openSpecialEventInboxModal();
});

// ====================================================================
// 初期化フォールバック: JSが正常に読み込まれたことを確認
// onAuthStateChangedが5秒以内に発火しない場合、ログイン画面を表示
// ====================================================================
setTimeout(() => {
    if (loginContainer.style.display === 'none' && mainContainer.style.display === 'none') {
        console.warn('[初期化] onAuthStateChangedが応答しません。ログイン画面を表示します。');
        loginContainer.style.display = 'block';
    }
}, 5000);
