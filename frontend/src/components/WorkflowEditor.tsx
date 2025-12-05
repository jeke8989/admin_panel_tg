import { useCallback, useRef, useState, useMemo, useEffect } from 'react';
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
import type { BotWorkflow, Bot } from '../types';
import { updateWorkflow, getBots, activateWorkflow, deactivateWorkflow } from '../utils/api';
import { useToast } from './ToastProvider';

import { NodeSettingsPanel } from './NodeSettingsPanel';
import { TriggerNode } from './workflow-nodes/TriggerNode';
import { ActionNode } from './workflow-nodes/ActionNode';
import { ConditionNode } from './workflow-nodes/ConditionNode';

interface WorkflowEditorProps {
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

export const WorkflowEditor = ({ workflow, onClose }: WorkflowEditorProps) => {
  if (!workflow) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-900 text-gray-500">
        <p>Сценарий не загружен</p>
      </div>
    );
  }

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBotIds, setSelectedBotIds] = useState<string[]>((workflow as any).botIds || [workflow.botId].filter(Boolean));
  const [workflowName, setWorkflowName] = useState(workflow.name || 'Новый сценарий');
  const [isActive, setIsActive] = useState(workflow.isActive || false);
  const [isToggling, setIsToggling] = useState(false);
  
  useEffect(() => {
    loadBots();
  }, []);

  const loadBots = async () => {
    try {
      const botsList = await getBots();
      setBots(botsList);
    } catch (error) {
      console.error('Error loading bots:', error);
    }
  };
  
  // Convert workflow data to ReactFlow format
  const initialNodes: Node[] = useMemo(() => {
    if (!workflow || !workflow.nodes) return [];
    return workflow.nodes.map(n => ({
      id: n.id || `node_${Math.random()}`,
      type: n.type || 'action-message',
      position: n.position || { x: 0, y: 0 },
      data: { ...(n.config || {}), label: n.config?.label || n.type || 'node' },
    }));
  }, [workflow]);

  const initialEdges: Edge[] = useMemo(() => {
    if (!workflow || !workflow.connections) return [];
    return workflow.connections.map(c => ({
      id: c.id || `edge_${Math.random()}`,
      source: c.sourceNodeId || '',
      target: c.targetNodeId || '',
      sourceHandle: c.sourceHandle || null,
      targetHandle: c.targetHandle || null,
      markerEnd: { type: MarkerType.ArrowClosed },
    }));
  }, [workflow]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Обновляем nodes и edges когда workflow меняется
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Синхронизируем isActive с workflow
  useEffect(() => {
    setIsActive(workflow.isActive || false);
  }, [workflow.isActive]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges],
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
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

  const handleToggleActive = async () => {
    setIsToggling(true);
    try {
      if (isActive) {
        await deactivateWorkflow(workflow.id);
        setIsActive(false);
      } else {
        await activateWorkflow(workflow.id);
        setIsActive(true);
      }
    } catch (error) {
      console.error('Error toggling workflow status:', error);
      showToast('Ошибка при изменении статуса сценария', 'error');
    } finally {
      setIsToggling(false);
    }
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

      await updateWorkflow(workflow.id, {
        name: workflowName,
        description: workflow.description || '',
        botIds: selectedBotIds,
        nodes: workflowNodes as any,
        connections: workflowConnections as any,
      });
      
      showToast('Сценарий сохранен', 'success');
    } catch (error) {
      console.error('Error saving workflow:', error);
      showToast('Ошибка при сохранении', 'error');
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
    <div className="h-full w-full bg-gray-900 flex flex-col">
      {/* Кастомные стили для Controls ReactFlow */}
      <style>{`
        .react-flow__controls {
          background: rgba(31, 41, 55, 0.95) !important;
          border: 1px solid rgba(75, 85, 99, 0.8) !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3) !important;
        }
        .react-flow__controls-button {
          background: rgba(55, 65, 81, 0.9) !important;
          border-bottom: 1px solid rgba(75, 85, 99, 0.5) !important;
          color: #ffffff !important;
          fill: #ffffff !important;
          stroke: #ffffff !important;
        }
        .react-flow__controls-button:hover {
          background: rgba(75, 85, 99, 0.95) !important;
          color: #60a5fa !important;
          fill: #60a5fa !important;
          stroke: #60a5fa !important;
        }
        .react-flow__controls-button:active {
          background: rgba(96, 165, 250, 0.2) !important;
        }
        .react-flow__controls-button svg {
          fill: #ffffff !important;
          stroke: #ffffff !important;
        }
        .react-flow__controls-button:hover svg {
          fill: #60a5fa !important;
          stroke: #60a5fa !important;
        }
      `}</style>
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="px-6 py-3">
          {/* Верхняя строка: название и кнопки */}
          <div className="flex justify-between items-center mb-3">
            <div className="flex-1 min-w-0 mr-6">
              <input
                type="text"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className="text-white font-semibold text-xl bg-transparent border-b border-transparent focus:border-blue-500 outline-none pb-1 w-full placeholder-gray-500"
                placeholder="Название сценария"
              />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Тоггл активности */}
              <div className="flex items-center gap-2 bg-gray-700/60 rounded-lg px-3 py-1.5">
                <span className={`text-xs font-medium ${isActive ? 'text-green-400' : 'text-gray-400'}`}>
                  {isActive ? 'Активен' : 'Неактивен'}
                </span>
                <button
                  onClick={handleToggleActive}
                  disabled={isToggling}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-gray-800 ${
                    isActive ? 'bg-green-600' : 'bg-gray-600'
                  } ${isToggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      isActive ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button
                onClick={onClose}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg transition-colors text-sm font-medium"
              >
                Закрыть
              </button>
            </div>
          </div>
          
          {/* Выбор ботов */}
          <div>
            <label className="text-gray-400 text-xs font-medium mb-1.5 block">Боты, к которым применяется сценарий:</label>
            <div className="flex flex-wrap gap-1.5">
              {bots.map((bot) => (
                <label
                  key={bot.id}
                  className={`px-3 py-1 rounded-md text-xs cursor-pointer transition-all duration-200 font-medium ${
                    selectedBotIds.includes(bot.id)
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedBotIds.includes(bot.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedBotIds([...selectedBotIds, bot.id]);
                      } else {
                        setSelectedBotIds(selectedBotIds.filter(id => id !== bot.id));
                      }
                    }}
                    className="hidden"
                  />
                  @{bot.username || bot.firstName || 'Unknown'}
                </label>
              ))}
            </div>
            {bots.length === 0 && (
              <p className="text-gray-500 text-xs mt-1">Нет доступных ботов</p>
            )}
          </div>
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
              <Controls showInteractive={false} />
            </ReactFlow>
          </ReactFlowProvider>
          
          {/* Settings Panel Overlay */}
          {selectedNode && (
            <NodeSettingsPanel 
                node={selectedNode}
                botIds={selectedBotIds}
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
