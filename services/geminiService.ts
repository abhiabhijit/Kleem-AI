
import { 
  GoogleGenAI, 
  GenerateContentResponse,
  Modality,
  Type
} from "@google/genai";
import { Course, LessonContent, Attachment } from "../types";

// Initialize the API client strictly as requested
const getAIClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Command Interpretation (New) ---

export const interpretAgentCommand = async (command: string, context: string = '') => {
  const ai = getAIClient();
  const prompt = `You are an AI OS assistant controlling a node-based study interface. The user wants to create a new node connected to a previous node.
  
  Current Context (Previous Node Topic): "${context}"
  User Command: "${command}"
  
  Determine the most appropriate node type and initial configuration.
  If the command is vague (e.g., "next", "practice", "quiz me"), use the Context to define the topic.
  
  Available Types:
  - study: For learning a new topic (markdown content + chat).
  - quiz: For testing knowledge on a topic.
  - slides: For visual presentation of a topic.
  - code: For programming practice (python, javascript, sql, etc).
  - media: For analyzing images or videos.
  - live: For starting a voice conversation.
  
  Return JSON:
  {
    "type": "study" | "quiz" | "slides" | "code" | "media" | "live",
    "data": {
       "topic": "Explicit topic from command OR derived from context.",
       "language": "programming language" (only for code),
       "code": "starter code if requested" (only for code),
       "mediaUrl": "url if provided" (only for media)
    }
  }`;

  try {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: prompt }] },
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
  } catch (e) {
      console.error("Interpreter failed", e);
      return { type: 'study', data: { topic: command || context || 'General Topic' } }; // Fallback
  }
}

// --- Text & Chat ---

export const streamChatResponse = async function* (
  history: { role: string; parts: { text: string }[] }[],
  newMessage: string,
  useSearch: boolean = false,
  systemInstruction?: string
) {
  const ai = getAIClient();
  const model = useSearch ? 'gemini-2.5-flash' : 'gemini-3-pro-preview';
  
  const tools = useSearch ? [{ googleSearch: {} }] : undefined;

  const chat = ai.chats.create({
    model: model,
    history: history,
    config: {
      tools: tools,
      systemInstruction: systemInstruction,
    }
  });

  const result = await chat.sendMessageStream({ message: newMessage });
  
  for await (const chunk of result) {
    const c = chunk as GenerateContentResponse;
    yield c;
  }
};

// --- Exam Prep (Thinking) ---

export const generateExamPlan = async function* (topic: string, attachments: Attachment[] = []) {
  const ai = getAIClient();
  
  // Construct content parts
  const parts: any[] = [];

  // Add Attachments (Files)
  attachments.forEach(att => {
      if (att.type === 'file' && att.mimeType) {
          parts.push({
              inlineData: {
                  mimeType: att.mimeType,
                  data: att.data
              }
          });
      }
  });

  // Add URLs and Topic to text prompt
  let textPrompt = `Prepare a high-level exam strategy and study plan. `;
  
  const urls = attachments.filter(a => a.type === 'url').map(a => a.data);
  if (urls.length > 0) {
      textPrompt += `\nConsider content from these resources: ${urls.join(', ')}.`;
  }
  
  if (topic) {
    textPrompt += `\nFocus topic: ${topic}.`;
  } else {
    textPrompt += `\nAnalyze the provided documents/images to determine the subject matter.`;
  }

  textPrompt += `\nFocus on the top 3-5 critical areas to master based on the provided context.`;

  parts.push({ text: textPrompt });

  // Using gemini-3-pro-preview with thinking budget
  try {
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3-pro-preview",
      contents: { parts },
      config: {
        thinkingConfig: { thinkingBudget: 10000 },
      }
    });

    for await (const chunk of responseStream) {
      yield chunk.text;
    }
  } catch (error) {
    // Fallback if 3-pro fails
    console.warn("Thinking model failed, falling back to Flash", error);
    yield "Thinking model busy. Switching to fast mode...\n";
    const fallbackResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts }
    });
    yield fallbackResponse.text || "";
  }
};

// --- Curriculum Generation ---

