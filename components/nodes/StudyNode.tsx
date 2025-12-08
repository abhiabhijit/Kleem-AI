
import React, { useState, useEffect } from 'react';
import { Handle, Position, NodeResizer, useReactFlow } from 'reactflow';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import { generateLessonContent, streamChatResponse, generatePodcastScript, generatePodcastAudio } from '../../services/geminiService';
import { LessonContent } from '../../types';

interface StudyNodeProps {
  id: string;
  data: {
    moduleTitle: string;
    moduleId: string;
    topic: string;
    isFullScreen?: boolean;
  };
  selected?: boolean;
}

// --- Internal Components ---

const ChatView = ({ context, topic, suggestedQuestions }: { context: string, topic: string, suggestedQuestions?: string[] }) => {
    const [msgs, setMsgs] = useState<{role: string, text: string}[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    const send = async (text: string) => {
        if(!text.trim()) return;
        const newMsg = {role: 'user', text: text};
        setMsgs(p => [...p, newMsg]);
        setInput('');
        setLoading(true);
        
        try {
            const hist = msgs.map(m => ({role: m.role, parts: [{text: m.text}]}));
            const gen = streamChatResponse(hist, newMsg.text, false, `Context: ${context.substring(0, 1000)}... Topic: ${topic}`);
            let txt = '';
            setMsgs(p => [...p, {role: 'model', text: ''}]);
            for await(const chunk of gen) {
                if(chunk.text) {
                    txt += chunk.text;
                    setMsgs(p => { const n = [...p]; n[n.length-1].text = txt; return n; });
                }
            }
        } finally { setLoading(false); }
    }

    return (
        <div className="h-full flex flex-col bg-white nodrag cursor-text">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {msgs.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-80">
                        <span className="material-symbols-outlined text-4xl mb-4 text-gray-300">forum</span>
                        <p className="font-bold text-xl mb-2">Ask about this lesson</p>
                        <p className="text-sm max-w-xs mx-auto text-gray-500 mb-6">I can explain complex terms, summarize sections, or provide examples.</p>
                        
                        {suggestedQuestions && suggestedQuestions.length > 0 && (
                            <div className="w-full max-w-sm space-y-2">
                                <p className="text-xs font-bold uppercase text-gray-400 mb-2">Suggested Questions</p>
                                {suggestedQuestions.map((q, i) => (
                                    <button 
                                        key={i} 
                                        onClick={() => send(q)}
                                        className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-black hover:bg-yellow-50 text-sm transition-all text-black font-medium"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {msgs.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                         <div className={`p-4 rounded-xl text-sm font-medium border-2 max-w-[85%] shadow-sm ${m.role === 'user' ? 'bg-black text-white border-black rounded-br-none' : 'bg-white text-black border-black rounded-bl-none'}`}>
                            {m.text}
                        </div>
                    </div>
                ))}
            </div>
            <div className="p-4 border-t-2 border-gray-100 bg-gray-50 flex gap-3">
                <input 
                    value={input} 
                    onChange={e => setInput(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && send(input)} 
                    placeholder="Type your question..." 
                    className="flex-1 text-sm bg-white text-black border-2 border-gray-300 rounded-lg px-4 py-3 outline-none focus:border-black focus:shadow-hard-sm transition-all font-medium placeholder-gray-400" 
                />
                <button onClick={() => send(input)} disabled={loading} className="bg-kleem-yellow border-2 border-black px-4 rounded-lg hover:bg-yellow-300 disabled:opacity-50 transition-colors shadow-sm hover:shadow-hard-sm active:shadow-none active:translate-y-0.5">
                    <span className="material-symbols-outlined text-black font-bold">send</span>
                </button>
            </div>
        </div>
    )
}

const AudioOverview = ({ context, topic }: { context: string, topic: string }) => {
    const [audioData, setAudioData] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('Ready to generate');

    const handleGenerate = async () => {
        setLoading(true);
        try {
            setStatus('Drafting Script (Host & Expert)...');
            const script = await generatePodcastScript(topic, context);
            
            setStatus('Recording Audio (Multi-Speaker)...');
            const audioBase64 = await generatePodcastAudio(script);
            
            if (audioBase64) {
                setAudioData(`data:audio/mp3;base64,${audioBase64}`);
                setStatus('Ready to Play');
            } else {
                setStatus('Failed to generate audio');
            }
        } catch (e) {
            console.error(e);
            setStatus('Error generating podcast');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-gray-900 to-black text-white relative overflow-hidden nodrag">
            {/* Background decoration */}
            <div className="absolute inset-0 opacity-10">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-kleem-yellow rounded-full blur-[100px]"></div>
            </div>

            <div className="z-10 w-full max-w-md text-center space-y-6">
                <div className="flex justify-center mb-4">
                    <div className={`w-24 h-24 rounded-full border-4 border-white flex items-center justify-center ${loading ? 'animate-pulse' : ''} bg-gray-800`}>
                        <span className="material-symbols-outlined text-5xl">{loading ? 'graphic_eq' : 'headphones'}</span>
                    </div>
                </div>

                <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Deep Dive Podcast</h3>
                    <p className="text-gray-400 text-sm">{loading ? status : "Generate a 2-person audio summary of this lesson."}</p>
                </div>

                {!audioData && !loading && (
                    <button 
                        onClick={handleGenerate}
                        className="w-full bg-white text-black font-black py-4 rounded-xl hover:bg-kleem-yellow hover:scale-105 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined">play_circle</span>
                        GENERATE EPISODE
                    </button>
                )}

                {loading && (
                     <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                        <div className="bg-kleem-yellow h-full w-1/2 animate-[shimmer_1s_infinite]"></div>
                     </div>
                )}

                {audioData && (
                    <div className="bg-gray-800/80 backdrop-blur rounded-xl p-4 border border-gray-700 animate-in fade-in slide-in-from-bottom-4">
                        <audio controls src={audioData} className="w-full mb-4 accent-kleem-yellow" />
                        <div className="flex justify-between items-center text-xs text-gray-400 px-1">
                            <span>Hosts: Sascha & Marina</span>
                            <a href={audioData} download="deep-dive.mp3" className="hover:text-white flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">download</span> Download
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export const StudyNodeContent: React.FC<StudyNodeProps['data'] & { nodeId: string; onClose?: () => void; onMaximize?: () => void }> = ({ moduleTitle, moduleId, topic, isFullScreen, onClose, onMaximize, nodeId }) => {
    const [content, setContent] = useState<LessonContent | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMsg, setLoadingMsg] = useState('Generating Lesson...');
    const [tab, setTab] = useState<'READ' | 'CHAT' | 'LISTEN'>('READ');
    const { deleteElements } = useReactFlow();

    useEffect(() => {
        let mounted = true;
        const fetchContent = async () => {
            try {
                const res = await generateLessonContent(moduleId, moduleTitle, topic);
                if (mounted) {
                    setContent(res);
                    setLoading(false);
                }
            } catch(e) { console.error(e); if(mounted) setLoading(false); }
        };
        fetchContent();
        return () => { mounted = false; };
    }, [moduleId]);

    const handleClose = () => {
        if (onClose) onClose();
        else deleteElements({ nodes: [{ id: nodeId }] });
    };

    return (
        <div className={classNames("bg-white rounded-xl shadow-hard border-2 border-black flex flex-col overflow-hidden transition-all duration-300", {
            "w-[600px]": !isFullScreen,
            "h-[700px]": !isFullScreen,
            "w-full h-full max-w-6xl mx-auto my-4": isFullScreen
        })}>
            {/* Browser Header */}
            <div className="bg-kleem-mint border-b-2 border-black px-4 py-3 flex items-center justify-between flex-shrink-0 cursor-move custom-drag-handle">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex gap-1.5 flex-shrink-0">
                         {/* Windows-like controls */}
                        <button onClick={handleClose} className="w-4 h-4 rounded-full bg-red-400 border-2 border-black hover:bg-red-500 flex items-center justify-center transition-colors">
                            <span className="material-symbols-outlined text-[10px] font-bold text-black opacity-0 hover:opacity-100">close</span>
                        </button>
                        <button onClick={onMaximize} className="w-4 h-4 rounded-full bg-yellow-400 border-2 border-black hover:bg-yellow-500 flex items-center justify-center transition-colors">
                            <span className="material-symbols-outlined text-[10px] font-bold text-black opacity-0 hover:opacity-100">crop_square</span>
                        </button>
                    </div>
                    {/* Fake URL Bar */}
                    <div className="flex-1 max-w-md bg-white border-2 border-black rounded-md px-3 py-1.5 flex items-center gap-2 shadow-sm">
                        <span className="material-symbols-outlined text-[10px] font-bold text-gray-500">lock</span>
                        <span className="text-xs font-bold truncate text-gray-700">kleem://learn/{moduleId}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                     <div className="flex bg-white rounded-lg border-2 border-black p-1 gap-1">
                        {['READ', 'CHAT', 'LISTEN'].map(t => (
                            <button 
                                key={t} 
                                onClick={() => setTab(t as any)}
                                className={`px-3 py-1 text-[10px] font-black rounded transition-all flex items-center gap-1 ${
                                    tab === t 
                                    ? 'bg-black text-white' 
                                    : 'text-black hover:bg-gray-100'
                                }`}
                            >
                                {t === 'LISTEN' && <span className="material-symbols-outlined text-[10px]">headphones</span>}
                                {t === 'LISTEN' ? 'DEEP DIVE' : t}
                            </button>
                        ))}
                    </div>
                    {/* Window Controls (Alternative placement or extra actions) */}
                    <div className="flex gap-1 ml-2">
                         <button onClick={onMaximize} className="p-1 hover:bg-black hover:text-white rounded transition-colors text-black" title={isFullScreen ? "Restore" : "Maximize"}>
                            <span className="material-symbols-outlined text-sm font-bold">{isFullScreen ? 'close_fullscreen' : 'check_box_outline_blank'}</span>
                         </button>
                         <button onClick={handleClose} className="p-1 hover:bg-red-500 hover:text-white rounded transition-colors text-black" title="Close">
                            <span className="material-symbols-outlined text-sm font-bold">close</span>
                         </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative bg-white flex flex-col">
                {loading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6 bg-white z-10">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-gray-200 rounded-full"></div>
                            <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                        </div>
                        <p className="text-sm font-black uppercase tracking-widest text-black animate-pulse">{loadingMsg}</p>
                    </div>
                ) : !content ? (
                    <div className="flex-1 flex items-center justify-center p-8">
                        <div className="text-center font-bold text-red-500 bg-red-50 p-6 rounded-xl border-2 border-red-100">
                            Failed to load content. Please try regenerating.
                        </div>
                    </div>
                ) : (
                    <>
                         {/* Page Title Header (Inside content - only for READ) */}
                        {tab === 'READ' && (
                            <div className="border-b border-gray-100 p-6 bg-white flex-shrink-0">
                                 <div className="max-w-4xl mx-auto">
                                    <span className="text-[10px] font-black text-kleem-mint-darker uppercase tracking-widest bg-kleem-mint/30 px-2 py-1 rounded text-teal-800">Module Lesson</span>
                                    <h1 className="text-2xl md:text-3xl font-black text-black mt-2 leading-tight">{moduleTitle}</h1>
                                 </div>
                            </div>
                        )}

                        {/* Nodrag area for scrolling */}
                        <div className="flex-1 overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent nodrag cursor-text">
                            <div className="h-full">
                                {tab === 'READ' && (
                                    <div className="max-w-4xl mx-auto p-6 md:p-10 prose prose-slate prose-lg max-w-none markdown-content pb-20">
                                        {content.markdownContent?.split('\n').map((l,i) => {
                                            if(l.startsWith('# ')) return <h1 key={i} className="text-black text-3xl font-black mb-6">{l.slice(2)}</h1>;
                                            if(l.startsWith('## ')) return <h2 key={i} className="text-black text-2xl font-bold mt-8 mb-4 border-b-2 border-black inline-block pb-1">{l.slice(3)}</h2>;
                                            if(l.startsWith('### ')) return <h3 key={i} className="text-black text-xl font-bold mt-6 mb-3">{l.slice(4)}</h3>;
                                            if(l.startsWith('- ')) return <li key={i} className="font-medium text-lg ml-4 pl-4 border-l-4 border-kleem-yellow mb-3 text-gray-800 list-none relative"><span className="absolute -left-[26px] top-2 w-2 h-2 bg-black rounded-full"></span>{l.slice(2)}</li>;
                                            return <p key={i} className="text-gray-800 mb-4 leading-relaxed font-medium">{l}</p>;
                                        })}
                                    </div>
                                )}
                                {tab === 'CHAT' && <ChatView context={content.markdownContent || ''} topic={topic} suggestedQuestions={content.suggestedQuestions} />}
                                {tab === 'LISTEN' && <AudioOverview context={content.markdownContent || ''} topic={topic} />}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export const StudyNode: React.FC<StudyNodeProps> = ({ id, data, selected }) => {
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
              <StudyNodeContent 
                nodeId={id}
                {...data} 
                onClose={() => toggleFullScreen()} 
                onMaximize={() => toggleFullScreen()} 
            />
          </div>,
          document.body
      );
  }

  return (
    <>
        <NodeResizer isVisible={selected} minWidth={400} minHeight={300} lineStyle={{border: '2px solid black'}} handleStyle={{width: 12, height: 12, border: '2px solid black', background: '#FEF08A'}} />
        <Handle type="target" position={Position.Left} className="!bg-black !border-2 !border-white !w-4 !h-4" />
        <StudyNodeContent 
            nodeId={id}
            {...data} 
            onMaximize={toggleFullScreen} 
        />
        <Handle type="source" position={Position.Right} className="!bg-black !border-2 !border-white !w-4 !h-4" />
    </>
  );
};
