import type { BotWorkflow } from '../types';

interface WorkflowItemProps {
  workflow: BotWorkflow;
  isActive: boolean;
  onClick: () => void;
  onDelete?: (id: string, e: React.MouseEvent) => void;
}

export const WorkflowItem = ({ workflow, isActive, onClick, onDelete }: WorkflowItemProps) => {
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const botsCount = Array.isArray((workflow as any).botIds) ? (workflow as any).botIds.length : 0;

  return (
    <div
      onClick={onClick}
      className={`
        flex items-center gap-3 p-3 cursor-pointer transition-colors
        ${isActive ? 'bg-blue-600/20' : 'hover:bg-gray-700/50'}
        border-b border-gray-700/50
      `}
    >
      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-lg">
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M7 7v10M12 7v10M17 7v10M5 5h14v14H5z" />
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1 gap-2">
          <div className="text-white font-medium truncate">{workflow.name}</div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${
                workflow.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
              }`}
            >
              {workflow.isActive ? 'Активен' : 'Неактивен'}
            </span>
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(workflow.id, e);
                }}
                className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400 transition-colors"
                title="Удалить сценарий"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="text-gray-500 text-xs mt-1 flex items-center gap-3">
          <span>Узлов: {workflow.nodes?.length || 0}</span>
          <span>Создан: {formatDate(workflow.createdAt)}</span>
          {botsCount > 0 && (
            <span className="flex-shrink-0">Ботов: {botsCount}</span>
          )}
        </div>
      </div>
    </div>
  );
};

