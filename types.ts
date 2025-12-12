

// Global types for AI Studio and App
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  CHAT_STUDY = 'CHAT_STUDY',
  EXAM_PREP = 'EXAM_PREP',
  LIVE_SESSION = 'LIVE_SESSION',
  MEDIA_LAB = 'MEDIA_LAB',
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  isThinking?: boolean;
  sources?: Array<{ title: string; uri: string }>;
  image?: string;
  audioData?: string;
}

export interface Attachment {
  type: 'file' | 'url';
  mimeType?: string; // e.g., 'application/pdf', 'image/png'
  data: string; // base64 for files, url string for urls
  name?: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  modules: CourseModule[];
}

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  concepts: string[];
}

export interface Slide {
  title: string;
  bullets: string[];
  imagePrompt?: string; 
  imageUrl?: string;    
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface LessonContent {
  moduleId: string;
  markdownContent: string;
  slides: Slide[];
  quiz: QuizQuestion[];
  suggestedQuestions?: string[];
}

// Session History Types
export interface Session {
    id: string;
    topic: string;
    createdAt: number;
    course: Course;
    graphState?: { nodes: any[], edges: any[] };
    lastModified?: number;
}

// React Flow Types (Implicitly used but defined here for structured data props)
export type NodeData = {
    // Start Node
    onStart?: (topic: string, attachments: Attachment[]) => Promise<void>;
    history?: Session[];
    onResume?: (session: Session) => void;
    onClearHistory?: () => void;
    
    // Curriculum Node
    course?: Course;
    onSelectModule?: (module: CourseModule) => void;
    
    // Study Node
    moduleTitle?: string;
    moduleId?: string;
    topic?: string;
    lessonContent?: LessonContent; // Persistence
    onAction?: (action: 'SLIDES' | 'CODE', data: any) => void; // New Action Handler
    
    // Quiz Node
    quizContent?: QuizQuestion[]; // Persistence
    
    // Slide Node
    slideContent?: Slide[]; // Persistence
    
    // Code Node
    code?: string; // Persistence
    language?: string;
    chatHistory?: { role: string; text: string }[]; // Persistence for Code Assistant
    isAssistantOpen?: boolean;
    
    // Media Node
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    mediaAnalysis?: string; // Persistence
    
    // Generic
    label?: string;
    context?: string;
    isFullScreen?: boolean;
    onNavigate?: (direction: 'prev' | 'next') => void;
}
