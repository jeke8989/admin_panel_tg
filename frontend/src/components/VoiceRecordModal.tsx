import { useState, useEffect, useRef } from 'react';

interface VoiceRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingComplete: (audioFile: File) => void;
}

export const VoiceRecordModal = ({ isOpen, onClose, onRecordingComplete }: VoiceRecordModalProps) => {
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isCancelledRef = useRef<boolean>(false);

  const cleanup = () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaRecorderRef.current?.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const startRecording = async () => {
    try {
      isCancelledRef.current = false; // Сбрасываем флаг отмены
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Настройка анализатора звука для визуализации
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      // Функция для обновления уровня звука
      const updateAudioLevel = () => {
        if (analyserRef.current && !isCancelledRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 255);
          animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
        }
      };
      updateAudioLevel();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Проверяем, не была ли запись отменена
        if (!isCancelledRef.current && audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg; codecs=opus' });
          const audioFile = new File([audioBlob], 'voice.ogg', { type: 'audio/ogg' });
          onRecordingComplete(audioFile);
        }
        // Очищаем ресурсы
        cleanup();
        // Закрываем модал
        onClose();
      };

      mediaRecorder.start();
      setRecordingTime(0);
      
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Ошибка при доступе к микрофону:', error);
      alert('Не удалось получить доступ к микрофону');
      cleanup();
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      void startRecording();
    }
    return () => {
      // Очищаем только при размонтировании компонента
      if (!isOpen) {
        cleanup();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleCancel = () => {
    isCancelledRef.current = true; // Устанавливаем флаг отмены
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <h3 className="text-xl font-semibold text-white mb-6 text-center">
          Запись голосового сообщения
        </h3>
        
        {/* Визуализация записи */}
        <div className="flex items-center justify-center mb-8 h-32">
          <div className="flex items-center gap-1">
            {[...Array(20)].map((_, i) => {
              const delay = i * 0.05;
              const height = 20 + audioLevel * 100 * (1 - Math.abs(i - 10) / 10);
              return (
                <div
                  key={i}
                  className="w-1 bg-blue-500 rounded-full transition-all duration-100"
                  style={{
                    height: `${height}px`,
                    animationDelay: `${delay}s`,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Таймер */}
        <div className="text-center mb-8">
          <div className="text-4xl font-bold text-white mb-2">
            {formatTime(recordingTime)}
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-gray-400 text-sm">Идет запись...</span>
          </div>
        </div>

        {/* Кнопки управления */}
        <div className="flex gap-4">
          <button
            onClick={handleCancel}
            className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
          >
            Отменить
          </button>
          <button
            onClick={stopRecording}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <rect x="6" y="6" width="8" height="8" rx="1" />
            </svg>
            Завершить
          </button>
        </div>

        {/* Подсказка */}
        <p className="text-gray-500 text-xs text-center mt-4">
          Нажмите "Завершить", чтобы сохранить запись
        </p>
      </div>
    </div>
  );
};

