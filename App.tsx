import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import LiveSession from './components/LiveSession';
import { ExerciseConfig } from './types';

const App: React.FC = () => {
  const [activeExercise, setActiveExercise] = useState<ExerciseConfig | null>(null);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50">
      {activeExercise ? (
        <LiveSession 
          exercise={activeExercise} 
          onEndSession={() => setActiveExercise(null)} 
        />
      ) : (
        <>
          <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur fixed w-full z-40">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-tr from-teal-400 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
                  K
                </div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                  Kinetix AI
                </span>
              </div>
              <div className="flex items-center space-x-6">
                <a href="#" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">History</a>
                <a href="#" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Settings</a>
                <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600"></div>
              </div>
            </div>
          </nav>
          
          <main className="pt-20">
             <Dashboard onSelectExercise={setActiveExercise} />
          </main>
        </>
      )}
    </div>
  );
};

export default App;
