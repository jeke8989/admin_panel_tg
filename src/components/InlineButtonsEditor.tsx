import { useState, useEffect } from 'react';

export interface InlineButton {
  text: string;
  callback_data?: string;
}

interface InlineButtonsEditorProps {
  buttons: InlineButton[][];
  onChange: (buttons: InlineButton[][]) => void;
}

export const InlineButtonsEditor = ({ buttons, onChange }: InlineButtonsEditorProps) => {
  const [localButtons, setLocalButtons] = useState<InlineButton[][]>(buttons || []);

  useEffect(() => {
    setLocalButtons(buttons || []);
  }, [buttons]);

  const updateButtons = (newButtons: InlineButton[][]) => {
    setLocalButtons(newButtons);
    onChange(newButtons);
  };

  const addRow = () => {
    updateButtons([...localButtons, [{ text: '', callback_data: '' }]]);
  };

  const removeRow = (rowIndex: number) => {
    updateButtons(localButtons.filter((_, i) => i !== rowIndex));
  };

  const addButton = (rowIndex: number) => {
    const newButtons = [...localButtons];
    newButtons[rowIndex] = [...newButtons[rowIndex], { text: '', callback_data: '' }];
    updateButtons(newButtons);
  };

  const removeButton = (rowIndex: number, buttonIndex: number) => {
    const newButtons = [...localButtons];
    newButtons[rowIndex] = newButtons[rowIndex].filter((_, i) => i !== buttonIndex);
    if (newButtons[rowIndex].length === 0) {
      removeRow(rowIndex);
    } else {
      updateButtons(newButtons);
    }
  };

  const updateButton = (rowIndex: number, buttonIndex: number, field: 'text' | 'callback_data', value: string) => {
    const newButtons = [...localButtons];
    newButtons[rowIndex][buttonIndex] = {
      ...newButtons[rowIndex][buttonIndex],
      [field]: value,
    };
    updateButtons(newButtons);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h5 className="text-white font-medium text-sm">Inline кнопки</h5>
        <button
          type="button"
          onClick={addRow}
          className="text-blue-500 hover:text-blue-400 text-xs font-medium flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Добавить ряд
        </button>
      </div>

      {localButtons.length === 0 ? (
        <div className="text-center py-4 text-gray-500 text-sm">
          Нет кнопок. Нажмите "Добавить ряд" для создания.
        </div>
      ) : (
        <div className="space-y-3">
          {localButtons.map((row, rowIndex) => (
            <div key={rowIndex} className="bg-gray-700 rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400 text-xs">Ряд {rowIndex + 1}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => addButton(rowIndex)}
                    className="text-blue-500 hover:text-blue-400 text-xs flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Кнопка
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRow(rowIndex)}
                    className="text-red-500 hover:text-red-400 text-xs"
                  >
                    Удалить ряд
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {row.map((button, buttonIndex) => (
                  <div key={buttonIndex} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={button.text}
                        onChange={(e) => updateButton(rowIndex, buttonIndex, 'text', e.target.value)}
                        placeholder="Текст кнопки"
                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      />
                      <input
                        type="text"
                        value={button.callback_data || ''}
                        onChange={(e) => updateButton(rowIndex, buttonIndex, 'callback_data', e.target.value)}
                        placeholder="Callback data (опционально)"
                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-gray-400 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                    {row.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeButton(rowIndex, buttonIndex)}
                        className="text-red-500 hover:text-red-400 p-2 mt-1"
                        title="Удалить кнопку"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-gray-500 text-xs">
        Текст кнопки обязателен. Callback data будет автоматически сгенерирован из текста, если не указан.
      </p>
    </div>
  );
};

