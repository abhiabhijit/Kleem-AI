
import React from 'react';
import { NodeResizer } from 'reactflow';
import { LiveSession } from '../LiveSession';

interface LiveNodeProps {
    selected?: boolean;
}

export const LiveNode: React.FC<LiveNodeProps> = ({ selected }) => {
    return (
        <>
            <NodeResizer 
                isVisible={selected} 
                minWidth={340} 
                minHeight={450} 
                lineStyle={{border: '2px solid white'}} 
                handleStyle={{width: 12, height: 12, border: '2px solid white', background: '#EF4444'}} 
            />
            {/* Added custom-drag-handle to the header div */}
            <div className="bg-black rounded-2xl shadow-hard border-2 border-white w-full h-full overflow-hidden flex flex-col min-w-[340px] min-h-[450px]">
                <div className="bg-kleem-purple border-b-2 border-white p-3 flex justify-between items-center px-4 cursor-grab active:cursor-grabbing flex-shrink-0 custom-drag-handle">
                    <span className="text-black text-sm font-black uppercase tracking-wider flex items-center gap-2 pointer-events-none">
                        <span className="w-3 h-3 rounded-full bg-red-500 border-2 border-black animate-pulse"></span>
                        Live Tutor
                    </span>
                    <span className="material-symbols-outlined text-black font-bold pointer-events-none">drag_handle</span>
                </div>
                {/* Added nodrag to content area so interaction doesn't drag the node */}
                <div className="flex-1 bg-black overflow-hidden nodrag">
                    <LiveSession />
                </div>
            </div>
        </>
    );
};
