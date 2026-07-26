import { useState } from 'react';
import { Segmented, ViewHeader } from '../components/ui';
import PostComposer from '../features/post/PostComposer';
import Feed from '../features/feed/Feed';

type Tab = 'post' | 'feed';

export default function PostView() {
  const [tab, setTab] = useState<Tab>('post');
  return (
    <div className="fade-in">
      <ViewHeader
        icon={tab === 'post' ? 'fa-pen-to-square' : 'fa-comments'}
        title={tab === 'post' ? '記録を投稿' : 'みんなの投稿'}
      />
      <Segmented<Tab>
        options={[
          { value: 'post', label: '投稿する' },
          { value: 'feed', label: 'フィード' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'post' ? <PostComposer /> : <Feed />}
    </div>
  );
}
