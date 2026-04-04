interface TabsProps {
  activeTab: 'chats' | 'bots' | 'broadcasts' | 'workflows';
  onTabChange: (tab: 'chats' | 'bots' | 'broadcasts' | 'workflows') => void;
  role?: 'admin' | 'user';
}

export const Tabs = ({ activeTab, onTabChange, role = 'admin' }: TabsProps) => {
  const isUser = role === 'user';

  const tabClass = (tab: string) =>
    `flex-1 px-2 md:px-4 py-3 text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
      activeTab === tab
        ? 'text-white border-b-2 border-blue-500'
        : 'text-gray-400 hover:text-white'
    }`;

  return (
    <div className="flex border-b border-gray-700 bg-gray-800">
      <button onClick={() => onTabChange('chats')} className={tabClass('chats')}>
        Чаты
      </button>
      {!isUser && (
        <>
          <button onClick={() => onTabChange('broadcasts')} className={tabClass('broadcasts')}>
            Рассылки
          </button>
          <button onClick={() => onTabChange('workflows')} className={tabClass('workflows')}>
            Сценарии
          </button>
          <button onClick={() => onTabChange('bots')} className={tabClass('bots')}>
            Боты
          </button>
        </>
      )}
    </div>
  );
};
