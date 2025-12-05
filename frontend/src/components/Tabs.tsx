interface TabsProps {
  activeTab: 'chats' | 'bots' | 'broadcasts' | 'workflows';
  onTabChange: (tab: 'chats' | 'bots' | 'broadcasts' | 'workflows') => void;
  role?: 'admin' | 'user';
}

export const Tabs = ({ activeTab, onTabChange, role = 'admin' }: TabsProps) => {
  const isUser = role === 'user';

  return (
    <div className="flex border-b border-gray-700 bg-gray-800">
      <button
        onClick={() => onTabChange('chats')}
        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
          activeTab === 'chats'
            ? 'text-white border-b-2 border-blue-500'
            : 'text-gray-400 hover:text-white'
        }`}
      >
        Чаты
      </button>
      {!isUser && (
        <>
          <button
            onClick={() => onTabChange('broadcasts')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'broadcasts'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Рассылки
          </button>
          <button
            onClick={() => onTabChange('workflows')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'workflows'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Сценарии
          </button>
          <button
            onClick={() => onTabChange('bots')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'bots'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Боты
          </button>
        </>
      )}
    </div>
  );
};

