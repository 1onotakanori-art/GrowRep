import { useState } from 'react';
import { Segmented, ViewHeader } from '../components/ui';
import { useMode } from '../context/ModeContext';
import PostComposer from '../features/post/PostComposer';
import DropsetComposer from '../features/dropset/DropsetComposer';
import Feed from '../features/feed/Feed';
import type { NavKey } from '../shell/BottomNav';

type Tab = 'post' | 'feed';

export default function PostView({
  onNavigate,
}: {
  onNavigate: (k: NavKey) => void;
}) {
  const { mode } = useMode();
  const [tab, setTab] = useState<Tab>('post');
  const isDropset = mode === 'dropset';
  return (
    <div className="fade-in">
      <ViewHeader
        icon={
          tab === 'post'
            ? isDropset
              ? 'fa-weight-hanging'
              : 'fa-pen-to-square'
            : 'fa-comments'
        }
        title={
          tab === 'post'
            ? isDropset
              ? '今日の挑戦'
              : '記録を投稿'
            : 'みんなの投稿'
        }
      />
      <Segmented<Tab>
        options={[
          { value: 'post', label: isDropset ? '挑戦する' : '投稿する' },
          { value: 'feed', label: 'フィード' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'post' ? (
        isDropset ? (
          <DropsetComposer />
        ) : (
          <PostComposer onNavigate={onNavigate} />
        )
      ) : (
        <Feed />
      )}
    </div>
  );
}
