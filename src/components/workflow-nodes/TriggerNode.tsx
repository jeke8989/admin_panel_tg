import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

export const TriggerNode = ({ data, type }: NodeProps) => {
  const getDisplayName = () => {
    if (type === 'trigger-command') return 'Command';
    if (type === 'trigger-text') return 'Text';
    if (type === 'trigger-callback') return 'Callback';
    return type.replace('trigger-', '');
  };

  return (
    <div className="bg-gray-800 border-2 border-blue-500 rounded-lg p-3 min-w-[150px] shadow-lg">
      <div className="text-blue-400 font-bold text-xs mb-1 uppercase tracking-wider">{getDisplayName()} Trigger</div>
      <div className="text-white text-sm font-medium">{data.label}</div>
      {data.command && <div className="text-gray-400 text-xs mt-1">/{data.command}</div>}
      {data.text && <div className="text-gray-400 text-xs mt-1">"{data.text}"</div>}
      {(data.callbackData || data.data) && (
        <div className="text-gray-400 text-xs mt-1">
          callback: {data.callbackData || data.data}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-500 border-2 border-gray-800" />
    </div>
  );
};

