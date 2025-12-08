
import React, { useState, useEffect } from 'react';
import { Handle, Position, NodeResizer, useReactFlow } from 'reactflow';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import { generateQuizOnly } from '../../services/geminiService';
import { QuizQuestion } from '../../types';

interface QuizNodeProps {
  id: string;
  data: {
    topic: string;
    context?: string;
    isFullScreen?: boolean;
  };
  selected?: boolean;
}

export const QuizNodeContent: React.FC<QuizNodeProps['data'] & { nodeId: string; onClose?: () => void; onMaximize?: () => void }> = ({ topic, context, isFullScreen, onClose, onMaximize, nodeId }) => {
    const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
    const [answers, setAnswers] = useState<number[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(true);
    const { deleteElements } = useReactFlow();

    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                const data = await generateQuizOnly(topic, context);
                setQuiz(data);
                setAnswers(new Array(data.length).fill(-1));
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchQuiz();
    }, [topic, context]);

    const handleClose = () => {
        if(onClose) onClose();
        else deleteElements({ nodes: [{ id: nodeId }] });
    };

    const score = answers.reduce((acc, curr, idx) => acc + (curr === quiz[idx]?.correctIndex ? 1 : 0), 0);

    return (
        <div className={classNames("bg-kleem-mint/20 rounded-xl shadow-hard border-2 border-black flex flex-col overflow-hidden transition-all duration-300", {
            "w-[400px] h-[500px]": !isFullScreen,
            "w-full h-full max-w-4xl mx-auto my-4": isFullScreen
        })}>
            <div className="bg-black text-white p-3 flex justify-between items-center px-4 border-b-2 border-black cursor-move custom-drag-handle">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-yellow-400">quiz</span>
                    <span className="font-bold uppercase tracking-wider text-sm">Quiz: {topic.substring(0, 15)}...</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onMaximize} className="p-1 hover:bg-gray-800 rounded text-white"><span className="material-symbols-outlined text-sm">{isFullScreen ? 'close_fullscreen' : 'check_box_outline_blank'}</span></button>
                    <button onClick={handleClose} className="p-1 hover:bg-red-600 rounded text-white"><span className="material-symbols-outlined text-sm">close</span></button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white nodrag cursor-default">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
                        <p className="mt-4 text-xs font-bold uppercase tracking-widest">Generating Questions...</p>
                    </div>
                ) : (
                    <>
                         {quiz.map((q, idx) => (
                            <div key={idx} className="bg-white p-4 rounded-xl border-2 border-black shadow-hard-sm">
                                <p className="font-bold text-sm mb-3 text-black flex gap-2">
                                    <span className="bg-black text-white w-5 h-5 rounded flex items-center justify-center text-xs flex-shrink-0 mt-0.5">{idx + 1}</span>
                                    {q.question}
                                </p>
                                <div className="space-y-1.5 pl-7">
                                    {q.options.map((opt, oIdx) => {
                                        let cls = "block w-full text-left px-3 py-2 text-xs font-bold rounded-lg border-2 transition-all ";
                                        if (submitted) {
                                            if (oIdx === q.correctIndex) cls += "bg-green-100 border-green-600 text-green-900 ";
                                            else if (answers[idx] === oIdx) cls += "bg-red-100 border-red-600 text-red-900 ";
                                            else cls += "border-gray-100 opacity-50 text-gray-400 ";
                                        } else {
                                            cls += answers[idx] === oIdx ? "bg-kleem-yellow border-black text-black shadow-hard-sm" : "bg-white border-gray-200 hover:border-black text-gray-700 hover:bg-gray-50";
                                        }
                                        return <button key={oIdx} onClick={() => !submitted && setAnswers(prev => { const n = [...prev]; n[idx] = oIdx; return n; })} className={cls}>{opt}</button>
                                    })}
                                </div>
                            </div>
                        ))}
                        
                        {!submitted ? (
                            <button 
                                onClick={() => setSubmitted(true)} 
                                disabled={answers.includes(-1)}
                                className="w-full bg-black text-white border-2 border-black py-3 rounded-xl text-md font-black hover:bg-gray-800 shadow-hard transition-all disabled:opacity-50"
                            >
                                SUBMIT
                            </button>
                        ) : (
                            <div className="text-center p-4 bg-black text-white rounded-xl border-2 border-black shadow-hard">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Score</p>
                                <h3 className="text-3xl font-black">{score} / {quiz.length}</h3>
                                <button onClick={() => { setSubmitted(false); setAnswers(new Array(quiz.length).fill(-1)); }} className="text-xs font-bold underline hover:text-kleem-yellow mt-2">Try Again</button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export const QuizNode: React.FC<QuizNodeProps> = ({ id, data, selected }) => {
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
            <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <QuizNodeContent nodeId={id} {...data} onClose={() => toggleFullScreen()} onMaximize={() => toggleFullScreen()} />
            </div>,
            document.body
        );
    }
    return (
        <>
            <NodeResizer isVisible={selected} minWidth={300} minHeight={400} lineStyle={{border: '2px solid black'}} handleStyle={{width: 12, height: 12, border: '2px solid black', background: '#FCD34D'}} />
            <Handle type="target" position={Position.Left} className="!bg-black !border-2 !border-white !w-4 !h-4" />
            <QuizNodeContent nodeId={id} {...data} onMaximize={toggleFullScreen} />
            <Handle type="source" position={Position.Right} className="!bg-black !border-2 !border-white !w-4 !h-4" />
        </>
    );
};
