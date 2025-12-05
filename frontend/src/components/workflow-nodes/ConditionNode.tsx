import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

export const ConditionNode = ({ data }: NodeProps) => {
  return (
    <div className="bg-gray-800 border-2 border-yellow-500 rounded-lg p-3 min-w-[150px] shadow-lg">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-yellow-500 border-2 border-gray-800" />
      <div className="text-yellow-500 font-bold text-xs mb-1 uppercase tracking-wider">Condition</div>
      <div className="text-white text-sm font-medium">{data.label}</div>
      
      <div className="flex justify-between mt-4 relative h-2">
        <div className="absolute left-[25%] -translate-x-1/2 -top-3">
             <span className="text-[10px] text-green-400">True</span>
        </div>
        <Handle 
            type="source" 
            position={Position.Bottom} 
            id="true" 
            className="w-3 h-3 bg-green-500 border-2 border-gray-800 !left-[25%]" 
        />
        
        <div className="absolute left-[75%] -translate-x-1/2 -top-3">
             <span className="text-[10px] text-red-400">False</span>
        </div>
        <Handle 
            type="source" 
            position={Position.Bottom} 
            id="false" 
            className="w-3 h-3 bg-red-500 border-2 border-gray-800 !left-[75%]" 
        />
      </div>
    </div>
  );
};

