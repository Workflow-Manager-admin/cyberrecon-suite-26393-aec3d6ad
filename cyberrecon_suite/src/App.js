import React, { useState } from "react";
import "./App.css";
import "./components/Sidebar.css";
import "./components/TabContainer.css";
import Sidebar from "./components/Sidebar";
import TabContainer from "./components/TabContainer";

// Placeholder modules for structure, update with actual modules soon
import ReconDashboard from "./modules/ReconDashboard";
import ScannerModule from "./modules/ScannerModule";
import ExploitModule from "./modules/ExploitModule";
import DebuggerModule from "./modules/DebuggerModule";
import WordlistModule from "./modules/WordlistModule";
import ReportsModule from "./modules/ReportsModule";
import BountyModule from "./modules/BountyModule";
import SettingsModule from "./modules/SettingsModule";

// Map keys to module components for routing
const moduleComponentMap = {
  recon: ReconDashboard,
  scanner: ScannerModule,
  exploitation: ExploitModule,
  debugger: DebuggerModule,
  wordlist: WordlistModule,
  reports: ReportsModule,
  bounty: BountyModule,
  settings: SettingsModule
};

// PUBLIC_INTERFACE
/**
 * Main app shell for CyberRecon Suite – persistent sidebar, tabbed area, responsive/professional.
 */
function App() {
  const [activeModule, setActiveModule] = useState("recon"); // default module

  // PUBLIC_INTERFACE – listen for "gotoSettings" for easy navigation from error link
  React.useEffect(() => {
    function handleGotoSettings(e) {
      setActiveModule("settings");
    }
    window.addEventListener("cyberrecon:gotoSettings", handleGotoSettings);
    return () =>
      window.removeEventListener("cyberrecon:gotoSettings", handleGotoSettings);
  }, []);

  const CurrentModule = moduleComponentMap[activeModule] || (() => <div>Module Not Found</div>);

  return (
    <div className="app-shell">
      <Sidebar activeModule={activeModule} onModuleSelect={setActiveModule} />
      <div className="main-content">
        <TabContainer moduleKey={activeModule}>
          <CurrentModule />
        </TabContainer>
      </div>
    </div>
  );
}

export default App;