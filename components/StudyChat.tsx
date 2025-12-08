import React, { useState, useRef, useEffect } from 'react';
import { streamChatResponse } from '../services/geminiService';
import { Message } from '../types';

export const StudyChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'model', content: 'Hello! I am your study assistant. Ask me anything about your course materials, or toggle "Web Search" for current events.' }
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSubmit = async () => {
    if (!input.trim() || isStreaming) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);

    const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
    }));

    try {
      const generator = streamChatResponse(history, userMsg.content, useSearch);
      
      let responseText = '';
      let currentMsgId = (Date.now() + 1).toString();
      let sources: Array<{ title: string; uri: string }> = [];

      setMessages(prev => [...prev, { id: currentMsgId, role: 'model', content: '' }]);

      for await (const chunk of generator) {
        const text = chunk.text;
        if (text) {
          responseText += text;
          
          // Check for grounding
          if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
             const chunks = chunk.candidates[0].groundingMetadata.groundingChunks;
             chunks.forEach((c: any) => {
                 if (c.web?.uri) {
                     sources.push({ title: c.web.title || 'Source', uri: c.web.uri });
                 }
             });
          }

          setMessages(prev => 
            prev.map(m => m.id === currentMsgId ? { ...m, content: responseText, sources: sources.length > 0 ? sources : undefined } : m)
          );
        }
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: 'Error connecting to Gemini.' }]);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${
              msg.role === 'user' 
                ? 'bg-brand-600 text-white rounded-br-none' 
                : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
            }`}>
              <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
              
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                    <p className="text-xs font-semibold mb-2 text-slate-500 uppercase">Sources</p>
                    <div className="flex flex-wrap gap-2">
                        {msg.sources.map((s, idx) => (
                            <a 
                                key={idx} 
                                href={s.uri} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-xs bg-slate-100 hover:bg-slate-200 text-brand-600 px-2 py-1 rounded border border-slate-200 truncate max-w-[200px]"
                            >
                                {s.title}
                            </a>
                        ))}
                    </div>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center mb-2 space-x-2">
                <label className="flex items-center text-xs text-slate-500 cursor-pointer hover:text-brand-600">
                    <input 
                        type="checkbox" 
                        checked={useSearch} 
                        onChange={(e) => setUseSearch(e.target.checked)} 
                        className="mr-2 rounded text-brand-600 focus:ring-brand-500"
                    />
                    Enable Google Search Grounding (Gemini Flash)
                </label>
            </div>
          <div className="flex gap-2 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Ask a question..."
              className="flex-1 rounded-xl border border-slate-300 px-4 py-3 pr-12 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none shadow-sm"
              disabled={isStreaming}
            />
            <button
              onClick={handleSubmit}
              disabled={isStreaming || !input}
              className="absolute right-2 top-2 bg-brand-600 text-white p-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
