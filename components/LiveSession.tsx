

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
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [status, setStatus] = useState('Ready to connect');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Refs for cleanup
  const sessionRef = useRef<Promise<any> | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  // Helper to stop all screen share tracks
  const cleanupScreenShare = () => {
      if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(t => t.stop());
          screenStreamRef.current = null;
      }
      if (videoRef.current) {
          videoRef.current.srcObject = null;
      }
      setIsScreenSharing(false);
  };

  const startSession = async () => {
    try {
      setStatus('Connecting...');
      const ai = getLiveClient();
      
      const inputCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      
      // CRITICAL: Explicitly resume contexts to prevent auto-suspend timeouts
      await inputCtx.resume();
      await outputCtx.resume();

      inputContextRef.current = inputCtx;
      outputContextRef.current = outputCtx;
      
      // Reset timing cursor
      nextStartTimeRef.current = 0;
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setStatus('Live');
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
            // Don't kill screen share on disconnect, user might want to reconnect
          },
          onerror: (e) => {
            console.error(e);
            setStatus('Connection Error');
            setIsActive(false);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
          },
          // System Instruction: Enforce English/User Language
          systemInstruction: 'You are a helpful, encouraging tutor. You can see the user\'s screen if they share it. Answer questions about what is on screen. Keep answers concise. CRITICAL: Always speak in the same language as the user. If the user speaks English, you MUST speak English.',
        }
      });
      sessionRef.current = sessionPromise;

    } catch (err) {
      console.error(err);
      setStatus('Failed to start session');
    }
  };

  const stopSession = async () => {
    // We optionally keep screen share running, but here we stop everything for a clean break
    cleanupScreenShare();
    
    if (sessionRef.current) {
        try {
            const session = await sessionRef.current;
            session.close();
        } catch(e) { console.log('Session already closed'); }
    }
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (inputContextRef.current) inputContextRef.current.close();
    if (outputContextRef.current) outputContextRef.current.close();
    
    setIsActive(false);
    setStatus('Session ended');
  };

  const handleToggleScreenShare = async () => {
      if (isScreenSharing) {
          cleanupScreenShare();
      } else {
          try {
              if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                  alert("Screen sharing is not supported in this browser or environment (ensure you are using HTTPS).");
                  return;
              }

              // This must be triggered by a user gesture.
              const stream = await navigator.mediaDevices.getDisplayMedia({ 
                  video: {
                      cursor: "always"
                  } as any,
                  audio: false 
              });
              
              screenStreamRef.current = stream;
              
              if (videoRef.current) {
                  videoRef.current.srcObject = stream;
                  await videoRef.current.play();
              }
              
              setIsScreenSharing(true);

              // Handle user stopping via browser UI
              stream.getVideoTracks()[0].onended = () => cleanupScreenShare();

          } catch (e: any) {
              console.error("Screen share failed", e);
              if (e.name === 'NotAllowedError') {
                  alert("Permission to share screen was denied. Please try again and select a window/screen.");
              } else if (e.name === 'NotFoundError') {
                  alert("No screen video source found.");
              } else {
                  alert(`Screen share error: ${e.message || e}`);
              }
              cleanupScreenShare();
          }
      }
  };

  // Robust Screen Share Loop
  // Only runs if we are BOTH sharing screen AND connected to Gemini
  useEffect(() => {
    let interval: any;
    
    if (isScreenSharing && isActive && videoRef.current) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        interval = setInterval(() => {
            const video = videoRef.current;
            if (!ctx || !video || !sessionRef.current) return;
            
            // Ensure video has data
            if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
                // Resize for performance (50% scale)
                canvas.width = video.videoWidth * 0.5;
                canvas.height = video.videoHeight * 0.5;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
                
                sessionRef.current.then((session: any) => {
                     session.sendRealtimeInput({
                          media: { mimeType: 'image/jpeg', data: base64 }
                      });
                });
            }
        }, 500); // 2 FPS
    }

    return () => {
        if (interval) clearInterval(interval);
    };
  }, [isScreenSharing, isActive]);


  useEffect(() => {
    return () => {
        stopSession();
    };
  }, []);

  return (
    <div className="h-full flex flex-col bg-slate-900 text-white relative overflow-hidden">
      
      {/* Main Visual Area */}
      <div className="flex-1 flex items-center justify-center relative p-4">
          
          {/* Default Pulse Animation when not sharing screen */}
          {!isScreenSharing && (
              <div className="relative z-10">
                <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center transition-colors duration-300 ${isActive ? 'border-brand-400 bg-brand-900/50' : 'border-slate-700 bg-slate-800'}`}>
                    <span className="material-symbols-outlined text-6xl">{isActive ? 'graphic_eq' : 'mic_off'}</span>
                </div>
                {isActive && (
                    <>
                        <div className="absolute -inset-4 rounded-full bg-brand-500/20 animate-ping"></div>
                        <div className="absolute -inset-12 rounded-full bg-brand-500/10 animate-pulse"></div>
                    </>
                )}
                {!isActive && (
                    <div className="absolute top-full mt-4 text-center text-slate-500 text-sm">
                        Tap "Start Tutor" to begin
                    </div>
                )}
              </div>
          )}

          {/* Screen Share Preview */}
          <div className={`absolute inset-0 flex items-center justify-center bg-black transition-opacity duration-300 ${isScreenSharing ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <video ref={videoRef} className="max-w-full max-h-full object-contain" muted playsInline />
              <div className="absolute top-4 left-4 bg-black/50 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 border border-white/20 z-10">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                  Sharing Screen
              </div>
          </div>
          
          {/* Status Overlay - Only shows if NOT sharing screen and NOT active, as a big CTA */}
          {!isActive && !isScreenSharing && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <button 
                      onClick={startSession}
                      className="bg-white text-black px-8 py-4 rounded-full font-black text-xl hover:scale-105 transition-transform shadow-hard flex items-center gap-2"
                  >
                      <span className="material-symbols-outlined text-2xl">mic</span>
                      START TUTOR
                  </button>
              </div>
          )}
      </div>

      {/* Control Bar (Toolbar) */}
      <div className="h-20 bg-black border-t-2 border-slate-800 flex items-center justify-center gap-6 z-30 flex-shrink-0">
          
          <button 
              onClick={startSession}
              disabled={isActive} 
              className={`p-4 rounded-full transition-all ${isActive ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-500'}`}
              title={isActive ? "Microphone On" : "Connect Mic"}
          >
              <span className="material-symbols-outlined">mic</span>
          </button>

          <button 
              onClick={handleToggleScreenShare}
              // Button is ALWAYS enabled now to ensure user gesture works
              className={`p-4 rounded-full transition-all ${
                  isScreenSharing ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
              title="Share Screen"
          >
              <span className="material-symbols-outlined">{isScreenSharing ? 'stop_screen_share' : 'present_to_all'}</span>
          </button>

          <button 
              onClick={stopSession}
              disabled={!isActive}
              className={`p-4 rounded-full transition-all ${!isActive ? 'bg-slate-800 text-slate-600' : 'bg-red-600 text-white hover:bg-red-500'}`}
              title="End Session"
          >
              <span className="material-symbols-outlined">call_end</span>
          </button>
      </div>

      <div className="absolute top-2 right-2 text-[10px] text-slate-500 font-mono pointer-events-none z-40">
          {status} {isScreenSharing ? '| Sharing' : ''}
      </div>
    </div>
  );
};
