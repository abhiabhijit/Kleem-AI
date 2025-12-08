
import React, { useState } from 'react';
import { Handle, Position, NodeResizer, useReactFlow } from 'reactflow';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import { executeCode } from '../../services/geminiService';

interface CodeNodeProps {
  id: string;
  data: {
    code?: string;
    language?: string;
    isFullScreen?: boolean;
  };
  selected?: boolean;
}

export const CodeNodeContent: React.FC<CodeNodeProps['data'] & { nodeId: string; onClose?: () => void; onMaximize?: () => void }> = ({ code: initialCode, language = 'python', isFullScreen, onClose, onMaximize, nodeId }) => {
    const [code, setCode] = useState(initialCode || 'print("Hello, World!")');
    const [output, setOutput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { deleteElements } = useReactFlow();

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

    return (
        <div className={classNames("bg-slate-900 rounded-xl shadow-hard border-2 border-black flex flex-col overflow-hidden transition-all duration-300", {
            "w-[500px] h-[400px]": !isFullScreen,
            "w-full h-full max-w-5xl mx-auto my-4": isFullScreen
        })}>
             {/* Header */}
             <div className="bg-slate-800 border-b-2 border-black p-3 flex justify-between items-center px-4 cursor-move custom-drag-handle">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-green-400 text-sm">terminal</span>
                    <span className="text-white text-sm font-bold uppercase tracking-wider">Code Sandbox ({language})</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onMaximize} className="p-1 hover:bg-gray-700 rounded text-white"><span className="material-symbols-outlined text-sm">{isFullScreen ? 'close_fullscreen' : 'check_box_outline_blank'}</span></button>
                    <button onClick={handleClose} className="p-1 hover:bg-red-600 rounded text-white"><span className="material-symbols-outlined text-sm">close</span></button>
                </div>
            </div>

            <div className="flex-1 flex flex-col relative nodrag cursor-text">
                {/* Editor Area */}
                <div className="flex-1 bg-slate-900 p-4 overflow-hidden flex flex-col">
                    <textarea 
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className="flex-1 w-full bg-slate-900 text-green-300 font-mono text-sm outline-none resize-none p-2 border border-slate-700 rounded-md focus:border-green-500 transition-colors"
                        placeholder="# Write your python code here..."
                        spellCheck={false}
                    />
                </div>

                {/* Controls */}
                <div className="px-4 py-2 bg-slate-800 border-t border-slate-700 flex justify-end">
                    <button 
                        onClick={handleRun}
                        disabled={isLoading}
                        className="bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                    >
                        {isLoading ? (
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                            <span className="material-symbols-outlined text-sm">play_arrow</span>
                        )}
                        Run Code
                    </button>
                </div>

                {/* Console Output */}
                <div className="h-1/3 bg-black border-t-2 border-slate-700 p-4 overflow-y-auto font-mono text-xs">
                    <div className="text-slate-500 mb-1 select-none">Output:</div>
                    {output ? (
                        <pre className="text-white whitespace-pre-wrap">{output}</pre>
                    ) : (
                        <span className="text-slate-600 italic">No output yet...</span>
                    )}
                </div>
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
            <NodeResizer isVisible={selected} minWidth={300} minHeight={200} lineStyle={{border: '2px solid black'}} handleStyle={{width: 12, height: 12, border: '2px solid black', background: '#4ade80'}} />
            <Handle type="target" position={Position.Left} className="!bg-black !border-2 !border-white !w-4 !h-4" />
            <CodeNodeContent nodeId={id} {...data} onMaximize={toggleFullScreen} />
            <Handle type="source" position={Position.Right} className="!bg-black !border-2 !border-white !w-4 !h-4" />
        </>
    );
};
