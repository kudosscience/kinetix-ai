import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { EXERCISES } from '../constants';
import { ExerciseConfig } from '../types';

interface DashboardProps {
  onSelectExercise: (ex: ExerciseConfig) => void;
}

const data = [
  { name: 'Mon', score: 65 },
  { name: 'Tue', score: 72 },
  { name: 'Wed', score: 68 },
  { name: 'Thu', score: 85 },
  { name: 'Fri', score: 82 },
  { name: 'Sat', score: 90 },
  { name: 'Sun', score: 95 },
];

const Dashboard: React.FC<DashboardProps> = ({ onSelectExercise }) => {
  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Welcome back, Alex</h1>
        <p className="text-slate-400">Ready to optimize your movement patterns?</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Weekly Progress Chart */}
        <div className="lg:col-span-2 bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
          <h2 className="text-xl font-semibold text-white mb-6">Form Consistency Score</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                />
                <Area type="monotone" dataKey="score" stroke="#2dd4bf" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="space-y-4">
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
                <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">Total Reps</h3>
                <p className="text-4xl font-bold text-white mt-2">1,248</p>
                <span className="text-emerald-400 text-sm">↑ 12% this week</span>
            </div>
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
                <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">Minutes Trained</h3>
                <p className="text-4xl font-bold text-white mt-2">340</p>
                <span className="text-emerald-400 text-sm">↑ 5% this week</span>
            </div>
        </div>
      </div>

      <section>
        <h2 className="text-2xl font-bold text-white mb-6">Start New Session</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {EXERCISES.map((ex) => (
            <button
              key={ex.id}
              onClick={() => onSelectExercise(ex)}
              className="group relative overflow-hidden bg-slate-800 rounded-2xl border border-slate-700 transition-all hover:border-teal-500 hover:shadow-lg hover:shadow-teal-500/20 text-left"
            >
              <div className="aspect-video w-full overflow-hidden bg-slate-900">
                 {/* Placeholder for complex graphics */}
                 <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-4xl">
                    🏃
                 </div>
              </div>
              <div className="p-5">
                <h3 className="text-lg font-bold text-white group-hover:text-teal-400 transition-colors">{ex.name}</h3>
                <p className="text-slate-400 text-sm mt-2 line-clamp-2">{ex.description}</p>
                <div className="mt-4 flex items-center text-teal-500 text-sm font-medium">
                   Start Training <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
