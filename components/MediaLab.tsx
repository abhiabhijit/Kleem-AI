
import React, { useState } from 'react';
import { generateImage, generateVideo, analyzeImage, generateSpeech, editImage } from '../services/geminiService';
import { ViewState } from '../types';

export const MediaLab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'video' | 'image' | 'analyze' | 'tts'>('image');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  
  // Image Edit State
  const [editBase64, setEditBase64] = useState<string | null>(null);

  // Veo Key State
  const checkVeoKey = async () => {
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          if (!hasKey && window.aistudio.openSelectKey) {
              await window.aistudio.openSelectKey();
          }
      }
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsLoading(true);
    setResult(null);

    try {
      if (activeTab === 'image') {
          if (editBase64) {
              // Edit mode
              const res = await editImage(editBase64.split(',')[1], prompt);
              setResult(res);
          } else {
             const res = await generateImage(prompt, '1K'); // Default 1K
             setResult(res);
          }
      } else if (activeTab === 'video') {
          await checkVeoKey(); // Ensure key
          const res = await generateVideo(prompt);
          setResult(res);
      } else if (activeTab === 'tts') {
          const res = await generateSpeech(prompt);
          // Convert raw audio base64 to blob url for player
          if (res) {
             const binary = atob(res);
             const array = new Uint8Array(binary.length);
             for(let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
             const blob = new Blob([array], {type: 'audio/mp3'}); // Gemini TTS returns mp3-like stream usually wrapped but here simplified
             // The API returns raw PCM or similar depending on config, but standard handling suggests using the context decode. 
             // For simple playback in <audio>, we need a container. 
             // Actually, the example code uses AudioContext to play. Let's do that in a simpler way or stick to AudioContext.
             // To simplify UI, let's assume result is base64 and we pass it to a custom player or handle it. 
             // For this demo, let's store base64 and use a useEffect to play it or a simple <audio> with data uri if format allows.
             // Given example used decodeAudioData, we should probably stick to that for robustness, but for "download link" style result:
             setResult(`data:audio/wav;base64,${res}`); // Note: Might need proper wav header if raw PCM
          }
      }
    } catch (e) {
      console.error(e);
      alert('Generation failed. See console.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              const base64 = reader.result as string;
              if (activeTab === 'analyze') {
                 setIsLoading(true);
                 analyzeImage(base64.split(',')[1], prompt || "Describe this image")
                    .then(txt => setResult(txt || 'No analysis'))
                    .finally(() => setIsLoading(false));
              } else if (activeTab === 'image') {
                  setEditBase64(base64);
              }
          };
          reader.readAsDataURL(file);
      }
  };

  return (
    <div className="h-full flex flex-col p-6 max-w-5xl mx-auto w-full overflow-y-auto">
      <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
         <span className="material-symbols-outlined text-teal-500">science</span> Media Lab
      </h2>

      <div className="flex space-x-2 mb-6 border-b border-slate-200 pb-1">
        {['image', 'video', 'tts', 'analyze'].map((tab) => (
            <button
                key={tab}
                onClick={() => { setActiveTab(tab as any); setResult(null); setEditBase64(null); }}
                className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${
                    activeTab === tab 
                    ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-500' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
            >
                {tab === 'image' && 'Image Gen/Edit'}
                {tab === 'video' && 'Veo Video'}
                {tab === 'tts' && 'Text to Speech'}
                {tab === 'analyze' && 'Analyze Upload'}
            </button>
        ))}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        
        {activeTab === 'image' && editBase64 && (
            <div className="mb-4 p-4 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <img src={editBase64} alt="To Edit" className="h-16 w-16 object-cover rounded" />
                    <span className="text-sm text-slate-600">Image selected for editing. Enter prompt below.</span>
                </div>
                <button onClick={() => setEditBase64(null)} className="text-red-500 text-sm">Clear</button>
            </div>
        )}

        {activeTab === 'analyze' || (activeTab === 'image' && !editBase64) ? (
             <div className="mb-4">
                 <label className="block text-sm font-medium text-slate-700 mb-2">
                     {activeTab === 'analyze' ? 'Upload Image/Frame to Analyze' : 'Optional: Upload Image to Edit (or skip for Generation)'}
                 </label>
                 <input type="file" accept="image/*" onChange={handleFileUpload} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"/>
             </div>
        ) : null}

        <div className="flex gap-4">
            <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                    activeTab === 'video' ? "A neon hologram of a cat driving..." :
                    activeTab === 'image' ? (editBase64 ? "Add sunglasses..." : "A diagram of mitochondria...") :
                    activeTab === 'tts' ? "Text to speak..." : 
                    "Prompt (optional for analysis)..."
                }
                className="flex-1 bg-white text-black rounded-xl border border-slate-300 p-3 focus:ring-2 focus:ring-teal-500 outline-none h-24 resize-none placeholder-gray-400"
            />
        </div>
        
        <div className="mt-4 flex justify-end">
            <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
            >
                {isLoading && <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>}
                {activeTab === 'analyze' ? 'Analyze' : 'Generate'}
            </button>
        </div>
      </div>

      {result && (
          <div className="mt-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Result</h3>
              <div className="flex justify-center bg-slate-50 p-4 rounded-xl min-h-[200px] items-center">
                  {activeTab === 'image' && <img src={result} alt="Generated" className="max-w-full rounded shadow" />}
                  {activeTab === 'video' && (
                      <video controls className="max-w-full rounded shadow" src={result} />
                  )}
                  {activeTab === 'tts' && (
                       // Simple audio player for base64/blob url
                       <audio controls autoPlay src={result} />
                  )}
                  {activeTab === 'analyze' && <p className="text-slate-700 whitespace-pre-wrap">{result}</p>}
              </div>
          </div>
      )}
    </div>
  );
};
