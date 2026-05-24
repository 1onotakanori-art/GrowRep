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
    if (currentMode === 'free' || currentMode === 'weekly') {
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
            totalScore: 0
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
                user.totalScore += pct;
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
            user.totalScore += pct;
        });
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
 * ユーザー情報を取得
 * @param {string} userId - ユーザーID
 * @returns {Promise<Object|null>} ユーザー情報
 */
async function getUserData(userId) {
    const doc = await db.collection('users').doc(userId).get();
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
        
        const multipliers = await getMultipliers();
        const collectionName = getCollectionName('posts');
        const postsSnapshot = await db.collection(collectionName).get();
        const usersSnapshot = await db.collection('users').get();
        
        // ユーザー情報を格納
        const usersData = {};
        usersSnapshot.forEach(doc => {
            const data = doc.data();
            usersData[doc.id] = data.userName || data.email;
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
        
        // 総合得点ランキングを表示
        displayTotalScores(usersScores);
        
    } catch (error) {
        console.error('得点チャートの描画に失敗しました:', error);
        scoreError.textContent = '得点チャートの描画に失敗しました';
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
                guestData = await getUserData(user.uid);
            } else if (!guestData.isGuest) {
                // isGuestフラグが未設定の場合は補完
                await db.collection('users').doc(user.uid).update({ isGuest: true });
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

        loadPosts();
        loadRanking();
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
    }
});

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
    
    // 現在表示中のタブがモード専用かつ表示できない場合、投稿タブに戻る
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab) {
        const activeMode = activeTab.dataset.mode;
        if (activeMode && activeMode !== currentMode) {
            // 投稿タブをアクティブに
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.querySelector('.tab-btn[data-tab="post"]').classList.add('active');
            document.getElementById('post-tab').classList.add('active');
        }
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
            timer: '指定した秒数ごとに音が鳴り、カウントアップされます'
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
            timer: '指定した秒数ごとに音が鳴り、カウントアップされます'
        }
    };

    const currentTexts = modeTexts[currentMode] || modeTexts['normal'];
    const modeClass = currentMode === 'normal' ? 'normal'
                    : currentMode === 'interval' ? 'interval-mode'
                    : currentMode === 'weekly' ? 'weekly-mode'
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
        'derby-mode-info': currentTexts.derby
    };
    
    Object.entries(modeInfoElements).forEach(([id, text]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = text;
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
    
    // モードセレクターの値を同期
    modeSelect.value = newMode;
    
    // 背景色クラスを切り替え（トランジション付き）（bodyとhtmlの両方）
    document.body.classList.remove('mode-normal', 'mode-interval', 'mode-free', 'mode-weekly');
    document.body.classList.add(`mode-${newMode}`);
    document.documentElement.classList.remove('mode-normal', 'mode-interval', 'mode-free', 'mode-weekly');
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
        const collectionName = getCollectionName('posts');
        console.log(`[loadPosts] Firestoreから取得中: ${collectionName} (${mode}モード)`);
        
        const snapshot = await db.collection(collectionName)
            .orderBy('timestamp', 'desc')
            .get();
        
        console.log(`[loadPosts] ${snapshot.size}件の投稿を取得 (${mode}モード)`);
        
        if (snapshot.empty) {
            postsList.innerHTML = '<p style="text-align: center; color: #999;">まだ投稿がありません</p>';
            postsCache[mode] = [];
            postsCacheTime[mode] = now;
            return;
        }
        
        // 各投稿のユーザー名を取得
        const posts = [];
        for (const doc of snapshot.docs) {
            const post = doc.data();
            const userData = await getUserData(post.userId);
            posts.push({
                id: doc.id,
                data: post,
                userName: userData && userData.userName ? userData.userName : post.userEmail
            });
        }
        
        // キャッシュを更新
        postsCache[mode] = posts;
        postsCacheTime[mode] = now;
        
        console.log(`[loadPosts] キャッシュ更新完了 (${mode}モード)`);
        
        // 投稿を表示
        renderPosts(posts);
        
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
        
        const snapshot = await db.collection(collectionName).get();
        
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
        // 全投稿を取得してクライアント側でフィルタリング（複合インデックス不要）
        const collectionName = getCollectionName('posts');
        const snapshot = await db.collection(collectionName).get();
        
        const userPosts = [];
        
        // 現在のユーザーかつ選択された種目の投稿を抽出
        snapshot.forEach((doc) => {
            const post = doc.data();
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
            weeklySimulatorExerciseKeys = weeklyChallenge ? weeklyChallenge.exercises.filter(k => freeExercises[k]) : [];
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
const PRESET_TAGS = [
    '胸', '背中', '肩', '腕', '脚', '腹', '全身', '体幹',
    '自重','ウェイト','3秒1回','1分間'
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

        const collectionName = 'posts_free';
        const postsSnapshot = await db.collection(collectionName).get();
        const usersSnapshot = await db.collection('users').get();

        const usersData = {};
        usersSnapshot.forEach(doc => {
            const data = doc.data();
            usersData[doc.id] = data.userName || data.email;
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

        // 総合得点ランキング表示
        displayFreeScores(usersScores, exerciseKeys);

    } catch (error) {
        console.error('[フリーモード] レーダーチャートエラー:', error);
        scoreError.textContent = 'チャートの描画に失敗しました';
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

/**
 * 週間チャレンジの選出設定を取得
 * @returns {Promise<Object>} { weightExponent: number }
 */
async function getWeeklyConfig() {
    try {
        const doc = await db.collection('settings_free').doc('weekly_config').get();
        if (doc.exists) {
            return doc.data();
        }
    } catch (e) {
        console.warn('[週間チャレンジ] weekly_config取得失敗、デフォルト使用:', e);
    }
    return { weightExponent: 2 };
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
 * 週間チャレンジを「通常2種目 + バーバリアン1種目」で選出
 * 既存の加重ランダムロジックをそのまま利用し、足りない枠は他プールで補完する
 * @param {Object} allExercises - freeExercises 全体
 * @param {Object} history - { [key]: 選出回数 }
 * @param {number} weightExponent - 重み指数
 * @param {Object} [exerciseRatings={}] - 種目評価集計
 * @param {Object} [creatorData={}] - 作成者データ
 * @returns {string[]}
 */
function selectWeeklyExercisesWithBarbarianSlot(allExercises, history, weightExponent = 2, exerciseRatings = {}, creatorData = {}) {
    const allKeys = Object.keys(allExercises || {}).filter(key => !allExercises[key]?.excludeFromWeekly);
    if (allKeys.length === 0) return [];

    const normalKeys = allKeys.filter(key => !(allExercises[key] && allExercises[key].barbarian));
    const barbarianKeys = allKeys.filter(key => allExercises[key] && allExercises[key].barbarian);

    const selectedNormal = selectWeeklyExercises(normalKeys, history, 2, weightExponent, exerciseRatings, creatorData);
    const selectedBarbarian = selectWeeklyExercises(barbarianKeys, history, 1, weightExponent, exerciseRatings, creatorData);

    const selectedSet = new Set([...selectedNormal, ...selectedBarbarian]);

    // 総数3を維持するため、枠不足時は残り全種目から補完
    if (selectedSet.size < 3) {
        const remainingKeys = allKeys.filter(key => !selectedSet.has(key));
        const fallback = selectWeeklyExercises(remainingKeys, history, 3 - selectedSet.size, weightExponent, exerciseRatings, creatorData);
        fallback.forEach(key => selectedSet.add(key));
    }

    return Array.from(selectedSet);
}

/**
 * 今週の週間チャレンジ設定を取得/更新する
 * - settings_free/weekly_challenge から読み込む
 * - 古ければ新しい3種目を選出してFirestoreに保存
 * @returns {Promise<Object>} weeklyChallenge
 */
async function getOrUpdateWeeklyChallenge() {
    const { start: weekStart, end: weekEnd } = getWeekBoundaries();

    try {
        const doc = await db.collection('settings_free').doc('weekly_challenge').get();

        if (doc.exists) {
            const data = doc.data();
            const savedWeekStart = data.weekStart ? data.weekStart.toDate() : null;

            // 同じ週かどうか確認（1分の誤差許容）
            if (savedWeekStart && Math.abs(savedWeekStart.getTime() - weekStart.getTime()) < 60 * 1000) {
                weeklyChallenge = {
                    weekStart,
                    weekEnd,
                    exercises: data.exercises || [],
                    selectionHistory: data.selectionHistory || {},
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

        // 手動上書き設定を確認（管理者が事前に来週の種目を指定している場合）
        const overrideDoc = await db.collection('settings_free').doc('weekly_override').get();
        if (overrideDoc.exists) {
            const overrideData = overrideDoc.data();
            const selectedExercises = overrideData.exercises || [];
            const newHistory = { ...existingHistory };
            selectedExercises.forEach(key => { newHistory[key] = (newHistory[key] || 0) + 1; });
            await db.collection('settings_free').doc('weekly_challenge').set({
                weekStart: firebase.firestore.Timestamp.fromDate(weekStart),
                weekEnd: firebase.firestore.Timestamp.fromDate(weekEnd),
                exercises: selectedExercises,
                selectionHistory: newHistory,
                isManualOverride: true,
                overrideLabel: overrideData.label || '特別イベント',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await db.collection('settings_free').doc('weekly_override').delete();
            weeklyChallenge = {
                weekStart, weekEnd,
                exercises: selectedExercises,
                selectionHistory: newHistory,
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
            creatorDataMap
        );

        // 選出履歴を更新
        const newHistory = { ...existingHistory };
        selectedExercises.forEach(key => {
            newHistory[key] = (newHistory[key] || 0) + 1;
        });

        await db.collection('settings_free').doc('weekly_challenge').set({
            weekStart: firebase.firestore.Timestamp.fromDate(weekStart),
            weekEnd: firebase.firestore.Timestamp.fromDate(weekEnd),
            exercises: selectedExercises,
            selectionHistory: newHistory,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        weeklyChallenge = {
            weekStart,
            weekEnd,
            exercises: selectedExercises,
            selectionHistory: newHistory
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

    const exercisesHtml = weeklyChallenge.exercises.map(key => {
        const ex = freeExercises[key];
        if (!ex) return '';
        return `<div class="weekly-challenge-exercise-item">🏋️ ${escapeHtml(ex.name)}</div>`;
    }).join('');

    const nextWeekEndJST = new Date(weeklyChallenge.weekEnd.getTime() + JST_OFFSET_MS);

    const overrideBadge = weeklyChallenge.isManualOverride
        ? `<span class="barbarian-badge" style="background:linear-gradient(135deg,#667eea,#764ba2);margin-left:6px"><i class="fa-solid fa-star"></i> ${escapeHtml(weeklyChallenge.overrideLabel || '特別イベント')}</span>`
        : '';

    infoEl.style.display = 'block';
    infoEl.className = 'weekly-challenge-info';
    infoEl.innerHTML = `
        <h3><i class="fa-solid fa-trophy"></i> 今週のチャレンジ${overrideBadge}</h3>
        <div class="weekly-challenge-period"><i class="fa-solid fa-calendar"></i> 第${weekNumber}週：${formatDate(monJST)} 〜 ${formatDate(friJST)}</div>
        <div class="weekly-challenge-exercises">${exercisesHtml}</div>
        <div class="weekly-challenge-next">次回発表: ${formatDate(nextWeekEndJST)} 17:00</div>
    `;
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

    if (!weeklyChallenge || weeklyChallenge.exercises.length === 0) {
        rankingList.innerHTML = '<p class="weekly-no-challenge">フリーモードに種目がまだ登録されていません。</p>';
        renderWeeklyChallengeInfo();
        return;
    }

    if (!forceRefresh && rankingCache.weekly && rankingCacheTime.weekly && (now - rankingCacheTime.weekly < CACHE_DURATION)) {
        console.log('[週間チャレンジ] ランキングキャッシュを使用');
        renderWeeklyChallengeInfo();
        renderRanking(rankingCache.weekly);
        return;
    }

    try {
        const snapshot = await db.collection('posts_free').get();

        const { weekStart, weekEnd, exercises } = weeklyChallenge;
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
        const exerciseKeys = exercises.filter(k => freeExercises[k]);

        const postsSnapshot = await db.collection('posts_free').get();
        const usersSnapshot = await db.collection('users').get();

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
        const exerciseKeys = weeklyChallenge ? weeklyChallenge.exercises.filter(k => freeExercises[k]) : [];
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
        exerciseKeys = weeklyChallenge ? weeklyChallenge.exercises.filter(k => freeExercises[k]) : [];
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

        // 総合得点ランキング
        displayFreeScores(usersScores, exerciseKeys);

    } catch (error) {
        console.error('[週間チャレンジ] チャートエラー:', error);
        scoreError.textContent = 'チャートの描画に失敗しました';
    }
}

/**
 * 週間チャレンジモード入場時のUI初期化
 */
async function initWeeklyMode() {
    if (!freeExercisesLoaded) {
        await loadFreeExercises();
    }
    await getOrUpdateWeeklyChallenge();
    updateWeeklyPostDropdown();
    updateWeeklyRulesTab();
    updateWeeklyGraphDropdown();
    renderWeeklyChallengeInfo();

    // 現在の週の履歴を保存（チャンプ集計用）
    if (weeklyChallenge && weeklyChallenge.exercises.length > 0) {
        saveWeeklyChallengeHistory(weeklyChallenge);
    }

    // 過去週の詳細データをセッション中1回だけバックフィル
    if (!weeklyChampionBackfillDoneInSession) {
        await checkAndFinalizePassedWeeks();
        weeklyChampionBackfillDoneInSession = true;
    }
}

/**
 * 週間チャレンジ: 投稿タブのプルダウンを今週の3種目に更新
 */
function updateWeeklyPostDropdown() {
    if (currentMode !== 'weekly') return;
    const postTab = document.getElementById('post-tab');
    const exercisesGrid = document.getElementById('post-exercises-grid');

    // 週間チャレンジではフィルタUIを削除
    const existingFilter = postTab.querySelector('.exercise-filter-bar');
    if (existingFilter) existingFilter.remove();

    exercisesGrid.innerHTML = '';

    if (!weeklyChallenge || weeklyChallenge.exercises.length === 0) {
        exercisesGrid.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">今週のチャレンジ種目はまだ設定されていません。</p>';
        return;
    }

    weeklyChallenge.exercises.forEach(key => {
        const ex = freeExercises[key];
        if (!ex) return;
        appendPostItem(exercisesGrid, key, ex);
    });
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

    // 評価データ・投稿実績・自分の評価を取得
    const exerciseKeys = weeklyChallenge.exercises;
    const [ratingSummaries, userPostedKeys, userRatingMap] = await Promise.all([
        getExerciseRatingSummaries(exerciseKeys),
        getUserPostedExerciseKeys('free'),
        getUserExerciseRatings(exerciseKeys)
    ]);

    exerciseKeys.forEach(key => {
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

    weeklyChallenge.exercises.forEach(key => {
        const ex = freeExercises[key];
        if (!ex) return;
        const option = document.createElement('option');
        option.value = key;
        option.textContent = ex.name;
        select.appendChild(option);
    });
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
                totalScore: 0
            };
        }

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
            user.totalScore += percent;
        });
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

    // posts_free / users を一括取得
    const [postsSnap, usersSnap, historySnap] = await Promise.all([
        db.collection('posts_free').get(),
        db.collection('users').get(),
        db.collection('weekly_challenge_history')
            .orderBy(firebase.firestore.FieldPath.documentId(), 'asc')
            .get()
    ]);

    const usersData = {};
    usersSnap.forEach(doc => {
        const d = doc.data();
        usersData[doc.id] = d.userName || d.email || 'Unknown';
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
            derbyWeeks.push({
                docId: doc.id,
                weekStart,
                weekEnd,
                exercises: Array.isArray(data.exercises) ? data.exercises : [],
                monJST
            });
        }
    });

    // 今週が同期間内であれば追加（historyに未登録の場合）
    if (weeklyChallenge && weeklyChallenge.weekStart) {
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
function renderMonthlyDerbyData(dataWrap, data, year, month) {
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
// 初期化フォールバック: JSが正常に読み込まれたことを確認
// onAuthStateChangedが5秒以内に発火しない場合、ログイン画面を表示
// ====================================================================
setTimeout(() => {
    if (loginContainer.style.display === 'none' && mainContainer.style.display === 'none') {
        console.warn('[初期化] onAuthStateChangedが応答しません。ログイン画面を表示します。');
        loginContainer.style.display = 'block';
    }
}, 5000);