const safeParseJSON = (text: string) => {
    try {
        return JSON.parse(text);
    } catch (e) {
        // Attempt to repair common truncation issues
        let repaired = text.trim();
        // If it looks like JSON but ends abruptly
        if (repaired.startsWith('{') && !repaired.endsWith('}')) {
             repaired += '"}'.repeat(5); // Aggressive closing
        }
        try { return JSON.parse(repaired); } catch (e2) { return {}; }
    }
}

export const generateCurriculum = async (topic: string, plan: string, onProgress?: (status: string) => void): Promise<Course> => {
  const ai = getAIClient();
  if (onProgress) onProgress("Drafting course structure...");
  
  // Simplified prompt to reduce token usage and risk of 500 error
  const prompt = `Create a structured course for '${topic || 'this subject'}' based on the plan below.
  Plan Summary: ${plan.substring(0, 2000)}...
  
  Return a valid JSON object ONLY:
  {
    "title": "Course Title",
    "description": "Short description",
    "modules": [
      { "id": "1", "title": "Module Name", "description": "Brief summary", "concepts": ["Key Concept 1"] }
    ]
  }`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      // Schema definition omitted to allow more flexibility and reduce strict validation errors, relying on prompt
    }
  });

  const data = safeParseJSON(response.text || "{}");
  if (!Array.isArray(data.modules)) {
      data.modules = [];
  }
  return data as Course;
};

// --- Lesson Content Generation ---

