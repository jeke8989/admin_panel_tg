import { useState, useEffect } from 'react';
import type { Bot } from '../types';
import { createBroadcast, getBots, api } from '../utils/api';
import { useToast } from './ToastProvider';

interface CreateBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateBroadcastModal = ({
  isOpen,
  onClose,
  onSuccess,
}: CreateBroadcastModalProps) => {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [bots, setBots] = useState<Bot[]>([]);
  const [availableStartParams, setAvailableStartParams] = useState<string[]>([]);
  const [selectedStartParams, setSelectedStartParams] = useState<string[]>([]);
  const [selectedBotIds, setSelectedBotIds] = useState<string[]>([]);
  const [noSegmentation, setNoSegmentation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadBots();
      loadStartParams();
    }
  }, [isOpen]);

  const loadBots = async () => {
    try {
      const botsList = await getBots();
      setBots(botsList);
    } catch (error) {
      console.error('Error loading bots:', error);
    }
  };

  const loadStartParams = async () => {
    try {
      const response = await api.get('/chats');
      const chats = response.data as Array<{ user?: { startParam?: string } }>;
      const startParamsSet = new Set<string>();
      chats.forEach((chat) => {
        if (chat.user?.startParam) {
          startParamsSet.add(chat.user.startParam);
        }
      });
      setAvailableStartParams(Array.from(startParamsSet));
    } catch (error) {
      console.error('Error loading start params:', error);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      showToast('Введите название рассылки', 'error');
      return;
    }

    if (!text.trim()) {
      showToast('Введите текст сообщения', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('text', text);

      const segments: {
        startParams?: string[];
        botIds?: string[];
      } = {};
      if (!noSegmentation) {
        if (selectedStartParams.length > 0) {
          segments.startParams = selectedStartParams;
        }
        if (selectedBotIds.length > 0) {
          segments.botIds = selectedBotIds;
        }
      }

      if (Object.keys(segments).length > 0) {
        formData.append('segments', JSON.stringify(segments));
      }

      formData.append('sendImmediately', 'false');

      await createBroadcast(formData);

      handleClose();
      onSuccess();
    } catch (error: unknown) {
      console.error('Error creating broadcast:', error);
      const errorMessage = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Ошибка при создании рассылки';
      showToast(errorMessage || 'Ошибка при создании рассылки', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setText('');
    setSelectedStartParams([]);
    setSelectedBotIds([]);
    setNoSegmentation(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 my-8">
        <h3 className="text-xl font-semibold text-white mb-4">
          Создать рассылку
        </h3>

        <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
          {/* Название */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Название рассылки *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название рассылки"
              className="w-full bg-gray-700 text-white placeholder-gray-400 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Текст сообщения */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Текст сообщения *
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Введите текст сообщения"
              rows={8}
              className="w-full bg-gray-700 text-white placeholder-gray-400 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Поддерживается HTML форматирование
            </p>
          </div>

          {/* Сегментация */}
          <div className="border-t border-gray-700 pt-4">
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="noSegmentation"
                checked={noSegmentation}
                onChange={(e) => {
                  setNoSegmentation(e.target.checked);
                  if (e.target.checked) {
                    setSelectedStartParams([]);
                    setSelectedBotIds([]);
                  }
                }}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
              />
              <label
                htmlFor="noSegmentation"
                className="ml-2 text-sm text-gray-300"
              >
                Без сегментации (отправить всем пользователям)
              </label>
            </div>

            {!noSegmentation && (
              <div className="space-y-4">
                {/* StartParam сегментация */}
                {availableStartParams.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Параметр start (выберите один или несколько)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {availableStartParams.map((param) => (
                        <label
                          key={param}
                          className="flex items-center px-3 py-1.5 bg-gray-700 rounded cursor-pointer hover:bg-gray-600 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedStartParams.includes(param)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStartParams([...selectedStartParams, param]);
                              } else {
                                setSelectedStartParams(
                                  selectedStartParams.filter((p) => p !== param),
                                );
                              }
                            }}
                            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 mr-2"
                          />
                          <span className="text-sm text-white">{param}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Боты сегментация */}
                {bots.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Боты (выберите один или несколько)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {bots.map((bot) => (
                        <label
                          key={bot.id}
                          className="flex items-center px-3 py-1.5 bg-gray-700 rounded cursor-pointer hover:bg-gray-600 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedBotIds.includes(bot.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedBotIds([...selectedBotIds, bot.id]);
                              } else {
                                setSelectedBotIds(
                                  selectedBotIds.filter((id) => id !== bot.id),
                                );
                              }
                            }}
                            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 mr-2"
                          />
                          <span className="text-sm text-white">
                            @{bot.username || bot.id}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Предпросмотр количества получателей */}
            <div className="mt-4 p-3 bg-blue-500/20 border border-blue-500/30 rounded">
              <p className="text-sm text-blue-300">
                {noSegmentation
                  ? 'Рассылка будет отправлена всем пользователям, которые взаимодействовали с любыми ботами'
                  : 'Количество получателей будет подсчитано при создании рассылки'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-700">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Отменить
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Создание...' : 'Создать черновик'}
          </button>
        </div>
      </div>
    </div>
  );
};
