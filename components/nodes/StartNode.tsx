
import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import ReactDOM from 'react-dom';
import { Session, Attachment } from '../../types';
import classNames from 'classnames';

interface StartNodeProps {
  data: {
    onStart: (topic: string, attachments: Attachment[]) => Promise<void>;
    history: Session[];
    onResume: (session: Session) => void;
    isFullScreen?: boolean;
  };
}

export const StartNodeContent: React.FC<StartNodeProps['data'] & { onClose?: () => void }> = ({ onStart, history, onResume, isFullScreen, onClose }) => {
  const [input, setInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [isExpanding, setIsExpanding] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [indexingProgress, setIndexingProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Simulated indexing effect
  useEffect(() => {
    let interval: any;
    if (isLoading) {
        setIndexingProgress(0);
        interval = setInterval(() => {
            setIndexingProgress(prev => {
                if (prev >= 90) return prev;
                return prev + Math.random() * 10;
            });
        }, 500);
    } else {
        setIndexingProgress(100);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleSubmit = async () => {
    if ((input.trim() || attachments.length > 0) && !isLoading) {
      setIsLoading(true);
      try {
        await onStart(input, attachments);
      } catch (e) {
        console.error(e);
        alert("Failed to start. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files) {
          Array.from(files).forEach((file: File) => {
              const reader = new FileReader();
              reader.onload = (ev) => {
                  const base64 = (ev.target?.result as string).split(',')[1];
                  setAttachments(prev => [...prev, {
                      type: 'file',
                      name: file.name,
                      mimeType: file.type,
                      data: base64
                  }]);
              };
              reader.readAsDataURL(file);
          });
      }
  };

  const handleAddUrl = () => {
      if (urlInput.trim()) {
          setAttachments(prev => [...prev, {
              type: 'url',
              name: urlInput,
              data: urlInput
          }]);
          setUrlInput('');
      }
  };

  const removeAttachment = (index: number) => {
      setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className={classNames("bg-white rounded-xl shadow-hard border-2 border-black overflow-hidden flex flex-col", {
        "w-[480px]": !isFullScreen,
        "w-full max-w-2xl": isFullScreen
    })}>
      {/* Brand Header */}
      <div className="bg-black p-6 flex justify-between items-center">
         <div>
             <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-kleem-yellow rounded-lg flex items-center justify-center border border-white">
                    <span className="material-symbols-outlined text-black font-bold">school</span>
                </div>
                <h1 className="text-2xl font-black text-white tracking-tight">KLEEM AI</h1>
             </div>
             <p className="text-gray-400 text-xs mt-1 font-medium">OPEN SOURCE STUDY OS</p>
         </div>
         {isFullScreen && (
             <button onClick={onClose} className="text-white hover:text-gray-300">
                 <span className="material-symbols-outlined">close</span>
             </button>
         )}
         {!isFullScreen && <div className="w-3 h-3 rounded-full bg-green-400 border-2 border-white animate-pulse"></div>}
      </div>

      <div className="p-6 space-y-6 bg-kleem-offwhite">
        {/* Topic Input */}
        <div>
            <label className="block text-sm font-bold text-black uppercase tracking-wider mb-2">
                What do you want to master?
            </label>
            <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="e.g. Molecular Biology, React Hooks..."
                className="w-full bg-white text-black border-2 border-black rounded-lg px-4 py-3 text-lg font-medium placeholder-gray-400 focus:ring-0 focus:bg-yellow-50 focus:shadow-hard-sm transition-all outline-none"
                disabled={isLoading}
            />
        </div>

        {/* Resources Input */}
        <div className="space-y-3">
             <label className="block text-sm font-bold text-black uppercase tracking-wider">
                Upload Context
            </label>
            
            <div className="flex gap-3">
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-2 border-2 border-black border-dashed rounded-lg p-3 bg-white text-black hover:bg-kleem-mint transition-colors font-bold text-sm disabled:opacity-50"
                >
                    <span className="material-symbols-outlined">upload_file</span>
                    <span>PDF / Image</span>
                </button>
                <input 
                    type="file" 
                    multiple 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="application/pdf,image/*" 
                    onChange={handleFileSelect}
                />
            </div>
            
            <div className="flex gap-2">
                <input 
                    type="text" 
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 bg-white text-black border-2 border-black rounded-lg px-3 py-2 text-sm font-medium outline-none focus:bg-yellow-50 placeholder-gray-400"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
                    disabled={isLoading}
                />
                <button 
                    onClick={handleAddUrl}
                    disabled={!urlInput || isLoading}
                    className="bg-black text-white border-2 border-black rounded-lg px-3 hover:bg-gray-800 disabled:opacity-50"
                >
                    <span className="material-symbols-outlined text-sm">add</span>
                </button>
            </div>

            {/* Chip List */}
            {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                    {attachments.map((att, idx) => (
                        <div key={idx} className="flex items-center gap-1 bg-white border-2 border-black px-2 py-1 rounded shadow-hard-sm text-xs font-bold text-black transform hover:-translate-y-0.5 transition-transform">
                            <span className="material-symbols-outlined text-[14px]">
                                {att.type === 'file' ? 'description' : 'link'}
                            </span>
                            <span className="truncate max-w-[150px]">{att.name}</span>
                            <button onClick={() => removeAttachment(idx)} disabled={isLoading} className="hover:text-red-600">
                                <span className="material-symbols-outlined text-[14px] font-bold">close</span>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>

        <button 
            onClick={handleSubmit}
            disabled={isLoading || (!input && attachments.length === 0)}
            className="w-full bg-kleem-yellow text-black border-2 border-black rounded-xl py-4 font-black text-lg hover:bg-yellow-300 hover:shadow-hard transition-all flex items-center justify-center gap-2 active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
        >
            {isLoading && (
                <div 
                    className="absolute left-0 top-0 bottom-0 bg-yellow-400/50 transition-all duration-300"
                    style={{ width: `${indexingProgress}%` }}
                ></div>
            )}
            
            <div className="relative flex items-center gap-2">
                {isLoading ? (
                    <>
                        <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                        <span>{attachments.length > 0 ? 'INDEXING SOURCES...' : 'PLANNING...'}</span>
                    </>
                ) : (
                    <>
                        <span>START LEARNING</span>
                        <span className="material-symbols-outlined font-bold">arrow_forward</span>
                    </>
                )}
            </div>
        </button>

        {/* History Area */}
        {history && history.length > 0 && (
            <div className="border-t-2 border-dashed border-gray-300 pt-4 mt-4">
                <div 
                    className="flex justify-between items-center cursor-pointer mb-3"
                    onClick={() => setIsExpanding(!isExpanding)}
                >
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Session History</span>
                    <span className="material-symbols-outlined text-black">
                        {isExpanding ? 'expand_less' : 'expand_more'}
                    </span>
                </div>
                
                <div className={`space-y-2 transition-all duration-300 ${isExpanding ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                    {/* Safe mapping for history */}
                    {history.map((session) => (
                        <button
                            key={session.id}
                            onClick={() => onResume(session)}
                            className="w-full text-left p-3 rounded-lg bg-white border-2 border-transparent hover:border-black hover:shadow-hard-sm transition-all flex items-center gap-3 group"
                        >
                            <div className="w-8 h-8 rounded-md bg-kleem-purple border-2 border-black flex items-center justify-center text-xs font-black text-black">
                                {session.topic.substring(0,2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-black truncate">{session.topic}</p>
                                <p className="text-xs text-gray-500 font-medium">
                                    {new Date(session.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export const StartNode: React.FC<StartNodeProps> = ({ data }) => {
  if (data.isFullScreen) {
      return ReactDOM.createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <StartNodeContent {...data} onClose={() => window.dispatchEvent(new CustomEvent('close-fullscreen'))} />
          </div>,
          document.body
      );
  }

  return (
    <div className="relative">
      <StartNodeContent {...data} />
      <Handle type="source" position={Position.Right} className="!bg-black !border-2 !border-white !w-4 !h-4" />
    </div>
  );
};
