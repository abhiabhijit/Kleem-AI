import React from 'react';
import { Canvas } from './components/Canvas';

const App: React.FC = () => {
  return (
    <div className="h-screen w-screen overflow-hidden">
        <Canvas />
    </div>
  );
};

export default App;