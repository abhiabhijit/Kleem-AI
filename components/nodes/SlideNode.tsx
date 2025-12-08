
import React, { useState, useEffect } from 'react';
import { Handle, Position, NodeResizer, useReactFlow } from 'reactflow';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import { generateSlidesOnly, generateImage, generateSpeech } from '../../services/geminiService';
import { Slide } from '../../types';

interface SlideNodeProps {
  id: string;
  data: {
    topic: string;
    context?: string;
    isFullScreen?: boolean;
  };
  selected?: boolean;
}

export const SlideNodeContent: React.FC<SlideNodeProps['data'] & { nodeId: string; onClose?: () => void; onMaximize?: () => void }> = ({ topic, context, isFullScreen, onClose, onMaximize, nodeId }) => {
    const [slides, setSlides] = useState<Slide[]>([]);
    const [current, setCurrent] = useState(0);
    const [images, setImages] = useState<Record<number, string>>({});
    const [loading, setLoading] = useState(true);
    const [isPresenting, setIsPresenting] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const { deleteElements } = useReactFlow();

    useEffect(() => {
        const fetchSlides = async () => {
            try {
                const data = await generateSlidesOnly(topic, context);
                setSlides(data);
            } catch (e) { console.error(e); } 
            finally { setLoading(false); }
        };
        fetchSlides();
    }, [topic, context]);

    useEffect(() => {
        if (!slides[current]) return;
        
        // Generate Image
        if (slides[current].imagePrompt && !images[current]) {
             generateImage(slides[current].imagePrompt!, '1K').then(img => {
                 if (img) setImages(prev => ({ ...prev, [current]: img }));
             });
        }
        
        // Present Mode Logic (Auto-TTS)
        if (isPresenting) {
            const textToRead = `${slides[current].title}. ${slides[current].bullets.join('. ')}`;
            generateSpeech(textToRead).then(base64 => {
                 if (base64) setAudioUrl(`data:audio/mp3;base64,${base64}`);
            });
        } else {
            setAudioUrl(null);
        }

    }, [current, slides, isPresenting]);

    const handleClose = () => {
        if (onClose) onClose();
        else deleteElements({ nodes: [{ id: nodeId }] });
    };

    const currentSlide = slides[current];

    return (
        <div className={classNames("bg-black rounded-xl shadow-hard border-2 border-white flex flex-col overflow-hidden relative transition-all duration-300", {
            "w-[450px] h-[350px]": !isFullScreen,
            "w-full h-full max-w-5xl mx-auto my-4": isFullScreen
        })}>
            {audioUrl && <audio src={audioUrl} autoPlay onEnded={() => { /* maybe auto advance? */ }} className="hidden" />}
            
            {/* Header controls for non-fullscreen mode inside the black box */}
            <div className="absolute top-0 right-0 p-2 z-20 flex gap-2">
                 <button onClick={onMaximize} className="p-1 bg-black/50 hover:bg-white/20 rounded-full text-white"><span className="material-symbols-outlined text-sm">{isFullScreen ? 'close_fullscreen' : 'crop_square'}</span></button>
                 <button onClick={handleClose} className="p-1 bg-black/50 hover:bg-red-500/80 rounded-full text-white"><span className="material-symbols-outlined text-sm">close</span></button>
            </div>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-white">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
                    <span className="text-xs font-bold uppercase tracking-widest">Designing Slides...</span>
                </div>
            ) : (
                <>
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 overflow-y-auto nodrag">
                        <h3 className="text-2xl font-black uppercase text-white leading-tight">{currentSlide?.title}</h3>
                        
                        {images[current] ? (
                            <img src={images[current]} className="max-h-[140px] rounded border-2 border-white object-cover" />
                        ) : (
                            <div className="h-32 w-40 bg-gray-800 rounded border-2 border-gray-700 border-dashed flex items-center justify-center">
                                <span className="material-symbols-outlined text-gray-600">image</span>
                            </div>
                        )}

                        <ul className="text-left text-sm space-y-1 text-gray-300 font-medium max-w-sm">
                            {currentSlide?.bullets.map((b, i) => (
                                <li key={i} className="flex gap-2">
                                    <span className="text-yellow-400 text-[10px] mt-1">●</span>
                                    <span>{b}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Footer Controls */}
                    <div className="bg-gray-900 border-t border-gray-700 p-2 flex justify-between items-center px-4 nodrag">
                        <button onClick={() => setCurrent(Math.max(0, current - 1))} disabled={current === 0} className="text-white disabled:opacity-30 hover:text-yellow-400"><span className="material-symbols-outlined">arrow_back</span></button>
                        
                        <div className="flex gap-4 items-center">
                            <span className="text-[10px] font-bold text-gray-500 tracking-widest">{current + 1} / {slides.length}</span>
                            <button 
                                onClick={() => setIsPresenting(!isPresenting)}
                                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${isPresenting ? 'bg-red-500 text-white' : 'bg-white text-black hover:bg-gray-200'}`}
                            >
                                <span className="material-symbols-outlined text-sm">{isPresenting ? 'stop_circle' : 'record_voice_over'}</span>
                                {isPresenting ? 'Stop' : 'Present'}
                            </button>
                        </div>

                        <button onClick={() => setCurrent(Math.min(slides.length - 1, current + 1))} disabled={current === slides.length - 1} className="text-white disabled:opacity-30 hover:text-yellow-400"><span className="material-symbols-outlined">arrow_forward</span></button>
                    </div>
                </>
            )}
        </div>
    );
}

export const SlideNode: React.FC<SlideNodeProps> = ({ id, data, selected }) => {
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
            <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
                <SlideNodeContent nodeId={id} {...data} onClose={() => toggleFullScreen()} onMaximize={() => toggleFullScreen()} />
            </div>,
            document.body
        );
    }
    return (
        <>
            <NodeResizer isVisible={selected} minWidth={300} minHeight={250} lineStyle={{border: '2px solid white'}} handleStyle={{width: 12, height: 12, border: '2px solid white', background: '#000'}} />
            <Handle type="target" position={Position.Left} className="!bg-white !border-2 !border-black !w-4 !h-4" />
            <SlideNodeContent nodeId={id} {...data} onMaximize={toggleFullScreen} />
            <Handle type="source" position={Position.Right} className="!bg-white !border-2 !border-black !w-4 !h-4" />
        </>
    );
};
