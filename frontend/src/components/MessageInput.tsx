import { useState, useRef, useImperativeHandle, forwardRef, type FormEvent } from 'react';
import { VoiceRecordModal } from './VoiceRecordModal';
import { ReplyPreview } from './ReplyPreview';
import type { Template, Message } from '../types';
import { getTemplateFileUrl } from '../utils/api';

interface MessageInputProps {
  onSendMessage: (text: string, files?: File[], replyToMessageId?: string) => void;
  replyToMessage?: Message | null;
  onCancelReply?: () => void;
}

export interface MessageInputRef {
  insertTemplate: (template: Template) => Promise<void>;
}

export const MessageInput = forwardRef<MessageInputRef, MessageInputProps>(({ onSendMessage, replyToMessage, onCancelReply }, ref) => {
  const [message, setMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Expose insertTemplate method to parent components
  useImperativeHandle(ref, () => ({
    insertTemplate: async (template: Template) => {
      // Insert template text
      if (template.text) {
        setMessage(template.text);
      }

      // Download and add template files
      if (template.files && template.files.length > 0) {
        const downloadedFiles: File[] = [];
        
        for (const templateFile of template.files) {
          try {
            const fileUrl = getTemplateFileUrl(template.id, templateFile.id);
            const response = await fetch(fileUrl);
            const blob = await response.blob();
            const file = new File([blob], templateFile.fileName, {
              type: templateFile.fileType,
            });
            downloadedFiles.push(file);
          } catch (error) {
            console.error('Error downloading template file:', error);
          }
        }

        if (downloadedFiles.length > 0) {
          setSelectedFiles(prev => [...prev, ...downloadedFiles]);
        }
      }
    },
  }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() || selectedFiles.length > 0) {
      onSendMessage(
        message.trim(), 
        selectedFiles.length > 0 ? selectedFiles : undefined,
        replyToMessage?.id
      );
      setMessage('');
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      // Очищаем reply после отправки
      if (onCancelReply) {
        onCancelReply();
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleStartRecording = () => {
    setIsRecordModalOpen(true);
  };

  const handleRecordingComplete = (audioFile: File) => {
    setSelectedFiles(prev => [...prev, audioFile]);
  };

  const getFilesPreview = () => {
    if (selectedFiles.length === 0) return null;

    return (
      <div className="mb-2 space-y-2 max-h-48 overflow-y-auto">
        {selectedFiles.map((file, index) => {
          const isImage = file.type.startsWith('image/');
          const isAudio = file.type.startsWith('audio/');
          const isVideo = file.type.startsWith('video/');

          return (
            <div key={index} className="p-2 bg-gray-700 rounded-lg flex items-center gap-2">
              {isImage && (
                <img
                  src={URL.createObjectURL(file)}
                  alt="Preview"
                  className="w-12 h-12 object-cover rounded"
                />
              )}
              {isVideo && (
                <video
                  src={URL.createObjectURL(file)}
                  className="w-12 h-12 object-cover rounded"
                />
              )}
              {isAudio && (
                <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
              )}
              {!isImage && !isVideo && !isAudio && (
                <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6z" clipRule="evenodd" />
                </svg>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{file.name}</p>
                <p className="text-xs text-gray-400">
                  {file.size > 1024 * 1024 
                    ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
                    : `${(file.size / 1024).toFixed(1)} KB`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveFile(index)}
                className="p-1 text-red-400 hover:text-red-300 flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="border-t border-gray-700 bg-gray-800 overflow-hidden flex-shrink-0" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      {replyToMessage && onCancelReply && (
        <div style={{ width: '100%', maxWidth: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
          <ReplyPreview message={replyToMessage} onCancel={onCancelReply} />
        </div>
      )}
      <div className="p-4">
        {getFilesPreview()}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          multiple
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip,.rar,.7z,.xls,.xlsx,.ppt,.pptx,.csv,.json,.xml"
        />
        <button
          type="button"
          onClick={handleFileButtonClick}
          className="p-2 text-gray-400 hover:text-white transition-colors"
          title="Прикрепить файлы"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
            />
          </svg>
        </button>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Сообщение..."
          className="flex-1 bg-gray-700 text-white placeholder-gray-400 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={handleStartRecording}
          className="p-2 text-gray-400 hover:text-white transition-colors"
          title="Записать голосовое"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        </button>
        <button
          type="submit"
          disabled={!message.trim() && selectedFiles.length === 0}
          className="p-2 text-blue-500 hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Отправить"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
        </form>

        {/* Модальное окно записи голосового */}
        <VoiceRecordModal
          isOpen={isRecordModalOpen}
          onClose={() => setIsRecordModalOpen(false)}
          onRecordingComplete={handleRecordingComplete}
        />
      </div>
    </div>
  );
});

