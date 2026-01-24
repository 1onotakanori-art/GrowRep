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

// 種目名の日本語マッピング
const exerciseNames = {
    'pushup': '腕立て伏せ',
    'situp': '腹筋',
    'squat': 'スクワット',
    'plank': 'プランク',
    'pullup': '懸垂'
};

// グローバル変数
let currentUser = null;
let myChart = null;

// 認証状態の監視
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        userName.textContent = user.email;
        loginContainer.style.display = 'none';
        mainContainer.style.display = 'block';
        loadPosts();
        loadRanking();
    } else {
        currentUser = null;
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
        await auth.createUserWithEmailAndPassword(email, password);
        authError.textContent = '';
    } catch (error) {
        authError.textContent = getErrorMessage(error.code);
    }
});

// ログアウト
logoutBtn.addEventListener('click', () => {
    auth.signOut();
});

// タブ切り替え
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
function loadPosts() {
    db.collection('posts')
        .orderBy('timestamp', 'desc')
        .onSnapshot((snapshot) => {
            postsList.innerHTML = '';
            
            if (snapshot.empty) {
                postsList.innerHTML = '<p style="text-align: center; color: #999;">まだ投稿がありません</p>';
                return;
            }
            
            snapshot.forEach((doc) => {
                const post = doc.data();
                const postElement = createPostElement(doc.id, post);
                postsList.appendChild(postElement);
            });
        });
}

// 投稿要素の作成
// XSS対策: ユーザー入力値は必ずエスケープ
function createPostElement(postId, post) {
    const div = document.createElement('div');
    div.className = 'post-item';
    
    const date = post.timestamp ? new Date(post.timestamp.toDate()).toLocaleString('ja-JP') : '投稿中...';
    const isLiked = post.likes && post.likes.includes(currentUser.uid);
    const likeCount = post.likes ? post.likes.length : 0;
    const isOwner = post.userId === currentUser.uid;
    
    // XSS対策: エスケープ処理を適用
    const safeEmail = escapeHtml(post.userEmail);
    const safeExerciseName = escapeHtml(exerciseNames[post.exerciseType] || post.exerciseType);
    const safeValue = parseInt(post.value) || 0; // 数値として扱う
    const safePostId = escapeHtml(postId);
    
    div.innerHTML = `
        <div class="post-header">
            <span class="post-user">${safeEmail}</span>
            <span class="post-date">${escapeHtml(date)}</span>
        </div>
        <div class="post-content">
            <span class="post-exercise">${safeExerciseName}</span>
            <span class="post-value">${safeValue} ${post.exerciseType === 'plank' ? '秒' : '回'}</span>
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
            ${renderComments(post.comments || [])}
            <div class="comment-input">
                <input type="text" id="comment-input-${safePostId}" placeholder="コメントを入力...">
                <button onclick="addComment('${safePostId}')">送信</button>
            </div>
        </div>
    `;
    
    return div;
}

// コメントの表示
// XSS対策: コメント内容をエスケープ
function renderComments(comments) {
    if (!comments || comments.length === 0) {
        return '';
    }
    
    return comments.map(comment => `
        <div class="comment-item">
            <div class="comment-author">${escapeHtml(comment.userEmail)}</div>
            <div class="comment-text">${escapeHtml(comment.text)}</div>
        </div>
    `).join('');
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
function toggleComments(postId) {
    const commentsSection = document.getElementById(`comments-${postId}`);
    commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
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
                email: post.userEmail
            };
        }
    });
    
    // ランキング表示
    rankingList.innerHTML = '';
    
    Object.keys(exerciseNames).forEach(type => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'ranking-category';
        
        const sorted = Object.entries(rankings[type])
            .map(([userId, data]) => data)
            .sort((a, b) => b.value - a.value);
        
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
                        <div class="ranking-user">${data.email}</div>
                        <div class="ranking-value">${data.value} ${type === 'plank' ? '秒' : '回'}</div>
                    </div>
                `;
            });
        }
        
        categoryDiv.innerHTML = rankingHTML;
        rankingList.appendChild(categoryDiv);
    });
}

// 成長グラフの読み込み
async function loadProgressChart() {
    const selectedType = graphExerciseType.value;
    
    const snapshot = await db.collection('posts')
        .where('userId', '==', currentUser.uid)
        .where('exerciseType', '==', selectedType)
        .orderBy('timestamp', 'asc')
        .get();
    
    const labels = [];
    const data = [];
    
    snapshot.forEach((doc) => {
        const post = doc.data();
        if (post.timestamp) {
            const date = new Date(post.timestamp.toDate());
            labels.push(date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }));
            data.push(post.value);
        }
    });
    
    // 既存のチャートを破棄
    if (myChart) {
        myChart.destroy();
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
                        text: selectedType === 'plank' ? '秒数' : '回数'
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
