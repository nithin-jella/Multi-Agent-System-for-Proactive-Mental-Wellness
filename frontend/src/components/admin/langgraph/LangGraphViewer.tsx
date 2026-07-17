'use client';

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Edge as FlowEdge,
  MiniMap,
  Node as FlowNode,
  NodeProps,
  Panel,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './LangGraphViewer.css'; // added external stylesheet

import { apiCall } from '@/utils/adminApi';

interface ExecutionState {
  node_id: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
  started_at?: string;
  completed_at?: string;
  execution_time_ms?: number;
  error_message?: string;
  metrics?: Record<string, unknown>;
}

interface EdgeExecutionState {
  edge_id: string;
  triggered: boolean;
  evaluation_result?: boolean;
}

interface ApiNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
  execution_state?: ExecutionState;
}

interface ApiEdge {
  source: string;
  target: string;
  data?: Record<string, unknown> | null;
  edge_type?: 'normal' | 'conditional';
  condition?: string;
  execution_state?: EdgeExecutionState;
}

interface GraphExecutionState {
  graph_id: string;
  execution_id: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  current_node?: string;
}

interface GraphState {
  nodes: ApiNode[];
  edges: ApiEdge[];
  execution_state?: GraphExecutionState;
  performance_metrics?: Record<string, Record<string, number>>;
}

type AgentNodeData = {
  label: string;
  agent: string;
  agentId: string;
  description?: string;
  executionState?: ExecutionState;
};

const agentPalette: Record<string, string> = {
  orchestrator: '#FF6B6B',
  sta: '#FFCA40',
  tca: '#A855F7',
  cma: '#34D399',
  ia: '#38BDF8',
};

const agentDisplayOrder = ['orchestrator', 'sta', 'tca', 'cma', 'ia'];
// Improved spacing for better visual organization
const columnWidth = 280; // Increased from 220
const agentOffset = 680; // Increased from 520  
const rowHeight = 200; // Increased from 170

