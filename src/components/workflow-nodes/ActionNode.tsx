import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

export const ActionNode = ({ data, type }: NodeProps) => {
  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 min-w-[150px] shadow-lg">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-gray-400 border-2 border-gray-800" />
      <div className="text-gray-400 font-bold text-xs mb-1 uppercase tracking-wider">{type.replace('action-', '')}</div>
      <div className="text-white text-sm font-medium">{data.label}</div>
      {data.text && <div className="text-gray-400 text-xs mt-1 truncate max-w-[140px]">{data.text}</div>}
      {data.delay && <div className="text-gray-400 text-xs mt-1">{data.delay}ms</div>}
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-gray-400 border-2 border-gray-800" />
    </div>
  );
};

