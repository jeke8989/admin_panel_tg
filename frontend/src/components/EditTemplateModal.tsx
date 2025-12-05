import { useState, useRef, useEffect, type FormEvent } from 'react';
import type { Template, TemplateFile } from '../types';
import { deleteTemplateFile, getTemplateFileUrl } from '../utils/api';

interface EditTemplateModalProps {
  isOpen: boolean;
  template: Template | null;
  onClose: () => void;
  onConfirm: (id: string, name?: string, text?: string | null, files?: File[]) => Promise<void>;
  isLoading: boolean;
}

export const EditTemplateModal = ({ isOpen, template, onClose, onConfirm, isLoading }: EditTemplateModalProps) => {
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [existingFiles, setExistingFiles] = useState<TemplateFile[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setText(template.text || '');
      setExistingFiles(template.files || []);
      setNewFiles([]);
    }
  }, [template]);

  if (!isOpen || !template) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      await onConfirm(template.id, name, text || null, newFiles);
      setNewFiles([]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setNewFiles(prev => [...prev, ...Array.from(e.target.files as FileList)]);
    }
  };

  const handleRemoveNewFile = (index: number) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteExistingFile = async (fileId: string) => {
    try {
      setDeletingFileId(fileId);
      await deleteTemplateFile(template.id, fileId);
      setExistingFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Ошибка при удалении файла');
    } finally {
      setDeletingFileId(null);
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return (
        <img
          src={URL.createObjectURL(file)}
          alt={file.name}
          className="w-full h-full object-cover"
        />
      );
    }
    
    return (
      <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
        <path d="M14 2v6h6" />
      </svg>
    );
  };

  const getExistingFileIcon = (file: TemplateFile) => {
    if (file.fileType.startsWith('image/')) {
      return (
        <img
          src={getTemplateFileUrl(template.id, file.id)}
          alt={file.fileName}
          className="w-full h-full object-cover"
        />
      );
    }
    
    return (
      <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
        <path d="M14 2v6h6" />
      </svg>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-semibold text-white mb-4">Редактировать шаблон</h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="templateName" className="block text-gray-300 text-sm font-medium mb-2">
              Название шаблона*
            </label>
            <input
              type="text"
              id="templateName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Введите название"
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="templateText" className="block text-gray-300 text-sm font-medium mb-2">
              Текст шаблона
            </label>
            <textarea
              id="templateText"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-y"
              placeholder="Введите текст (опционально)"
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Существующие файлы
            </label>
            {existingFiles.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                {existingFiles.map((file) => (
                  <div key={file.id} className="relative bg-gray-700 rounded-lg p-2">
                    <button
                      type="button"
                      onClick={() => handleDeleteExistingFile(file.id)}
                      disabled={deletingFileId === file.id}
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 flex items-center justify-center bg-gray-600 rounded overflow-hidden">
                        {getExistingFileIcon(file)}
                      </div>
                      <span className="text-xs text-gray-300 truncate w-full text-center">
                        {file.fileName}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm mb-3">Нет файлов</p>
            )}

            <label className="block text-gray-300 text-sm font-medium mb-2">
              Добавить новые файлы
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              multiple
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors border-2 border-dashed border-gray-600 hover:border-blue-500"
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Выбрать файлы</span>
              </div>
            </button>

            {newFiles.length > 0 && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {newFiles.map((file, index) => (
                  <div key={index} className="relative bg-gray-700 rounded-lg p-2">
                    <button
                      type="button"
                      onClick={() => handleRemoveNewFile(index)}
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 flex items-center justify-center bg-gray-600 rounded overflow-hidden">
                        {getFileIcon(file)}
                      </div>
                      <span className="text-xs text-gray-300 truncate w-full text-center">
                        {file.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

