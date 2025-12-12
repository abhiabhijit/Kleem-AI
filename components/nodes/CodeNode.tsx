
import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeResizer, useReactFlow } from 'reactflow';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import { executeCode, streamCodeTutor } from '../../services/geminiService';

interface CodeNodeProps {
  id: string;
  data: {
    code?: string;
    language?: string;
    chatHistory?: { role: string; text: string }[];
    isAssistantOpen?: boolean;
    isFullScreen?: boolean;
    onNavigate?: (direction: 'prev' | 'next') => void;
  };
  selected?: boolean;
}

// Helper to parse and render message content with code blocks
const ParsedMessage = ({ 
    text, 
    onInsert, 
    onReplace 
}: { 
    text: string, 
    onInsert: (code: string) => void,
    onReplace: (code: string) => void
}) => {
    const parts = [];
    // Regex matches code blocks: ```lang ... ```
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        // Push text before code block
        if (match.index > lastIndex) {
            parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
        }
        // Push code block
        parts.push({ type: 'code', lang: match[1] || 'text', content: match[2] });
        lastIndex = regex.lastIndex;
    }
    // Push remaining text
    if (lastIndex < text.length) {
        parts.push({ type: 'text', content: text.substring(lastIndex) });
    }

    if (parts.length === 0) return <div className="whitespace-pre-wrap">{text}</div>;

    return (
        <div className="space-y-2 min-w-0">
            {parts.map((part, i) => (
                part.type === 'text' ? (
                    <div key={i} className="whitespace-pre-wrap">{part.content}</div>
                ) : (
                    <div key={i} className="rounded-md border border-slate-600 bg-slate-950 overflow-hidden my-2 shadow-sm">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700">
                             <span className="text-[10px] uppercase text-slate-400 font-bold">{part.lang}</span>
                             <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => navigator.clipboard.writeText(part.content)}
                                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-700"
                                    title="Copy to Clipboard"
                                >
                                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                                    <span>Copy</span>
                                </button>
                                <div className="w-px h-3 bg-slate-600 mx-1"></div>
                                <button 
                                    onClick={() => onInsert(part.content)}
                                    className="flex items-center gap-1 text-[10px] text-green-400 hover:text-green-300 transition-colors font-bold px-2 py-1 rounded hover:bg-slate-700"
                                    title="Insert at cursor position"
                                >
                                    <span className="material-symbols-outlined text-[14px]">post_add</span>
                                    <span>Insert</span>
                                </button>
                                <button 
                                    onClick={() => onReplace(part.content)}
                                    className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded hover:bg-slate-700"
                                    title="Replace entire file"
                                >
                                    <span className="material-symbols-outlined text-[14px]">sync_alt</span>
                                    <span>Replace All</span>
                                </button>
                             </div>
                        </div>
                        <pre className="p-3 text-xs font-mono text-green-100 overflow-x-auto whitespace-pre custom-scrollbar">
                            {part.content}
                        </pre>
                    </div>
                )
            ))}
        </div>
    );
};

