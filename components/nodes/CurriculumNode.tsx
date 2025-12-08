
import React from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import ReactDOM from 'react-dom';
import { Course, CourseModule } from '../../types';
import classNames from 'classnames';

interface CurriculumNodeProps {
  id: string;
  data: {
    course: Course;
    onSelectModule: (module: CourseModule) => void;
    isFullScreen?: boolean;
  };
}

export const CurriculumNodeContent: React.FC<CurriculumNodeProps['data'] & { nodeId: string; onClose?: () => void; onMaximize?: () => void }> = ({ course, onSelectModule, isFullScreen, onClose, onMaximize, nodeId }) => {
    const { deleteElements } = useReactFlow();

    const handleClose = () => {
        if (onClose) onClose();
        else deleteElements({ nodes: [{ id: nodeId }] });
    };

    return (
        <div className={classNames("bg-white rounded-xl shadow-hard border-2 border-black flex flex-col overflow-hidden transition-all duration-300", {
            "w-[450px]": !isFullScreen,
            "h-[600px]": !isFullScreen,
            "w-full h-full max-w-6xl mx-auto my-4": isFullScreen
        })}>
            {/* Browser Header */}
            <div className="bg-kleem-yellow border-b-2 border-black p-3 flex items-center justify-between flex-shrink-0 cursor-move custom-drag-handle">
                 <div className="flex items-center gap-3 w-full">
                    <div className="flex gap-1.5 flex-shrink-0">
                        <button onClick={handleClose} className="w-3 h-3 rounded-full bg-white border-2 border-black hover:bg-red-400"></button>
                        <button onClick={onMaximize} className="w-3 h-3 rounded-full bg-white border-2 border-black hover:bg-yellow-400"></button>
                    </div>
                    {/* Fake URL Bar */}
                    <div className="flex-1 bg-white border-2 border-black px-3 py-1.5 rounded-md text-xs font-bold truncate max-w-[300px] flex items-center gap-2 text-black">
                        <span className="material-symbols-outlined text-[10px]">lock</span>
                        <span>kleem://curriculum/{course.id || 'overview'}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                     <button onClick={onMaximize} className="p-1 hover:bg-black/10 rounded"><span className="material-symbols-outlined text-sm text-black">{isFullScreen ? 'close_fullscreen' : 'crop_square'}</span></button>
                     <button onClick={handleClose} className="p-1 hover:bg-red-500 hover:text-white rounded text-black"><span className="material-symbols-outlined text-sm">close</span></button>
                </div>
            </div>

            {/* Webpage Content */}
            <div className="flex-1 overflow-y-auto bg-white p-0 relative scrollbar-thin scrollbar-thumb-black scrollbar-track-gray-100 nodrag cursor-default">
                 {/* Hero Section */}
                 <div className="p-8 border-b-2 border-black bg-kleem-offwhite">
                    <span className="inline-block px-2 py-1 rounded border border-black bg-black text-white text-[10px] font-bold uppercase tracking-widest mb-3">Course Overview</span>
                    <h1 className="text-3xl font-black text-black mb-4 tracking-tight leading-none">{course.title}</h1>
                    <p className="text-lg font-medium text-gray-700 leading-relaxed">{course.description}</p>
                 </div>

                 {/* Module List */}
                 <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xs font-black text-black uppercase tracking-widest">Syllabus</h2>
                        <span className="text-xs font-bold text-gray-500">{course.modules?.length || 0} Modules</span>
                    </div>
                    
                    {course.modules && Array.isArray(course.modules) && course.modules.map((mod, idx) => (
                        <div 
                            key={mod.id || idx}
                            className="group relative"
                        >
                            <button 
                                onClick={() => {
                                    onSelectModule(mod);
                                }}
                                className="w-full text-left p-5 rounded-xl border-2 border-black bg-white text-black hover:bg-black hover:text-white transition-all shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none flex items-start gap-4"
                            >
                                <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-kleem-yellow border-2 border-black text-black font-black text-sm group-hover:bg-white group-hover:text-black transition-colors">
                                    {idx + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-bold mb-1 leading-tight">{mod.title}</h3>
                                    <p className="text-sm font-medium opacity-70 line-clamp-2 leading-relaxed">{mod.description}</p>
                                    
                                    {mod.concepts && mod.concepts.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {mod.concepts.slice(0, 3).map(c => (
                                                <span key={c} className="text-[10px] px-2 py-0.5 rounded border border-current opacity-60 font-bold uppercase">
                                                    {c}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <span className="material-symbols-outlined opacity-0 group-hover:opacity-100 transition-opacity self-center">
                                    arrow_forward
                                </span>
                            </button>
                        </div>
                    ))}
                    {(!course.modules || course.modules.length === 0) && (
                        <div className="p-8 text-center border-2 border-dashed border-gray-300 rounded-xl">
                            <p className="text-gray-500 font-bold text-sm">No modules found in this curriculum.</p>
                        </div>
                    )}
                 </div>
            </div>
        </div>
    );
};


export const CurriculumNode: React.FC<CurriculumNodeProps> = ({ id, data }) => {
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
          <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 lg:p-8 animate-in fade-in duration-200">
              <CurriculumNodeContent 
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
    <div className="relative">
      <Handle type="target" position={Position.Left} className="!bg-black !border-2 !border-white !w-4 !h-4" />
      <CurriculumNodeContent nodeId={id} {...data} onMaximize={toggleFullScreen} />
      <Handle type="source" position={Position.Right} className="!bg-black !border-2 !border-white !w-4 !h-4" />
    </div>
  );
};
