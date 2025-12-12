
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
    slideContent?: Slide[];
    isFullScreen?: boolean;
    onNavigate?: (direction: 'prev' | 'next') => void;
  };
  selected?: boolean;
}

export const SlideNodeContent: React.FC<SlideNodeProps['data'] & { nodeId: string; onClose?: () => void; onMaximize?: () => void }> = ({ topic, context, slideContent, isFullScreen, onClose, onMaximize, nodeId, onNavigate }) => {
    const [slides, setSlides] = useState<Slide[]>(slideContent || []);
    const [current, setCurrent] = useState(0);
    const [loading, setLoading] = useState(!slideContent);
    const [isPresenting, setIsPresenting] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const { deleteElements, setNodes } = useReactFlow();

    // 1. Initial Load of Slides Content
    useEffect(() => {
        if (slideContent && slideContent.length > 0) {
            setSlides(slideContent);
            setLoading(false);
            return;
        }

        let isMounted = true;
        const fetchSlides = async () => {
            try {
                const data = await generateSlidesOnly(topic, context);
                if (isMounted) {
                    setSlides(data);
                    // Persist initial text content
                    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, slideContent: data } } : n));
                }
            } catch (e) { console.error(e); } 
            finally { if (isMounted) setLoading(false); }
        };
        fetchSlides();
        return () => { isMounted = false; };
    }, [topic, context, nodeId, setNodes]); 

    // 2. Image Generation & Persistence Logic
    useEffect(() => {
        if (!slides[current]) return;

        const currentSlide = slides[current];
        
        // Only generate if we have a prompt AND no image URL yet
        if (currentSlide.imagePrompt && !currentSlide.imageUrl) {
             generateImage(currentSlide.imagePrompt, '1K').then(img => {
                 if (img) {
                     // 1. Update Local State for immediate UI feedback
                     setSlides(prev => {
                         const newSlides = [...prev];
                         newSlides[current] = { ...newSlides[current], imageUrl: img };
                         return newSlides;
                     });

                     // 2. Update Global ReactFlow State for Persistence (survives FullScreen toggle)
                     setNodes(nds => nds.map(n => {
                         if (n.id === nodeId) {
                             // Safety check to ensure we don't overwrite with stale data
                             const existingSlides = n.data.slideContent || [];
                             // Deep copy to be safe
                             const updatedSlides = existingSlides.map(s => ({...s}));
                             
                             if (updatedSlides[current]) {
                                 updatedSlides[current].imageUrl = img;
                             } else if (existingSlides.length === 0) {
                                 // Fallback if global state was empty for some reason
                                 return { ...n, data: { ...n.data, slideContent: slides.map((s, i) => i === current ? { ...s, imageUrl: img } : s) } };
                             }
                             return { ...n, data: { ...n.data, slideContent: updatedSlides } };
                         }
                         return n;
                     }));
                 }
             });
        }
        
        // Present Mode Logic (Auto-TTS)
        if (isPresenting) {
            const textToRead = `${currentSlide.title}. ${currentSlide.bullets.join('. ')}`;
            generateSpeech(textToRead).then(base64 => {
                 if (base64) setAudioUrl(`data:audio/mp3;base64,${base64}`);
            });
        } else {
            setAudioUrl(null);
        }

    }, [current, slides, isPresenting, nodeId, setNodes]);

    const handleClose = () => {
        if (onClose) onClose();
        else deleteElements({ nodes: [{ id: nodeId }] });
    };

    const currentSlide = slides[current];

    return (
        <div className={classNames("bg-zinc-900 rounded-xl shadow-hard border-2 border-white flex flex-col overflow-hidden relative transition-all duration-300", {
            "w-full h-full min-w-[600px] min-h-[400px]": !isFullScreen,
            "w-full h-full max-w-7xl mx-auto my-4": isFullScreen
        })}>
            {audioUrl && <audio src={audioUrl} autoPlay onEnded={() => { /* maybe auto advance? */ }} className="hidden" />}
            
            {/* Header / Drag Handle */}
            <div className="bg-zinc-800 border-b-2 border-zinc-700 p-2 flex justify-between items-center px-4 cursor-move custom-drag-handle flex-shrink-0 z-20 select-none">
                <div className="flex items-center gap-2 text-white pointer-events-none">
                    <span className="material-symbols-outlined text-sm text-yellow-400">slideshow</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Slide Deck</span>
                </div>
                <div className="flex items-center gap-2 nodrag">
                    {isFullScreen && onNavigate && (
                        <div className="flex gap-1 mr-2">
                             <button onClick={() => onNavigate('prev')} className="p-1 hover:bg-zinc-700 rounded transition-colors text-white" title="Previous Node">
                                <span className="material-symbols-outlined text-sm font-bold">arrow_back</span>
                             </button>
                             <button onClick={() => onNavigate('next')} className="p-1 hover:bg-zinc-700 rounded transition-colors text-white" title="Next Node">
                                <span className="material-symbols-outlined text-sm font-bold">arrow_forward</span>
                             </button>
                        </div>
                    )}
                    <button onClick={onMaximize} className="p-1 hover:bg-zinc-700 rounded text-white" title={isFullScreen ? "Restore" : "Fullscreen"}>
                        <span className="material-symbols-outlined text-sm">{isFullScreen ? 'close_fullscreen' : 'crop_square'}</span>
                    </button>
                    <button onClick={handleClose} className="p-1 hover:bg-red-600 rounded text-white" title="Close">
                        <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-white space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-400 animate-pulse">Designing Slides...</span>
                </div>
            ) : (
                <>
                    {/* Content Area - Side by Side Layout */}
                    <div className="flex-1 flex overflow-hidden bg-black relative nodrag">
                         {/* Background Accent */}
                         <div className="absolute top-0 right-0 w-2/3 h-full bg-zinc-900 skew-x-12 transform origin-top translate-x-1/4 z-0 border-l border-zinc-800"></div>

                         <div className="relative z-10 flex w-full h-full">
                             {/* Left: Text Content */}
                             <div className="w-1/2 p-8 flex flex-col justify-center space-y-6">
                                 <div>
                                    <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest mb-2 block opacity-80">Slide {current + 1}</span>
                                    <h3 className="text-3xl font-black text-white leading-none uppercase tracking-tight">{currentSlide?.title}</h3>
                                 </div>
                                 
                                 <ul className="space-y-4">
                                     {currentSlide?.bullets.map((b, i) => (
                                         <li key={i} className="flex gap-3 text-sm font-medium text-zinc-300 leading-relaxed">
                                             <span className="text-yellow-400 mt-1.5 w-1.5 h-1.5 bg-yellow-400 rounded-full flex-shrink-0"></span>
                                             <span>{b}</span>
                                         </li>
                                     ))}
                                 </ul>
                             </div>

                             {/* Right: Image Content */}
                             <div className="w-1/2 p-4 flex items-center justify-center">
                                 {currentSlide?.imageUrl ? (
                                     <div className="relative w-full h-full max-h-[80%] rounded-lg overflow-hidden shadow-2xl border-4 border-white/10 group">
                                         <img 
                                            src={currentSlide.imageUrl} 
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                                            alt="Slide Visual"
                                         />
                                         <div className="absolute inset-0 ring-1 ring-inset ring-black/10"></div>
                                     </div>
                                 ) : (
                                     <div className="w-64 h-48 bg-zinc-800/50 rounded-lg border-2 border-zinc-700 border-dashed flex flex-col items-center justify-center gap-3 animate-pulse">
                                         <span className="material-symbols-outlined text-zinc-600 text-4xl">image</span>
                                         <span className="text-[10px] font-bold text-zinc-600 uppercase">Generating Visual...</span>
                                     </div>
                                 )}
                             </div>
                         </div>
                    </div>

                    {/* Footer Controls */}
                    <div className="bg-zinc-800 border-t border-zinc-700 p-3 flex justify-between items-center px-6 nodrag z-20">
                        <button 
                            onClick={() => setCurrent(Math.max(0, current - 1))} 
                            disabled={current === 0} 
                            className="text-white disabled:opacity-30 hover:text-yellow-400 transition-colors p-1 rounded hover:bg-zinc-700"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        
                        <div className="flex gap-4 items-center">
                            <div className="flex gap-1">
                                {slides.map((_, idx) => (
                                    <div 
                                        key={idx} 
                                        className={`h-1.5 rounded-full transition-all duration-300 ${current === idx ? 'w-8 bg-yellow-400' : 'w-2 bg-zinc-600'}`}
                                    />
                                ))}
                            </div>
                            <div className="w-px h-4 bg-zinc-600 mx-2"></div>
                            <button 
                                onClick={() => setIsPresenting(!isPresenting)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${
                                    isPresenting 
                                    ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]' 
                                    : 'bg-white text-black hover:bg-zinc-200'
                                }`}
                            >
                                <span className="material-symbols-outlined text-sm">{isPresenting ? 'stop_circle' : 'record_voice_over'}</span>
                                {isPresenting ? 'Stop' : 'Present'}
                            </button>
                        </div>

                        <button 
                            onClick={() => setCurrent(Math.min(slides.length - 1, current + 1))} 
                            disabled={current === slides.length - 1} 
                            className="text-white disabled:opacity-30 hover:text-yellow-400 transition-colors p-1 rounded hover:bg-zinc-700"
                        >
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </button>
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
            <NodeResizer isVisible={selected} minWidth={600} minHeight={400} lineStyle={{border: '2px solid white'}} handleStyle={{width: 12, height: 12, border: '2px solid white', background: '#FACC15'}} />
            <Handle type="target" position={Position.Left} className="!bg-white !border-2 !border-black !w-4 !h-4" />
            <SlideNodeContent nodeId={id} {...data} onMaximize={toggleFullScreen} />
            <Handle type="source" position={Position.Right} className="!bg-white !border-2 !border-black !w-4 !h-4" />
        </>
    );
};