export const CodeNodeContent: React.FC<CodeNodeProps['data'] & { nodeId: string; onClose?: () => void; onMaximize?: () => void }> = ({ 
    code: initialCode, 
    language = 'python', 
    chatHistory = [], 
    isAssistantOpen = false,
    isFullScreen, 
    onClose, 
    onMaximize, 
    nodeId, 
    onNavigate 
}) => {
    const [code, setCode] = useState(initialCode || 'print("Hello, World!")');
    const [output, setOutput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    // Assistant State
    const [showAssistant, setShowAssistant] = useState(isAssistantOpen);
    const [messages, setMessages] = useState<{role: string, text: string}[]>(chatHistory);
    const [chatInput, setChatInput] = useState('');
    const [isChatting, setIsChatting] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<HTMLTextAreaElement>(null);
    
    const { deleteElements, setNodes } = useReactFlow();

    // Persist changes
    const persistData = (updates: Partial<CodeNodeProps['data']>) => {
        setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n));
    };

    const handleInsertCode = (snippet: string) => {
        const textarea = editorRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentCode = code;
        
        // Insert at cursor or replace selection
        const newCode = currentCode.substring(0, start) + snippet + currentCode.substring(end);
        
        setCode(newCode);
        persistData({ code: newCode });

        // Restore focus and move cursor to end of inserted text
        setTimeout(() => {
            textarea.focus();
            const newCursorPos = start + snippet.length;
            textarea.selectionStart = newCursorPos;
            textarea.selectionEnd = newCursorPos;
        }, 50);
    };

    const handleReplaceCode = (newCode: string) => {
        if (confirm("Are you sure you want to replace the entire file?")) {
            setCode(newCode);
            persistData({ code: newCode });
        }
    };

    useEffect(() => {
        if (showAssistant) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, showAssistant]);

    const handleRun = async () => {
        setIsLoading(true);
        setOutput('');
        try {
            const result = await executeCode(code, language);
            setOutput(result);
        } catch (error) {
            setOutput(`Error: ${error}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (onClose) onClose();
        else deleteElements({ nodes: [{ id: nodeId }] });
    };

    const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setCode(e.target.value);
    };

    const handleBlur = () => {
        persistData({ code });
    };
    
    const toggleAssistant = () => {
        const newState = !showAssistant;
        setShowAssistant(newState);
        persistData({ isAssistantOpen: newState });
    };

    const handleChatSubmit = async (overrideText?: string) => {
        const text = overrideText || chatInput;
        if (!text.trim() || isChatting) return;

        const newMsg = { role: 'user', text };
        const updatedHistory = [...messages, newMsg];
        setMessages(updatedHistory);
        setChatInput('');
        setIsChatting(true);

        // Save history immediately
        persistData({ chatHistory: updatedHistory });

        try {
            const historyForApi = updatedHistory.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
            const generator = streamCodeTutor(historyForApi, text, code, language);
            
            let responseText = '';
            setMessages(prev => [...prev, { role: 'model', text: '' }]);
            
            for await (const chunk of generator) {
                if (chunk.text) {
                    responseText += chunk.text;
                    setMessages(prev => {
                        const copy = [...prev];
                        copy[copy.length - 1].text = responseText;
                        return copy;
                    });
                }
            }
            // Save final history
            persistData({ chatHistory: [...updatedHistory, { role: 'model', text: responseText }] });
        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, { role: 'model', text: "Error: Could not connect to coding assistant." }]);
        } finally {
            setIsChatting(false);
        }
    };

    return (
        <div className={classNames("bg-slate-900 rounded-xl shadow-hard border-2 border-black flex flex-col overflow-hidden transition-all duration-300", {
            "w-[650px] h-[500px]": !isFullScreen,
            "w-full h-full max-w-7xl mx-auto my-4": isFullScreen
        })}>
             {/* Header */}
             <div className="bg-slate-800 border-b-2 border-black p-3 flex justify-between items-center px-4 cursor-move custom-drag-handle flex-shrink-0">
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-green-400 text-sm">terminal</span>
                    <span className="text-white text-sm font-bold uppercase tracking-wider">Code Sandbox ({language})</span>
                </div>
                <div className="flex items-center gap-2">
                    {/* Toggle Assistant */}
                    <button 
                        onClick={toggleAssistant}
                        className={`flex items-center gap-1 px-3 py-1 rounded text-[10px] font-bold uppercase transition-all mr-4 ${showAssistant ? 'bg-green-600 text-white' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'}`}
                    >
                        <span className="material-symbols-outlined text-sm">smart_toy</span>
                        {showAssistant ? 'Assistant On' : 'Assistant Off'}
                    </button>

                    {/* Navigation Buttons for Full Screen */}
                    {isFullScreen && onNavigate && (
                        <div className="flex gap-1 mr-2">
                             <button onClick={() => onNavigate('prev')} className="p-1 hover:bg-gray-700 rounded transition-colors" title="Previous Node">
                                <span className="material-symbols-outlined text-sm font-bold text-white">arrow_back</span>
                             </button>
                             <button onClick={() => onNavigate('next')} className="p-1 hover:bg-gray-700 rounded transition-colors" title="Next Node">
                                <span className="material-symbols-outlined text-sm font-bold text-white">arrow_forward</span>
                             </button>
                        </div>
                    )}

                    <button onClick={onMaximize} className="p-1 hover:bg-gray-700 rounded text-white"><span className="material-symbols-outlined text-sm">{isFullScreen ? 'close_fullscreen' : 'check_box_outline_blank'}</span></button>
                    <button onClick={handleClose} className="p-1 hover:bg-red-600 rounded text-white"><span className="material-symbols-outlined text-sm">close</span></button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Pane: Editor & Console */}
                <div className="flex-1 flex flex-col min-w-0 border-r border-black relative">
                     {/* Editor Area */}
                    <div className="flex-1 bg-slate-900 p-4 overflow-hidden flex flex-col nodrag cursor-text relative">
                        <textarea 
                            ref={editorRef}
                            value={code}
                            onChange={handleCodeChange}
                            onBlur={handleBlur}
                            onKeyDown={(e) => e.stopPropagation()} 
                            className="flex-1 w-full bg-slate-900 text-green-300 font-mono text-sm outline-none resize-none p-2 border border-slate-700 rounded-md focus:border-green-500 transition-colors leading-relaxed"
                            placeholder="# Write your python code here..."
                            spellCheck={false}
                        />
                        {/* Run Button Floating */}
                        <div className="absolute bottom-6 right-8 z-10">
                             <button 
                                onClick={handleRun}
                                disabled={isLoading}
                                className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-full shadow-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95 active:shadow-none hover:-translate-y-0.5"
                            >
                                {isLoading ? (
                                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                ) : (
                                    <span className="material-symbols-outlined text-lg">play_arrow</span>
                                )}
                                Run Code
                            </button>
                        </div>
                    </div>

                    {/* Console Output */}
                    <div className="h-1/3 bg-black border-t-2 border-slate-700 p-4 overflow-y-auto font-mono text-xs nodrag">
                        <div className="text-slate-500 mb-1 select-none font-bold uppercase tracking-wider text-[10px]">Terminal Output</div>
                        {output ? (
                            <pre className="text-white whitespace-pre-wrap">{output}</pre>
                        ) : (
                            <span className="text-slate-600 italic">No output yet...</span>
                        )}
                    </div>
                </div>

                {/* Right Pane: AI Assistant */}
                {showAssistant && (
                    <div className="w-80 bg-slate-800 flex flex-col border-l border-black animate-in slide-in-from-right duration-300">
                        <div className="p-3 border-b border-slate-700 bg-slate-800/50">
                            <h3 className="text-xs font-bold text-green-400 uppercase tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">terminal</span>
                                Gemini Coder
                            </h3>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 nodrag cursor-text scrollbar-thin scrollbar-thumb-slate-600">
                            {messages.length === 0 && (
                                <div className="text-center mt-10 space-y-4">
                                    <p className="text-slate-400 text-xs">I can review your code, fix bugs, or give you practice challenges.</p>
                                    <div className="flex flex-col gap-2 px-4">
                                        <button onClick={() => handleChatSubmit("Review my code for errors")} className="bg-slate-700 hover:bg-slate-600 text-white text-xs p-2 rounded border border-slate-600 text-left">🐞 Review for Bugs</button>
                                        <button onClick={() => handleChatSubmit(`Give me a ${language} boilerplate for inheritance`)} className="bg-slate-700 hover:bg-slate-600 text-white text-xs p-2 rounded border border-slate-600 text-left">🏗️ Boilerplate Code</button>
                                        <button onClick={() => handleChatSubmit("Explain this code step-by-step")} className="bg-slate-700 hover:bg-slate-600 text-white text-xs p-2 rounded border border-slate-600 text-left">🧠 Explain Code</button>
                                    </div>
                                </div>
                            )}
                            
                            {messages.map((m, i) => (
                                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`p-3 rounded-lg text-xs w-[90%] ${m.role === 'user' ? 'bg-green-600 text-white' : 'bg-slate-700 text-gray-200 border border-slate-600'}`}>
                                        <ParsedMessage 
                                            text={m.text} 
                                            onInsert={handleInsertCode} 
                                            onReplace={handleReplaceCode} 
                                        />
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>

                        <div className="p-3 bg-slate-800 border-t border-slate-700">
                            <div className="relative">
                                <input 
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    onKeyDown={e => {
                                        e.stopPropagation();
                                        if (e.key === 'Enter') handleChatSubmit();
                                    }}
                                    placeholder="Ask about your code..."
                                    className="w-full bg-black text-white text-xs rounded-md border border-slate-600 p-2 pr-8 outline-none focus:border-green-500"
                                    disabled={isChatting}
                                />
                                <button 
                                    onClick={() => handleChatSubmit()}
                                    disabled={isChatting || !chatInput.trim()}
                                    className="absolute right-1 top-1 p-1 text-slate-400 hover:text-green-400 disabled:opacity-30"
                                >
                                    <span className="material-symbols-outlined text-sm">send</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export const CodeNode: React.FC<CodeNodeProps> = ({ id, data, selected }) => {
    const { setNodes } = useReactFlow();

    const toggleFullScreen = () => {
        setNodes((nds) => nds.map((n) => {
            if (n.id === id) {
                return { ...n, data: { ...n.data, isFullScreen: !n.data.isFullScreen } };
            }
            return n;
        }));
    };

    if (data.isFullScreen) {
        return ReactDOM.createPortal(
            <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                <CodeNodeContent nodeId={id} {...data} onClose={() => toggleFullScreen()} onMaximize={() => toggleFullScreen()} />
            </div>,
            document.body
        );
    }

    return (
        <>
            <NodeResizer isVisible={selected} minWidth={450} minHeight={300} lineStyle={{border: '2px solid black'}} handleStyle={{width: 12, height: 12, border: '2px solid black', background: '#4ade80'}} />
            <Handle type="target" position={Position.Left} className="!bg-black !border-2 !border-white !w-4 !h-4" />
            <CodeNodeContent nodeId={id} {...data} onMaximize={toggleFullScreen} />
            <Handle type="source" position={Position.Right} className="!bg-black !border-2 !border-white !w-4 !h-4" />
        </>
    );
};