export const generateLessonContent = async (moduleId: string, moduleTitle: string, topic: string): Promise<LessonContent> => {
  const ai = getAIClient();
  const prompt = `Create a lesson for "${moduleTitle}" in "${topic}".
  Return JSON:
  {
    "markdownContent": "Detailed explanation with markdown.",
    "slides": [{ "title": "Slide Title", "bullets": ["Point 1"], "imagePrompt": "Visual description" }],
    "quiz": [{ "question": "Q1", "options": ["A","B"], "correctIndex": 0, "explanation": "Why" }],
    "suggestedQuestions": ["Question 1", "Question 2", "Question 3"]
  }
  Keep it concise.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    }
  });

  const data = safeParseJSON(response.text || "{}");
  
  // Defensive defaults
  if (!Array.isArray(data.slides)) data.slides = [];
  data.slides.forEach((s: any) => {
      if (!Array.isArray(s.bullets)) s.bullets = [];
  });
  if (!Array.isArray(data.quiz)) data.quiz = [];
  if (!Array.isArray(data.suggestedQuestions)) data.suggestedQuestions = [];
  
  return { ...data, moduleId };
};

// --- Podcast Generation (New) ---

export const generatePodcastScript = async (topic: string, context: string) => {
    const ai = getAIClient();
    const prompt = `Generate a podcast script between two hosts, 'Sascha' (Host) and 'Marina' (Expert), discussing the following topic: ${topic}.
    
    Context material:
    ${context.substring(0, 5000)}...
    
    The script should be engaging, conversational, and roughly 2-3 minutes long.
    Use the format:
    Sascha: [text]
    Marina: [text]
    
    Return ONLY the script text.
    `;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
    });
    return response.text || "";
}

export const generatePodcastAudio = async (script: string) => {
    const ai = getAIClient();
    
    // We pass the script directly to the TTS model with multi-speaker config
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: script }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                multiSpeakerVoiceConfig: {
                    speakerVoiceConfigs: [
                        {
                            speaker: 'Sascha',
                            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } // Sascha - Friendly
                        },
                        {
                            speaker: 'Marina',
                            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } // Marina - Expert
                        }
                    ]
                }
            }
        }
    });
    
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
}


// --- Specialized Generators for specific nodes ---

export const generateQuizOnly = async (topic: string, context?: string): Promise<any[]> => {
    const ai = getAIClient();
    const prompt = `Create a 5-question multiple choice quiz for "${topic}". ${context ? `Context: ${context.substring(0, 500)}...` : ''}
    Return JSON array of objects: [{ "question": "...", "options": ["..."], "correctIndex": 0, "explanation": "..." }]`;
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    const data = safeParseJSON(response.text || "[]");
    return Array.isArray(data) ? data : (data.quiz || []);
}

export const generateSlidesOnly = async (topic: string, context?: string): Promise<any[]> => {
    const ai = getAIClient();
    const prompt = `Create a 5-slide presentation for "${topic}". ${context ? `Context: ${context.substring(0, 500)}...` : ''}
    Return JSON array: [{ "title": "...", "bullets": ["..."], "imagePrompt": "Visual description for slide" }]`;
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    const data = safeParseJSON(response.text || "[]");
    return Array.isArray(data) ? data : (data.slides || []);
}


// --- Code Execution ---

export const executeCode = async (code: string, language: string = 'python') => {
  const ai = getAIClient();
  const prompt = `Act as a ${language} interpreter. Execute the following code and return ONLY the output. 
  Do not explain the code. 
  If there is an error, return the error message.
  
  Code:
  \`\`\`${language}
  ${code}
  \`\`\`
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: { parts: [{ text: prompt }] }
  });

  return response.text || "";
};

// --- Vision & Analysis ---

export const analyzeImage = async (base64Image: string, prompt: string) => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: {
      parts: [
        { inlineData: { mimeType: "image/png", data: base64Image } },
        { text: prompt }
      ]
    }
  });
  return response.text;
};

export const editImage = async (base64Image: string, prompt: string) => {
   const ai = getAIClient();
   const response = await ai.models.generateContent({
     model: 'gemini-2.5-flash-image',
     contents: {
       parts: [
         {
           inlineData: {
             data: base64Image,
             mimeType: 'image/png', // Assuming png for simplicity
           },
         },
         {
           text: prompt,
         },
       ],
     },
   });

   // Extract image from response
   for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
   }
   return null;
}

export const analyzeMedia = async (url: string, type: 'image' | 'video', prompt: string) => {
  const ai = getAIClient();
  const model = "gemini-2.5-flash";

  try {
      let mimeType = type === 'image' ? 'image/jpeg' : 'video/mp4';
      let data = '';

      if (url.startsWith('data:')) {
          const parts = url.split(',');
          const meta = parts[0];
          data = parts[1];
          const matches = meta.match(/:(.*?);/);
          if (matches) mimeType = matches[1];
      } else {
          // Attempt fetch for public URLs 
          const response = await fetch(url);
          if (!response.ok) throw new Error("Failed to fetch media");
          const blob = await response.blob();
          mimeType = blob.type;
          
          data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                  const result = reader.result as string;
                  resolve(result.split(',')[1]);
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
          });
      }

      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            { inlineData: { mimeType, data } },
            { text: prompt }
          ]
        }
      });

      return response.text || "No analysis provided.";
  } catch (error: any) {
      console.error("Media analysis error", error);
      return `Analysis failed: ${error.message || "Unknown error"}. Note: Remote URLs may be blocked by CORS.`;
  }
}

// --- Video Understanding ---

export const analyzeVideoContent = async (base64Frames: string[], prompt: string) => {
  const ai = getAIClient();
  const parts = base64Frames.map(frame => ({
    inlineData: { mimeType: "image/jpeg", data: frame }
  }));
  parts.push({ text: prompt } as any);

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: { parts }
  });
  return response.text;
};


// --- Generation (Image, Video, Audio) ---

export const generateImage = async (prompt: string, size: "1K" | "2K" | "4K" = "1K") => {
  const ai = getAIClient();
  
  // Use gemini-2.5-flash-image for faster, simpler diagram generation in lessons
  const model = size === '1K' ? 'gemini-2.5-flash-image' : 'gemini-3-pro-image-preview';

  const response = await ai.models.generateContent({
    model: model,
    contents: {
      parts: [{ text: prompt }],
    },
    config: {
       // aspectRatio and imageSize only for pro-image, but for flash-image we just pass basic prompt
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
};

export const generateSpeech = async (text: string) => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Fenrir' },
        },
      },
    },
  });
  
  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return base64Audio;
};

// --- Veo Video Generation ---

export const generateVideo = async (prompt: string): Promise<string | null> => {
  const ai = getAIClient(); 
  
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: prompt,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({operation: operation});
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (downloadLink) {
    return `${downloadLink}&key=${process.env.API_KEY}`;
  }
  return null;
};

// --- Audio Transcription ---

export const transcribeAudio = async (base64Audio: string) => {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
            parts: [
                { inlineData: { mimeType: "audio/wav", data: base64Audio } }, 
                { text: "Transcribe this audio exactly." }
            ]
        }
    });
    return response.text;
}

// --- Live Client Factory ---
export const getLiveClient = () => {
    return getAIClient();
}
