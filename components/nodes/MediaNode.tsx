
import React, { useState } from 'react';
import { Handle, Position, NodeResizer, useReactFlow } from 'reactflow';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import { analyzeMedia } from '../../services/geminiService';

interface MediaNodeProps {
  id: string;
  data: {
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    analysis?: string;
    isFullScreen?: boolean;
  };
  selected?: boolean;
}

export const MediaNodeContent: React.FC<MediaNodeProps['data'] & { nodeId: string; onClose?: () => void; onMaximize?: () => void }> = ({ mediaUrl: initialUrl, mediaType: initialType, analysis: initialAnalysis, isFullScreen, onClose, onMaximize, nodeId }) => {
    const [url, setUrl] = useState(initialUrl || '');
    const [type, setType] = useState<'image' | 'video'>(initialType || 'image');
    const [analysis, setAnalysis] = useState(initialAnalysis || '');
    const [isLoading, setIsLoading] = useState(false);
    const { deleteElements } = useReactFlow();

    const handleAnalyze = async () => {
        if (!url) return;
        setIsLoading(true);
        setAnalysis('');
        try {
            const prompt = "Analyze this media and generate a study summary with key points and educational value.";
            const result = await analyzeMedia(url, type, prompt);
            setAnalysis(result);
        } catch (error) {
            setAnalysis(`Error: ${error}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (onClose) onClose();
        else deleteElements({ nodes: [{ id: nodeId }] });
    };

    return (
        <div className={classNames("bg-white rounded-xl shadow-hard border-2 border-black flex flex-col overflow-hidden transition-all duration-300", {
            "w-[450px]": !isFullScreen,
            "h-[500px]": !isFullScreen,
            "w-full h-full max-w-5xl mx-auto my-4": isFullScreen
        })}>
             {/* Header */}
             <div className="bg-teal-100 border-b-2 border-black p-3 flex justify-between items-center px-4 cursor-move custom-drag-handle">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-teal-700 text-sm">perm_media</span>
                    <span className="text-black text-sm font-bold uppercase tracking-wider">Media Analyzer</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onMaximize} className="p-1 hover:bg-teal-200 rounded text-teal-900"><span className="material-symbols-outlined text-sm">{isFullScreen ? 'close_fullscreen' : 'check_box_outline_blank'}</span></button>
                    <button onClick={handleClose} className="p-1 hover:bg-red-500 rounded hover:text-white text-teal-900"><span className="material-symbols-outlined text-sm">close</span></button>
                </div>
            </div>

            <div className="flex-1 flex flex-col p-4 space-y-4 overflow-y-auto nodrag cursor-default">
                {/* Input Section */}
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <input 
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="Paste Image or Video URL..."
                            className="flex-1 border-2 border-black rounded-lg px-3 py-2 text-sm outline-none focus:bg-teal-50 placeholder-gray-400 font-medium bg-white text-black"
                        />
                         <select 
                            value={type}
                            onChange={(e) => setType(e.target.value as 'image' | 'video')}
                            className="border-2 border-black rounded-lg px-2 py-2 text-sm font-bold bg-white text-black outline-none"
                        >
                            <option value="image">Image</option>
                            <option value="video">Video</option>
                        </select>
                    </div>
                    <button 
                        onClick={handleAnalyze}
                        disabled={isLoading || !url}
                        className="w-full bg-black text-white font-bold py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                            <span className="material-symbols-outlined text-sm">auto_awesome</span>
                        )}
                        GENERATE STUDY NOTES
                    </button>
                </div>

                {/* Preview */}
                {url && (
                    <div className="bg-black rounded-lg border-2 border-black overflow-hidden relative group min-h-[150px] flex items-center justify-center">
                         {type === 'image' ? (
                             <img src={url} alt="Media Preview" className="max-h-60 w-full object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                         ) : (
                             <video src={url} controls className="max-h-60 w-full" />
                         )}
                    </div>
                )}

                {/* Output */}
                {analysis && (
                    <div className="flex-1 bg-teal-50 border-2 border-black rounded-lg p-4 overflow-y-auto">
                        <h4 className="font-black text-teal-800 text-xs uppercase tracking-widest mb-2">Analysis Results</h4>
                        <div className="prose prose-sm max-w-none text-black">
                             {analysis.split('\n').map((l,i) => <p key={i} className="mb-1">{l}</p>)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export const MediaNode: React.FC<MediaNodeProps> = ({ id, data, selected }) => {
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
                <MediaNodeContent nodeId={id} {...data} onClose={() => toggleFullScreen()} onMaximize={() => toggleFullScreen()} />
            </div>,
            document.body
        );
    }

    return (
        <>
            <NodeResizer isVisible={selected} minWidth={350} minHeight={400} lineStyle={{border: '2px solid black'}} handleStyle={{width: 12, height: 12, border: '2px solid black', background: '#2dd4bf'}} />
            <Handle type="target" position={Position.Left} className="!bg-black !border-2 !border-white !w-4 !h-4" />
            <MediaNodeContent nodeId={id} {...data} onMaximize={toggleFullScreen} />
            <Handle type="source" position={Position.Right} className="!bg-black !border-2 !border-white !w-4 !h-4" />
        </>
    );
};
