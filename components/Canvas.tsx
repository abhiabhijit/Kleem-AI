
import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  Node, 
  Edge,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  useReactFlow,
  OnSelectionChangeParams,
  useStoreApi,
  addEdge,
  Connection
} from 'reactflow';
import { StartNode } from './nodes/StartNode';
import { CurriculumNode } from './nodes/CurriculumNode';
import { StudyNode } from './nodes/StudyNode';
import { LiveNode } from './nodes/LiveNode';
import { CodeNode } from './nodes/CodeNode';
import { MediaNode } from './nodes/MediaNode';
import { QuizNode } from './nodes/QuizNode';
import { SlideNode } from './nodes/SlideNode';
import { generateExamPlan, generateCurriculum, interpretAgentCommand } from '../services/geminiService';
import { Course, CourseModule, Session, Attachment } from '../types';

const nodeTypes = {
  start: StartNode,
  curriculum: CurriculumNode,
  study: StudyNode,
  live: LiveNode,
  code: CodeNode,
  media: MediaNode,
  quiz: QuizNode,
  slides: SlideNode
};

const INITIAL_NODES: Node[] = [
    { 
        id: 'start', 
        type: 'start', 
        position: { x: 0, y: 0 }, 
        data: {},
        style: { width: 480 } // Hint for initial layout
    }
];

// Context Menu Component for "Prompt from Connectors"
const NodeMenu = ({ x, y, onSelect, onPrompt, onClose }: { x: number, y: number, onSelect: (type: string) => void, onPrompt: (txt: string) => void, onClose: () => void }) => {
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);

    const handlePrompt = () => {
        if(!input.trim()) return;
        setIsThinking(true);
        onPrompt(input);
        // We don't close immediately to show some feedback or let the parent handle close
    };

    return (
        <div 
            className="absolute z-50 bg-white rounded-xl shadow-hard border-2 border-black overflow-hidden flex flex-col w-64 animate-in fade-in zoom-in duration-200 origin-top-left"
            style={{ top: y, left: x }}
        >
            <div className="bg-black text-white text-xs font-bold uppercase tracking-wider p-2 text-center flex justify-between items-center">
                <span>Create Node</span>
                <button onClick={onClose}><span className="material-symbols-outlined text-sm">close</span></button>
            </div>
            
            <div className="p-2 border-b border-gray-100 bg-gray-50">
                <div className="flex gap-1 relative">
                    <input 
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handlePrompt()}
                        className="w-full text-sm p-2 pr-8 border border-gray-300 rounded outline-none focus:border-black transition-colors text-black bg-white placeholder-gray-500 font-medium" 
                        placeholder="Ask AI for next step..."
                        disabled={isThinking}
                        autoFocus
                    />
                    <button onClick={handlePrompt} className="absolute right-1 top-1 p-1 text-gray-400 hover:text-black" disabled={isThinking}>
                         {isThinking ? <span className="block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span> : <span className="material-symbols-outlined text-sm">arrow_upward</span>}
                    </button>
                </div>
            </div>

            <button onClick={() => onSelect('study')} className="px-4 py-3 text-left text-sm font-bold hover:bg-yellow-50 hover:text-black transition-colors flex items-center gap-2 text-black">
                <span className="material-symbols-outlined text-base">menu_book</span> Lesson
            </button>
            <button onClick={() => onSelect('quiz')} className="px-4 py-3 text-left text-sm font-bold hover:bg-yellow-50 hover:text-black transition-colors flex items-center gap-2 text-black">
                <span className="material-symbols-outlined text-base">quiz</span> Quiz
            </button>
            <button onClick={() => onSelect('slides')} className="px-4 py-3 text-left text-sm font-bold hover:bg-yellow-50 hover:text-black transition-colors flex items-center gap-2 text-black">
                <span className="material-symbols-outlined text-base">slideshow</span> Slides
            </button>
            <button onClick={() => onSelect('code')} className="px-4 py-3 text-left text-sm font-bold hover:bg-yellow-50 hover:text-black transition-colors flex items-center gap-2 text-black">
                <span className="material-symbols-outlined text-base">code</span> Code Practice
            </button>
        </div>
    );
};

