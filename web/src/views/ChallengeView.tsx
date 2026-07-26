import { useState } from 'react';
import { ViewHeader, Segmented } from '../components/ui';
import ThisWeek from '../features/weekly/ThisWeek';
import ChampionsList from '../features/weekly/ChampionsList';
import DerbyView from '../features/weekly/DerbyView';

type Tab = 'week' | 'champions' | 'derby';

const HEADERS: Record<Tab, { icon: string; title: string }> = {
  week: { icon: 'fa-trophy', title: '今週のチャレンジ' },
  champions: { icon: 'fa-crown', title: '歴代チャンプ' },
  derby: { icon: 'fa-calendar-days', title: '月間ダービー' },
};

export default function ChallengeView() {
  const [tab, setTab] = useState<Tab>('week');
  return (
    <div className="fade-in">
      <ViewHeader icon={HEADERS[tab].icon} title={HEADERS[tab].title} />
      <Segmented<Tab>
        options={[
          { value: 'week', label: '今週' },
          { value: 'champions', label: '歴代チャンプ' },
          { value: 'derby', label: '月間ダービー' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'week' && <ThisWeek />}
      {tab === 'champions' && <ChampionsList />}
      {tab === 'derby' && <DerbyView />}
    </div>
  );
}
