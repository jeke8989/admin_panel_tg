import { useState, useEffect } from 'react';
import type { Bot, Broadcast, InlineButton } from '../types';
import { createBroadcast, getBots, api, getSegmentationCounts, testBroadcast, updateBroadcast } from '../utils/api';
import { useToast } from './ToastProvider';
import { InlineButtonsEditor } from './InlineButtonsEditor';
import { FileUploader } from './FileUploader';

interface CreateBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  broadcast?: Broadcast; // Для редактирования
}

// Лимиты символов для Telegram
const MAX_TEXT_LENGTH = 4096; // Для текстовых сообщений
const MAX_CAPTION_LENGTH = 1024; // Для подписей к изображениям

export const CreateBroadcastModal = ({
  isOpen,
  onClose,
  onSuccess,
  broadcast,
}: CreateBroadcastModalProps) => {
  const isEditMode = !!broadcast;
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [bots, setBots] = useState<Bot[]>([]);
  const [availableStartParams, setAvailableStartParams] = useState<string[]>([]);
  const [selectedStartParams, setSelectedStartParams] = useState<string[]>([]);
  const [selectedBotIds, setSelectedBotIds] = useState<string[]>([]);
  const [noSegmentation, setNoSegmentation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [segmentationCounts, setSegmentationCounts] = useState<{
    total: number;
    byStartParam: Record<string, number>;
    byBotId: Record<string, number>;
    selectedTotal: number;
  } | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [enableScheduling, setEnableScheduling] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [inlineButtons, setInlineButtons] = useState<InlineButton[][]>([]);
  const [fileId, setFileId] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const isScheduled = enableScheduling && !!scheduledAt;

  // Получаем максимальную длину в зависимости от наличия изображения
  const maxLength = fileId ? MAX_CAPTION_LENGTH : MAX_TEXT_LENGTH;
  const currentLength = text.length;
  const isTextTooLong = currentLength > maxLength;

  useEffect(() => {
    if (isOpen) {
      loadBots();
      loadStartParams();
      
      // Если режим редактирования, загружаем данные рассылки
      if (broadcast) {
        setName(broadcast.name || '');
        setText(broadcast.text || '');
        if (broadcast.segments) {
          setSelectedStartParams(broadcast.segments.startParams || []);
          setSelectedBotIds(broadcast.segments.botIds || []);
          setNoSegmentation(
            !broadcast.segments.startParams?.length && !broadcast.segments.botIds?.length
          );
        } else {
          setNoSegmentation(true);
        }
        if (broadcast.scheduledAt) {
          const scheduledDate = new Date(broadcast.scheduledAt);
          // Конвертируем в локальное время для datetime-local input
          const year = scheduledDate.getFullYear();
          const month = String(scheduledDate.getMonth() + 1).padStart(2, '0');
          const day = String(scheduledDate.getDate()).padStart(2, '0');
          const hours = String(scheduledDate.getHours()).padStart(2, '0');
          const minutes = String(scheduledDate.getMinutes()).padStart(2, '0');
          const localDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
          setScheduledAt(localDateTime);
          setEnableScheduling(true);
        } else {
          setScheduledAt('');
          setEnableScheduling(false);
        }
        setInlineButtons(broadcast.inlineButtons || []);
        setFileId(broadcast.fileId || null);
        setFileUrl(broadcast.fileUrl || null);
      } else {
        // Сброс для создания новой рассылки
        setName('');
        setText('');
        setSelectedStartParams([]);
        setSelectedBotIds([]);
        setNoSegmentation(false);
        setScheduledAt('');
        setEnableScheduling(false);
        setInlineButtons([]);
        setFileId(null);
        setFileUrl(null);
      }
    }
  }, [isOpen, broadcast]);

  useEffect(() => {
    if (isOpen) {
      // Загружаем счетчики после загрузки ботов и параметров
      const timeoutId = setTimeout(() => {
        loadSegmentationCounts();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, selectedStartParams, selectedBotIds, noSegmentation, bots]);

  useEffect(() => {
    if (isOpen) {
      // Небольшая задержка для обновления счетчиков после изменения выбора
      const timeoutId = setTimeout(() => {
        loadSegmentationCounts();
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [selectedStartParams, selectedBotIds, noSegmentation, isOpen]);

  const loadBots = async () => {
    try {
      const botsList = await getBots();
      // Фильтруем только активные боты для сегментации
      const activeBots = botsList.filter((bot) => bot.isActive);
      setBots(activeBots);
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

  const loadSegmentationCounts = async () => {
    setIsLoadingCounts(true);
    try {
      // Всегда загружаем полные счетчики (для всех параметров и ботов)
      // segments передаем только для расчета selectedTotal
      const segments = noSegmentation
        ? undefined
        : {
            startParams:
              selectedStartParams.length > 0 ? selectedStartParams : undefined,
            botIds: selectedBotIds.length > 0 ? selectedBotIds : undefined,
          };
      const counts = await getSegmentationCounts(segments);
      setSegmentationCounts(counts);
    } catch (error) {
      console.error('Error loading segmentation counts:', error);
    } finally {
      setIsLoadingCounts(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      showToast('Введите название рассылки', 'error');
      return;
    }

    // Валидация: либо текст, либо изображение должно быть
    if (!text.trim() && !fileId) {
      showToast('Введите текст сообщения или загрузите изображение', 'error');
      return;
    }

    // Валидация длины текста
    if (text.length > maxLength) {
      showToast(
        fileId
          ? `Подпись к изображению не может превышать ${MAX_CAPTION_LENGTH} символов. Текущая длина: ${text.length}`
          : `Текст сообщения не может превышать ${MAX_TEXT_LENGTH} символов. Текущая длина: ${text.length}`,
        'error',
      );
      return;
    }

    setIsLoading(true);
    try {
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

      // Валидация даты планирования
      if (enableScheduling && scheduledAt) {
        const scheduledDate = new Date(scheduledAt);
        const now = new Date();
        if (scheduledDate <= now) {
          showToast('Дата и время планирования должны быть в будущем', 'error');
          setIsLoading(false);
          return;
        }
      }

      // Фильтруем пустые кнопки
      const filteredButtons = inlineButtons
        .map(row => row.filter(btn => btn.text.trim()))
        .filter(row => row.length > 0);

      if (isEditMode && broadcast) {
        await updateBroadcast(broadcast.id, {
          name,
          text,
          segments: Object.keys(segments).length > 0 ? segments : undefined,
          inlineButtons: filteredButtons.length > 0 ? filteredButtons : undefined,
          fileId: fileId || undefined,
          fileUrl: fileUrl || undefined,
          scheduledAt: enableScheduling && scheduledAt ? scheduledAt : null,
        });
      } else {
        await createBroadcast({
          name,
          text,
          segments: Object.keys(segments).length > 0 ? segments : undefined,
          inlineButtons: filteredButtons.length > 0 ? filteredButtons : undefined,
          fileId: fileId || undefined,
          fileUrl: fileUrl || undefined,
          sendImmediately: false,
          scheduledAt: enableScheduling && scheduledAt ? scheduledAt : undefined,
        });
      }

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

  const handleTest = async () => {
    // Валидация: либо текст, либо изображение должно быть
    if (!text.trim() && !fileId) {
      showToast('Введите текст сообщения или загрузите изображение для тестирования', 'error');
      return;
    }

    // Валидация длины текста
    if (text.length > maxLength) {
      showToast(
        fileId
          ? `Подпись к изображению не может превышать ${MAX_CAPTION_LENGTH} символов. Текущая длина: ${text.length}`
          : `Текст сообщения не может превышать ${MAX_TEXT_LENGTH} символов. Текущая длина: ${text.length}`,
        'error',
      );
      return;
    }

    setIsTesting(true);
    try {
      // Фильтруем пустые кнопки для тестирования
      const filteredButtons = inlineButtons
        .map(row => row.filter(btn => btn.text.trim()))
        .filter(row => row.length > 0);

      const result = await testBroadcast(
        text, 
        undefined, 
        fileId || undefined, 
        fileUrl || undefined,
        filteredButtons.length > 0 ? filteredButtons : undefined,
      );
      if (result.success) {
        showToast(result.message, 'success');
      } else {
        showToast(result.message, 'error');
      }
    } catch (error: unknown) {
      console.error('Error testing broadcast:', error);
      const errorMessage = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Ошибка при тестировании рассылки';
      showToast(errorMessage || 'Ошибка при тестировании рассылки', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setText('');
    setSelectedStartParams([]);
    setSelectedBotIds([]);
    setNoSegmentation(false);
    setScheduledAt('');
    setEnableScheduling(false);
    setInlineButtons([]);
    setFileId(null);
    setFileUrl(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 my-8">
        <h3 className="text-xl font-semibold text-white mb-4">
          {isEditMode ? 'Редактировать рассылку' : 'Создать рассылку'}
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

          {/* Изображение */}
          <div className="border-t border-gray-700 pt-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Изображение (опционально)
            </label>
            <FileUploader
              onFileSelect={(id, url) => {
                setFileId(id);
                setFileUrl(url || null);
              }}
              currentFileId={fileId}
              currentPreviewUrl={fileUrl}
              accept="image/*"
              maxSizeMB={20}
            />
            <p className="text-xs text-gray-400 mt-1">
              Если загружено изображение, текст будет использован как подпись (caption)
            </p>
          </div>

          {/* Текст сообщения */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {fileId ? 'Подпись к изображению' : 'Текст сообщения *'}
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={fileId ? "Введите подпись к изображению (опционально)" : "Введите текст сообщения"}
              rows={8}
              className={`w-full bg-gray-700 text-white placeholder-gray-400 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 ${
                isTextTooLong ? 'focus:ring-red-500 border-red-500' : 'focus:ring-blue-500'
              }`}
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-gray-400">
                Поддерживается HTML форматирование
              </p>
              <p className={`text-xs ${isTextTooLong ? 'text-red-400' : currentLength > maxLength * 0.9 ? 'text-yellow-400' : 'text-gray-400'}`}>
                {currentLength} / {maxLength}
              </p>
            </div>
            {isTextTooLong && (
              <p className="text-xs text-red-400 mt-1">
                Превышен лимит символов! {fileId ? 'Подпись к изображению' : 'Текст сообщения'} не может превышать {maxLength} символов.
              </p>
            )}
          </div>

          {/* Inline кнопки */}
          <div className="border-t border-gray-700 pt-4">
            <InlineButtonsEditor
              buttons={inlineButtons}
              onChange={setInlineButtons}
            />
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
                {segmentationCounts && (
                  <span className="ml-2 text-blue-400">
                    ({segmentationCounts.total} пользователей)
                  </span>
                )}
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
                          <span className="text-sm text-white">
                            {param}
                            {segmentationCounts?.byStartParam[param] !== undefined && (
                              <span className="ml-1 text-blue-400">
                                ({segmentationCounts.byStartParam[param]} пользователей)
                              </span>
                            )}
                          </span>
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
                            {segmentationCounts?.byBotId[bot.id] !== undefined && (
                              <span className="ml-1 text-blue-400">
                                ({segmentationCounts.byBotId[bot.id]} пользователей)
                              </span>
                            )}
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
              {isLoadingCounts ? (
                <p className="text-sm text-blue-300">Подсчет получателей...</p>
              ) : segmentationCounts ? (
                <p className="text-sm text-blue-300">
                  {noSegmentation
                    ? `Рассылка будет отправлена всем пользователям: ${segmentationCounts.total} пользователей`
                    : isScheduled
                      ? `Для запланированной рассылки список получателей будет сформирован при запуске. Сейчас по выбранной сегментации: ${segmentationCounts.selectedTotal} пользователей`
                      : `Общее количество получателей для выбранной сегментации: ${segmentationCounts.selectedTotal} пользователей`}
                </p>
              ) : (
                <p className="text-sm text-blue-300">
                  Количество получателей будет подсчитано при создании рассылки
                </p>
              )}
            </div>
          </div>

          {/* Планирование рассылки */}
          <div className="border-t border-gray-700 pt-4 mt-4">
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="enableScheduling"
                checked={enableScheduling}
                onChange={(e) => {
                  setEnableScheduling(e.target.checked);
                  if (!e.target.checked) {
                    setScheduledAt('');
                  }
                }}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
              />
              <label
                htmlFor="enableScheduling"
                className="ml-2 text-sm font-medium text-gray-300"
              >
                Запланировать рассылку
              </label>
            </div>

            {enableScheduling && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Дата и время запуска *
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full bg-gray-700 text-white placeholder-gray-400 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required={enableScheduling}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Рассылка будет автоматически отправлена в указанное время
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-700">
          <button
            onClick={handleClose}
            disabled={isLoading || isTesting}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Отменить
          </button>
          <button
            onClick={handleTest}
            disabled={isLoading || isTesting || (!text.trim() && !fileId) || isTextTooLong}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {isTesting ? 'Тестирование...' : 'Тестировать'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || isTesting || isTextTooLong}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? (isEditMode ? 'Сохранение...' : 'Создание...') : (isEditMode ? 'Сохранить' : 'Создать черновик')}
          </button>
        </div>
      </div>
    </div>
  );
};
