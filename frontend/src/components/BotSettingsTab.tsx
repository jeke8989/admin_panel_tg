import { useState, useEffect } from 'react';
import type { Bot, BotWorkflow } from '../types';
import { getBotWorkflows, createWorkflow, deleteWorkflow, activateWorkflow, deactivateWorkflow } from '../utils/api';
import { WorkflowEditor } from './WorkflowEditor';

interface BotSettingsTabProps {
  bot: Bot;
}

export const BotSettingsTab = ({ bot }: BotSettingsTabProps) => {
  const [workflows, setWorkflows] = useState<BotWorkflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingWorkflow, setEditingWorkflow] = useState<BotWorkflow | null>(null);

  useEffect(() => {
    loadWorkflows();
  }, [bot.id]);

  const loadWorkflows = async () => {
    try {
      setIsLoading(true);
      const data = await getBotWorkflows(bot.id);
      setWorkflows(data);
    } catch (error) {
      console.error('Error loading workflows:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateWorkflow = async () => {
    try {
      const newWorkflow = await createWorkflow({
        botId: bot.id,
        name: 'Новый сценарий',
        description: '',
        isActive: false,
        nodes: [],
        connections: []
      });
      setWorkflows([newWorkflow, ...workflows]);
      setEditingWorkflow(newWorkflow);
    } catch (error) {
      console.error('Error creating workflow:', error);
      alert('Ошибка при создании сценария');
    }
  };

  const handleDeleteWorkflow = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Вы уверены, что хотите удалить этот сценарий?')) return;
    
    try {
      await deleteWorkflow(id);
      setWorkflows(workflows.filter(w => w.id !== id));
      if (editingWorkflow?.id === id) {
        setEditingWorkflow(null);
      }
    } catch (error) {
      console.error('Error deleting workflow:', error);
      alert('Ошибка при удалении сценария');
    }
  };

  const handleToggleActive = async (workflow: BotWorkflow, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = workflow.isActive 
        ? await deactivateWorkflow(workflow.id)
        : await activateWorkflow(workflow.id);
      
      setWorkflows(workflows.map(w => w.id === workflow.id ? updated : w));
    } catch (error) {
      console.error('Error toggling workflow:', error);
      alert('Ошибка при изменении статуса сценария');
    }
  };

  if (editingWorkflow) {
    return (
      <WorkflowEditor 
        workflow={editingWorkflow} 
        onClose={() => {
          setEditingWorkflow(null);
          loadWorkflows();
        }} 
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-white">Сценарии (Workflows)</h3>
        <button
          onClick={handleCreateWorkflow}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Создать сценарий
        </button>
      </div>

      {isLoading ? (
        <div className="text-gray-500 text-center py-8">Загрузка сценариев...</div>
      ) : workflows.length === 0 ? (
        <div className="text-gray-500 text-center py-8 bg-gray-800 rounded-lg border border-gray-700">
          <p className="mb-4">У этого бота пока нет сценариев</p>
          <button
            onClick={handleCreateWorkflow}
            className="text-blue-400 hover:text-blue-300"
          >
            Создать первый сценарий
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              onClick={() => setEditingWorkflow(workflow)}
              className="bg-gray-800 rounded-lg p-4 border border-gray-700 cursor-pointer hover:border-gray-500 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-white font-medium text-lg mb-1">{workflow.name}</h4>
                  <p className="text-gray-400 text-sm">{workflow.description || 'Нет описания'}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>Узлов: {workflow.nodes?.length || 0}</span>
                    <span>Создан: {new Date(workflow.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => handleToggleActive(workflow, e)}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      workflow.isActive 
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                        : 'bg-gray-600/20 text-gray-400 hover:bg-gray-600/30'
                    }`}
                  >
                    {workflow.isActive ? 'Активен' : 'Неактивен'}
                  </button>
                  <button
                    onClick={(e) => handleDeleteWorkflow(workflow.id, e)}
                    className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

