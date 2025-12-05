import { useState } from 'react';

interface AddBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (token: string) => void;
  isLoading: boolean;
}

export const AddBotModal = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: AddBotModalProps) => {
  const [token, setToken] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (token.trim()) {
      onConfirm(token.trim());
    }
  };

  const handleClose = () => {
    setToken('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-semibold text-white mb-4">
          Добавить бота
        </h3>
        <p className="text-gray-300 mb-4 text-sm">
          Введите токен бота, полученный от @BotFather в Telegram
        </p>
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
          disabled={isLoading}
          className="w-full bg-gray-700 text-white placeholder-gray-400 rounded-lg px-4 py-2 mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Отменить
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !token.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Добавление...' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  );
};

