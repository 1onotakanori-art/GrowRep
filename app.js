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
let currentMode = 'prototype'; // 'prototype' または '3sec-rule'

/**
 * モードに応じたコレクション名を取得
 * @param {string} baseCollection - 基本コレクション名（'posts', 'scores', 'multipliers'）
 * @returns {string} モード別のコレクション名
 */
function getCollectionName(baseCollection) {
    if (currentMode === '3sec-rule') {
        return `${baseCollection}_3sec`;
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
const userName = document.getElementById('user-name');
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
let rankingCache = null;
let rankingCacheTime = null;
let scoreCache = null;
let scoreCacheTime = null;
// モード別キャッシュ
let postsCache = {
    prototype: null,
    '3sec-rule': null
};
let postsCacheTime = {
    prototype: null,
    '3sec-rule': null
};
let rankingCache = {
    prototype: null,
    '3sec-rule': null
};
let rankingCacheTime = {
    prototype: null,
    '3sec-rule': null
};
let scoreCache = {
    prototype: null,
    '3sec-rule': null
};
let scoreCacheTime = {
    prototype: null,
    '3sec-rule': null
};
let progressCache = {
    prototype: {},
    '3sec-rule': {}
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
        
        // ユーザー名を表示（メールアドレスと同じ場合は未設定と表示）
        if (currentUserData.userName && currentUserData.userName !== user.email) {
            userName.textContent = currentUserData.userName;
        } else {
            userName.textContent = user.email + ' (ユーザー名未設定)';
        }
        
        loginContainer.style.display = 'none';
        mainContainer.style.display = 'block';
        
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
            content.classList.remove('active');
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
}

/**
 * モード変更処理
 */
function changeMode(newMode) {
    if (currentMode === newMode) return;
    
    console.log(`モード切り替え: ${currentMode} → ${newMode}`);
    currentMode = newMode;
    
    // タブの表示を更新
    updateTabsForMode();
    
    // 現在のモードのプログレスキャッシュをクリア
    progressCache[newMode] = {};
    
    // データをリフレッシュ
    if (currentUser) {
        try {
            console.log(`${newMode}モードのデータを読み込み中...`);
            console.log(`使用コレクション: ${getCollectionName('posts')}, ${getCollectionName('settings')}`);
            
            loadPosts(true);  // 強制リフレッシュ
            loadRanking(true);  // 強制リフレッシュ
            
            // 得点タブの場合も再読み込み
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab && activeTab.id === 'score-tab') {
                loadUserCheckboxes(true);
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
        
        // すべてのタブボタンとコンテンツから active を削除
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        // クリックされたタブを active に
        btn.classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
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
        
        // ルールタブの場合は倍率をロード
        if (tabName === 'rules') {
            loadMultipliers();
        }
        
        // 得点タブの場合はキャッシュを使用
        if (tabName === 'score') {
            loadUserCheckboxes(false);  // キャッシュ使用
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
                await loadUserCheckboxes(true);  // 強制更新
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
    if (!type || !exerciseNames[type]) {
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
    const safeExerciseName = escapeHtml(exerciseNames[post.exerciseType] || post.exerciseType);
    const safeValue = parseInt(post.value) || 0; // 数値として扱う
    const safePostId = escapeHtml(postId);
    
    div.innerHTML = `
        <div class="post-header">
            <span class="post-user">${safeUserName}</span>
            <span class="post-date">${escapeHtml(date)}</span>
        </div>
        <div class="post-content">
            <span class="post-exercise">${safeExerciseName}</span>
            <span class="post-value">${safeValue} ${post.exerciseType === 'Lsit' ? '秒' : post.exerciseType === 'pullup' ? 'セット' : '回'}</span>
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
    Object.keys(exerciseNames).forEach(type => {
        rankings[type] = {};
    });
    
    snapshot.forEach((doc) => {
        const post = doc.data();
        const type = post.exerciseType;
        const userId = post.userId;
        const value = post.value;
        
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
    
    for (const type of Object.keys(exerciseNames)) {
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
        
        let rankingHTML = `<h3>${exerciseNames[type]}</h3>`;
        
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
                        <div class="ranking-value">${data.value} ${type === 'Lsit' ? '秒' : type === 'pullup' ? 'セット' : '回'}</div>
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
        
        // ラベルとデータを作成
        userPosts.forEach(post => {
            const date = new Date(post.timestamp.toDate());
            labels.push(date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }));
            data.push(post.value);
        });
        
        // 既存のチャートを破棄
        if (myChart) {
            myChart.destroy();
        }
        
        // データがない場合のメッセージ
        if (data.length === 0) {
            const ctx = progressChart.getContext('2d');
            ctx.clearRect(0, 0, progressChart.width, progressChart.height);
            ctx.font = '16px Arial';
            ctx.fillStyle = '#999';
            ctx.textAlign = 'center';
            ctx.fillText('この種目の記録がまだありません', progressChart.width / 2, progressChart.height / 2);
            return;
        }
        
        // 新しいチャートを作成
        const ctx = progressChart.getContext('2d');
        myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: exerciseNames[selectedType],
                    data: data,
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
                            text: selectedType === 'Lsit' ? '秒数' : selectedType === 'pullup' ? 'セット数' : '回数'
                        }
                    },
                    x: {
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
