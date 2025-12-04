import { useState, useEffect, useCallback } from 'react';
import type { Broadcast, BroadcastStatistics } from '../types';
import { getBroadcasts, getBroadcastById, getBroadcastStatistics, sendBroadcast, deleteBroadcast, copyBroadcast } from '../utils/api';
import { CreateBroadcastModal } from '../components/CreateBroadcastModal';
import { BroadcastList } from '../components/BroadcastList';

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
  const [selectedBroadcastId, setSelectedBroadcastId] = useState<string | null>(activeBroadcastId || null);
  const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null);
  const [broadcastStatistics, setBroadcastStatistics] = useState<BroadcastStatistics | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

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
    } catch (error) {
      console.error('Error loading broadcasts:', error);
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
      alert('Ошибка при отправке рассылки');
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту рассылку?')) {
      return;
    }
    try {
      await deleteBroadcast(id);
      await loadBroadcasts();
      if (selectedBroadcastId === id) {
        setSelectedBroadcastId(null);
        setSelectedBroadcast(null);
        setBroadcastStatistics(null);
      }
      onBroadcastDeleted?.(id);
    } catch (error) {
      console.error('Error deleting broadcast:', error);
      const errorMessage = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Ошибка при удалении рассылки';
      alert(errorMessage || 'Ошибка при удалении рассылки');
    }
  };

  const handleCopyBroadcast = async (id: string) => {
    try {
      const copiedBroadcast = await copyBroadcast(id);
      await loadBroadcasts();
      alert('Рассылка успешно скопирована!');
      // Выбираем скопированную рассылку
      await handleBroadcastSelect(copiedBroadcast.id);
      await loadBroadcastDetails(copiedBroadcast.id);
      onBroadcastCopied?.(copiedBroadcast.id);
    } catch (error) {
      console.error('Error copying broadcast:', error);
      const errorMessage = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Ошибка при копировании рассылки';
      alert(errorMessage || 'Ошибка при копировании рассылки');
    }
  };

  const handleCreateBroadcast = async () => {
    await loadBroadcasts();
    setIsCreateModalOpen(false);
  };

  useEffect(() => {
    if (activeBroadcastId && activeBroadcastId !== selectedBroadcastId) {
      setSelectedBroadcastId(activeBroadcastId);
    }
  }, [activeBroadcastId]);


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
    </>
  );
};

