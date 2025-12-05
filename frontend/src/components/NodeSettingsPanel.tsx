import { useState, useEffect } from 'react';
import { FileUploader } from './FileUploader';
import { InlineButtonsEditor } from './InlineButtonsEditor';
import type { InlineButton } from './InlineButtonsEditor';

interface ReactFlowNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: {
    label?: string;
    command?: string;
    text?: string;
    matchType?: string;
    delay?: number;
    messageType?: 'text' | 'photo' | 'video' | 'document' | 'audio' | 'voice' | 'animation';
    mediaFile?: string;
    buttons?: InlineButton[][];
    [key: string]: unknown;
  };
}

interface NodeSettingsPanelProps {
  node: ReactFlowNode | null;
  botIds: string[];
  onChange: (nodeId: string, data: ReactFlowNode['data']) => void;
  onClose: () => void;
  onDelete: (nodeId: string) => void;
}

export const NodeSettingsPanel = ({ node, botIds, onChange, onClose, onDelete }: NodeSettingsPanelProps) => {
  const [label, setLabel] = useState('');
  const [config, setConfig] = useState<ReactFlowNode['data']>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync node data to local state
  useEffect(() => {
    if (!node) return;
    
    const nodeLabel = node.data.label || '';
    const nodeConfig = node.data;
    
    // Batch state updates
    setLabel(nodeLabel);
    setConfig(nodeConfig);
    setShowDeleteConfirm(false);
  }, [node]);

  if (!node) return null;

  const handleChange = (key: string, value: unknown) => {
    const newData = { ...config, [key]: value };
    setConfig(newData);
    onChange(node.id, newData);
  };
  
  const handleLabelChange = (val: string) => {
      setLabel(val);
      handleChange('label', val);
  };

  if (showDeleteConfirm) {
    return (
      <div className="w-80 bg-gray-800 border-l border-gray-700 p-4 absolute right-0 top-0 z-10 shadow-xl h-full flex flex-col justify-center items-center text-center">
        <h3 className="text-white text-lg font-bold mb-4">Удалить узел?</h3>
        <p className="text-gray-400 mb-6 text-sm">Это действие нельзя отменить.</p>
        <div className="flex gap-3">
          <button 
            onClick={() => {
                onDelete(node.id);
                setShowDeleteConfirm(false);
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
          >
            Удалить
          </button>
          <button 
            onClick={() => setShowDeleteConfirm(false)}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-gray-800 border-l border-gray-700 p-4 overflow-y-auto h-full absolute right-0 top-0 z-10 shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-white font-medium text-lg">Настройки узла</h3>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowDeleteConfirm(true)} 
            className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-gray-700 transition-colors"
            title="Удалить узел"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="mb-6">
        <label className="block text-gray-400 text-xs uppercase font-bold mb-2">Название</label>
        <input 
            type="text" 
            value={label} 
            onChange={e => handleLabelChange(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="Введите название..."
        />
      </div>
      
      <div className="border-t border-gray-700 pt-6">
        <h4 className="text-white font-medium mb-4">Параметры</h4>

        {node.type === 'action-message' && (
          <p className="text-gray-500 text-xs mb-4">
            {config.messageType === 'text' || !config.messageType
              ? 'Максимум 4096 символов в текстовом сообщении Telegram.'
              : 'Максимум 1024 символа в подписи (caption) к медиа в Telegram.'}
          </p>
        )}

        {/* Specific fields based on type */}
        {node.type === 'trigger-command' && (
           <div className="mb-4">
              <label className="block text-gray-400 text-xs uppercase font-bold mb-2">Команда (без /)</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">/</span>
                <input 
                    type="text" 
                    value={config.command || ''} 
                    onChange={e => handleChange('command', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded pl-6 pr-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="start"
                />
              </div>
           </div>
        )}
        
        {node.type === 'trigger-text' && (
           <>
             <div className="mb-4">
                <label className="block text-gray-400 text-xs uppercase font-bold mb-2">Текст сообщения</label>
                <input 
                    type="text" 
                    value={config.text || ''} 
                    onChange={e => handleChange('text', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
             </div>
             <div className="mb-4">
                <label className="block text-gray-400 text-xs uppercase font-bold mb-2">Тип совпадения</label>
                <select
                    value={config.matchType || 'exact'}
                    onChange={e => handleChange('matchType', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                >
                    <option value="exact">Точное совпадение</option>
                    <option value="contains">Содержит</option>
                    <option value="regex">Регулярное выражение</option>
                </select>
             </div>
           </>
        )}

        {node.type === 'trigger-callback' && (
           <>
             <div className="mb-4">
                <label className="block text-gray-400 text-xs uppercase font-bold mb-2">Callback Data</label>
                <input 
                    type="text" 
                    value={(config.callbackData || config.data || '') as string} 
                    onChange={e => handleChange('callbackData', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="Оставьте пустым для любого callback"
                />
                <p className="text-gray-500 text-xs mt-1">
                  Если оставить пустым, триггер сработает на любой callback query
                </p>
             </div>
             <div className="mb-4">
                <label className="block text-gray-400 text-xs uppercase font-bold mb-2">Тип совпадения</label>
                <select
                    value={config.matchType || 'exact'}
                    onChange={e => handleChange('matchType', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                >
                    <option value="exact">Точное совпадение</option>
                    <option value="contains">Содержит</option>
                    <option value="startsWith">Начинается с</option>
                    <option value="regex">Регулярное выражение</option>
                </select>
             </div>
           </>
        )}

        {node.type === 'action-message' && (
           <>
             <div className="mb-4">
                <label className="block text-gray-400 text-xs uppercase font-bold mb-2">Тип сообщения</label>
                <select
                    value={config.messageType || 'text'}
                    onChange={e => handleChange('messageType', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                >
                    <option value="text">Текст</option>
                    <option value="photo">Фото</option>
                    <option value="video">Видео</option>
                    <option value="document">Документ</option>
                    <option value="audio">Аудио</option>
                    <option value="voice">Голосовое сообщение</option>
                    <option value="animation">Анимация (GIF)</option>
                </select>
             </div>

             {(config.messageType === 'text' || config.messageType === undefined) && (
               <div className="mb-4">
                  <label className="block text-gray-400 text-xs uppercase font-bold mb-2">Текст сообщения</label>
                  <textarea 
                      value={config.text || ''} 
                      onChange={e => handleChange('text', e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white h-32 resize-none focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="Введите текст сообщения..."
                      maxLength={4096}
                  />
                  <p className="text-gray-500 text-xs mt-1">
                    {(config.text || '').length}/4096 символов
                  </p>
               </div>
             )}

             {config.messageType && config.messageType !== 'text' && (
               <>
                 <div className="mb-4">
                    <label className="block text-gray-400 text-xs uppercase font-bold mb-2">
                      {config.messageType === 'photo' ? 'Фото' : 
                       config.messageType === 'video' ? 'Видео' :
                       config.messageType === 'document' ? 'Документ' :
                       config.messageType === 'audio' ? 'Аудио' :
                       config.messageType === 'voice' ? 'Голосовое сообщение' :
                       'Анимация'}
                    </label>
                    <FileUploader
                      botId={botIds[0] || ''}
                      onFileSelect={(fileId, fileUrl) => {
                        handleChange('mediaFile', fileId);
                        if (fileUrl !== undefined) {
                          handleChange('mediaPreviewUrl', fileUrl);
                        }
                      }}
                      currentFileId={config.mediaFile as string | undefined}
                      currentPreviewUrl={config.mediaPreviewUrl as string | undefined}
                      accept={
                        config.messageType === 'photo' ? 'image/*' :
                        config.messageType === 'video' ? 'video/*' :
                        config.messageType === 'document' ? '*' :
                        config.messageType === 'audio' ? 'audio/*' :
                        config.messageType === 'voice' ? 'audio/ogg,audio/mpeg' :
                        'image/gif,video/mp4'
                      }
                    />
                 </div>

                 {(config.messageType === 'photo' || 
                   config.messageType === 'video' || 
                   config.messageType === 'document' || 
                   config.messageType === 'audio' || 
                   config.messageType === 'animation') && (
                   <div className="mb-4">
                      <label className="block text-gray-400 text-xs uppercase font-bold mb-2">Подпись (caption)</label>
                      <textarea 
                          value={config.text || ''} 
                          onChange={e => handleChange('text', e.target.value)}
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white h-24 resize-none focus:outline-none focus:border-blue-500 transition-colors"
                          placeholder="Введите подпись к медиа..."
                          maxLength={1024}
                      />
                      <p className="text-gray-500 text-xs mt-1">
                        {(config.text || '').length}/1024 символа
                      </p>
                   </div>
                 )}
               </>
             )}

             <div className="mb-4 border-t border-gray-700 pt-4">
                <InlineButtonsEditor
                  buttons={config.buttons || []}
                  onChange={(buttons) => handleChange('buttons', buttons)}
                />
             </div>
           </>
        )}

        {node.type === 'action-delay' && (
           <div className="mb-4">
              <label className="block text-gray-400 text-xs uppercase font-bold mb-2">Задержка (мс)</label>
              <input 
                  type="number" 
                  value={config.delay || 1000} 
                  onChange={e => handleChange('delay', parseInt(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  step={100}
                  min={0}
              />
              <p className="text-gray-500 text-xs mt-1">1000 мс = 1 секунда</p>
           </div>
        )}
      </div>
      
    </div>
  );
};
