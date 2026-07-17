'use client';

import { useMemo } from 'react';
import ReactFlow, {
    Background,
    Controls,
    Edge,
    Node,
    Position,
    useNodesState,
    useEdgesState,
    MarkerType,
    Handle,
    NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';

// ── Brutalist Base Node ──────────────────────────────────────────────────────
const BaseNodeWrapper = ({ children, status, isConnectable, dashed }: any) => (
    <div className={`px-4 py-3 bg-black border ${dashed ? 'border-dashed' : ''} ${
        status === 'healthy'  ? 'border-emerald-500 text-emerald-500' :
        status === 'degraded' ? 'border-yellow-500 text-yellow-500'  :
        status === 'down'     ? 'border-red-500 text-red-500'  :
                                'border-white/50 text-white'
    } min-w-40 font-mono`}>
        <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="opacity-0 w-0 h-0" />
        {children}
        <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="opacity-0 w-0 h-0" />
    </div>
);

// ── Standard agent node (Aika, TCA, CMA, IA) ─────────────────────────────────
const AgentNode = ({ data, isConnectable }: NodeProps) => (
    <BaseNodeWrapper status={data.status} isConnectable={isConnectable}>
        <div className="flex flex-col gap-1 mb-1">
            <div className="text-xs font-bold uppercase tracking-widest">{data.label}</div>
            <div className="text-[10px] uppercase tracking-wider opacity-70">
                STATUS:{data.statusLabel ?? data.status ?? 'UNKNOWN'}
            </div>
        </div>
        {data.metrics && (
            <div className="pt-2 mt-2 border-t border-current/30 flex justify-between items-center">
                <span className="text-[10px] uppercase tracking-wider">SRATE</span>
                <span className="text-xs font-bold">{data.metrics.successRate}%</span>
            </div>
        )}
    </BaseNodeWrapper>
);

// ── Parallel crisis "fan-out" node (TCA ∥ CMA) ───────────────────────────────
const ParallelCrisisNode = ({ data, isConnectable }: NodeProps) => (
    <div className="px-5 py-4 border border-red-500 bg-black text-red-500 min-w-56 font-mono">
        <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="opacity-0 w-0 h-0" />
        <div className="flex flex-col gap-1 mb-3">
            <div className="text-xs font-bold uppercase tracking-widest">PARALLEL CRISIS</div>
            <div className="text-[10px] uppercase tracking-wider opacity-70">asyncio.gather</div>
        </div>
        <div className="flex gap-2">
            <div className="flex-1 border border-yellow-500 text-yellow-500 px-3 py-2 text-center uppercase text-[10px]">
                <div className="font-bold mb-1">TCA</div>
                <div>CBT Plan</div>
            </div>
            <div className="flex-1 border border-red-500 text-red-500 px-3 py-2 text-center uppercase text-[10px]">
                <div className="font-bold mb-1">CMA</div>
                <div>Escalate</div>
            </div>
        </div>
        <div className="mt-2 text-[9px] text-center tracking-wide uppercase opacity-70">
            LATENCY:max(TCA, CMA)
        </div>
        <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="opacity-0 w-0 h-0" />
    </div>
);

// ── Synthesize node ───────────────────────────────────────────────────────────
const SynthesizeNode = ({ data, isConnectable }: NodeProps) => (
    <div className="px-4 py-3 border border-white/50 bg-black min-w-40 text-center font-mono">
        <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="opacity-0 w-0 h-0" />
        <div className="text-xs font-bold text-white uppercase tracking-widest">SYNTHESIZE</div>
        <div className="text-[9px] text-white/50 uppercase tracking-wider mt-1">FINAL RESPONSE</div>
        <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="opacity-0 w-0 h-0" />
    </div>
);

// ── END terminal node ─────────────────────────────────────────────────────────
const EndNode = ({ isConnectable }: NodeProps) => (
    <div className="px-6 py-2 border border-white/30 bg-black text-center font-mono">
        <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="opacity-0 w-0 h-0" />
        <div className="text-xs font-bold text-white uppercase tracking-widest">END</div>
    </div>
);

// ── Background STA node (fire-and-forget) ────────────────────────────────────
const BackgroundNode = ({ data, isConnectable }: NodeProps) => (
    <div className="px-4 py-3 border border-dashed border-white/30 bg-black min-w-44 font-mono">
        <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="opacity-0 w-0 h-0" id="target-left" />
        <div className="flex flex-col gap-1 mb-1">
            <div className="text-xs font-bold text-white uppercase tracking-widest">{data.label}</div>
            <div className="text-[10px] uppercase tracking-wider text-white/50">BACKGROUND TASK</div>
        </div>
        <div className="text-[9px] text-white/40 leading-relaxed uppercase">
            PHQ-9 · GAD-7 · DASS-21<br />POST-CONVERSATION
        </div>
    </div>
);

// ── User node ─────────────────────────────────────────────────────────────────
const UserNode = ({ data, isConnectable }: NodeProps) => (
    <div className="px-6 py-3 border border-white text-white bg-black text-center font-mono">
        <div className="text-xs font-bold uppercase tracking-widest">USER</div>
        <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="opacity-0 w-0 h-0" />
    </div>
);

const nodeTypes = {
    agent:          AgentNode,
    user:           UserNode,
    parallelCrisis: ParallelCrisisNode,
    synthesize:     SynthesizeNode,
    endNode:        EndNode,
    background:     BackgroundNode,
};

interface AgenticArchitectureGraphProps {
    onNodeClick: (nodeId: string) => void;
    healthData: any;
}

export function AgenticArchitectureGraph({ onNodeClick, healthData }: AgenticArchitectureGraphProps) {
    const getGraphData = (graphName: string) => {
        const graph = healthData?.graphs?.find(
            (g: any) => g?.graph_name && g.graph_name.toLowerCase() === graphName.toLowerCase()
        );
        return {
            status: graph?.status ?? 'unknown',
            metrics: graph ? { successRate: (graph.success_rate * 100).toFixed(1) } : null,
        };
    };

    const initialNodes: Node[] = [
        { id: 'user', type: 'user', position: { x: 370, y: 0 }, data: { label: 'User' } },
        { id: 'aika', type: 'agent', position: { x: 340, y: 110 }, data: { label: 'AIKA', statusLabel: 'ORCHESTRATOR', ...getGraphData('orchestrator') } },
        { id: 'tca', type: 'agent', position: { x: 60, y: 300 }, data: { label: 'TCA', statusLabel: 'MODERATE', ...getGraphData('tca') } },
        { id: 'parallel_crisis', type: 'parallelCrisis', position: { x: 290, y: 280 }, data: {} },
        { id: 'ia', type: 'agent', position: { x: 620, y: 300 }, data: { label: 'IA (ANALYTICS)', statusLabel: 'DATA', ...getGraphData('ia') } },
        { id: 'synthesize', type: 'synthesize', position: { x: 340, y: 470 }, data: {} },
        { id: 'end', type: 'endNode', position: { x: 372, y: 570 }, data: {} },
        { id: 'sta_bg', type: 'background', position: { x: 650, y: 440 }, data: { label: 'STA PROCESS', ...getGraphData('sta') } },
    ];

    const createBrutalistEdge = (id: string, source: string, target: string, color: string, label: string, dashed = false) => ({
        id, source, target,
        type: 'step',
        animated: !dashed,
        label,
        labelStyle: { fill: color, fontSize: 10, fontFamily: 'monospace', fontWeight: 600, letterSpacing: '0.05em' },
        labelBgStyle: { fill: '#000', stroke: color, strokeWidth: 1 },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 0,
        style: { stroke: color, strokeWidth: 1, strokeDasharray: dashed ? '4,4' : undefined },
        markerEnd: { type: MarkerType.ArrowClosed, color },
    });

    const initialEdges: Edge[] = [
        createBrutalistEdge('e-u-a', 'user', 'aika', '#fff', 'INPUT'),
        createBrutalistEdge('e-a-t', 'aika', 'tca', '#eab308', 'MODERATE'),
        createBrutalistEdge('e-a-p', 'aika', 'parallel_crisis', '#ef4444', 'CRITICAL'),
        createBrutalistEdge('e-a-i', 'aika', 'ia', '#a855f7', 'ANALYTICS'),
        createBrutalistEdge('e-a-e', 'aika', 'end', '#fff', 'DIRECT', true),
        createBrutalistEdge('e-t-s', 'tca', 'synthesize', '#fff', 'OUTPUT'),
        createBrutalistEdge('e-p-s', 'parallel_crisis', 'synthesize', '#fff', 'MERGE'),
        createBrutalistEdge('e-i-s', 'ia', 'synthesize', '#fff', 'OUTPUT'),
        createBrutalistEdge('e-s-e', 'synthesize', 'end', '#fff', 'DONE'),
        { ...createBrutalistEdge('e-a-b', 'aika', 'sta_bg', '#fff', 'ASYNC', true), targetHandle: 'target-left' },
    ];

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    useMemo(() => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.type !== 'agent') return node;
                const graphName = node.id === 'aika' ? 'orchestrator' : node.id === 'sta_bg' ? 'sta' : node.id;
                return { ...node, data: { ...node.data, ...getGraphData(graphName) } };
            })
        );
    }, [healthData]);

    return (
        <div className="h-[680px] w-full bg-black border border-white/20 overflow-hidden relative font-mono">
            {/* Legend */}
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 bg-black border border-white/20 p-3">
                <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1 border-b border-white/20 pb-1">Topology Legend</div>
                {[
                    { color: '#fff', label: 'STANDARD FLOW' },
                    { color: '#eab308', label: 'MODERATE (TCA)' },
                    { color: '#ef4444', label: 'CRITICAL (TCA||CMA)' },
                    { color: '#a855f7', label: 'ANALYTICS (IA)' },
                    { color: '#fff', dash: true, label: 'ASYNC / DIRECT' },
                ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                        <svg width="24" height="8">
                            <line x1="0" y1="4" x2="24" y2="4" stroke={item.color} strokeWidth="1" strokeDasharray={item.dash ? '4,4' : undefined} />
                        </svg>
                        <span className="text-[9px] text-white uppercase">{item.label}</span>
                    </div>
                ))}
            </div>

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={(_, node) => onNodeClick(node.id)}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                attributionPosition="bottom-right"
                className="bg-black"
                minZoom={0.5}
                maxZoom={1.5}
            >
                <Background color="#333" gap={20} size={1} />
                <Controls className="!bg-black !border-[0.5px] !border-white/20 [&>button]:!border-b-[0.5px] [&>button]:!border-white/20 [&>button]:!fill-white hover:[&>button]:!bg-white/10" />
            </ReactFlow>
        </div>
    );
}
