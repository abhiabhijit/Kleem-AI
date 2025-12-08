import React from 'react';
import { ViewState } from '../types';

interface DashboardProps {
  onNavigate: (view: ViewState) => void;
}

const FeatureCard = ({ 
  title, 
  desc, 
  icon, 
  color,
  onClick 
}: { 
  title: string; 
  desc: string; 
  icon: string; 
  color: string;
  onClick: () => void 
}) => (
  <button 
    onClick={onClick}
    className="group p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all text-left flex flex-col h-full"
  >
    <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
      <span className="material-symbols-outlined text-white text-2xl">{icon}</span>
    </div>
    <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
    <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
  </button>
);

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  return (
    <div className="flex-1 overflow-y-auto p-8 lg:p-12">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-3">Welcome back, Scholar</h1>
          <p className="text-slate-600 text-lg">Ready to master your materials? Choose a study mode below.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard 
            title="Exam Prep" 
            desc="Use Gemini 2.0 Pro's thinking capabilities to build a rigorous study plan."
            icon="psychology"
            color="bg-purple-600"
            onClick={() => onNavigate(ViewState.EXAM_PREP)}
          />
          <FeatureCard 
            title="Live Tutor" 
            desc="Have a real-time voice conversation with your AI tutor to reinforce concepts."
            icon="graphic_eq"
            color="bg-rose-500"
            onClick={() => onNavigate(ViewState.LIVE_SESSION)}
          />
          <FeatureCard 
            title="Study Chat" 
            desc="Deep dive into topics with Google Search grounding and citations."
            icon="chat_bubble"
            color="bg-blue-600"
            onClick={() => onNavigate(ViewState.CHAT_STUDY)}
          />
          <FeatureCard 
            title="Media Lab" 
            desc="Generate diagrams, videos, or analyze charts and lecture recordings."
            icon="science"
            color="bg-teal-500"
            onClick={() => onNavigate(ViewState.MEDIA_LAB)}
          />
        </div>
      </div>
    </div>
  );
};
