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
    'pushup': '腕立て伏せ',
    'dips': '顎付けディップス',
    'squat': '片足スクワット(左右合計)',
    'Lsit': 'Lシット(秒)',
    'pullup': '懸垂(セット)'
};

// グローバル変数
let currentUser = null;
let currentUserData = null;  // ユーザー情報（usersコレクションから取得）
let myChart = null;
let unsubscribePosts = null;  // 投稿リスナーの解除用

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
        loadPosts();
        loadRanking();
    } else {
        // ログアウト時の処理
        currentUser = null;
        currentUserData = null;
        
        // 投稿リスナーを解除
        if (unsubscribePosts) {
            unsubscribePosts();
            unsubscribePosts = null;
        }
        
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
        
        // ランキングタブの場合は再読み込み
        if (tabName === 'ranking') {
            loadRanking();
        }
        
        // グラフタブの場合は描画
        if (tabName === 'progress') {
            loadProgressChart();
        }
    });
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
        await db.collection('posts').add({
            userId: currentUser.uid,
            userEmail: currentUser.email,
            exerciseType: type,
            value: value,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            likes: [],
            comments: []
        });
        
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

// 投稿の読み込み
async function loadPosts() {
    // 既存のリスナーを解除
    if (unsubscribePosts) {
        unsubscribePosts();
    }
    
    // 新しいリスナーを設定
    unsubscribePosts = db.collection('posts')
        .orderBy('timestamp', 'desc')
        .onSnapshot(async (snapshot) => {
            postsList.innerHTML = '';
            
            if (snapshot.empty) {
                postsList.innerHTML = '<p style="text-align: center; color: #999;">まだ投稿がありません</p>';
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
            
            // 投稿を表示
            posts.forEach(({ id, data, userName }) => {
                const postElement = createPostElement(id, data, userName);
                postsList.appendChild(postElement);
            });
        }, (error) => {
            console.error('投稿の読み込みエラー:', error);
            postsList.innerHTML = '<p style="text-align: center; color: #e74c3c;">投稿の読み込みに失敗しました</p>';
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
                ❤️ いいね ${likeCount > 0 ? likeCount : ''}
            </button>
            <button class="comment-btn" onclick="toggleComments('${safePostId}')">
                💬 コメント ${post.comments && post.comments.length > 0 ? post.comments.length : ''}
            </button>
            ${isOwner ? `<button class="delete-btn" onclick="deletePost('${safePostId}')">🗑️ 削除</button>` : ''}
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
        renderComments(post.comments).then(html => {
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
async function renderComments(comments) {
    if (!comments || comments.length === 0) {
        return '';
    }
    
    const commentElements = [];
    for (const comment of comments) {
        const userData = await getUserData(comment.userId);
        const userName = userData && userData.userName ? userData.userName : comment.userEmail;
        commentElements.push(`
            <div class="comment-item">
                <div class="comment-author">${escapeHtml(userName)}</div>
                <div class="comment-text">${escapeHtml(comment.text)}</div>
            </div>
        `);
    }
    
    return commentElements.join('');
}

// いいねの切り替え
async function toggleLike(postId) {
    const postRef = db.collection('posts').doc(postId);
    const doc = await postRef.get();
    const post = doc.data();
    const likes = post.likes || [];
    
    if (likes.includes(currentUser.uid)) {
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
}

// コメント表示の切り替え
async function toggleComments(postId) {
    const commentsSection = document.getElementById(`comments-${postId}`);
    const isVisible = commentsSection.style.display !== 'none';
    
    if (!isVisible) {
        // コメントを表示する前に最新のコメントを取得
        const doc = await db.collection('posts').doc(postId).get();
        const post = doc.data();
        const commentsList = document.getElementById(`comments-list-${postId}`);
        
        if (post.comments && post.comments.length > 0) {
            const html = await renderComments(post.comments);
            commentsList.innerHTML = html;
        } else {
            commentsList.innerHTML = '';
        }
    }
    
    commentsSection.style.display = isVisible ? 'none' : 'block';
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
    
    const postRef = db.collection('posts').doc(postId);
    await postRef.update({
        comments: firebase.firestore.FieldValue.arrayUnion({
            userId: currentUser.uid,
            userEmail: currentUser.email,
            text: text,
            timestamp: new Date().toISOString()
        })
    });
    
    input.value = '';
}

// 投稿の削除
async function deletePost(postId) {
    if (!confirm('本当にこの投稿を削除しますか？')) {
        return;
    }
    
    try {
        await db.collection('posts').doc(postId).delete();
        alert('投稿を削除しました');
    } catch (error) {
        alert('削除に失敗しました');
        console.error('削除エラー:', error);
    }
}

// ランキングの読み込み
async function loadRanking() {
    const snapshot = await db.collection('posts').get();
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
    
    // ランキング表示
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
            sorted.forEach((data, index) => {
                const position = index + 1;
                const positionClass = position === 1 ? 'first' : position === 2 ? 'second' : position === 3 ? 'third' : '';
                rankingHTML += `
                    <div class="ranking-item">
                        <div class="ranking-position ${positionClass}">${position}</div>
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
    
    // userIdでフィルタリングし、timestampでソート
    // exerciseTypeのフィルタリングはクライアント側で実施（複合インデックス不要）
    const snapshot = await db.collection('posts')
        .where('userId', '==', currentUser.uid)
        .orderBy('timestamp', 'asc')
        .get();
    
    const labels = [];
    const data = [];
    
    snapshot.forEach((doc) => {
        const post = doc.data();
        // 選択された種目のみを抽出
        if (post.exerciseType === selectedType && post.timestamp) {
            const date = new Date(post.timestamp.toDate());
            labels.push(date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }));
            data.push(post.value);
        }
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
}

// グラフの種目変更時
graphExerciseType.addEventListener('change', loadProgressChart);
