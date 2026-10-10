/**
 * ============================================================================
 * [FROZEN / DEPRECATED] TSOS Native Windows (WPF / .NET) Client
 * ============================================================================
 * ARCHITECTURAL DIRECTIVE:
 * The standalone C# / WPF native client has been FROZEN.
 * Desktop operations will focus exclusively on an Electron.js wrapper
 * around the web POS terminal for unified cross-platform hardware access
 * (Raw ESC/POS WebUSB/WebSerial, cash drawers, and offline SQLite caching).
 * ============================================================================
 */

import React, { useState } from 'react';
import { useTsosStore } from '../../lib/store';
import { PosScreen } from '../pos/PosScreen';
import { KdsScreen } from '../kds/KdsScreen';
import { playChime } from '../../lib/sound';
import {
  Monitor,
  Printer,
  Wifi,
  HardDrive,
  Keyboard,
  Maximize2,
  Minus,
  X,
  CreditCard,
  QrCode,
  DollarSign,
  Coffee,
  CheckCircle2,
  RefreshCw,
  Sliders,
  AlertTriangle,
} from 'lucide-react';

export const WindowsAppClient: React.FC = () => {
  const { location, currentProfile, audioEnabled, orders } = useTsosStore();
  const [windowsTab, setWindowsTab] = useState<'pos' | 'kds'>('pos');
  const [printerStatus, setPrinterStatus] = useState<'ready' | 'printing' | 'error'>('ready');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cfdEnabled, setCfdEnabled] = useState(true);

  const handleTestPrint = () => {
    setPrinterStatus('printing');
    if (audioEnabled) playChime('click');
    setTimeout(() => {
      setPrinterStatus('ready');
      alert('Windows Print Spooler: Test raw ESC/POS page dispatched to COM3 (58mm Thermal Printer).');
    }, 600);
  };

  const handleKickDrawer = () => {
    setDrawerOpen(true);
    if (audioEnabled) playChime('complete');
    setTimeout(() => setDrawerOpen(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-100px)] overflow-hidden bg-[#1E1E1E] text-white select-none">
      {/* Windows 11 Fluent Window Titlebar */}
      <div className="h-9 bg-[#2B2B2B] border-b border-[#3A3A3A] px-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-xs bg-[#F97316] flex items-center justify-center text-[10px] font-bold text-white">
            W
          </div>
          <span className="font-semibold text-gray-200">
            TSOS Terminal Desktop v2.4 (x64) — {location.name} (Windows Native Client)
          </span>
          <span className="px-1.5 py-0.2 rounded-xs bg-[#3A3A3A] text-[10px] text-emerald-400 font-mono">
            ● LOCAL HOST RUNTIME
          </span>
        </div>

        {/* Windows Standard Window Controls */}
        <div className="flex items-center">
          <button className="h-9 px-3 hover:bg-[#3A3A3A] text-gray-300 flex items-center justify-center">
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button className="h-9 px-3 hover:bg-[#3A3A3A] text-gray-300 flex items-center justify-center">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button className="h-9 px-3 hover:bg-[#C42B1C] text-gray-300 hover:text-white flex items-center justify-center">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Windows Peripheral & Hotkey Status Ribbon */}
      <div className="bg-[#242424] border-b border-[#333333] px-3 py-1.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Hardware peripherals */}
        <div className="flex items-center gap-4 text-gray-300">
          <div className="flex items-center gap-1.5">
            <Printer className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px]">
              Epson TM-T82III (COM3):{' '}
              <strong className="text-emerald-400 font-mono">{printerStatus.toUpperCase()}</strong>
            </span>
          </div>

          <button
            onClick={handleKickDrawer}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-xs border text-[11px] transition-colors ${
              drawerOpen
                ? 'bg-amber-900/60 border-amber-500 text-amber-300'
                : 'bg-[#2E2E2E] border-[#404040] hover:bg-[#383838]'
            }`}
          >
            <HardDrive className="w-3 h-3 text-amber-400" />
            <span>RJ11 Cash Drawer {drawerOpen ? '(KICKED OPEN)' : '(Pulse Kick)'}</span>
          </button>

          <button
            onClick={handleTestPrint}
            className="flex items-center gap-1 px-2 py-0.5 rounded-xs bg-[#2E2E2E] border border-[#404040] hover:bg-[#383838] text-[11px]"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Test Print ESC/POS</span>
          </button>

          <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
            <input
              type="checkbox"
              checked={cfdEnabled}
              onChange={(e) => setCfdEnabled(e.target.checked)}
              className="rounded-xs"
            />
            <span>CFD (Secondary Display)</span>
          </label>
        </div>

        {/* Function Keys Shortcut Bar */}
        <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono">
          <span className="bg-[#333] px-1.5 py-0.5 rounded-xs text-white">F1</span> POS
          <span className="bg-[#333] px-1.5 py-0.5 rounded-xs text-white">F2</span> KDS
          <span className="bg-[#333] px-1.5 py-0.5 rounded-xs text-white">F4</span> Cash
          <span className="bg-[#333] px-1.5 py-0.5 rounded-xs text-white">F5</span> UPI QR
          <span className="bg-[#333] px-1.5 py-0.5 rounded-xs text-white">F9</span> Lock
        </div>

        {/* Tab switch for Windows terminal */}
        <div className="flex items-center bg-[#1A1A1A] p-0.5 rounded-md border border-[#333]">
          <button
            onClick={() => setWindowsTab('pos')}
            className={`px-3 py-1 rounded-sm text-xs font-semibold ${
              windowsTab === 'pos' ? 'bg-[#F97316] text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Terminal POS
          </button>
          <button
            onClick={() => setWindowsTab('kds')}
            className={`px-3 py-1 rounded-sm text-xs font-semibold ${
              windowsTab === 'kds' ? 'bg-[#F97316] text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Terminal KDS
          </button>
        </div>
      </div>

      {/* Main Container rendering POS or KDS in native windows styling */}
      <div className="flex-1 flex overflow-hidden">
        {windowsTab === 'pos' ? <PosScreen /> : <KdsScreen />}
      </div>

      {/* Bottom Windows Status Bar */}
      <div className="h-6 bg-[#2B2B2B] border-t border-[#3A3A3A] px-3 flex items-center justify-between text-[11px] text-gray-400 font-mono">
        <div className="flex items-center gap-4">
          <span>OPERATOR: {currentProfile.name} ({currentProfile.role.toUpperCase()})</span>
          <span>SHIFT: 08:00 AM - 04:00 PM</span>
          <span>ORDERS IN BUFFER: {orders.length}</span>
        </div>
        <div className="flex items-center gap-3 text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>ESC/POS DRIVER ACTIVE (WIN32 SPOOLER)</span>
        </div>
      </div>
    </div>
  );
};
