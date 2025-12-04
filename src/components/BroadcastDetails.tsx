import type { Broadcast, BroadcastStatistics } from '../types';
import { BroadcastStatistics as BroadcastStatisticsComponent } from './BroadcastStatistics';

interface BroadcastDetailsProps {
  broadcast: Broadcast;
  statistics: BroadcastStatistics | null;
  onSend: () => void;
  onDelete: () => void;
  onRefresh: () => void;
  onCopy?: () => void;
}

export const BroadcastDetails = ({
  broadcast,
  statistics,
  onSend,
  onDelete,
  onRefresh,
  onCopy,
}: BroadcastDetailsProps) => {

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-500/20 text-gray-400';
      case 'sending':
        return 'bg-blue-500/20 text-blue-400';
      case 'completed':
        return 'bg-green-500/20 text-green-400';
      case 'failed':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Черновик';
      case 'sending':
        return 'Отправка';
      case 'completed':
        return 'Завершена';
      case 'failed':
        return 'Ошибка';
      default:
        return status;
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 overflow-hidden">
      {/* Заголовок */}
      <div className="p-6 border-b border-gray-700 bg-gray-800">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h2 className="text-white text-xl font-semibold mb-2">
              {broadcast.name}
            </h2>
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 text-sm rounded ${getStatusColor(
                  broadcast.status,
                )}`}
              >
                {getStatusLabel(broadcast.status)}
              </span>
              <span className="text-gray-400 text-sm">
                Создано:{' '}
                {new Date(broadcast.createdAt).toLocaleDateString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {broadcast.status === 'draft' && (
              <button
                onClick={onSend}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Запустить рассылку
              </button>
            )}
            {onCopy && (
              <button
                onClick={onCopy}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm flex items-center gap-2"
                title="Копировать рассылку"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Копировать
              </button>
            )}
            <button
              onClick={onRefresh}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
            >
              Обновить
            </button>
            <button
              onClick={onDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              Удалить
            </button>
          </div>
        </div>

        {/* Статистика - всегда видна */}
        {statistics && (
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div className="bg-gray-700/50 rounded-lg p-3">
              <div className="text-gray-400 text-xs mb-1">Всего получателей</div>
              <div className="text-white text-lg font-semibold">
                {statistics.total}
              </div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3">
              <div className="text-gray-400 text-xs mb-1">Отправлено</div>
              <div className="text-white text-lg font-semibold">
                {statistics.sent}
              </div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3">
              <div className="text-gray-400 text-xs mb-1">Доставлено</div>
              <div className="text-white text-lg font-semibold">
                {statistics.delivered}
              </div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3">
              <div className="text-gray-400 text-xs mb-1">Прочитано</div>
              <div className="text-white text-lg font-semibold">
                {statistics.read} ({statistics.readPercentage}%)
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Контент */}
      <div className="flex-1 overflow-y-auto p-6">
        {statistics ? (
          <>
            <BroadcastStatisticsComponent statistics={statistics} />
            <div className="mt-6 space-y-6">
                      {/* Сообщение */}
                      <div>
                        <h3 className="text-white font-medium mb-3">Сообщение</h3>
                        <div className="bg-gray-800 rounded-lg p-4">
                          <div
                            className="text-white"
                            dangerouslySetInnerHTML={{ __html: broadcast.text || '' }}
                          />
                        </div>
                      </div>

              {/* Сегментация */}
              {broadcast.segments && (
                <div>
                  <h3 className="text-white font-medium mb-3">Сегментация</h3>
                  <div className="bg-gray-800 rounded-lg p-4 space-y-2">
                    {broadcast.segments.startParams &&
                      broadcast.segments.startParams.length > 0 && (
                        <div>
                          <span className="text-gray-400 text-sm">
                            Параметры start:{' '}
                          </span>
                          <span className="text-white">
                            {broadcast.segments.startParams.join(', ')}
                          </span>
                        </div>
                      )}
                    {broadcast.segments.botIds &&
                      broadcast.segments.botIds.length > 0 && (
                        <div>
                          <span className="text-gray-400 text-sm">Боты: </span>
                          <span className="text-white">
                            {broadcast.segments.botIds.length} выбрано
                          </span>
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-6">
            {/* Сообщение */}
            <div>
              <h3 className="text-white font-medium mb-3">Сообщение</h3>
              <div className="bg-gray-800 rounded-lg p-4">
                <div
                  className="text-white"
                  dangerouslySetInnerHTML={{ __html: broadcast.text || '' }}
                />
              </div>
            </div>

            {/* Сегментация */}
            {broadcast.segments && (
              <div>
                <h3 className="text-white font-medium mb-3">Сегментация</h3>
                <div className="bg-gray-800 rounded-lg p-4 space-y-2">
                  {broadcast.segments.startParams &&
                    broadcast.segments.startParams.length > 0 && (
                      <div>
                        <span className="text-gray-400 text-sm">
                          Параметры start:{' '}
                        </span>
                        <span className="text-white">
                          {broadcast.segments.startParams.join(', ')}
                        </span>
                      </div>
                    )}
                  {broadcast.segments.botIds &&
                    broadcast.segments.botIds.length > 0 && (
                      <div>
                        <span className="text-gray-400 text-sm">Боты: </span>
                        <span className="text-white">
                          {broadcast.segments.botIds.length} выбрано
                        </span>
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

