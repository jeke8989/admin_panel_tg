import { useCallback, useRef, useState, useMemo } from 'react';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
  MarkerType,
} from 'reactflow';
import type { Connection, Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import type { BotWorkflow, WorkflowNode, WorkflowConnection } from '../types';
import { updateWorkflow } from '../utils/api';

import { NodeSettingsPanel } from './NodeSettingsPanel';
import { TriggerNode } from './workflow-nodes/TriggerNode';
import { ActionNode } from './workflow-nodes/ActionNode';
import { ConditionNode } from './workflow-nodes/ConditionNode';

interface WorkflowEditorProps {
  botId: string;
  workflow: BotWorkflow;
  onClose: () => void;
}

const nodeTypes = {
  'trigger-command': TriggerNode,
  'trigger-text': TriggerNode,
  'trigger-callback': TriggerNode,
  'action-message': ActionNode,
  'action-delay': ActionNode,
  'condition-if': ConditionNode,
};

export const WorkflowEditor = ({ botId, workflow, onClose }: WorkflowEditorProps) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  
  // Convert workflow data to ReactFlow format
  const initialNodes: Node[] = (workflow.nodes || []).map(n => ({
    id: n.id || `node_${Math.random()}`,
    type: n.type,
    position: n.position,
    data: { ...n.config, label: n.config?.label || n.type },
  }));

  const initialEdges: Edge[] = (workflow.connections || []).map(c => ({
    id: c.id,
    source: c.sourceNodeId,
    target: c.targetNodeId,
    sourceHandle: c.sourceHandle,
    targetHandle: c.targetHandle,
    markerEnd: { type: MarkerType.ArrowClosed },
  }));

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges],
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleNodeChange = (nodeId: string, data: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data };
        }
        return node;
      })
    );
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter(
      (edge) => edge.source !== nodeId && edge.target !== nodeId
    ));
    setSelectedNode(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Map ReactFlow nodes/edges back to our format
      const workflowNodes = nodes.map(n => ({
        id: n.id,
        type: n.type as any,
        position: n.position,
        config: n.data,
      }));

      const workflowConnections = edges.map(e => ({
        sourceNodeId: e.source,
        targetNodeId: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      }));

      await updateWorkflow(botId, workflow.id, {
        nodes: workflowNodes as any,
        connections: workflowConnections as any,
      });
      
      alert('Сценарий сохранен');
    } catch (error) {
      console.error('Error saving workflow:', error);
      alert('Ошибка при сохранении');
    } finally {
      setIsSaving(false);
    }
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = reactFlowWrapper.current!.getBoundingClientRect();
      const clientX = event.clientX - position.left;
      const clientY = event.clientY - position.top;

      const newNode: Node = {
        id: `node_${Date.now()}`,
        type,
        position: { x: clientX, y: clientY },
        data: { label: `${type.split('-')[1] || type} node` },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes],
  );

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 p-4 border-b border-gray-700 flex justify-between items-center">
        <div>
           <h2 className="text-white font-bold text-lg">{workflow.name}</h2>
           <p className="text-gray-400 text-sm">Визуальный редактор</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            onClick={onClose}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <div className="w-64 bg-gray-800 border-r border-gray-700 p-4 overflow-y-auto">
          <h3 className="text-white font-medium mb-4">Инструменты</h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="text-gray-400 text-xs uppercase font-bold mb-2">Триггеры</h4>
              <div 
                className="bg-gray-700 p-2 rounded cursor-grab mb-2 text-white text-sm hover:bg-gray-600 border border-gray-600 hover:border-blue-500 transition-colors"
                onDragStart={(event) => event.dataTransfer.setData('application/reactflow', 'trigger-command')}
                draggable
              >
                Команда
              </div>
              <div 
                className="bg-gray-700 p-2 rounded cursor-grab mb-2 text-white text-sm hover:bg-gray-600 border border-gray-600 hover:border-blue-500 transition-colors"
                onDragStart={(event) => event.dataTransfer.setData('application/reactflow', 'trigger-text')}
                draggable
              >
                Текст
              </div>
              <div 
                className="bg-gray-700 p-2 rounded cursor-grab mb-2 text-white text-sm hover:bg-gray-600 border border-gray-600 hover:border-blue-500 transition-colors"
                onDragStart={(event) => event.dataTransfer.setData('application/reactflow', 'trigger-callback')}
                draggable
              >
                Callback (кнопка)
              </div>
            </div>

            <div>
              <h4 className="text-gray-400 text-xs uppercase font-bold mb-2">Действия</h4>
              <div 
                className="bg-gray-700 p-2 rounded cursor-grab mb-2 text-white text-sm hover:bg-gray-600 border border-gray-600 hover:border-blue-500 transition-colors"
                onDragStart={(event) => event.dataTransfer.setData('application/reactflow', 'action-message')}
                draggable
              >
                Сообщение
              </div>
              <div 
                className="bg-gray-700 p-2 rounded cursor-grab mb-2 text-white text-sm hover:bg-gray-600 border border-gray-600 hover:border-blue-500 transition-colors"
                onDragStart={(event) => event.dataTransfer.setData('application/reactflow', 'action-delay')}
                draggable
              >
                Задержка
              </div>
            </div>
            
            <div>
              <h4 className="text-gray-400 text-xs uppercase font-bold mb-2">Условия</h4>
              <div 
                className="bg-gray-700 p-2 rounded cursor-grab mb-2 text-white text-sm hover:bg-gray-600 border border-gray-600 hover:border-blue-500 transition-colors"
                onDragStart={(event) => event.dataTransfer.setData('application/reactflow', 'condition-if')}
                draggable
              >
                If / Else
              </div>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onDragOver={onDragOver}
              onDrop={onDrop}
              nodeTypes={nodeTypes}
              fitView
              attributionPosition="bottom-right"
              className="bg-gray-900"
            >
              <Background color="#374151" gap={16} size={1} />
              <Controls className="bg-gray-800 border-gray-700 text-white fill-white" />
            </ReactFlow>
          </ReactFlowProvider>
          
          {/* Settings Panel Overlay */}
          {selectedNode && (
            <NodeSettingsPanel 
                node={selectedNode}
                botId={botId}
                onChange={handleNodeChange} 
                onClose={() => setSelectedNode(null)}
                onDelete={handleDeleteNode}
            />
          )}
        </div>
      </div>
    </div>
  );
};
