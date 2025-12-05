import { useEffect, useState } from 'react';
import Lottie from 'lottie-react';
import pako from 'pako';

interface TgsStickerProps {
  fileUrl: string;
  className?: string;
}

export const TgsSticker = ({ fileUrl, className = 'max-w-[150px]' }: TgsStickerProps) => {
  const [animationData, setAnimationData] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadTgsSticker = async () => {
      try {
        // Используем прокси для обхода CORS
        const proxyUrl = `http://localhost:3000/chats/proxy-telegram-file?url=${encodeURIComponent(fileUrl)}`;
        
        // Загружаем .tgs файл (это gzip-сжатый JSON)
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Failed to load sticker');

        // Получаем ArrayBuffer
        const arrayBuffer = await response.arrayBuffer();
        
        // Разархивируем gzip
        const decompressed = pako.inflate(new Uint8Array(arrayBuffer), { to: 'string' });
        
        // Парсим JSON
        const lottieData = JSON.parse(decompressed);
        
        setAnimationData(lottieData);
      } catch (err) {
        console.error('Error loading TGS sticker:', err);
        setError(true);
      }
    };

    loadTgsSticker();
  }, [fileUrl]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center bg-gray-600 rounded-lg p-4 w-[150px] h-[150px]">
        <span className="text-4xl mb-2">🎭</span>
        <span className="text-xs text-gray-400">Стикер</span>
      </div>
    );
  }

  if (!animationData) {
    return (
      <div className="flex items-center justify-center w-[150px] h-[150px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Lottie
        animationData={animationData}
        loop={true}
        autoplay={true}
        style={{ width: '150px', height: '150px' }}
      />
    </div>
  );
};

