import { useState, useEffect, useCallback } from 'react';
import type { Broadcast, BroadcastStatistics } from '../types';
import { getBroadcasts, getBroadcastById, getBroadcastStatistics, sendBroadcast, deleteBroadcast, copyBroadcast } from '../utils/api';
import { CreateBroadcastModal } from '../components/CreateBroadcastModal';
import { BroadcastList } from '../components/BroadcastList';
import { useToast } from '../components/ToastProvider';
import { ConfirmModal } from '../components/ConfirmModal';

interface BroadcastsPageProps {
  activeBroadcastId?: string | null;
  onBroadcastSelect?: (id: string) => void;
  onBroadcastDeleted?: (id: string) => void;
  onBroadcastCopied?: (id: string) => void;
}

export const BroadcastsPage = ({ 
  activeBroadcastId, 
  onBroadcastSelect,
  onBroadcastDeleted,
  onBroadcastCopied,
}: BroadcastsPageProps = {}) => {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Инициализируем selectedBroadcastId только если activeBroadcastId явно передан и не null
  const [selectedBroadcastId, setSelectedBroadcastId] = useState<string | null>(
    activeBroadcastId && activeBroadcastId !== null ? activeBroadcastId : null
  );
  const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null);
  const [broadcastStatistics, setBroadcastStatistics] = useState<BroadcastStatistics | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [broadcastToDelete, setBroadcastToDelete] = useState<Broadcast | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    loadBroadcasts();
  }, []);

  useEffect(() => {
    if (selectedBroadcastId) {
      loadBroadcastDetails(selectedBroadcastId);
    }
  }, [selectedBroadcastId]);

  const loadBroadcasts = async () => {
    try {
      setIsLoading(true);
      const broadcastsList = await getBroadcasts();
      setBroadcasts(broadcastsList);

      // Если ничего не выбрано — автоматически выбираем первую рассылку
      if (!selectedBroadcastId && broadcastsList.length > 0) {
        const firstId = broadcastsList[0].id;
        setSelectedBroadcastId(firstId);
        onBroadcastSelect?.(firstId);
        await loadBroadcastDetails(firstId);
      }
    } catch (error) {
      console.error('Error loading broadcasts:', error);
      showToast('Ошибка при загрузке рассылок', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadBroadcastDetails = async (id: string) => {
    try {
      const [broadcast, statistics] = await Promise.all([
        getBroadcastById(id),
        getBroadcastStatistics(id),
      ]);
      setSelectedBroadcast(broadcast);
      setBroadcastStatistics(statistics);
    } catch (error) {
      console.error('Error loading broadcast details:', error);
    }
  };

  const handleBroadcastSelect = (id: string) => {
    setSelectedBroadcastId(id);
    onBroadcastSelect?.(id);
  };

  const handleSendBroadcast = async (id: string) => {
    try {
      await sendBroadcast(id);
      await loadBroadcasts();
      if (selectedBroadcastId === id) {
        await loadBroadcastDetails(id);
      }
    } catch (error) {
      console.error('Error sending broadcast:', error);
      showToast('Ошибка при отправке рассылки', 'error');
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    const target = broadcasts.find((b) => b.id === id);
    if (!target) return;
    setBroadcastToDelete(target);
  };

  const confirmDeleteBroadcast = async () => {
    if (!broadcastToDelete) return;
    setIsDeleting(true);
    try {
      await deleteBroadcast(broadcastToDelete.id);
      await loadBroadcasts();
      if (selectedBroadcastId === broadcastToDelete.id) {
        setSelectedBroadcastId(null);
        setSelectedBroadcast(null);
        setBroadcastStatistics(null);
      }
      onBroadcastDeleted?.(broadcastToDelete.id);
      showToast('Рассылка удалена', 'success');
    } catch (error) {
      console.error('Error deleting broadcast:', error);
      const errorMessage = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Ошибка при удалении рассылки';
      showToast(errorMessage || 'Ошибка при удалении рассылки', 'error');
    } finally {
      setIsDeleting(false);
      setBroadcastToDelete(null);
    }
  };

  const handleCopyBroadcast = async (id: string) => {
    try {
      const copiedBroadcast = await copyBroadcast(id);
      await loadBroadcasts();
      showToast('Рассылка успешно скопирована!', 'success');
      // Выбираем скопированную рассылку
      await handleBroadcastSelect(copiedBroadcast.id);
      await loadBroadcastDetails(copiedBroadcast.id);
      onBroadcastCopied?.(copiedBroadcast.id);
    } catch (error) {
      console.error('Error copying broadcast:', error);
      const errorMessage = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Ошибка при копировании рассылки';
      showToast(errorMessage || 'Ошибка при копировании рассылки', 'error');
    }
  };

  const handleCreateBroadcast = async () => {
    await loadBroadcasts();
    setIsCreateModalOpen(false);
  };

  useEffect(() => {
    // Синхронизируем selectedBroadcastId с activeBroadcastId только если activeBroadcastId явно установлен
    // Если activeBroadcastId === null или undefined, это означает, что выбор должен быть очищен
    if (activeBroadcastId === null || activeBroadcastId === undefined) {
      setSelectedBroadcastId(null);
      setSelectedBroadcast(null);
      setBroadcastStatistics(null);
    } else if (activeBroadcastId && activeBroadcastId !== selectedBroadcastId) {
      setSelectedBroadcastId(activeBroadcastId);
    }
  }, [activeBroadcastId, selectedBroadcastId]);


  return (
    <>
      <BroadcastList
        broadcasts={broadcasts}
        activeBroadcastId={selectedBroadcastId}
        onBroadcastSelect={handleBroadcastSelect}
        onCreateBroadcast={() => setIsCreateModalOpen(true)}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        isLoading={isLoading}
      />

      {/* Модальное окно создания рассылки */}
      {isCreateModalOpen && (
        <CreateBroadcastModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleCreateBroadcast}
        />
      )}
      <ConfirmModal
        isOpen={!!broadcastToDelete}
        title="Удалить рассылку?"
        message={broadcastToDelete ? `Вы уверены, что хотите удалить рассылку "${broadcastToDelete.name}"?` : ''}
        confirmText="Удалить"
        cancelText="Отменить"
        isLoading={isDeleting}
        onConfirm={confirmDeleteBroadcast}
        onCancel={() => setBroadcastToDelete(null)}
      />
    </>
  );
};

