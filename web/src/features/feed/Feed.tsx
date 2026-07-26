import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useMode } from '../../context/ModeContext';
import { useToast } from '../../context/ToastContext';
import {
  getPosts,
  toggleLike,
  addComment,
  deleteComment,
  deletePost,
  type LoadedPost,
} from '../../lib/posts';
import { POSTS_PAGE_SIZE } from '../../lib/constants';
import { Skeleton, EmptyState, ExerciseIcon } from '../../components/ui';
import styles from './Feed.module.css';

function formatDate(ts: LoadedPost['timestamp']): string {
  if (!ts) return '投稿中…';
  try {
    return ts.toDate().toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function Feed() {
  const { user } = useAuth();
  const { freeExercises } = useData();
  const { refreshToken } = useMode();
  const { toast } = useToast();
  const [posts, setPosts] = useState<LoadedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(POSTS_PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});

  const load = useCallback(async (lim: number) => {
    setLoading(true);
    try {
      const { posts: p, hasMore: hm } = await getPosts(lim);
      setPosts(p);
      setHasMore(hm);
    } catch {
      toast('投稿の読み込みに失敗しました', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load(limit);
  }, [load, limit, refreshToken]);

  async function onLike(post: LoadedPost) {
    if (!user) return;
    const liked = !!post.likes?.includes(user.uid);
    // 楽観的更新
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? {
              ...p,
              likes: liked
                ? (p.likes || []).filter((u) => u !== user.uid)
                : [...(p.likes || []), user.uid],
            }
          : p,
      ),
    );
    try {
      await toggleLike(post.id, user.uid, liked);
    } catch {
      load(limit);
    }
  }

  async function onSubmitComment(post: LoadedPost) {
    if (!user) return;
    const text = (commentText[post.id] || '').trim();
    if (!text) return;
    if (text.length > 500) {
      toast('コメントは500文字以内で入力してください', 'error');
      return;
    }
    try {
      await addComment(post.id, user, text);
      setCommentText((c) => ({ ...c, [post.id]: '' }));
      await load(limit);
      setOpenComments((o) => ({ ...o, [post.id]: true }));
    } catch {
      toast('コメントの送信に失敗しました', 'error');
    }
  }

  async function onDeleteComment(post: LoadedPost, index: number) {
    if (!confirm('このコメントを削除しますか？')) return;
    try {
      await deleteComment(post.id, index);
      await load(limit);
    } catch {
      toast('削除に失敗しました', 'error');
    }
  }

  async function onDeletePost(post: LoadedPost) {
    if (!confirm('この投稿を削除しますか？')) return;
    try {
      await deletePost(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      toast('投稿を削除しました', 'success');
    } catch {
      toast('削除に失敗しました', 'error');
    }
  }

  if (loading && posts.length === 0) return <Skeleton count={4} />;
  if (posts.length === 0)
    return <EmptyState icon="fa-comments" message="まだ投稿がありません" />;

  return (
    <div className={styles.feed}>
      {posts.map((post) => {
        const ex = freeExercises[post.exerciseType];
        const isBarbarian = !!ex?.barbarian;
        const liked = !!(user && post.likes?.includes(user.uid));
        const likeCount = post.likes?.length || 0;
        const commentCount = post.comments?.length || 0;
        const mine = user?.uid === post.userId;
        return (
          <div key={post.id} className={styles.post}>
            <div className={styles.head}>
              <span className={styles.exIcon}>
                <ExerciseIcon icon={ex?.icon} />
              </span>
              <div className={styles.headMain}>
                <span className={styles.user}>{post.userName}</span>
                <span className={styles.date}>{formatDate(post.timestamp)}</span>
              </div>
              {mine && (
                <button
                  className={styles.del}
                  onClick={() => onDeletePost(post)}
                  aria-label="投稿を削除"
                >
                  <i className="fa-solid fa-trash" />
                </button>
              )}
            </div>

            <div className={styles.body}>
              <span className={styles.exName}>
                {ex?.name || post.exerciseType}
              </span>
              <span className={styles.value}>
                {post.value}
                <span className={styles.unit}>{isBarbarian ? '秒' : ''}</span>
              </span>
            </div>

            <div className={styles.actions}>
              <button
                className={liked ? styles.likedBtn : styles.actBtn}
                onClick={() => onLike(post)}
              >
                <i className={`fa-${liked ? 'solid' : 'regular'} fa-heart`} />
                {likeCount > 0 && <span>{likeCount}</span>}
              </button>
              <button
                className={styles.actBtn}
                onClick={() =>
                  setOpenComments((o) => ({ ...o, [post.id]: !o[post.id] }))
                }
              >
                <i className="fa-regular fa-comment" />
                {commentCount > 0 && <span>{commentCount}</span>}
              </button>
            </div>

            {openComments[post.id] && (
              <div className={styles.comments}>
                {(post.comments || []).map((c, i) => {
                  const cmine = user?.uid === c.userId;
                  return (
                    <div key={i} className={styles.comment}>
                      <span className={styles.cUser}>
                        {c.userName || (c as { userEmail?: string }).userEmail || '名無し'}
                      </span>
                      <span className={styles.cText}>{c.text}</span>
                      {cmine && (
                        <button
                          className={styles.cDel}
                          onClick={() => onDeleteComment(post, i)}
                          aria-label="コメント削除"
                        >
                          <i className="fa-solid fa-xmark" />
                        </button>
                      )}
                    </div>
                  );
                })}
                <div className={styles.commentForm}>
                  <input
                    className="field"
                    placeholder="コメントを追加…"
                    value={commentText[post.id] || ''}
                    maxLength={500}
                    onChange={(e) =>
                      setCommentText((c) => ({ ...c, [post.id]: e.target.value }))
                    }
                    onKeyDown={(e) =>
                      e.key === 'Enter' && onSubmitComment(post)
                    }
                  />
                  <button
                    className={styles.sendBtn}
                    onClick={() => onSubmitComment(post)}
                    aria-label="送信"
                  >
                    <i className="fa-solid fa-paper-plane" />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {hasMore && (
        <button
          className={styles.more}
          onClick={() => setLimit((l) => l + POSTS_PAGE_SIZE)}
        >
          もっと見る
        </button>
      )}
    </div>
  );
}
