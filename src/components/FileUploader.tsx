import { useState, useRef, useCallback, useEffect } from 'react';

interface FileUploaderProps {
  botId: string;
  onFileSelect: (fileId: string, fileUrl?: string | null) => void;
  currentFileId?: string | null;
  currentPreviewUrl?: string | null;
  accept?: string;
  maxSizeMB?: number;
}

export const FileUploader = ({ 
  botId,
  onFileSelect, 
  currentFileId,
  currentPreviewUrl,
  accept = '*/*',
  maxSizeMB = 50 
}: FileUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(currentFileId || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Загружаем превью для уже сохраненного файла
  useEffect(() => {
    let isMounted = true;

    const loadPreview = async () => {
      if (currentPreviewUrl) {
        setPreview(currentPreviewUrl);
        setUploadedFileId(currentFileId || null);
        return;
      }

      if (!currentFileId) return;

      try {
        const { getWorkflowFileUrl } = await import('../utils/api');
        const url = await getWorkflowFileUrl(botId, currentFileId);
        setUploadedFileId(currentFileId);
        if (url) {
          setPreview(url);
        }
      } catch (e) {
        console.error('Error loading preview for existing file', e);
        setUploadedFileId(currentFileId);
      }
    };

    if (isMounted) {
      loadPreview();
    }

    return () => {
      isMounted = false;
    };
  }, [botId, currentFileId, currentPreviewUrl]);

  const handleFile = useCallback(async (file: File) => {
    console.log('[FileUploader] Starting file upload:', { botId, fileName: file.name, fileSize: file.size });
    
    if (!botId) {
      setError('Бот не выбран');
      console.error('[FileUploader] Bot ID is missing');
      return;
    }
    
    if (file.size > maxSizeMB * 1024 * 1024) {
      const errorMsg = `Файл слишком большой. Максимальный размер: ${maxSizeMB} МБ`;
      setError(errorMsg);
      console.error('[FileUploader] File too large:', file.size);
      return;
    }
    
    setError(null);

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

    // Upload file to Telegram
    try {
      console.log('[FileUploader] Calling uploadWorkflowFile API...');
      const { uploadWorkflowFile } = await import('../utils/api');
      const data = await uploadWorkflowFile(botId, file);
      console.log('[FileUploader] Upload successful:', { fileId: data.fileId, fileType: data.fileType });
      
      setUploadedFileId(data.fileId);
      if (data.fileUrl && file.type.startsWith('image/')) {
        setPreview(data.fileUrl);
      }
      onFileSelect(data.fileId, data.fileUrl);
      setError(null);
    } catch (err) {
      console.error('[FileUploader] Upload error details:', err);
      const errorMessage = err instanceof Error 
        ? err.message 
        : (err as { response?: { data?: { message?: string }; status?: number } })?.response?.data?.message 
        || (err as { response?: { status?: number } })?.response?.status === 401
        ? 'Ошибка авторизации. Проверьте, что вы вошли в систему.'
        : 'Ошибка при загрузке файла в Telegram';
      setError(errorMessage);
      setPreview(null);
    }
  }, [onFileSelect, maxSizeMB, botId]);

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
    setUploadedFileId(null);
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
          ${preview || uploadedFileId ? 'bg-gray-700/50' : 'bg-gray-800'}
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
        ) : uploadedFileId ? (
          <div className="relative flex flex-col items-center justify-center h-32 text-gray-400 text-sm cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <span className="mb-1">Файл загружен в Telegram</span>
            <span className="text-xs mb-2">ID: {uploadedFileId.substring(0, 20)}...</span>
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

      {uploadedFileId && !error && (
        <p className="text-gray-400 text-xs">
          Файл загружен в Telegram (ID: {uploadedFileId.substring(0, 20)}...). Нажмите на изображение, чтобы удалить.
        </p>
      )}
    </div>
  );
};

