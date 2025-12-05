import { useState, useRef, useCallback, useEffect } from 'react';

interface FileUploaderProps {
  botId?: string; // Теперь необязательный - файлы загружаются на сервер
  onFileSelect: (fileId: string, fileUrl?: string | null) => void;
  currentFileId?: string | null;
  currentPreviewUrl?: string | null;
  accept?: string;
  maxSizeMB?: number;
}

export const FileUploader = ({ 
  // botId не используется - файлы загружаются на сервер и работают для всех ботов
  onFileSelect, 
  currentFileId,
  currentPreviewUrl,
  accept = '*/*',
  maxSizeMB = 50 
}: FileUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(currentFileId || null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Проверяем, является ли файл изображением по расширению
  const isImageFile = (url: string | null | undefined): boolean => {
    if (!url) return false;
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const lowerUrl = url.toLowerCase();
    return imageExtensions.some(ext => lowerUrl.includes(ext));
  };

  // Загружаем превью для уже сохраненного файла
  useEffect(() => {
    // Если есть currentPreviewUrl (полный URL)
    if (currentPreviewUrl) {
      if (isImageFile(currentPreviewUrl)) {
        // Для изображений показываем превью
        setPreview(currentPreviewUrl);
      } else {
        // Для документов не показываем превью изображения
        setPreview(null);
      }
      // Извлекаем путь из URL для uploadedFileUrl
      const uploadsMatch = currentPreviewUrl.match(/\/uploads\/[^?#]+/);
      if (uploadsMatch) {
        setUploadedFileUrl(uploadsMatch[0]);
      } else {
        setUploadedFileUrl(currentFileId || currentPreviewUrl);
      }
      return;
    }

    if (currentFileId) {
      setUploadedFileUrl(currentFileId);
      // Если currentFileId - это URL изображения, используем его как превью
      if ((currentFileId.startsWith('/') || currentFileId.startsWith('http')) && isImageFile(currentFileId)) {
        const fullUrl = currentFileId.startsWith('http') 
          ? currentFileId 
          : `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000'}${currentFileId}`;
        setPreview(fullUrl);
      } else {
        // Не изображение - не показываем превью
        setPreview(null);
      }
    } else {
      // Нет файла
      setUploadedFileUrl(null);
      setPreview(null);
    }
  }, [currentFileId, currentPreviewUrl]);

  const handleFile = useCallback(async (file: File) => {
    console.log('[FileUploader] Starting file upload:', { fileName: file.name, fileSize: file.size });
    
    if (file.size > maxSizeMB * 1024 * 1024) {
      const errorMsg = `Файл слишком большой. Максимальный размер: ${maxSizeMB} МБ`;
      setError(errorMsg);
      console.error('[FileUploader] File too large:', file.size);
      return;
    }
    
    setError(null);
    setIsUploading(true);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }

    // Upload file to server (not Telegram) - works for all bots
    try {
      console.log('[FileUploader] Uploading file to server...');
      const { uploadFileToServer } = await import('../utils/api');
      const data = await uploadFileToServer(file);
      console.log('[FileUploader] Upload successful:', { url: data.url, filename: data.filename });
      
      // Формируем полный URL для отображения
      const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';
      const fullUrl = `${baseUrl}${data.url}`;
      
      setUploadedFileUrl(data.url);
      if (file.type.startsWith('image/')) {
        setPreview(fullUrl);
      }
      // Передаём URL файла (работает для всех ботов)
      onFileSelect(data.url, fullUrl);
      setError(null);
    } catch (err) {
      console.error('[FileUploader] Upload error details:', err);
      const errorMessage = err instanceof Error 
        ? err.message 
        : (err as { response?: { data?: { message?: string }; status?: number } })?.response?.data?.message 
        || (err as { response?: { status?: number } })?.response?.status === 401
        ? 'Ошибка авторизации. Проверьте, что вы вошли в систему.'
        : 'Ошибка при загрузке файла';
      setError(errorMessage);
      setPreview(null);
    } finally {
      setIsUploading(false);
    }
  }, [onFileSelect, maxSizeMB]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleRemove = useCallback(() => {
    setPreview(null);
    setUploadedFileUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onFileSelect('');
  }, [onFileSelect]);

  return (
    <div className="space-y-2">
      <div
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${isDragging 
            ? 'border-blue-500 bg-blue-500/10' 
            : 'border-gray-600 hover:border-gray-500'
          }
          ${preview || uploadedFileUrl ? 'bg-gray-700/50' : 'bg-gray-800'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {preview ? (
          <div className="relative">
            <img 
              src={preview} 
              alt="Preview" 
              className="max-h-48 mx-auto rounded-lg object-contain cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            />
            <button
              onClick={handleRemove}
              className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 transition-colors"
              type="button"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : uploadedFileUrl ? (
          <div className="relative flex flex-col items-center justify-center h-32 text-gray-400 text-sm cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            {/* Иконка документа */}
            <svg className="w-12 h-12 mb-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="mb-1 text-green-400">✓ Файл загружен</span>
            <span className="text-xs text-gray-500">{uploadedFileUrl.split('/').pop()}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 transition-colors"
              type="button"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : isUploading ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm">
            <svg className="animate-spin w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Загрузка...</span>
          </div>
        ) : (
          <>
            <svg 
              className="w-12 h-12 mx-auto text-gray-400 mb-3" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-gray-400 text-sm mb-2">
              Перетащите файл сюда или
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-blue-500 hover:text-blue-400 text-sm font-medium"
            >
              выберите файл
            </button>
            <p className="text-gray-500 text-xs mt-2">
              Максимальный размер: {maxSizeMB} МБ
            </p>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileInput}
        className="hidden"
      />

      {error && (
        <p className="text-red-400 text-xs">{error}</p>
      )}

      {uploadedFileUrl && !error && (
        <p className="text-green-400 text-xs">
          ✓ Файл загружен и готов к использованию для всех ботов
        </p>
      )}
    </div>
  );
};

