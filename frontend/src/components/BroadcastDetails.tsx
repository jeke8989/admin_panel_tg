import { useState, useEffect } from 'react';
import type { Broadcast, BroadcastStatistics, Bot } from '../types';
import { BroadcastStatisticsComponent } from './BroadcastStatistics';
import { getBots } from '../utils/api';

interface BroadcastDetailsProps {
  broadcast: Broadcast;
  statistics: BroadcastStatistics | null;
  onSend: () => void;
  onDelete: () => void;
  onRefresh?: () => void; // Опциональный, так как кнопка удалена
  onCopy?: () => void;
  onEdit?: () => void;
}

export const BroadcastDetails = ({
  broadcast,
  statistics,
  onSend,
  onDelete,
  onCopy,
  onEdit,
}: BroadcastDetailsProps) => {
  const [bots, setBots] = useState<Bot[]>([]);

  useEffect(() => {
    loadBots();
  }, []);

  const loadBots = async () => {
    try {
      const botsList = await getBots();
      setBots(botsList);
    } catch (error) {
      console.error('Error loading bots:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-500/20 text-gray-400';
      case 'scheduled':
        return 'bg-yellow-500/20 text-yellow-400';
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
      case 'scheduled':
        return 'Запланирована';
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
      <div className="p-3 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-white text-lg font-semibold mb-1 truncate">
              {broadcast.name}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2 py-0.5 text-xs rounded ${getStatusColor(
                  broadcast.status,
                )}`}
              >
                {getStatusLabel(broadcast.status)}
              </span>
              <span className="text-gray-400 text-xs">
                Создано:{' '}
                {new Date(broadcast.createdAt).toLocaleDateString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {broadcast.status === 'scheduled' && broadcast.scheduledAt && (
                <span className="text-yellow-400 text-xs">
                  • Запланировано: {new Date(broadcast.scheduledAt).toLocaleDateString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                  })} {new Date(broadcast.scheduledAt).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            {(broadcast.status === 'draft' || broadcast.status === 'scheduled') && onEdit && (
              <button
                onClick={onEdit}
                className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs whitespace-nowrap"
              >
                Редактировать
              </button>
            )}
            {broadcast.status === 'draft' && (
              <button
                onClick={onSend}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs whitespace-nowrap"
              >
                Запустить рассылку
              </button>
            )}
            {onCopy && (
              <button
                onClick={onCopy}
                className="px-2.5 py-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-xs flex items-center gap-1.5"
                title="Копировать рассылку"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline">Копировать</span>
              </button>
            )}
            <button
              onClick={onDelete}
              className="px-2.5 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs whitespace-nowrap"
            >
              Удалить
            </button>
          </div>
        </div>
      </div>

      {/* Контент */}
      <div className="flex-1 overflow-y-auto p-4">
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
                  <div className="bg-gray-800 rounded-lg p-4 space-y-4">
                    {!broadcast.segments.startParams?.length && !broadcast.segments.botIds?.length ? (
                      <div className="text-gray-400 text-sm">
                        Без сегментации (отправить всем пользователям)
                      </div>
                    ) : (
                      <>
                        {broadcast.segments.startParams &&
                          broadcast.segments.startParams.length > 0 && (
                            <div>
                              <div className="text-gray-400 text-sm mb-2 font-medium">
                                Параметры start:
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {broadcast.segments.startParams.map((param) => (
                                  <span
                                    key={param}
                                    className="px-3 py-1.5 bg-purple-600/20 text-purple-400 text-sm rounded-lg border border-purple-600/30"
                                  >
                                    {param}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        {broadcast.segments.botIds &&
                          broadcast.segments.botIds.length > 0 && (
                            <div>
                              <div className="text-gray-400 text-sm mb-2 font-medium">
                                Боты ({broadcast.segments.botIds.length}):
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {broadcast.segments.botIds.map((botId) => {
                                  const bot = bots.find((b) => b.id === botId);
                                  return (
                                    <span
                                      key={botId}
                                      className={`px-3 py-1.5 text-sm rounded-lg border ${
                                        bot?.isActive
                                          ? 'bg-blue-600/20 text-blue-400 border-blue-600/30'
                                          : 'bg-gray-600/20 text-gray-400 border-gray-600/30'
                                      }`}
                                    >
                                      @{bot?.username || botId}
                                      {bot?.isActive === false && (
                                        <span className="ml-2 text-xs text-red-400">(неактивен)</span>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                      </>
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
                <div className="bg-gray-800 rounded-lg p-4 space-y-4">
                  {!broadcast.segments.startParams?.length && !broadcast.segments.botIds?.length ? (
                    <div className="text-gray-400 text-sm">
                      Без сегментации (отправить всем пользователям)
                    </div>
                  ) : (
                    <>
                      {broadcast.segments.startParams &&
                        broadcast.segments.startParams.length > 0 && (
                          <div>
                            <div className="text-gray-400 text-sm mb-2 font-medium">
                              Параметры start:
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {broadcast.segments.startParams.map((param) => (
                                <span
                                  key={param}
                                  className="px-3 py-1.5 bg-purple-600/20 text-purple-400 text-sm rounded-lg border border-purple-600/30"
                                >
                                  {param}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      {broadcast.segments.botIds &&
                        broadcast.segments.botIds.length > 0 && (
                          <div>
                            <div className="text-gray-400 text-sm mb-2 font-medium">
                              Боты ({broadcast.segments.botIds.length}):
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {broadcast.segments.botIds.map((botId) => {
                                const bot = bots.find((b) => b.id === botId);
                                return (
                                  <span
                                    key={botId}
                                    className={`px-3 py-1.5 text-sm rounded-lg border ${
                                      bot?.isActive
                                        ? 'bg-blue-600/20 text-blue-400 border-blue-600/30'
                                        : 'bg-gray-600/20 text-gray-400 border-gray-600/30'
                                    }`}
                                  >
                                    @{bot?.username || botId}
                                    {bot?.isActive === false && (
                                      <span className="ml-2 text-xs text-red-400">(неактивен)</span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                    </>
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

