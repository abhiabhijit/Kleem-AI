import React, { useState } from 'react';
import { LiveSession } from '../LiveSession';

export const LiveNode: React.FC = () => {
    return (
        <div className="bg-black rounded-2xl shadow-hard border-2 border-white w-[340px] h-[450px] overflow-hidden flex flex-col">
            <div className="bg-kleem-purple border-b-2 border-white p-3 flex justify-between items-center px-4 cursor-grab active:cursor-grabbing">
                <span className="text-black text-sm font-black uppercase tracking-wider flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500 border-2 border-black animate-pulse"></span>
                    Live Tutor
                </span>
                <span className="material-symbols-outlined text-black font-bold">drag_handle</span>
            </div>
            <div className="flex-1 bg-black">
                <LiveSession />
            </div>
        </div>
    );
};