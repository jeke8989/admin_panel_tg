interface DeleteMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

export const DeleteMessageModal = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: DeleteMessageModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-semibold text-white mb-4">
          Удалить сообщение?
        </h3>
        <p className="text-gray-300 mb-6">
          Это действие нельзя отменить. Сообщение будет удалено из базы данных и из Telegram.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Удаление...' : 'Удалить'}
          </button>
        </div>
      </div>
    </div>
  );
};

