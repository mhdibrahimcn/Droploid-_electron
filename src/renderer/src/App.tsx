import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SetupWizard } from './pages/SetupWizard';
import { Workspace } from './pages/Workspace';
import { CommandPalette } from './components/CommandPalette';
import { SettingsModal } from './components/SettingsModal';
import { PromoteSheet } from './components/PromoteSheet';
import { OrgSheet } from './components/OrgSheet';
import { DeployPanel } from './components/DeployPanel';
import { useAppStore } from './stores/appStore';
import { useOrgStore } from './stores/orgStore';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket } from 'lucide-react';

function AppLoader() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center z-50 overflow-hidden" style={{ background: 'var(--color-bg-base)' }}>
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent-glow rounded-full blur-[120px] opacity-30 animate-pulse" />
      
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center"
      >
        <div className="relative">
          <motion.div
            animate={{ 
              boxShadow: [
                '0 0 0 0 rgba(99, 102, 241, 0.4)',
                '0 0 0 20px rgba(99, 102, 241, 0)',
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-24 h-24 bg-[#0E1321] rounded-2xl flex items-center justify-center border border-white/10 glow-accent backdrop-blur-xl relative overflow-hidden"
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-[-12deg] w-[200%] animate-[shimmer-wave_2s_infinite_linear]" />
            
            {/* Main Icon */}
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Rocket size={40} className="text-accent-bright drop-shadow-[0_0_15px_rgba(129,140,248,0.5)]" />
            </motion.div>
          </motion.div>

          {/* Orbits */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-[-20px] rounded-full border border-dashed border-white/10"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-[-40px] rounded-full border border-white/5"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-16 flex flex-col items-center"
        >
          <h1 className="text-2xl font-bold text-white tracking-tight leading-none mb-2 font-sans">
            Droploid <span className="text-accent-bright font-normal">Studio</span>
          </h1>
          <div className="flex items-center gap-3 mt-4 bg-white/5 px-4 py-2 rounded-full border border-white/10 backdrop-blur-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-bright animate-ping" />
            <p className="text-xs text-text-secondary font-mono tracking-wider uppercase">
              Initializing Engine
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

function MainApp() {
  const isSetupComplete = useAppStore((s) => s.isSetupComplete);

  return (
    <MemoryRouter>
      <Routes>
        <Route
          path="/"
          element={
            isSetupComplete ? (
              <Navigate to="/workspace" replace />
            ) : (
              <Navigate to="/setup" replace />
            )
          }
        />
        <Route path="/setup" element={<SetupWizard />} />
        <Route path="/workspace/*" element={<Workspace />} />
      </Routes>
      
      {/* Global Overlays */}
      {isSetupComplete && (
        <>
          <CommandPalette />
          <SettingsModal />
          <PromoteSheet />
          <OrgSheet />
          <DeployPanel />
        </>
      )}
    </MemoryRouter>
  );
}

export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  const isHydrated = useAppStore((s) => s.isHydrated);
  const init = !splashDone || !isHydrated;

  useEffect(() => {
    useOrgStore.getState().load();
    const timer = setTimeout(() => setSplashDone(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence mode="wait">
      {init ? (
        <motion.div
          key="loader"
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="h-screen w-screen"
        >
          <AppLoader />
        </motion.div>
      ) : (
        <motion.div
          key="app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="h-screen w-screen overflow-hidden"
          style={{ background: 'var(--color-bg-base)', color: 'var(--color-text-primary)' }}
        >
          <MainApp />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
