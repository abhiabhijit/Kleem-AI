import React, { useEffect, useRef, useState } from 'react';
import { getLiveClient } from '../services/geminiService';
import { LiveServerMessage, Modality } from '@google/genai';

// --- Audio Helpers ---
function createBlob(data: Float32Array) {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  // Convert Int16Array to a binary string
  let binary = '';
  const bytes = new Uint8Array(int16.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Data = btoa(binary);

  return {
    data: base64Data,
    mimeType: 'audio/pcm;rate=16000',
  };
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
// --- End Audio Helpers ---

export const LiveSession: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('Ready to connect');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Refs for cleanup
  const sessionRef = useRef<any>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  const startSession = async () => {
    try {
      setStatus('Connecting...');
      const ai = getLiveClient();
      
      const inputCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      inputContextRef.current = inputCtx;
      outputContextRef.current = outputCtx;
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setStatus('Connected. Listening...');
            setIsActive(true);
            
            // Setup Audio Input
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const base64Audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputCtx) {
                const interrupted = msg.serverContent?.interrupted;
                if (interrupted) {
                    sourcesRef.current.forEach(s => s.stop());
                    sourcesRef.current.clear();
                    nextStartTimeRef.current = 0;
                }

                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                const audioBuffer = await decodeAudioData(
                    decode(base64Audio),
                    outputCtx,
                    24000,
                    1
                );
                
                const source = outputCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputCtx.destination);
                source.addEventListener('ended', () => sourcesRef.current.delete(source));
                source.start(nextStartTimeRef.current);
                sourcesRef.current.add(source);
                nextStartTimeRef.current += audioBuffer.duration;
            }
          },
          onclose: () => {
            setStatus('Disconnected');
            setIsActive(false);
          },
          onerror: (e) => {
            console.error(e);
            setStatus('Error occurred');
            setIsActive(false);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
          },
          systemInstruction: 'You are a helpful, encouraging tutor. Keep answers concise and conversational.',
        }
      });
      sessionRef.current = sessionPromise;

    } catch (err) {
      console.error(err);
      setStatus('Failed to start session');
    }
  };

  const stopSession = async () => {
    if (sessionRef.current) {
        const session = await sessionRef.current;
        session.close();
    }
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (inputContextRef.current) inputContextRef.current.close();
    if (outputContextRef.current) outputContextRef.current.close();
    
    setIsActive(false);
    setStatus('Session ended');
  };

  useEffect(() => {
    return () => {
        // Cleanup on unmount
        stopSession();
    };
  }, []);

  return (
    <div className="h-full flex flex-col items-center justify-center bg-slate-900 text-white p-8 relative overflow-hidden">
      {/* Visualizer Background (Simple Pulse) */}
      <div className={`absolute w-[500px] h-[500px] bg-brand-500 rounded-full blur-[128px] opacity-20 transition-all duration-1000 ${isActive ? 'scale-110' : 'scale-90'}`}></div>

      <div className="z-10 text-center space-y-8">
        <div className="relative">
             <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center transition-colors duration-300 ${isActive ? 'border-brand-400 bg-brand-900/50' : 'border-slate-700 bg-slate-800'}`}>
                <span className="material-symbols-outlined text-6xl">mic</span>
             </div>
             {isActive && (
                 <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                </span>
             )}
        </div>

        <div>
            <h2 className="text-3xl font-bold mb-2">Live Tutor</h2>
            <p className="text-slate-400 text-lg">{status}</p>
        </div>

        <button
            onClick={isActive ? stopSession : startSession}
            className={`px-8 py-4 rounded-full font-bold text-lg transition-all transform hover:scale-105 ${
                isActive 
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30' 
                : 'bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/30'
            }`}
        >
            {isActive ? 'End Session' : 'Start Conversation'}
        </button>
      </div>

      <div className="absolute bottom-8 text-slate-500 text-sm">
        Powered by Gemini 2.5 Flash Native Audio (Live API)
      </div>
    </div>
  );
};
