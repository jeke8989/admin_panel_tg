import type { Broadcast } from '../types';
import { BroadcastItem } from './BroadcastItem';

interface BroadcastListProps {
  broadcasts: Broadcast[];
  activeBroadcastId: string | null;
  onBroadcastSelect: (id: string) => void;
  onCreateBroadcast: () => void;
  statusFilter: string;
  onStatusFilterChange: (filter: string) => void;
  isLoading: boolean;
}

export const BroadcastList = ({
  broadcasts,
  activeBroadcastId,
  onBroadcastSelect,
  onCreateBroadcast,
  statusFilter,
  onStatusFilterChange,
  isLoading,
}: BroadcastListProps) => {
  const filteredBroadcasts = broadcasts.filter((broadcast) => {
    if (statusFilter === 'all') return true;
    return broadcast.status === statusFilter;
  });

  return (
    <div className="flex flex-col h-full bg-gray-800">
      <div className="p-4 border-b border-gray-700 bg-gray-800">
        <button
          onClick={onCreateBroadcast}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Создать рассылку
        </button>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 text-sm"
        >
          <option value="all">Все статусы</option>
          <option value="draft">Черновики</option>
          <option value="sending">Отправка</option>
          <option value="completed">Завершенные</option>
          <option value="failed">Ошибки</option>
        </select>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="h-full w-full flex items-center justify-center text-gray-500">
            <p>Загрузка...</p>
          </div>
        ) : filteredBroadcasts.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-gray-500">
            <p>Нет рассылок</p>
          </div>
        ) : (
          filteredBroadcasts.map((broadcast) => (
            <BroadcastItem
              key={broadcast.id}
              broadcast={broadcast}
              isActive={broadcast.id === activeBroadcastId}
              onClick={() => onBroadcastSelect(broadcast.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

