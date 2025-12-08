import React, { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { generateExamPlan, generateCurriculum, generateLessonContent, generateImage, streamChatResponse } from '../services/geminiService';
import { Course, LessonContent, QuizQuestion, Slide } from '../types';

// --- UI Components (Simulating Shadcn) ---

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>{children}</div>
);

const Badge: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}>
    {children}
  </span>
);

const Button = ({ children, onClick, disabled, variant = 'primary', className = '' }: any) => {
    const baseClass = "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2";
    const variants: any = {
        primary: "bg-brand-600 text-white hover:bg-brand-700",
        secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
        outline: "border border-slate-200 bg-white hover:bg-slate-100 text-slate-900"
    };
    return (
        <button onClick={onClick} disabled={disabled} className={`${baseClass} ${variants[variant]} ${className}`}>
            {children}
        </button>
    );
};

// --- Sub-components ---

const LessonChat = ({ topic, context }: { topic: string; context: string }) => {
    const [messages, setMessages] = useState<{role: string, text: string}[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSend = async () => {
        if (!input.trim()) return;
        const newMsg = { role: 'user', text: input };
        setMessages(prev => [...prev, newMsg]);
        setInput('');
        setLoading(true);

        const history = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
        // Add context to history as system instruction or first message? 
        // We'll use system instruction in the new service method
        const generator = streamChatResponse(history, input, false, `You are a helpful tutor for the topic "${topic}". The current lesson context is: ${context.substring(0, 1000)}... Answer succinctly.`);
        
        let responseText = '';
        setMessages(prev => [...prev, { role: 'model', text: '' }]);
        
        try {
            for await (const chunk of generator) {
                if (chunk.text) {
                    responseText += chunk.text;
                    setMessages(prev => {
                        const copy = [...prev];
                        copy[copy.length - 1].text = responseText;
                        return copy;
                    });
                }
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[500px] border rounded-lg bg-slate-50">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && <p className="text-center text-slate-500 text-sm mt-10">Ask me anything about this lesson!</p>}
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-lg p-3 text-sm ${m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>
                            {m.text}
                        </div>
                    </div>
                ))}
            </div>
            <div className="p-3 border-t bg-white rounded-b-lg flex gap-2">
                <input 
                    className="flex-1 text-sm border rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500" 
                    placeholder="Ask a question..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    disabled={loading}
                />
                <button disabled={loading} onClick={handleSend} className="bg-brand-600 text-white p-2 rounded-md">
                    <span className="material-symbols-outlined text-sm">send</span>
                </button>
            </div>
        </div>
    );
};

const QuizView = ({ quiz }: { quiz: QuizQuestion[] }) => {
    const [answers, setAnswers] = useState<number[]>(new Array(quiz.length).fill(-1));
    const [showResults, setShowResults] = useState(false);

    const handleSelect = (qIdx: number, optIdx: number) => {
        if (showResults) return;
        const newAns = [...answers];
        newAns[qIdx] = optIdx;
        setAnswers(newAns);
    };

    const score = answers.reduce((acc, curr, idx) => acc + (curr === quiz[idx].correctIndex ? 1 : 0), 0);

    return (
        <div className="space-y-8 max-w-2xl mx-auto py-4">
            {quiz.map((q, idx) => (
                <Card key={idx} className="p-6">
                    <h3 className="font-semibold text-lg mb-4 text-slate-900">{idx + 1}. {q.question}</h3>
                    <div className="space-y-2">
                        {q.options.map((opt, oIdx) => {
                            let itemClass = "w-full text-left p-3 rounded-lg border transition-all text-sm ";
                            if (showResults) {
                                if (oIdx === q.correctIndex) itemClass += "bg-green-50 border-green-500 text-green-700 font-medium ";
                                else if (answers[idx] === oIdx) itemClass += "bg-red-50 border-red-500 text-red-700 ";
                                else itemClass += "border-slate-200 opacity-50 ";
                            } else {
                                if (answers[idx] === oIdx) itemClass += "bg-brand-50 border-brand-500 text-brand-700 ";
                                else itemClass += "hover:bg-slate-50 border-slate-200 text-slate-700 ";
                            }
                            
                            return (
                                <button 
                                    key={oIdx} 
                                    onClick={() => handleSelect(idx, oIdx)}
                                    className={itemClass}
                                >
                                    {opt}
                                </button>
                            );
                        })}
                    </div>
                    {showResults && (
                        <div className="mt-4 p-3 bg-slate-50 rounded-md text-sm text-slate-600">
                            <strong>Explanation:</strong> {q.explanation}
                        </div>
                    )}
                </Card>
            ))}
            
            {!showResults ? (
                <Button onClick={() => setShowResults(true)} className="w-full py-6 text-lg" disabled={answers.includes(-1)}>
                    Submit Answers
                </Button>
            ) : (
                <div className="text-center p-6 bg-slate-900 text-white rounded-xl">
                    <h3 className="text-2xl font-bold mb-2">Score: {score} / {quiz.length}</h3>
                    <p>{score === quiz.length ? "Perfect score! You're ready to move on." : "Review the explanations and try again!"}</p>
                </div>
            )}
        </div>
    );
};

const SlideDeck = ({ slides }: { slides: Slide[] }) => {
    const [current, setCurrent] = useState(0);
    const [images, setImages] = useState<Record<number, string>>({});

    useEffect(() => {
        const loadImages = async () => {
            slides.forEach(async (slide, idx) => {
                if (slide.imagePrompt && !images[idx]) {
                    const img = await generateImage(slide.imagePrompt, '1K'); // 1K is faster/cheaper via flash-image
                    if (img) setImages(prev => ({ ...prev, [idx]: img }));
                }
            });
        };
        loadImages();
    }, [slides]);

    return (
        <div className="h-[500px] flex flex-col items-center justify-center bg-slate-900 rounded-xl p-8 relative overflow-hidden text-white">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-800 z-0"></div>
            
            <div className="z-10 w-full max-w-3xl flex flex-col h-full">
                <div className="flex-1 flex flex-col justify-center items-center text-center space-y-6">
                    <h2 className="text-3xl font-bold tracking-tight">{slides[current].title}</h2>
                    
                    {images[current] ? (
                        <img src={images[current]} alt="Slide Visual" className="h-48 rounded-lg shadow-lg border border-slate-700 object-cover" />
                    ) : (
                         slides[current].imagePrompt && (
                            <div className="h-48 w-48 rounded-lg bg-slate-800 flex items-center justify-center animate-pulse">
                                <span className="material-symbols-outlined text-slate-600 text-4xl">image</span>
                            </div>
                         )
                    )}

                    <ul className="text-left space-y-3 text-lg text-slate-300">
                        {slides[current].bullets.map((b, i) => (
                            <li key={i} className="flex items-start gap-2">
                                <span className="text-brand-400 mt-1">•</span> {b}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-700">
                    <button 
                        onClick={() => setCurrent(Math.max(0, current - 1))}
                        disabled={current === 0}
                        className="p-2 hover:bg-slate-700 rounded-full disabled:opacity-30 transition-colors"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <span className="text-sm font-medium text-slate-400">{current + 1} / {slides.length}</span>
                    <button 
                        onClick={() => setCurrent(Math.min(slides.length - 1, current + 1))}
                        disabled={current === slides.length - 1}
                        className="p-2 hover:bg-slate-700 rounded-full disabled:opacity-30 transition-colors"
                    >
                        <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Main Component ---

export const ExamPrep: React.FC = () => {
  const [mode, setMode] = useState<'SETUP' | 'PLAN_VIEW' | 'COURSE_VIEW'>('SETUP');
  const [topic, setTopic] = useState('');
  const [loadingMsg, setLoadingMsg] = useState('');
  
  // Data
  const [plan, setPlan] = useState('');
  const [course, setCourse] = useState<Course | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  
  // Lesson Data
  const [lessonContent, setLessonContent] = useState<LessonContent | null>(null);
  const [lessonMode, setLessonMode] = useState<'READ' | 'WATCH' | 'QUIZ' | 'CHAT'>('READ');
  const [loadingLesson, setLoadingLesson] = useState(false);

  // Refs for animation
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Handlers ---

  const handleCreatePlan = async () => {
      if (!topic) return;
      setLoadingMsg('Designing Strategy...');
      setPlan('');
      
      try {
          const generator = generateExamPlan(topic);
          for await (const chunk of generator) {
            setPlan(prev => prev + chunk);
          }
          setMode('PLAN_VIEW');
      } catch (e) {
          console.error(e);
      } finally {
          setLoadingMsg('');
      }
  };

  const handleStartCourse = async () => {
      setLoadingMsg('Structuring Curriculum...');
      try {
          const generatedCourse = await generateCurriculum(topic, plan);
          setCourse(generatedCourse);
          if (generatedCourse.modules.length > 0) {
              setActiveModuleId(generatedCourse.modules[0].id);
              await loadLesson(generatedCourse.modules[0].id, generatedCourse.modules[0].title);
          }
          setMode('COURSE_VIEW');
      } catch (e) {
          console.error(e);
      } finally {
          setLoadingMsg('');
      }
  };

  const loadLesson = async (moduleId: string, title: string) => {
      setActiveModuleId(moduleId);
      setLoadingLesson(true);
      setLessonContent(null);
      setLessonMode('READ'); // Reset to read on new lesson

      try {
          const content = await generateLessonContent(moduleId, title, topic);
          setLessonContent(content);
      } catch (e) {
          console.error(e);
      } finally {
          setLoadingLesson(false);
      }
  };

  // --- Animation Effect ---
  useEffect(() => {
      if (mode === 'COURSE_VIEW' && containerRef.current) {
          gsap.fromTo(containerRef.current, 
            { opacity: 0, y: 20 }, 
            { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
          );
      }
  }, [mode]);

  // --- Render Views ---

  if (mode === 'SETUP' || mode === 'PLAN_VIEW') {
      return (
        <div className="max-w-4xl mx-auto p-8 h-full flex flex-col justify-center">
            <div className="text-center mb-10">
                <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">What do you want to master today?</h1>
                <p className="text-lg text-slate-600">Enter a subject, exam, or skill. We'll build a custom course for you.</p>
            </div>

            <div className="flex gap-4 mb-8">
                <input 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Molecular Biology, React Hooks, AP US History..."
                    className="flex-1 text-lg p-4 rounded-xl border border-slate-300 shadow-sm focus:ring-2 focus:ring-brand-500 outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreatePlan()}
                />
                <button 
                    onClick={handleCreatePlan}
                    disabled={!!loadingMsg || !topic}
                    className="bg-brand-600 text-white px-8 rounded-xl font-semibold text-lg hover:bg-brand-700 transition-all disabled:opacity-50 shadow-lg shadow-brand-200"
                >
                    {loadingMsg || 'Generate'}
                </button>
            </div>

            {mode === 'PLAN_VIEW' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-slate-800">Study Strategy</h2>
                        <Button onClick={handleStartCourse} className="gap-2">
                            Start Studying <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </Button>
                    </div>
                    <div className="prose prose-slate max-w-none text-slate-600">
                        {plan.split('\n').slice(0, 10).map((l, i) => <p key={i}>{l}</p>)}
                        <p className="italic text-slate-400 mt-4">...and more detailed breakdown.</p>
                    </div>
                </div>
            )}
        </div>
      );
  }

  // --- Course View ---

  return (
    <div className="flex h-full bg-slate-50" ref={containerRef}>
        {/* Sidebar Navigation */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
            <div className="p-6 border-b border-slate-100">
                <h2 className="font-bold text-lg text-slate-900 leading-tight">{course?.title}</h2>
                <p className="text-xs text-slate-500 mt-2 line-clamp-2">{course?.description}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {course?.modules.map((mod, idx) => (
                    <button
                        key={mod.id}
                        onClick={() => loadLesson(mod.id, mod.title)}
                        className={`w-full text-left p-3 rounded-lg text-sm transition-all border ${
                            activeModuleId === mod.id 
                            ? 'bg-brand-50 border-brand-200 text-brand-700 shadow-sm' 
                            : 'bg-white border-transparent hover:bg-slate-50 text-slate-600'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${activeModuleId === mod.id ? 'bg-brand-200 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>
                                {idx + 1}
                            </span>
                            <span className="font-medium truncate">{mod.title}</span>
                        </div>
                    </button>
                ))}
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50">
                <div className="w-full bg-slate-200 rounded-full h-2 mb-2">
                    <div className="bg-brand-500 h-2 rounded-full w-[10%]"></div>
                </div>
                <p className="text-xs text-center text-slate-500">Course Progress: 10%</p>
            </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
            {/* Header */}
            <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 flex-shrink-0 z-10">
                <h1 className="text-xl font-bold text-slate-800">
                    {course?.modules.find(m => m.id === activeModuleId)?.title || 'Loading...'}
                </h1>
                
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {[
                        { id: 'READ', icon: 'menu_book', label: 'Read' },
                        { id: 'WATCH', icon: 'slideshow', label: 'Slides' },
                        { id: 'CHAT', icon: 'chat', label: 'Chat' },
                        { id: 'QUIZ', icon: 'quiz', label: 'Quiz' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setLessonMode(tab.id as any)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                lessonMode === tab.id 
                                ? 'bg-white text-slate-900 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </header>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
                <div className="max-w-4xl mx-auto">
                    {loadingLesson ? (
                        <div className="flex flex-col items-center justify-center h-64 space-y-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
                            <p className="text-slate-500 animate-pulse">Generating lesson content...</p>
                        </div>
                    ) : !lessonContent ? (
                        <div className="text-center text-slate-500 mt-20">Select a module to begin.</div>
                    ) : (
                        <div className="animate-in fade-in zoom-in-95 duration-300">
                            {lessonMode === 'READ' && (
                                <Card className="p-8 md:p-12 min-h-[500px]">
                                    <div className="prose prose-slate max-w-none markdown-content">
                                        <div className="mb-6 flex gap-2">
                                            {course?.modules.find(m => m.id === activeModuleId)?.concepts.map(c => (
                                                <Badge key={c} className="bg-brand-50 text-brand-700 border-brand-200">{c}</Badge>
                                            ))}
                                        </div>
                                        {lessonContent.markdownContent.split('\n').map((line, i) => {
                                             if (line.startsWith('# ')) return <h1 key={i}>{line.replace('# ', '')}</h1>;
                                             if (line.startsWith('## ')) return <h2 key={i}>{line.replace('## ', '')}</h2>;
                                             if (line.startsWith('- ')) return <li key={i} className="ml-4">{line.replace('- ', '')}</li>;
                                             return <p key={i}>{line}</p>;
                                        })}
                                    </div>
                                </Card>
                            )}

                            {lessonMode === 'WATCH' && (
                                <SlideDeck slides={lessonContent.slides} />
                            )}

                            {lessonMode === 'QUIZ' && (
                                <QuizView quiz={lessonContent.quiz} />
                            )}

                            {lessonMode === 'CHAT' && (
                                <LessonChat 
                                    topic={course?.modules.find(m => m.id === activeModuleId)?.title || ''} 
                                    context={lessonContent.markdownContent} 
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};