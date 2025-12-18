import { useState } from 'react';
import type { BroadcastStatistics } from '../types';
import { BroadcastRecipientStatus } from '../types';

interface BroadcastStatisticsProps {
  statistics: BroadcastStatistics;
}

export const BroadcastStatisticsComponent = ({
  statistics,
}: BroadcastStatisticsProps) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredRecipients = statistics.recipients.filter((recipient) => {
    if (statusFilter === 'all') return true;
    return recipient.status === statusFilter;
  });

  const getStatusColor = (status: BroadcastRecipientStatus) => {
    switch (status) {
      case BroadcastRecipientStatus.SENT:
        return 'bg-blue-500/20 text-blue-400';
      case BroadcastRecipientStatus.DELIVERED:
        return 'bg-green-500/20 text-green-400';
      case BroadcastRecipientStatus.READ:
        return 'bg-purple-500/20 text-purple-400';
      case BroadcastRecipientStatus.FAILED:
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getStatusLabel = (status: BroadcastRecipientStatus) => {
    switch (status) {
      case BroadcastRecipientStatus.SENT:
        return 'Отправлено';
      case BroadcastRecipientStatus.DELIVERED:
        return 'Доставлено';
      case BroadcastRecipientStatus.READ:
        return 'Прочитано';
      case BroadcastRecipientStatus.FAILED:
        return 'Ошибка';
      default:
        return 'Ожидание';
    }
  };

  return (
    <div className="space-y-6">
      {/* Общая статистика */}
      <div>
        <h3 className="text-white font-medium mb-3">Общая статистика</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Всего получателей</div>
            <div className="text-white text-2xl font-semibold">
              {statistics.total}
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Отправлено</div>
            <div className="text-white text-2xl font-semibold">
              {statistics.sent}
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Доставлено</div>
            <div className="text-white text-2xl font-semibold">
              {statistics.delivered}
            </div>
          </div>
        </div>
      </div>

      {/* Список получателей */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-medium">Получатели</h3>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Все статусы</option>
            <option value={BroadcastRecipientStatus.SENT}>Отправлено</option>
            <option value={BroadcastRecipientStatus.DELIVERED}>
              Доставлено
            </option>
            <option value={BroadcastRecipientStatus.FAILED}>Ошибки</option>
          </select>
        </div>
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                    Пользователь
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                    Статус
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                    Отправлено
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                    startParam
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredRecipients.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <p className="text-sm font-medium">Список получателей пуст</p>
                        <p className="text-xs mt-1">Для запланированных рассылок получатели будут сформированы при запуске</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRecipients.map((recipient) => (
                    <tr key={recipient.id} className="hover:bg-gray-700/30">
                      <td className="px-4 py-3">
                        <div className="text-white text-sm">
                          {recipient.user.firstName}{' '}
                          {recipient.user.lastName || ''}
                        </div>
                        {recipient.user.username && (
                          <div className="text-gray-400 text-xs">
                            @{recipient.user.username}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 text-xs rounded ${getStatusColor(
                            recipient.status,
                          )}`}
                        >
                          {getStatusLabel(recipient.status)}
                        </span>
                        {recipient.errorMessage && (
                          <div className="text-red-400 text-xs mt-1">
                            {recipient.errorMessage}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {recipient.sentAt
                          ? new Date(recipient.sentAt).toLocaleString('ru-RU')
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {recipient.user.startParam ? (
                          <span className="px-2 py-0.5 bg-purple-600/20 text-purple-400 text-xs rounded">
                            {recipient.user.startParam}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

