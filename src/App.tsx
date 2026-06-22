import React, { useState } from 'react';
import { 
  Activity, Layers, Database, Shuffle, FileCode, Terminal, 
  CheckSquare, Zap, AlertTriangle, Monitor, BookOpen, ChevronRight, HelpCircle
} from 'lucide-react';
import InteractiveSimulator from './components/InteractiveSimulator';
import SagaDiagram from './components/SagaDiagram';
import DatabaseSchema from './components/DatabaseSchema';
import CodeExplorer from './components/CodeExplorer';
import DeploymentExplorer from './components/DeploymentExplorer';
import ApiCatalog from './components/ApiCatalog';
import ArchitecturalReview from './components/ArchitecturalReview';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('simulator');

  const navigationTabs = [
    { id: 'simulator', label: 'Interactive Simulator', icon: Monitor, badge: 'LIVE' },
    { id: 'diagrams', label: 'Topology Diagrams', icon: Shuffle },
    { id: 'database', label: 'Storage ERDs', icon: Database },
    { id: 'api', label: 'API Specifications', icon: Activity },
    { id: 'code', label: '.NET 9 Repository', icon: Terminal, badge: 'C#' },
    { id: 'devops', label: 'Platform Infrastructure', icon: FileCode },
    { id: 'review', label: 'Architectural Memo', icon: BookOpen }
  ];

  return (
    <div className="min-h-screen bg-[#020204] font-sans text-[#E0E0E0] flex flex-col selection:bg-[#00b4ff]/20 antialiased" id="main-app-container">
      {/* Top Professional Executive Header */}
      <header className="border-b border-[#1a1a2e] bg-[#050508] sticky top-0 z-50 shadow-md px-6 py-3" id="header-section">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-[#00b4ff] to-[#0047ff] rounded-sm flex items-center justify-center font-bold text-xs text-white">B+</div>
            <div>
              <h1 className="text-sm font-bold tracking-tight uppercase text-white flex items-center gap-2">
                BookingSaga.Orchestrator
                <span className="text-[10px] font-mono tracking-widest uppercase font-extrabold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  v1.2-stable
                </span>
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00ff64] animate-pulse"></div>
                  <span className="text-[9px] text-[#00ff64] font-bold uppercase tracking-widest">System Active</span>
                </div>
                <div className="h-2 w-[1px] bg-[#333]"></div>
                <span className="text-[9px] text-[#666] uppercase">Cluster: us-east-1a</span>
              </div>
            </div>
          </div>

          {/* Quick Stats overview */}
          <div className="flex items-center gap-6 border-l border-[#1a1a2e] pl-6 select-none shrink-0" id="header-stats-panel">
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider text-[#666] font-semibold">System Throughput</div>
              <div className="text-xs font-mono font-bold text-[#E0E0E0]">1,284 req/sec</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider text-[#666] font-semibold">Avg Latency (P99)</div>
              <div className="text-xs font-mono font-bold text-[#00ff64]">42ms</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider text-[#666] font-semibold">Core Runtime</div>
              <div className="text-xs font-mono font-bold text-[#00b4ff]">.NET 9 + Postgres</div>
            </div>
          </div>

        </div>
      </header>

      {/* Primary Navigation Tabs Strip */}
      <nav className="bg-[#050508] border-b border-[#1a1a2e] sticky top-[57px] z-40 shadow-sm" id="navigation-tabs-strip">
        <div className="max-w-7xl mx-auto px-6 overflow-x-auto scrollbar-none flex gap-1 py-1.5" id="nav-tabs-row">
          {navigationTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-1.5 px-3 flex items-center gap-2 rounded border text-xs font-bold transition-all relative whitespace-nowrap focus:outline-none shrink-0 ${
                  isActive 
                    ? 'bg-[#12121e] text-[#00b4ff] border-[#1a1a2e] shadow-inner text-white' 
                    : 'text-[#999] hover:text-white hover:bg-[#0c0c14]/50 border-transparent'
                }`}
              >
                <tab.icon className={`h-3.5 w-3.5 ${isActive ? 'text-[#00b4ff]' : 'text-[#666]'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[8px] font-mono leading-none tracking-wider px-1.5 py-0.5 rounded font-extrabold ${
                    tab.id === 'simulator' 
                      ? 'bg-[#00ff64]/10 text-[#00ff64] border border-[#00ff64]/20' 
                      : 'bg-[#00b4ff]/10 text-[#00b4ff] border border-[#00b4ff]/20'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Responsive Canvas Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-6" id="application-body">
        
        {/* Render Active View Panels */}
        <div className="transition-all duration-300" id="active-panel-renderer">
          {activeTab === 'simulator' && <InteractiveSimulator />}
          {activeTab === 'diagrams' && <SagaDiagram />}
          {activeTab === 'database' && <DatabaseSchema />}
          {activeTab === 'api' && <ApiCatalog />}
          {activeTab === 'code' && <CodeExplorer />}
          {activeTab === 'devops' && <DeploymentExplorer />}
          {activeTab === 'review' && <ArchitecturalReview />}
        </div>

      </main>

      {/* Professional Infrastructure Footer */}
      <footer className="h-10 border-t border-[#1a1a2e] flex items-center justify-between px-8 bg-[#020204] text-[10px] text-[#444] uppercase font-bold tracking-[0.2em]" id="footer-section">
        <div>Cloud Native Architecture | Resilience Node-01</div>
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#00ff64] animate-pulse"></span>Healthz: OK</span>
          <span>DB: connected</span>
          <span>Broker: connected</span>
        </div>
      </footer>
    </div>
  );
}
