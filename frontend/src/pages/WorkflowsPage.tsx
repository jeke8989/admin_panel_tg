import { useState, useEffect } from 'react';
import type { BotWorkflow } from '../types';
import { getWorkflows, createWorkflow, deleteWorkflow } from '../utils/api';
import { WorkflowList } from '../components/WorkflowList';
import { DeleteWorkflowModal } from '../components/DeleteWorkflowModal';
import { useToast } from '../components/ToastProvider';

interface WorkflowsPageProps {
  activeWorkflowId?: string | null;
  onWorkflowSelect?: (id: string) => void;
  onWorkflowDeleted?: (id: string) => void;
}

export const WorkflowsPage = ({ 
  activeWorkflowId, 
  onWorkflowSelect,
  onWorkflowDeleted,
}: WorkflowsPageProps = {}) => {
  const [workflows, setWorkflows] = useState<BotWorkflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(
    activeWorkflowId && activeWorkflowId !== null ? activeWorkflowId : null
  );
  const [, setIsCreating] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [workflowToDelete, setWorkflowToDelete] = useState<BotWorkflow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    loadWorkflows();
  }, []);

  useEffect(() => {
    if (activeWorkflowId === null || activeWorkflowId === undefined) {
      setSelectedWorkflowId(null);
    } else if (activeWorkflowId && activeWorkflowId !== selectedWorkflowId) {
      setSelectedWorkflowId(activeWorkflowId);
    }
  }, [activeWorkflowId, selectedWorkflowId]);

  const loadWorkflows = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getWorkflows();
      setWorkflows(data || []);

      // Если ничего не выбрано — автоматически выбираем первый сценарий
      if (!selectedWorkflowId && data && data.length > 0) {
        const firstId = data[0].id;
        setSelectedWorkflowId(firstId);
        onWorkflowSelect?.(firstId);
      }
    } catch (error: any) {
      console.error('Error loading workflows:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Неизвестная ошибка';
      setError(`Ошибка при загрузке сценариев: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWorkflowSelect = (id: string) => {
    setSelectedWorkflowId(id);
    onWorkflowSelect?.(id);
  };

  const handleCreateWorkflow = async () => {
    try {
      setIsCreating(true);
      const newWorkflow = await createWorkflow({
        name: 'Новый сценарий',
        description: '',
        isActive: false,
        botIds: [],
        nodes: [],
        connections: []
      });
      await loadWorkflows();
      // Выбираем созданный сценарий
      handleWorkflowSelect(newWorkflow.id);
    } catch (error) {
      console.error('Error creating workflow:', error);
      showToast('Ошибка при создании сценария', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteWorkflowClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const workflow = workflows.find(w => w.id === id);
    if (workflow) {
      setWorkflowToDelete(workflow);
    }
  };

  const handleDeleteWorkflowConfirm = async () => {
    if (!workflowToDelete) return;

    try {
      setIsDeleting(true);
      await deleteWorkflow(workflowToDelete.id);
      await loadWorkflows();
      
      // Очищаем состояние если удаляемый сценарий был выбран
      if (selectedWorkflowId === workflowToDelete.id) {
        setSelectedWorkflowId(null);
        onWorkflowSelect?.(null as any);
      }
      
      onWorkflowDeleted?.(workflowToDelete.id);
      setWorkflowToDelete(null);
    } catch (error) {
      console.error('Error deleting workflow:', error);
        showToast('Ошибка при удалении сценария', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <WorkflowList
        workflows={workflows}
        activeWorkflowId={selectedWorkflowId}
        onWorkflowSelect={handleWorkflowSelect}
        onCreateWorkflow={handleCreateWorkflow}
        onDeleteWorkflow={handleDeleteWorkflowClick}
        isLoading={isLoading}
      />
      
      <DeleteWorkflowModal
        isOpen={!!workflowToDelete}
        onClose={() => setWorkflowToDelete(null)}
        onConfirm={handleDeleteWorkflowConfirm}
        isLoading={isDeleting}
        workflowName={workflowToDelete?.name || ''}
      />
    </>
  );
};