export const CanvasContent: React.FC = () => {
    const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    
    // History for Undo/Redo
    const [past, setPast] = useState<{nodes: Node[], edges: Edge[]}[]>([]);
    const [future, setFuture] = useState<{nodes: Node[], edges: Edge[]}[]>([]);
    
    // Navigation & Command State
    const [focusedNodeId, setFocusedNodeId] = useState<string | null>('start');
    const [commandInput, setCommandInput] = useState('');
    const [isProcessingCommand, setIsProcessingCommand] = useState(false);
    
    // Context Menu State
    const [menuState, setMenuState] = useState<{ visible: boolean; x: number; y: number; sourceNodeId: string | null; sourceHandle: string | null }>({ visible: false, x: 0, y: 0, sourceNodeId: null, sourceHandle: null });
    
    // Refs for connection tracking
    const connectStartParams = useRef<{ nodeId: string | null; handleId: string | null }>({ nodeId: null, handleId: null });

    const { fitView, getNodes, getEdges, getNode, screenToFlowPosition, deleteElements } = useReactFlow();

    // Force fit view on mount to ensure start node is visible
    useEffect(() => {
        const timer = setTimeout(() => {
            fitView({ padding: 0.2, duration: 800 });
        }, 100);
        return () => clearTimeout(timer);
    }, [fitView]);

    // Undo/Redo Logic
    const takeSnapshot = () => {
        setPast(prev => [...prev.slice(-9), { nodes, edges }]); // Keep last 10
        setFuture([]);
    };

    const undo = () => {
        if (past.length === 0) return;
        const previous = past[past.length - 1];
        const newPast = past.slice(0, past.length - 1);
        setPast(newPast);
        setFuture(prev => [{ nodes, edges }, ...prev]);
        setNodes(previous.nodes);
        setEdges(previous.edges);
    };

    const redo = () => {
        if (future.length === 0) return;
        const next = future[0];
        const newFuture = future.slice(1);
        setFuture(newFuture);
        setPast(prev => [...prev, { nodes, edges }]);
        setNodes(next.nodes);
        setEdges(next.edges);
    };

    // Wrapper for state changes to support history
    const pushHistory = useCallback(() => {
        takeSnapshot();
    }, [nodes, edges]);

    useEffect(() => {
        try {
            const stored = localStorage.getItem('kleem_sessions');
            if (stored) {
                setSessions(JSON.parse(stored));
            }
        } catch(e) {
            console.warn("Could not load sessions from localStorage", e);
        }
    }, []);

    const saveSession = (topic: string, course: Course) => {
        const newSession: Session = { id: Date.now().toString(), topic, createdAt: Date.now(), course };
        const updated = [newSession, ...sessions];
        setSessions(updated);
        try {
            localStorage.setItem('kleem_sessions', JSON.stringify(updated));
        } catch(e) { console.warn("Failed to save session", e); }
    };

    const handleClearHistory = () => {
        if (confirm("Are you sure you want to clear your study history?")) {
            setSessions([]);
            try {
                localStorage.removeItem('kleem_sessions');
            } catch(e) {}
        }
    };

    // --- Node Navigation ---
    const handleNavigate = useCallback((nodeId: string, direction: 'prev' | 'next') => {
        const nodes = getNodes();
        const edges = getEdges();
        const currentNode = nodes.find(n => n.id === nodeId);
        if (!currentNode) return;

        let targetId: string | null = null;

        // Helper: Get sorted children nodes for a given parent ID
        const getSortedChildren = (parentId: string) => {
             const childEdges = edges.filter(e => e.source === parentId);
             const childNodes = childEdges
                .map(e => nodes.find(n => n.id === e.target))
                .filter(Boolean) as Node[];
             // Sort by Y position (visual vertical stack)
             return childNodes.sort((a, b) => a.position.y - b.position.y);
        };

        if (direction === 'next') {
            // Priority 1: Go to first Child (Drill down)
            const children = getSortedChildren(nodeId);
            if (children.length > 0) {
                targetId = children[0].id;
            } else {
                // Priority 2: Go to Next Sibling (Traverse across) OR Parent's Next Sibling (Traverse Up/Across)
                let walker = nodeId;
                while (walker) {
                    const incomingEdge = edges.find(e => e.target === walker);
                    if (!incomingEdge) break; // Root reached

                    const siblings = getSortedChildren(incomingEdge.source);
                    const currentIndex = siblings.findIndex(n => n.id === walker);

                    if (currentIndex !== -1 && currentIndex < siblings.length - 1) {
                        targetId = siblings[currentIndex + 1].id;
                        break;
                    }
                    // If last sibling, loop up to parent to check its siblings
                    walker = incomingEdge.source;
                }
            }
        } else {
            // Prev Logic
            const incomingEdge = edges.find(e => e.target === nodeId);
            if (incomingEdge) {
                const siblings = getSortedChildren(incomingEdge.source);
                const currentIndex = siblings.findIndex(n => n.id === nodeId);
                
                if (currentIndex > 0) {
                    // Go to Previous Sibling
                    targetId = siblings[currentIndex - 1].id;
                } else {
                    // Go to Parent
                    targetId = incomingEdge.source;
                }
            }
        }

        if (targetId) {
            setFocusedNodeId(targetId);

            const targetNode = nodes.find(n => n.id === targetId);
            const isTargetFullScreen = targetNode?.data?.isFullScreen;
            const isCurrentFullScreen = currentNode.data?.isFullScreen;

            if (isCurrentFullScreen) {
                // If currently full screen, switch full screen to the new node
                setNodes(nds => nds.map(n => {
                    if (n.id === nodeId) return { ...n, data: { ...n.data, isFullScreen: false } };
                    if (n.id === targetId) return { ...n, data: { ...n.data, isFullScreen: true } };
                    return n;
                }));
            } else {
                // Otherwise just pan camera
                fitView({ nodes: [{id: targetId}], duration: 800, padding: 0.2 });
            }
        }
    }, [getNodes, getEdges, setNodes, fitView]);

    const handleStart = async (topic: string, attachments: Attachment[], onProgress?: (status: string) => void) => {
        const effectiveTopic = topic || (attachments.length > 0 ? "Uploaded Materials" : "General Study");
        if (onProgress) onProgress("ANALYZING & PLANNING...");
        
        pushHistory();

        const planGenerator = generateExamPlan(effectiveTopic, attachments);
        let plan = '';
        try {
            for await (const chunk of planGenerator) {
                plan += chunk;
            }

            if (onProgress) onProgress("STRUCTURING COURSE...");
            const course = await generateCurriculum(effectiveTopic, plan, onProgress);
            
            saveSession(effectiveTopic, course);
            addCurriculumNode(course);
        } catch (e) {
            console.error("Failed to generate course", e);
            alert("Failed to generate course. Please try again.");
        }
    };

    const handleResume = (session: Session) => {
        pushHistory();
        setNodes([
            { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { onStart: handleStart, history: sessions, onResume: handleResume, onClearHistory: handleClearHistory } }
        ]);
        setEdges([]);
        setTimeout(() => addCurriculumNode(session.course), 100);
    };

    // --- Node Addition Logic ---

    const addNodeGeneric = (type: string, data: any, position?: {x: number, y: number}, parentId?: string, explicitId?: string) => {
        pushHistory();
        const id = explicitId || `${type}-${Date.now()}`;
        
        let pos = position;
        
        if (!pos) {
            if (parentId) {
                // Use getNode() to get fresh state, avoiding stale closures
                const parent = getNode(parentId);
                if (parent) {
                    // Check for existing children to offset positions and prevent overlaps
                    const existingChildren = getEdges().filter(e => e.source === parentId).length;
                    
                    // Vertical Stacking: Move Right (600px) and Down (child index * 600px)
                    // This ensures vertical alignment for sub-nodes
                    const xOffset = 600; 
                    const ySpacing = 600;
                    
                    pos = { 
                        x: parent.position.x + xOffset, 
                        y: parent.position.y + (existingChildren * ySpacing) 
                    };
                }
            } else if (focusedNodeId) {
                const focused = getNode(focusedNodeId);
                if (focused) pos = { x: focused.position.x + 600, y: focused.position.y };
            }
        }
        
        // Fallback positioning (prevent sticking to 0,0)
        if (!pos) {
            const count = getNodes().length;
            pos = { x: 100 + (count * 30), y: 100 + (count * 30) };
        }

        const newNode: Node = {
            id,
            type,
            position: pos,
            data: { 
                ...data, 
                isFullScreen: false,
                onNavigate: (dir: 'prev'|'next') => handleNavigate(id, dir),
                // Pass persistent handlers if needed
                 ...(type === 'start' ? {
                     onStart: handleStart,
                     history: sessions,
                     onResume: handleResume,
                     onClearHistory: handleClearHistory
                } : {})
            },
            dragHandle: '.custom-drag-handle' 
        };

        setNodes(nds => nds.concat(newNode));

        if (parentId) {
            const newEdge: Edge = {
                id: `e-${parentId}-${id}`,
                source: parentId,
                target: id,
                animated: true,
                style: { stroke: '#000', strokeWidth: 3 },
                type: 'smoothstep'
            };
            setEdges(eds => eds.concat(newEdge));
        }

        setTimeout(() => {
            setFocusedNodeId(id);
            fitView({ nodes: [{id}], duration: 800, padding: 0.2 });
        }, 150);
        return id;
    };

    // New handler for actions triggered by nodes
    const handleNodeAction = (sourceId: string, action: string, payload: any) => {
        const sourceNode = getNode(sourceId);
        if (!sourceNode) return;
        
        const topic = sourceNode.data.topic || "General Topic";

        if (action === 'SLIDES') {
            addNodeGeneric('slides', { 
                topic, 
                context: payload.markdownContent 
            }, undefined, sourceId);
        } else if (action === 'CODE') {
            addNodeGeneric('code', { 
                language: 'python',
                code: payload.code || "# Start coding...",
                context: payload.context 
            }, undefined, sourceId);
        }
    };

    const addCurriculumNode = (course: Course) => {
        const id = `curriculum-${Date.now()}`;
        addNodeGeneric('curriculum', { 
            course,
            onSelectModule: (mod: CourseModule) => addStudyNode(mod, id, course.title) // Pass explicit ID as parent
        }, { x: 600, y: 0 }, 'start', id);
    };

    const addStudyNode = (mod: CourseModule, parentId: string, topic: string) => {
        const id = `study-${Date.now()}`;
        addNodeGeneric('study', { 
            moduleTitle: mod.title, 
            moduleId: mod.id, 
            topic,
            onAction: (action: string, payload: any) => handleNodeAction(id, action, payload)
        }, undefined, parentId, id);
    };

    // --- Command Interpretation ---

    const handleCommandSubmit = async (prompt: string, sourceNodeId?: string, targetPosition?: {x: number, y: number}) => {
        if (!prompt.trim()) return;
        setIsProcessingCommand(true);
        try {
            const parent = sourceNodeId || focusedNodeId;
            let contextTopic = '';
            
            let contextData: any = {};
            let position = targetPosition;

            if (parent) {
                const pNode = getNode(parent); // Use fresh node data
                if (pNode) {
                    if (pNode.data?.topic) contextTopic = pNode.data.topic;
                    else if (pNode.data?.moduleTitle) contextTopic = pNode.data.moduleTitle;
                    
                    contextData.topic = contextTopic;
                    if (pNode.data?.markdownContent) contextData.context = pNode.data.markdownContent;

                    // If explicit position wasn't passed, generic logic in addNodeGeneric handles it
                }
            }
            
            const cmd = await interpretAgentCommand(prompt, contextTopic);

            const finalData = { ...contextData, ...cmd.data };
            if (!finalData.topic) finalData.topic = "General Study";

             if (cmd.type === 'study') {
                 if (!finalData.moduleTitle) finalData.moduleTitle = finalData.topic;
                 if (!finalData.moduleId) finalData.moduleId = `gen-${Date.now()}`;
            }

            addNodeGeneric(cmd.type, finalData, position, parent || undefined);
            setCommandInput('');
        } catch (e) {
            console.error(e);
            alert("Could not understand command.");
        } finally {
            setIsProcessingCommand(false);
            setMenuState(p => ({ ...p, visible: false }));
        }
    };

    // --- Connector Events ---

    const onConnectStart = useCallback((_: any, { nodeId, handleId }: any) => {
        connectStartParams.current = { nodeId, handleId };
    }, []);

    const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
        const target = event.target as HTMLElement;
        const isPane = target.classList.contains('react-flow__pane');

        if (isPane && connectStartParams.current.nodeId) {
            const { clientX, clientY } = 'changedTouches' in event ? (event as any).changedTouches[0] : (event as MouseEvent);
            setMenuState({
                visible: true,
                x: clientX, 
                y: clientY,
                sourceNodeId: connectStartParams.current.nodeId,
                sourceHandle: connectStartParams.current.handleId
            });
        }
    }, []);

    const handleMenuSelect = (type: string) => {
        if (!menuState.sourceNodeId) return;
        
        const sourceNode = getNode(menuState.sourceNodeId);
        const position = screenToFlowPosition({ x: menuState.x, y: menuState.y });
        
        const contextData: any = {};
        if (sourceNode?.data?.topic) contextData.topic = sourceNode.data.topic;
        else if (sourceNode?.data?.moduleTitle) contextData.topic = sourceNode.data.moduleTitle;
        else contextData.topic = "General Topic";

        if (sourceNode?.data?.markdownContent) contextData.context = sourceNode.data.markdownContent;

        addNodeGeneric(type, contextData, position, menuState.sourceNodeId);
        setMenuState(prev => ({ ...prev, visible: false }));
    };

    // --- Other Toolbar Actions ---

    const toggleLiveNode = () => {
        pushHistory();
        const liveNodes = getNodes().filter(n => n.type === 'live');
        if (liveNodes.length > 0) {
            deleteElements({ nodes: liveNodes });
        } else {
             const flowCenter = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
             addNodeGeneric('live', {}, { x: flowCenter.x - 170, y: flowCenter.y - 225 });
        }
    };

    const handleDeleteSelected = () => {
        pushHistory();
        const selected = getNodes().filter(n => n.selected);
        if (selected.length > 0) {
             deleteElements({ nodes: selected });
        }
    };

    const onConnect = useCallback((params: Connection) => {
        pushHistory();
        setEdges((eds) => addEdge(params, eds));
    }, [pushHistory, setEdges]);

    const onNodeDragStart = useCallback(() => {
        pushHistory();
    }, [pushHistory]);

    // Keep start node logic fresh
    useEffect(() => {
        setNodes(nds => nds.map(n => ({
            ...n,
            data: {
                ...n.data,
                onNavigate: (dir: 'prev'|'next') => handleNavigate(n.id, dir),
                ...(n.type === 'start' ? {
                     onStart: handleStart,
                     history: sessions,
                     onResume: handleResume,
                     onClearHistory: handleClearHistory
                } : {})
            }
        })));
    }, [sessions, handleNavigate]); 

    // Handle ESC and Fullscreen Close events
    useEffect(() => {
        const closeHandler = () => setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, isFullScreen: false } })));
        window.addEventListener('close-fullscreen', closeHandler);
        
        const keyHandler = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            // Prevent deletion if user is typing in an input
            if (target.matches('input, textarea, [contenteditable]')) return;

            if (e.key === 'Escape') closeHandler();
            if (e.key === 'Backspace' || e.key === 'Delete') handleDeleteSelected();
        };

        window.addEventListener('keydown', keyHandler);
        return () => {
            window.removeEventListener('close-fullscreen', closeHandler);
            window.removeEventListener('keydown', keyHandler);
        }
    }, [handleDeleteSelected]); // Ensure fresh handler logic

    return (
        <div className="w-full h-screen bg-[#f3f4f6] relative">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}
                onNodeDragStart={onNodeDragStart}
                onSelectionChange={({ nodes: selected }) => { if(selected.length) setFocusedNodeId(selected[0].id) }}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.2}
                maxZoom={2}
                deleteKeyCode={null} // Disable React Flow default deletion to handle it globally with input protection
                defaultEdgeOptions={{ type: 'smoothstep' }}
                proOptions={{ hideAttribution: true }}
                onPaneClick={() => setMenuState(p => ({ ...p, visible: false }))}
            >
                <Background color="#cbd5e1" gap={24} size={2} />
                <Controls position="bottom-right" className="!m-6" />
                <MiniMap 
                    nodeStrokeColor="#000" 
                    nodeColor={(n) => n.type === 'start' ? '#fff' : '#000'} 
                    maskColor="rgba(240, 240, 240, 0.6)"
                    className="!border-2 !border-black !shadow-hard !rounded-lg !m-6"
                />
            </ReactFlow>

            {/* Prompt From Connectors Menu */}
            {menuState.visible && (
                <NodeMenu 
                    x={menuState.x} 
                    y={menuState.y} 
                    onSelect={handleMenuSelect}
                    onPrompt={(txt) => {
                        const position = screenToFlowPosition({ x: menuState.x, y: menuState.y });
                        handleCommandSubmit(txt, menuState.sourceNodeId || undefined, position);
                    }} 
                    onClose={() => setMenuState(p => ({...p, visible: false}))} 
                />
            )}

            {/* Main Toolbar */}
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-white rounded-xl shadow-hard border-2 border-black px-4 py-3 flex gap-4 z-50 items-center max-w-[90vw] overflow-x-auto">
                 
                 {/* Input for prompting new nodes */}
                 <div className="flex items-center gap-2 border-r-2 border-gray-100 pr-4 mr-2">
                    <span className="material-symbols-outlined text-gray-400">auto_awesome</span>
                    <input 
                        value={commandInput}
                        onChange={(e) => setCommandInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCommandSubmit(commandInput)}
                        placeholder="Type to create (e.g. 'Add a python node')..."
                        className="w-48 md:w-64 outline-none text-sm font-bold bg-transparent placeholder-gray-400 text-black"
                        disabled={isProcessingCommand}
                    />
                    {isProcessingCommand && <span className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin"></span>}
                 </div>

                 {/* Navigation & Fit View Group */}
                 <div className="flex items-center gap-2 border-r-2 border-gray-100 pr-4 mr-2">
                    <button 
                         className="flex items-center justify-center p-1 rounded hover:bg-gray-100 disabled:opacity-30 text-black" 
                         onClick={() => focusedNodeId && handleNavigate(focusedNodeId, 'prev')}
                         disabled={!focusedNodeId}
                         title="Previous Node"
                     >
                         <span className="material-symbols-outlined">arrow_back</span>
                     </button>

                     <button className="flex flex-col items-center gap-1 text-black hover:text-blue-600 transition-colors" onClick={() => fitView({ duration: 800, padding: 0.2 })} title="Fit View">
                         <span className="material-symbols-outlined text-2xl">crop_free</span>
                     </button>

                     <button 
                         className="flex items-center justify-center p-1 rounded hover:bg-gray-100 disabled:opacity-30 text-black" 
                         onClick={() => focusedNodeId && handleNavigate(focusedNodeId, 'next')}
                         disabled={!focusedNodeId}
                         title="Next Node"
                     >
                         <span className="material-symbols-outlined">arrow_forward</span>
                     </button>
                 </div>

                 {/* Delete & Undo/Redo Group */}
                 <div className="flex items-center gap-2 border-x-2 border-gray-100 px-4">
                     <button 
                         className="flex flex-col items-center gap-1 text-black hover:text-red-600 transition-colors group" 
                         onClick={handleDeleteSelected}
                         title="Delete Selected"
                     >
                         <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">close</span>
                     </button>
                     
                     <div className="flex gap-1 ml-2">
                         <button onClick={undo} disabled={past.length === 0} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 text-black" title="Undo">
                            <span className="material-symbols-outlined text-xl">undo</span>
                         </button>
                         <button onClick={redo} disabled={future.length === 0} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 text-black" title="Redo">
                            <span className="material-symbols-outlined text-xl">redo</span>
                         </button>
                     </div>
                 </div>

                 {/* Node Creators - REMOVED MEDIA BUTTON */}

                 <button className="flex flex-col items-center gap-1 text-black hover:text-green-600 transition-colors group" onClick={() => addNodeGeneric('code', {}, undefined, focusedNodeId || undefined)} title="Add Code Sandbox">
                     <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">terminal</span>
                 </button>

                 <button className="flex flex-col items-center gap-1 text-black hover:text-red-500 transition-colors group relative" onClick={toggleLiveNode} title="Toggle Live Tutor">
                     <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">mic</span>
                     {getNodes().some(n => n.type === 'live') && <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                 </button>
            </div>
        </div>
    );
};

export const Canvas = () => (
    <ReactFlowProvider>
        <CanvasContent />
    </ReactFlowProvider>
);
