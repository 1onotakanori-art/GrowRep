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
let currentMode = 'interval'; // 'normal' または 'interval'

/**
 * モードに応じたコレクション名を取得
 * @param {string} baseCollection - 基本コレクション名（'posts', 'scores', 'multipliers'）
 * @returns {string} モード別のコレクション名
 */
function getCollectionName(baseCollection) {
    if (currentMode === 'interval') {
        return `${baseCollection}_interval`;
    }
    if (currentMode === 'free') {
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
const submitPostBtn = document.getElementById('submit-post-btn');
const exerciseType = document.getElementById('exercise-type');
const exerciseValue = document.getElementById('exercise-value');
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
    free: null
};
let postsCacheTime = {
    normal: null,
    interval: null,
    free: null
};
let rankingCache = {
    normal: null,
    interval: null,
    free: null
};
let rankingCacheTime = {
    normal: null,
    interval: null,
    free: null
};
let scoreCache = {
    normal: null,
    interval: null,
    free: null
};
let scoreCacheTime = {
    normal: null,
    interval: null,
    free: null
};
let progressCache = {
    normal: {},
    interval: {},
    free: {}
};  // 種目ごとにキャッシュ
const CACHE_DURATION = 5 * 60 * 1000;  // キャッシュ有効期間: 5分

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
        
        // 集計方法を取得
        const scoringMethod = document.getElementById('scoring-method').value;
        const isDeviationMode = scoringMethod === 'deviation';
        const isPercentageMode = scoringMethod === 'percentage';
        
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
    // 集計方法を取得
    const scoringMethod = document.getElementById('scoring-method').value;
    
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
        
        // ユーザー情報を取得
        currentUserData = await getUserData(user.uid);
        
        // ユーザー情報が存在しない場合（既存ユーザーの初回ログイン）
        if (!currentUserData) {
            await createUserData(user.uid, user.email, user.email);
            currentUserData = await getUserData(user.uid);
        }
        
        // ユーザー名をプロフィールボタンに表示
        let displayName = user.email;
        if (currentUserData.userName && currentUserData.userName !== user.email) {
            displayName = currentUserData.userName;
        }
        profileBtn.textContent = '👤 ' + displayName;
        
        loginContainer.style.display = 'none';
        mainContainer.style.display = 'block';
        
        // モードセレクターの値を現在のモードに同期
        modeSelect.value = currentMode;
        
        // 背景色クラスを設定
        document.body.classList.remove('mode-normal', 'mode-interval', 'mode-free');
        document.body.classList.add(`mode-${currentMode}`);
        
        // モードに応じたタブ表示を初期化
        updateTabsForMode();
        
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
        profileEmail.textContent = currentUser.email;
        
        // 現在のユーザー名を表示
        if (currentUserData.userName && currentUserData.userName !== currentUser.email) {
            currentUsername.textContent = currentUserData.userName;
        } else {
            currentUsername.textContent = '未設定';
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
        userName.textContent = newUsername;
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
            // ただしtimer-tabはintervalとfreeの両方で使用可能
            if (content.id === 'timer-tab' && (currentMode === 'interval' || currentMode === 'free')) {
                // timer-tabはintervalとfreeで共有
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
            score: 'ノーマルモードの総合得点'
        },
        'interval': {
            post: 'インターバルモードの記録を投稿すること',
            board: 'インターバルモードのデータのみ表示',
            ranking: 'インターバルモードのランキング表示',
            progress: 'インターバルモードの成長記録',
            rules: 'インターバルモードのルールと倍率設定',
            score: 'インターバルモードの総合得点'
        },
        'free': {
            post: 'フリーモードの記録を投稿（自由種目）',
            board: 'フリーモードのデータのみ表示',
            ranking: 'フリーモードのランキング表示',
            progress: 'フリーモードの成長記録',
            rules: 'フリーモードの種目管理（種目の追加・削除が可能）',
            score: 'フリーモードの総合得点'
        }
    };

    const currentTexts = modeTexts[currentMode];
    const modeClass = currentMode === 'normal' ? 'normal' : currentMode === 'interval' ? 'interval-mode' : 'free-mode';
    
    // 各タブのモード情報を更新
    const modeInfoElements = {
        'post-mode-info': currentTexts.post,
        'board-mode-info': currentTexts.board,
        'ranking-mode-info': currentTexts.ranking,
        'progress-mode-info': currentTexts.progress,
        'rules-mode-info': currentTexts.rules,
        'score-mode-info': currentTexts.score
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
    
    // モードセレクターの値を同期
    modeSelect.value = newMode;
    
    // 背景色クラスを切り替え（トランジション付き）
    document.body.classList.remove('mode-normal', 'mode-interval', 'mode-free');
    document.body.classList.add(`mode-${newMode}`);
    
    // タブの表示を更新
    updateTabsForMode();
    
    // 現在のモードのプログレスキャッシュをクリア
    progressCache[newMode] = {};
    
    // データをリフレッシュ
    if (currentUser) {
        try {
            console.log(`${newMode}モードのデータを読み込み中...`);
            console.log(`使用コレクション: ${getCollectionName('posts')}, ${getCollectionName('settings')}`);

            // フリーモードへの切り替え時はUI初期化
            if (newMode === 'free') {
                await initFreeMode();
            } else {
                // フリーモードから戻る場合はUI復元
                restoreStandardExerciseUI();
            }

            loadPosts(true);  // 強制リフレッシュ
            loadRanking(true);  // 強制リフレッシュ

            // 得点タブの場合も再読み込み
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab && activeTab.id === 'score-tab') {
                if (newMode === 'free') {
                    loadFreeUserCheckboxes(true);
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
        
        // ルールタブの場合は倍率をロード（フリーモードでは種目管理UI）
        if (tabName === 'rules') {
            if (currentMode === 'free') {
                updateFreeRulesTab();
            } else {
                loadMultipliers();
            }
        }
        
        // 得点タブの場合はキャッシュを使用
        if (tabName === 'score') {
            if (currentMode === 'free') {
                loadFreeUserCheckboxes(false);
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
    });
});

// ====================================================================
// 統合更新ボタンのイベントリスナー
// ====================================================================

// 統合更新ボタン（現在のタブに応じて更新処理を実行）
document.getElementById('refresh-all-btn').addEventListener('click', async function() {
    this.classList.add('loading');
    const originalText = this.textContent;
    this.textContent = '⏳ 更新中...';
    
    try {
        const mode = currentMode;
        
        // 現在アクティブなタブを取得
        const activeTab = document.querySelector('.tab-content.active');
        const tabId = activeTab ? activeTab.id : null;
        
        switch(tabId) {
            case 'ranking-tab':
                await loadRanking(true);  // 強制更新
                break;
            case 'progress-tab':
                progressCache[mode] = {};  // グラフのキャッシュをクリア
                await loadProgressChart();
                break;
            case 'score-tab':
                if (currentMode === 'free') {
                    await loadFreeUserCheckboxes(true);
                } else {
                    await loadUserCheckboxes(true);
                }
                break;
            case 'board-tab':
                await loadPosts(true);  // 掲示板を強制更新
                break;
            default:
                // その他のタブでは特に何もしない
                break;
        }
    } finally {
        this.classList.remove('loading');
        this.textContent = originalText;
    }
});

// 投稿の送信
// バリデーション: 入力値の検証を強化
submitPostBtn.addEventListener('click', async () => {
    const type = exerciseType.value;
    const value = parseInt(exerciseValue.value);
    
    // 種目の検証
    const validExercises = currentMode === 'free' ? freeExercises : exerciseNames;
    if (!type || !validExercises[type]) {
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
            exerciseType: type,
            value: value,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            likes: [],
            comments: []
        });
        
        console.log(`[submitPost] 投稿成功: ${exerciseNames[type]} ${value} (${currentMode}モード)`);
        
        // 投稿後、現在のモードのキャッシュをクリア（新しいデータを反映させるため）
        const mode = currentMode;
        rankingCache[mode] = null;
        rankingCacheTime[mode] = null;
        scoreCache[mode] = null;
        scoreCacheTime[mode] = null;
        progressCache[mode] = {};
        postsCache[mode] = null;
        postsCacheTime[mode] = null;
        
        exerciseType.value = '';
        exerciseValue.value = '';
        postError.textContent = '';
        
        // 投稿後、掲示板タブに切り替え
        document.querySelector('[data-tab="board"]').click();
        
        alert('投稿しました！');
    } catch (error) {
        postError.textContent = '投稿に失敗しました。もう一度お試しください。';
        console.error('投稿エラー:', error);
    }
});

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
    const currentExNames = currentMode === 'free' ? getFreeExerciseNames() : exerciseNames;
    const safeExerciseName = escapeHtml(currentExNames[post.exerciseType] || post.exerciseType);
    const safeValue = parseInt(post.value) || 0; // 数値として扱う
    const safePostId = escapeHtml(postId);
    
    div.innerHTML = `
        <div class="post-header">
            <span class="post-user">${safeUserName}</span>
            <span class="post-date">${escapeHtml(date)}</span>
        </div>
        <div class="post-content">
            <span class="post-exercise">${safeExerciseName}</span>
            <span class="post-value">${safeValue} ${currentMode === 'free' ? '' : (post.exerciseType === 'Lsit' ? '秒' : post.exerciseType === 'pullup' ? 'セット' : '回')}</span>
        </div>
        <div class="post-actions">
            <button class="like-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${safePostId}')">
                💪 ${likeCount > 0 ? likeCount : ''}
            </button>
            <button class="comment-btn" onclick="toggleComments('${safePostId}')">
                💬 ${post.comments && post.comments.length > 0 ? post.comments.length : ''}
            </button>
            ${isOwner ? `<button class="delete-btn" onclick="deletePost('${safePostId}')">🗑️ </button>` : ''}
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
                ${isOwner ? `<button class="comment-delete-btn" onclick="deleteComment('${escapeHtml(postId)}', ${i})">🗑️</button>` : ''}
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
        const currentCount = parseInt(currentText.replace('💪', '').trim()) || 0;
        
        // UIを即座に更新（楽観的更新）
        if (isLiked) {
            // いいねを取り消す場合
            likeBtn.classList.remove('liked');
            const newCount = Math.max(0, currentCount - 1);
            likeBtn.innerHTML = `💪 ${newCount > 0 ? newCount : ''}`;
        } else {
            // いいねを追加する場合
            likeBtn.classList.add('liked');
            const newCount = currentCount + 1;
            likeBtn.innerHTML = `💪 ${newCount}`;
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
                commentBtn.innerHTML = `💬 ${post.comments.length}`;
            }
        }
        
        // 成功メッセージを表示
        alert('💬 コメントが送信されました！');
    } catch (error) {
        console.error('コメント送信エラー:', error);
        alert('❌ コメントの送信に失敗しました');
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
                commentBtn.innerHTML = `💬 ${updatedComments.length > 0 ? updatedComments.length : ''}`;
            }
        }
        
        alert('🗑️ コメントを削除しました');
    } catch (error) {
        console.error('コメント削除エラー:', error);
        alert('❌ コメントの削除に失敗しました');
    }
}

// ランキングの読み込み（キャッシュ対応）
async function loadRanking(forceRefresh = false) {
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

        if (!rankings[type][userId] || rankings[type][userId].value < value) {
            rankings[type][userId] = {
                value: value,
                userId: userId,
                email: post.userEmail
            };
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
    
    const currentExNames = currentMode === 'free' ? getFreeExerciseNames() : exerciseNames;
    for (const type of Object.keys(currentExNames)) {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'ranking-category';
        
        // 各ユーザーのユーザー名を取得
        const entries = [];
        for (const [userId, data] of Object.entries(rankings[type])) {
            const userData = await getUserData(userId);
            const userName = userData && userData.userName ? userData.userName : data.email;
            entries.push({
                userName: userName,
                value: data.value
            });
        }
        
        const sorted = entries.sort((a, b) => b.value - a.value);
        
        let rankingHTML = `<h3>${currentExNames[type] || type}</h3>`;
        
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
                
                const positionClass = currentRank === 1 ? 'first' : currentRank === 2 ? 'second' : currentRank === 3 ? 'third' : '';
                rankingHTML += `
                    <div class="ranking-item">
                        <div class="ranking-position ${positionClass}">${currentRank}</div>
                        <div class="ranking-user">${escapeHtml(data.userName)}</div>
                        <div class="ranking-value">${data.value} ${currentMode === 'free' ? '' : (type === 'Lsit' ? '秒' : type === 'pullup' ? 'セット' : '回')}</div>
                    </div>
                `;
            });
        }
        
        categoryDiv.innerHTML = rankingHTML;
        rankingList.appendChild(categoryDiv);
    }
}

// 成長グラフの読み込み
async function loadProgressChart() {
    const selectedType = graphExerciseType.value;
    
    try {
        // 全投稿を取得してクライアント側でフィルタリング（複合インデックス不要）
        const collectionName = getCollectionName('posts');
        const snapshot = await db.collection(collectionName).get();
        
        const labels = [];
        const data = [];
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

        // 新しいチャートを作成（time scaleで実際の日付間隔を反映）
        const ctx = progressChart.getContext('2d');
        myChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: (currentMode === 'free' ? (freeExercises[selectedType]?.name || selectedType) : exerciseNames[selectedType]),
                    data: chartData,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: currentMode === 'free' ? '記録' : (selectedType === 'Lsit' ? '秒数' : selectedType === 'pullup' ? 'セット数' : '回数')
                        }
                    },
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            displayFormats: {
                                day: 'M/d'
                            },
                            tooltipFormat: 'yyyy/MM/dd'
                        },
                        title: {
                            display: true,
                            text: '日付'
                        }
                    }
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

// 集計方法の変更時
document.getElementById('scoring-method').addEventListener('change', async () => {
    if (currentMode === 'free') {
        // フリーモードは常に%表示
        const checkboxes = document.querySelectorAll('.user-checkbox input[type="checkbox"]');
        const selectedIds = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
        await loadFreeScoreChart(selectedIds);
        return;
    }
    // ランキングを再表示
    const usersScores = await getAllUsersScores();
    await displayTotalScores(usersScores);

    // チャートも再描画（現在選択されているユーザーで）
    const checkboxes = document.querySelectorAll('.user-checkbox input[type="checkbox"]');
    const selectedIds = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    await loadScoreChart(selectedIds);
});

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

// Web Audio APIでビープ音を生成
let audioContext = null;

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

// ロック画面復帰時にAudioContextを再開し、タイマーの経過を補正する
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // AudioContextがsuspendedなら再開
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log('[タイマー] visibilitychange: AudioContext再開成功');
            }).catch(err => {
                console.error('[タイマー] visibilitychange: AudioContext再開失敗:', err);
            });
        }
        // タイマーが動作中なら経過時間を補正
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
        }
    }
});

// 毎秒の小さな音（チック音）
function playTickSound() {
    const ctx = initAudioContext();
    if (!ctx) return;
    
    try {
        // AudioContextがsuspendedの場合はスキップ
        if (ctx.state === 'suspended') {
            console.log('[タイマー] AudioContext is suspended, skipping tick sound');
            return;
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
function playBeepSound() {
    const ctx = initAudioContext();
    if (!ctx) return;
    
    try {
        if (ctx.state === 'suspended') {
            console.log('[タイマー] AudioContext is suspended, skipping beep sound');
            return;
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
function playCountdownSound() {
    const ctx = initAudioContext();
    if (!ctx) return;
    
    try {
        if (ctx.state === 'suspended') {
            console.log('[タイマー] AudioContext is suspended, skipping countdown sound');
            return;
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

function startTimer() {
    if (timerInterval) return; // 既に実行中の場合は何もしない

    console.log('[タイマー] スタートボタンが押されました');

    // インターバル設定を取得
    const intervalInput = document.getElementById('interval-input');
    intervalSeconds = parseInt(intervalInput.value) || 3;

    // AudioContextを初期化して再開（ブラウザのオートプレイポリシー対応）
    const ctx = initAudioContext();
    if (ctx && ctx.state === 'suspended') {
        console.log('[タイマー] AudioContextを再開します:', ctx.state);
        ctx.resume().then(() => {
            console.log('[タイマー] AudioContext再開成功:', ctx.state);
        }).catch(error => {
            console.error('[タイマー] AudioContext再開失敗:', error);
        });
    }

    // ボタンの状態を更新
    timerStartBtn.disabled = true;
    timerStopBtn.disabled = false;
    intervalInput.disabled = true;

    // 準備時間のカウントダウン開始
    isPreparationPhase = true;
    preparationCountdown = 10;
    updateTimerDisplay();

    // 準備フェーズの開始時刻を記録
    let prepStartTime = Date.now();
    let lastPrepCountdown = preparationCountdown;

    console.log('[タイマー] setIntervalを開始します');

    timerInterval = setInterval(() => {
        // AudioContextがsuspendedなら自動再開を試みる
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {});
        }

        if (isPreparationPhase) {
            // 実時間ベースで準備カウントダウンを計算
            const prepElapsed = Math.floor((Date.now() - prepStartTime) / 1000);
            preparationCountdown = Math.max(0, 10 - prepElapsed);

            // 1秒進んだタイミングでのみ音を鳴らす
            if (preparationCountdown < lastPrepCountdown && preparationCountdown > 0) {
                playCountdownSound();
            }
            lastPrepCountdown = preparationCountdown;

            updateTimerDisplay();

            if (preparationCountdown <= 0) {
                // 準備時間終了、メインタイマー開始
                isPreparationPhase = false;
                elapsedSeconds = 0;
                currentCount = 1;  // 0秒時点で1にセット
                timerStartTime = Date.now(); // メインタイマーの開始時刻を記録
                playBeepSound();    // 0秒時点の音を再生
                updateTimerDisplay();
            }
        } else {
            // メインタイマー（実時間ベース）
            const realElapsed = Math.floor((Date.now() - timerStartTime) / 1000);
            const prevElapsed = elapsedSeconds;
            elapsedSeconds = realElapsed;
            const newCount = 1 + Math.floor(elapsedSeconds / intervalSeconds);

            // インターバルごとに回数をカウント
            if (newCount > currentCount) {
                playBeepSound(); // 大きな音
                currentCount = newCount;
            } else if (elapsedSeconds > prevElapsed) {
                playTickSound(); // 小さな音
            }

            updateTimerDisplay();
        }
    }, 1000); // 1秒間隔
}

function stopTimer() {
    if (!timerInterval) return;
    
    clearInterval(timerInterval);
    timerInterval = null;
    isPreparationPhase = false;
    
    // ボタンの状態を更新
    timerStartBtn.disabled = false;
    timerStopBtn.disabled = true;
    
    const intervalInput = document.getElementById('interval-input');
    intervalInput.disabled = false;
    
    updateTimerDisplay();
}

function resetTimer() {
    stopTimer();
    
    currentCount = 0;
    elapsedSeconds = 0;
    preparationCountdown = 10;
    updateTimerDisplay();
    
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
let freeExercises = {};  // { key: { name: '種目名', rule: 'ルール' } }
let freeExercisesLoaded = false;

/**
 * フリーモードの種目リストをFirestoreから取得
 */
async function loadFreeExercises() {
    try {
        const doc = await db.collection('settings_free').doc('exercises').get();
        if (doc.exists) {
            freeExercises = doc.data().exercises || {};
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

/**
 * フリーモードの種目を追加
 * @param {string} name - 種目名
 * @param {string} rule - ルール説明
 */
async function addFreeExercise(name, rule) {
    // キー名を生成（ユニークなID）
    const key = 'free_' + Date.now();
    freeExercises[key] = { name: name, rule: rule };
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
    if (!confirm(`種目「${freeExercises[key]?.name}」を削除しますか？`)) return;
    delete freeExercises[key];
    await saveFreeExercises();

    // キャッシュクリア
    scoreCache.free = null;
    scoreCacheTime.free = null;
    rankingCache.free = null;
    rankingCacheTime.free = null;

    updateFreeExerciseUI();
}

/**
 * フリーモードのUI全体を更新
 */
function updateFreeExerciseUI() {
    updateFreePostDropdown();
    updateFreeRulesTab();
    updateFreeGraphDropdown();
}

/**
 * フリーモード：投稿タブのプルダウンを更新
 */
function updateFreePostDropdown() {
    if (currentMode !== 'free') return;
    const select = document.getElementById('exercise-type');
    // 既存のオプションをクリア
    select.innerHTML = '<option value="">種目を選択</option>';
    Object.entries(freeExercises).forEach(([key, ex]) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = ex.name;
        select.appendChild(option);
    });
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
    if (title) title.textContent = '📋 フリーモード種目管理';

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
        addBtn.textContent = '➕ 種目を追加';
        addBtn.addEventListener('click', () => {
            document.getElementById('free-exercise-modal').style.display = 'block';
        });
        rulesList.parentNode.insertBefore(addBtn, rulesList);
    }

    // ルールリストを再構築
    rulesList.innerHTML = '';
    Object.entries(freeExercises).forEach(([key, ex]) => {
        const item = document.createElement('div');
        item.className = 'rule-item';
        item.innerHTML = `
            <div class="rule-info">
                <h3>${escapeHtml(ex.name)}</h3>
                <p class="rule-detail">${escapeHtml(ex.rule)}</p>
            </div>
            <button class="rule-delete-btn" data-key="${escapeHtml(key)}">🗑️ 削除</button>
        `;
        rulesList.appendChild(item);
    });

    // 削除ボタンにイベントリスナーを設定
    rulesList.querySelectorAll('.rule-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            deleteFreeExercise(btn.dataset.key);
        });
    });

    if (Object.keys(freeExercises).length === 0) {
        rulesList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">まだ種目が登録されていません。上のボタンから種目を追加してください。</p>';
    }
}

/**
 * フリーモード：成長グラフのプルダウンを更新
 */
function updateFreeGraphDropdown() {
    if (currentMode !== 'free') return;
    const select = document.getElementById('graph-exercise-type');
    select.innerHTML = '';
    Object.entries(freeExercises).forEach(([key, ex]) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = ex.name;
        select.appendChild(option);
    });
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
    // ルールタブのタイトルを復元
    const rulesTab = document.getElementById('rules-tab');
    const title = rulesTab.querySelector('h2');
    if (title) title.textContent = '📋 種目ルール';

    // レーダーチャートの凡例注釈を削除
    const annotations = document.querySelector('.chart-legend-annotations');
    if (annotations) annotations.remove();

    // 投稿プルダウンを復元
    const select = document.getElementById('exercise-type');
    select.innerHTML = `
        <option value="">種目を選択</option>
        <option value="pushup">プッシュアップ</option>
        <option value="dips">ディップス</option>
        <option value="squat">片足スクワット</option>
        <option value="Lsit">Lシット(秒)</option>
        <option value="pullup">懸垂(セット)</option>
    `;

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
    const rulesTab = document.getElementById('rules-tab');
    const addBtn = rulesTab.querySelector('.add-exercise-btn');
    if (addBtn) addBtn.remove();

    // ルールリストを復元
    const rulesList = rulesTab.querySelector('.rules-list');
    rulesList.innerHTML = `
        <div class="rule-item">
            <div class="rule-info">
                <h3>💪 プッシュアップ</h3>
                <p class="rule-detail">プッシュアップバーを使用。顎がマットにつくまで下げる。</p>
            </div>
            <div class="rule-multiplier" style="display:none;">
                <label>倍率：</label>
                <input type="number" id="multiplier-pushup" min="0.1" step="0.1" value="1.0">
            </div>
        </div>
        <div class="rule-item">
            <div class="rule-info">
                <h3>🔥 ディップス</h3>
                <p class="rule-detail">顎がストレッチポールにタッチするまで下げる。幅、ポール位置は自由。</p>
            </div>
            <div class="rule-multiplier" style="display:none;">
                <label>倍率：</label>
                <input type="number" id="multiplier-dips" min="0.1" step="0.1" value="1.0">
            </div>
        </div>
        <div class="rule-item">
            <div class="rule-info">
                <h3>🦵 片足スクワット</h3>
                <p class="rule-detail">マット3段重ねの上で、片足でしゃがんで立ち上がる。左右の合計回数。</p>
            </div>
            <div class="rule-multiplier" style="display:none;">
                <label>倍率：</label>
                <input type="number" id="multiplier-squat" min="0.1" step="0.1" value="1.0">
            </div>
        </div>
        <div class="rule-item">
            <div class="rule-info">
                <h3>⏱️ Lシット(秒)</h3>
                <p class="rule-detail">プッシュアップバー/ダンベルを使用。秒数で記録。</p>
            </div>
            <div class="rule-multiplier" style="display:none;">
                <label>倍率：</label>
                <input type="number" id="multiplier-Lsit" min="0.1" step="0.1" value="1.0">
            </div>
        </div>
        <div class="rule-item">
            <div class="rule-info">
                <h3>🏃 懸垂(セット)</h3>
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

// フリーモード種目追加モーダルのイベント
document.querySelector('.close-free-exercise-modal').addEventListener('click', () => {
    document.getElementById('free-exercise-modal').style.display = 'none';
    document.getElementById('free-exercise-error').textContent = '';
});

window.addEventListener('click', (event) => {
    const modal = document.getElementById('free-exercise-modal');
    if (event.target === modal) {
        modal.style.display = 'none';
        document.getElementById('free-exercise-error').textContent = '';
    }
});

document.getElementById('add-free-exercise-btn').addEventListener('click', async () => {
    const nameInput = document.getElementById('free-exercise-name');
    const ruleInput = document.getElementById('free-exercise-rule');
    const errorEl = document.getElementById('free-exercise-error');

    const name = nameInput.value.trim();
    const rule = ruleInput.value.trim();

    if (!name) {
        errorEl.textContent = '種目名を入力してください';
        return;
    }
    if (name.length > 20) {
        errorEl.textContent = '種目名は20文字以内で入力してください';
        return;
    }

    try {
        await addFreeExercise(name, rule);
        nameInput.value = '';
        ruleInput.value = '';
        errorEl.textContent = '';
        document.getElementById('free-exercise-modal').style.display = 'none';
        alert('種目を追加しました！');
    } catch (error) {
        errorEl.textContent = '種目の追加に失敗しました';
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

            if (!userRecords[userId].exercises[exerciseType] ||
                userRecords[userId].exercises[exerciseType] < value) {
                userRecords[userId].exercises[exerciseType] = value;
            }
        });

        // %計算（最高得点を100%とする）
        exerciseKeys.forEach(exercise => {
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

        // 注釈を表示（レーダーチャートの下）
        let annotationContainer = document.querySelector('.chart-legend-annotations');
        if (!annotationContainer) {
            annotationContainer = document.createElement('div');
            annotationContainer.className = 'chart-legend-annotations';
            scoreChart.parentNode.insertBefore(annotationContainer, scoreChart.nextSibling);
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
    const sortedUsers = Object.entries(usersScores)
        .sort((a, b) => b[1].totalScore - a[1].totalScore);

    let html = '';
    let currentRank = 1;
    let previousScore = null;

    sortedUsers.forEach(([userId, userData], index) => {
        const totalScore = userData.totalScore;
        if (previousScore !== null && totalScore !== previousScore) {
            currentRank = index + 1;
        }
        previousScore = totalScore;

        const medal = currentRank === 1 ? '🥇' : currentRank === 2 ? '🥈' : currentRank === 3 ? '🥉' : `${currentRank}.`;

        let breakdownHtml = exerciseKeys.map(key => {
            const ex = freeExercises[key];
            if (!ex) return '';
            return `
                <div class="breakdown-item breakdown-deviation">
                    <span class="breakdown-label">${escapeHtml(ex.name)}</span>
                    <span class="breakdown-num">${userData.exercises[key] || 0}</span>
                    <span class="breakdown-score">-</span>
                    <span class="breakdown-pct">${(userData.scores[key] || 0).toFixed(1)}%</span>
                </div>
            `;
        }).join('');

        html += `
            <div class="total-score-item" onclick="toggleScoreDetails('${escapeHtml(userId)}')">
                <div class="score-header">
                    <span class="score-rank">${medal}</span>
                    <span class="score-username">${escapeHtml(userData.userName)}</span>
                    <span class="score-value">${totalScore.toFixed(1)}%</span>
                </div>
                <div class="score-details" id="score-details-${escapeHtml(userId)}" style="display: none;">
                    <div class="score-breakdown">
                        ${breakdownHtml}
                    </div>
                </div>
            </div>
        `;
    });

    totalScoresList.innerHTML = html;
}

/**
 * フリーモード用ユーザーチェックボックス
 */
async function loadFreeUserCheckboxes(forceRefresh = false) {
    try {
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
