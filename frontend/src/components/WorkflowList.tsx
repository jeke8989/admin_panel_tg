import type { BotWorkflow } from '../types';
import { WorkflowItem } from './WorkflowItem';

interface WorkflowListProps {
  workflows: BotWorkflow[];
  activeWorkflowId: string | null;
  onWorkflowSelect: (id: string) => void;
  onCreateWorkflow: () => void;
  onDeleteWorkflow?: (id: string, e: React.MouseEvent) => void;
  isLoading: boolean;
}

export const WorkflowList = ({
  workflows,
  activeWorkflowId,
  onWorkflowSelect,
  onCreateWorkflow,
  onDeleteWorkflow,
  isLoading,
}: WorkflowListProps) => {
  return (
    <div className="flex flex-col h-full bg-gray-800">
      <div className="p-4 border-b border-gray-700 bg-gray-800">
        <button
          onClick={onCreateWorkflow}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Создать сценарий
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">Загрузка сценариев...</div>
        ) : workflows.length === 0 ? (
          <div className="p-4 text-center">
            <div className="text-gray-500 mb-4">У вас пока нет сценариев</div>
            <button
              onClick={onCreateWorkflow}
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              Создать первый сценарий
            </button>
          </div>
        ) : (
          <div>
            {workflows.map((workflow) => (
              <WorkflowItem
                key={workflow.id}
                workflow={workflow}
                isActive={activeWorkflowId === workflow.id}
                onClick={() => onWorkflowSelect(workflow.id)}
                onDelete={onDeleteWorkflow}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