const AgentNode = ({ data }: NodeProps<AgentNodeData>) => {
  const executionState = data.executionState;
  const isRunning = executionState?.status === 'running';
  const hasFailed = executionState?.status === 'failed';
  const isCompleted = executionState?.status === 'completed';
  
  // Enhanced styling with better visual hierarchy
  const nodeClasses = `
    relative rounded-2xl border-2 transition-all duration-300 ease-in-out
    ${isRunning ? 'border-orange-400 bg-orange-50/10 shadow-orange-400/20' : 
      hasFailed ? 'border-red-400 bg-red-50/10 shadow-red-400/20' :
      isCompleted ? 'border-green-400 bg-green-50/10 shadow-green-400/20' :
      'border-white/30 bg-slate-900/90'} 
    shadow-xl backdrop-blur-md hover:shadow-2xl hover:scale-105
    px-5 py-4 text-left min-w-[240px] max-w-[280px]
  `.trim().replace(/\s+/g, ' ');

  return (
    <div className={nodeClasses}>
      {/* Status indicator dot */}
      <div className="absolute top-3 right-3 w-3 h-3 rounded-full flex items-center justify-center">
        {isRunning && <div className="w-full h-full bg-orange-400 rounded-full animate-pulse" />}
        {hasFailed && <div className="w-full h-full bg-red-400 rounded-full" />}
        {isCompleted && <div className="w-full h-full bg-green-400 rounded-full" />}
      </div>
      
      {/* Agent type badge */}
      <div
        // agent-color is controlled via external CSS classes (agent-{agentId})
        className={`inline-block px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest mb-2 agent-badge agent-${data.agentId}`}
      >
        {data.agent}
      </div>
      
      {/* Node label */}
      <h3 className="text-base font-bold text-white mb-1 leading-tight">
        {data.label}
      </h3>
      
      {/* Description */}
      {data.description && (
        <p className="text-xs text-gray-300 leading-relaxed line-clamp-3">
          {data.description}
        </p>
      )}
      
      {/* Execution info */}
      {executionState && (
        <div className="mt-3 pt-2 border-t border-white/10">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">
              {executionState.execution_time_ms ? 
                `${executionState.execution_time_ms}ms` : 
                executionState.status
              }
            </span>
            {executionState.error_message && (
              <span className="text-red-400 text-[10px] truncate max-w-[100px]" 
                    title={executionState.error_message}>
                Error
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const nodeTypes = { agent: AgentNode };

const LangGraphViewer = () => {
  const [graphState, setGraphState] = useState<GraphState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<ApiNode | null>(null);
  const [realTimeUpdates, setRealTimeUpdates] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchGraphState = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Use enhanced endpoint for execution state and metrics
      const data = await apiCall<GraphState>('/api/v1/admin/agents-config/enhanced');
      setGraphState(data);
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Unable to load agent configuration.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    if (!realTimeUpdates || wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsRef.current = new WebSocket(`${protocol}//${window.location.host}/api/v1/admin/agents-config/ws`);
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connection established');
      };

      wsRef.current.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          // Handle different message types from the WebSocket
          if (message.event && message.data) {
            // This is an execution state update
            console.log('Received execution update:', message.event);
            // Only refresh on specific events that affect the graph structure
            if (message.event === 'graph_structure_changed' || message.event === 'nodes_updated') {
              fetchGraphState();
            }
            // For execution state updates, we could update individual nodes without full refresh
            // but for now, we'll avoid constant refreshing
          } else if (message.nodes && message.edges) {
            // This is a full graph state update
            setGraphState(message as GraphState);
          } else {
            console.log('Received WebSocket message:', message);
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err, 'Raw data:', event.data);
        }
      };

      wsRef.current.onclose = (event: CloseEvent) => {
        console.log(`WebSocket connection closed: ${event.code} - ${event.reason}`);
        // Reconnect after 5 seconds if real-time updates are still enabled
        if (realTimeUpdates) {
          setTimeout(connectWebSocket, 5000);
        }
      };

      wsRef.current.onerror = (error: Event) => {
        console.error('WebSocket error occurred:', {
          type: error.type,
          target: error.target,
          timeStamp: error.timeStamp
        });
      };
    } catch (err) {
      console.error('Failed to connect WebSocket:', err);
    }
  }, [realTimeUpdates, fetchGraphState]);

  // Initial load effect - runs once on mount
  useEffect(() => {
    fetchGraphState();
  }, [fetchGraphState]);

  // WebSocket connection effect - only manages WebSocket, no polling
  useEffect(() => {
    if (realTimeUpdates) {
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [realTimeUpdates, connectWebSocket]);

  const apiNodeMap = useMemo(() => {
    const map = new Map<string, ApiNode>();
    graphState?.nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [graphState]);

  const agentOrder = useMemo(() => {
    if (!graphState) return agentDisplayOrder;

    const discovered = Array.from(
      new Set(graphState.nodes.map((node) => (node.data?.agentId as string) ?? 'agent')),
    );

    return [...discovered].sort((a, b) => {
      const preferredIndexA = agentDisplayOrder.indexOf(a);
      const preferredIndexB = agentDisplayOrder.indexOf(b);
      if (preferredIndexA !== -1 && preferredIndexB !== -1) {
        return preferredIndexA - preferredIndexB;
      }
      if (preferredIndexA !== -1) return -1;
      if (preferredIndexB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [graphState]);

  const sortedNodes = useMemo(() => {
    if (!graphState) return [];
    const laneIndex = (agentId: string) => {
      const idx = agentOrder.indexOf(agentId);
      return idx === -1 ? agentOrder.length : idx;
    };

    return [...graphState.nodes].sort((a, b) => {
      const agentA = (a.data?.agentId as string) ?? 'agent';
      const agentB = (b.data?.agentId as string) ?? 'agent';
      const agentDiff = laneIndex(agentA) - laneIndex(agentB);
      if (agentDiff !== 0) return agentDiff;

      const columnA = Number(a.data?.column ?? 0);
      const columnB = Number(b.data?.column ?? 0);
      if (columnA !== columnB) return columnA - columnB;

      const rowA = Number(a.data?.row ?? 0);
      const rowB = Number(b.data?.row ?? 0);
      return rowA - rowB;
    });
  }, [graphState, agentOrder]);

  const reactFlowNodes: FlowNode<AgentNodeData>[] = useMemo(() => {
    if (!graphState) return [];

    const laneIndex = (agentId: string) => {
      const idx = agentOrder.indexOf(agentId);
      return idx === -1 ? agentOrder.length : idx;
    };

    // Enhanced positioning with better vertical distribution
    const nodesByAgent = new Map<string, typeof sortedNodes>();
    sortedNodes.forEach(node => {
      const agentId: string = (node.data?.agentId as string) ?? 'agent';
      if (!nodesByAgent.has(agentId)) {
        nodesByAgent.set(agentId, []);
      }
      nodesByAgent.get(agentId)!.push(node);
    });

    return sortedNodes.map((node) => {
      const agentId: string = (node.data?.agentId as string) ?? 'agent';
      const column = Number(node.data?.column ?? 0);
      const row = Number(node.data?.row ?? 0);
      
      // Enhanced positioning calculation with better spacing
      const baseX = laneIndex(agentId) * agentOffset;
      const baseY = 100; // Add top margin
      
      // Stagger nodes vertically within the same agent lane to reduce clustering
      const agentNodes = nodesByAgent.get(agentId) || [];
      const nodeIndexInAgent = agentNodes.indexOf(node);
      const verticalOffset = nodeIndexInAgent * 50; // Add slight vertical stagger
      
      const position = {
        x: baseX + column * columnWidth + (column > 0 ? 50 : 0), // Extra spacing for subsequent columns
        y: baseY + row * rowHeight + verticalOffset,
      };

      const executionState = node.execution_state;

      return {
        id: node.id,
        position,
        type: 'agent',
        data: {
          label: (node.data?.label as string) ?? node.id,
          agent: (node.data?.agent as string) ?? agentId,
          agentId,
          description: node.data?.description as string,
          executionState,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        // Remove inline styles to let the AgentNode component handle all styling
        style: {},
      } satisfies FlowNode<AgentNodeData>;
    });
  }, [sortedNodes, agentOrder, graphState]);

  const agentLegend = useMemo(() => {
    const seen = new Map<string, string>();
    sortedNodes.forEach((node) => {
      const agentId: string = (node.data?.agentId as string) ?? 'agent';
      if (!seen.has(agentId)) {
        seen.set(agentId, (node.data?.agent as string) ?? agentId);
      }
    });
    return agentOrder
      .filter((agentId) => seen.has(agentId))
      .map((agentId) => ({
        id: agentId,
        label: seen.get(agentId) ?? agentId,
      }));
  }, [sortedNodes, agentOrder]);

  const reactFlowEdges: FlowEdge[] = useMemo(() => {
    if (!graphState) return [];

    const laneIndex = (agentId: string) => {
      const idx = agentOrder.indexOf(agentId);
      return idx === -1 ? agentOrder.length : idx;
    };

    return [...graphState.edges]
      .sort((a, b) => {
        const sourceA = apiNodeMap.get(a.source);
        const sourceB = apiNodeMap.get(b.source);
        const agentA = (sourceA?.data?.agentId as string) ?? (a.data?.agentId as string) ?? 'agent';
        const agentB = (sourceB?.data?.agentId as string) ?? (b.data?.agentId as string) ?? 'agent';
        const agentDiff = laneIndex(agentA) - laneIndex(agentB);
        if (agentDiff !== 0) return agentDiff;
        return a.source.localeCompare(b.source);
      })
      .map((edge) => {
        const agentId =
          (edge.data?.agentId as string) ?? (apiNodeMap.get(edge.source)?.data?.agentId as string) ?? 'agent';
        
        const isConditional = edge.edge_type === 'conditional' || edge.condition;
        const executionState = edge.execution_state;
        const wasTriggered = executionState?.triggered;
        
        // Use CSS classes for edge color / style. Classes are defined in LangGraphViewer.css.
        return {
          id: `${edge.source}->${edge.target}`,
          source: edge.source,
          target: edge.target,
          type: 'smoothstep',
          animated: wasTriggered,
          className: `lang-edge agent-${agentId} ${wasTriggered ? 'lang-edge-triggered' : isConditional ? 'lang-edge-conditional' : ''}`,
          label: (edge.data?.label as string) || (edge.condition ? `${edge.condition}` : undefined),
          labelStyle: {
            fontSize: '12px',
            color: '#cbd5e1',
            background: 'transparent',
            pointerEvents: 'auto',
          },
        } satisfies FlowEdge;
      });
  }, [graphState, apiNodeMap, agentOrder]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: FlowNode) => {
      const original = apiNodeMap.get(node.id) ?? null;
      setSelectedNode(original);
    },
    [apiNodeMap],
  );

  if (isLoading) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-xl border border-white/10 bg-white/5">
        <div className="animate-pulse text-sm text-gray-300">Loading agent graph...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-6 text-sm text-red-200">
        {error}
      </div>
    );
  }

  if (!graphState) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-gray-300">
        No LangGraph configuration available yet.
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div className="mb-4 flex flex-wrap items-center gap-3">
  {agentLegend.map(({ id, label }) => (
          <div key={id} className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full legend-dot agent-${id}`} />
            <span className="text-xs font-medium uppercase tracking-wide text-gray-300">
              {label}
            </span>
          </div>
        ))}
        <button
          onClick={fetchGraphState}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg bg-blue-500/20 px-3 py-1.5 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-500/30 disabled:opacity-50"
        >
          <svg className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
        <button
          onClick={() => setRealTimeUpdates(!realTimeUpdates)}
          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            realTimeUpdates
              ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
              : 'bg-white/10 text-gray-300 hover:bg-white/20'
          }`}
        >
          <div className={`h-2 w-2 rounded-full ${realTimeUpdates ? 'bg-green-400' : 'bg-gray-400'}`} />
          {realTimeUpdates ? 'Live Updates' : 'Manual Mode'}
        </button>
      </div>

      <div className="h-[700px] overflow-hidden rounded-xl border border-white/15 bg-slate-950/60">
        <ReactFlow
          nodes={reactFlowNodes}
          edges={reactFlowEdges}
          nodeTypes={nodeTypes}
          fitView
          defaultViewport={{ x: 0, y: 0, zoom: 0.75 }}
          onNodeClick={handleNodeClick}
          onPaneClick={() => setSelectedNode(null)}
          proOptions={{ hideAttribution: true }}
          fitViewOptions={{ 
            padding: 0.3,
            minZoom: 0.5,
            maxZoom: 1.5,
            includeHiddenNodes: false
          }}
          minZoom={0.4}
          maxZoom={2}
          panOnDrag={true}
          zoomOnScroll={true}
          zoomOnDoubleClick={true}
          selectNodesOnDrag={false}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
        >
          <Background 
            color="rgba(255,255,255,0.05)" 
            gap={32} 
            size={1}
          />
          <MiniMap 
            pannable 
            zoomable 
            maskColor="rgba(2,6,23,0.9)" 
            nodeColor={(node) => {
              const agentId = node.data?.agentId as string;
              return agentPalette[agentId] ?? '#FFCA40';
            }}
            nodeStrokeWidth={2}
            nodeBorderRadius={8}
            className="langgraph-minimap"
          />
          <Controls />

          {selectedNode && (
            <Panel
              position="top-right"
              className="max-h-[500px] w-80 max-w-[320px] overflow-y-auto rounded-xl border border-white/15 bg-slate-900/85 p-4 text-xs text-gray-200 shadow-xl"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">
                    {(selectedNode.data?.agent as string) ?? 'Agent'}
                  </p>
                  <h3 className="text-lg font-semibold text-white">
                    {(selectedNode.data?.label as string) ?? selectedNode.id}
                  </h3>
                </div>
                <button
                  className="text-[11px] text-gray-400 transition hover:text-gray-100"
                  onClick={() => setSelectedNode(null)}
                  type="button"
                >
                  Close
                </button>
              </div>
              {(() => {
                const description = selectedNode.data?.description;
                return description && typeof description === 'string' ? (
                  <p className="mt-2 text-gray-300">
                    {description}
                  </p>
                ) : null;
              })()}
              <div className="mt-3 rounded-lg bg-white/5 p-3 text-[11px] text-gray-200">
                <pre className="whitespace-pre-wrap break-words">
                  {JSON.stringify(selectedNode.data, null, 2)}
                </pre>
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>
    </div>
  );
};

export default LangGraphViewer;
