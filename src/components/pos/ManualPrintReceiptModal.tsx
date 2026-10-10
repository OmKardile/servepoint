import React, { useState, useMemo } from 'react';
import { Order, PaperWidth } from '../../types';
import { useTsosStore } from '../../lib/store';
import {
  Printer,
  Bluetooth,
  X,
  CheckCircle2,
  Sliders,
  Code,
  FileText,
  DollarSign,
  RefreshCw,
  Sparkles,
  Scissors,
  Smartphone,
  ChevronDown,
  Info,
  Radio,
  ExternalLink,
  ShieldCheck,
  BatteryCharging,
  Layers,
} from 'lucide-react';
import {
  BluetoothPrinterDevice,
  ReceiptFormatOptions,
  DEFAULT_RECEIPT_OPTIONS,
  PRESET_BLUETOOTH_PRINTERS,
  requestWebBluetoothPrinter,
  disconnectWebBluetoothPrinter,
  printViaBluetooth,
  formatCustomReceiptEscPos,
  formatCustomReceiptText,
  generateTestReceiptEscPos,
  triggerCashDrawerKick,
  getLineWidth,
} from '../../lib/printerService';

interface ManualPrintReceiptModalProps {
  initialOrder?: Order | null;
  onClose: () => void;
}

export const ManualPrintReceiptModal: React.FC<ManualPrintReceiptModalProps> = ({
  initialOrder,
  onClose,
}) => {
  const { location, orders, printerConfig, updatePrinterConfig, addPrintLog, currentProfile } = useTsosStore();

  // Order selection: default to provided order, or first available order
  const availableOrders = useMemo(() => orders || [], [orders]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    initialOrder?.id || (availableOrders.length > 0 ? availableOrders[0].id : '')
  );

  const activeOrder: Order | undefined = useMemo(() => {
    if (initialOrder && initialOrder.id === selectedOrderId) return initialOrder;
    return availableOrders.find((o) => o.id === selectedOrderId) || initialOrder || availableOrders[0];
  }, [initialOrder, selectedOrderId, availableOrders]);

  // Bluetooth device management state
  const [printersList, setPrintersList] = useState<BluetoothPrinterDevice[]>(PRESET_BLUETOOTH_PRINTERS);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>(
    printersList.find((p) => p.connected)?.id || printersList[0]?.id || ''
  );
  const [isScanningBluetooth, setIsScanningBluetooth] = useState(false);
  const [bluetoothStatusMessage, setBluetoothStatusMessage] = useState<string | null>(null);

  // Formatting Options state
  const [formatOptions, setFormatOptions] = useState<ReceiptFormatOptions>({
    ...DEFAULT_RECEIPT_OPTIONS,
    paperWidth: printerConfig.paper_width || '80mm',
  });

  // UI tabs & states
  const [activeTab, setActiveTab] = useState<'preview' | 'options' | 'printers' | 'hex'>('preview');
  const [isPrinting, setIsPrinting] = useState(false);
  const [printFeedback, setPrintFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const selectedPrinter = printersList.find((p) => p.id === selectedPrinterId) || printersList[0];

  // Keep paper width in sync if printer has a fixed native width
  const handleSelectPrinter = (p: BluetoothPrinterDevice) => {
    setSelectedPrinterId(p.id);
    setFormatOptions((prev) => ({
      ...prev,
      paperWidth: p.paperWidth,
    }));
  };

  // Pair new Web Bluetooth Printer
  const handleScanWebBluetooth = async () => {
    setIsScanningBluetooth(true);
    setBluetoothStatusMessage('Scanning for nearby Web Bluetooth thermal printers (LE / RFCOMM)...');

    const res = await requestWebBluetoothPrinter();
    setIsScanningBluetooth(false);

    if (res.success && res.device) {
      setPrintersList((prev) => [res.device!, ...prev.filter((p) => p.id !== res.device!.id)]);
      setSelectedPrinterId(res.device.id);
      setFormatOptions((prev) => ({ ...prev, paperWidth: res.device!.paperWidth }));
      setBluetoothStatusMessage(`Paired with ${res.device.name}!`);
      setTimeout(() => setBluetoothStatusMessage(null), 4000);
    } else {
      setBluetoothStatusMessage(res.message);
      setTimeout(() => setBluetoothStatusMessage(null), 5000);
    }
  };

  // Format active receipt text for live preview
  const previewText = useMemo(() => {
    if (!activeOrder) return 'No order selected.';
    return formatCustomReceiptText(activeOrder, location, formatOptions);
  }, [activeOrder, location, formatOptions]);

  // Format ESC/POS binary stream
  const escPosBytes = useMemo(() => {
    if (!activeOrder) return new Uint8Array();
    return formatCustomReceiptEscPos(activeOrder, location, formatOptions);
  }, [activeOrder, location, formatOptions]);

  // Hex dump preview
  const hexPreview = useMemo(() => {
    return Array.from(escPosBytes.slice(0, 200))
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
  }, [escPosBytes]);

  // Handle Physical Web Bluetooth Print
  const handleBluetoothPrint = async () => {
    if (!activeOrder) return;
    setIsPrinting(true);
    setPrintFeedback(null);

    const res = await printViaBluetooth(escPosBytes, selectedPrinter);
    setPrintFeedback(res);
    setIsPrinting(false);

    // Record print attempt in global audit logs
    addPrintLog({
      order_id: activeOrder.id,
      order_number: activeOrder.order_number,
      document_type: 'bill',
      printer_name: selectedPrinter ? selectedPrinter.name : 'Web Bluetooth Thermal',
      interface_type: 'bluetooth',
      paper_width: formatOptions.paperWidth,
      status: res.success ? 'success' : 'failed',
      error_message: res.success ? undefined : res.message,
      bytes_sent: escPosBytes.length,
      operator_name: currentProfile?.name || 'Staff Cashier',
    });

    setTimeout(() => setPrintFeedback(null), 4000);
  };

  // Handle Standard Browser Print Dialog
  const handleBrowserPrint = () => {
    if (formatOptions.openCashDrawer && activeOrder?.payment_method === 'cash') {
      triggerCashDrawerKick();
    }
    setPrintFeedback({
      success: true,
      message: `Print job dispatched to system print dialog for ${formatOptions.paperWidth} roll.`,
    });

    addPrintLog({
      order_id: activeOrder?.id,
      order_number: activeOrder?.order_number,
      document_type: 'bill',
      printer_name: 'Browser Print Engine',
      interface_type: 'browser',
      paper_width: formatOptions.paperWidth,
      status: 'success',
      bytes_sent: escPosBytes.length,
      operator_name: currentProfile?.name || 'Staff Cashier',
    });

    window.print();
    setTimeout(() => setPrintFeedback(null), 3500);
  };

  // Handle Diagnostic Test Pattern
  const handleTestPrint = async () => {
    setIsPrinting(true);
    const testBytes = generateTestReceiptEscPos(location, {
      ...printerConfig,
      paper_width: formatOptions.paperWidth,
      open_cash_drawer: formatOptions.openCashDrawer,
      cut_paper: formatOptions.autoCut,
    });
    const res = await printViaBluetooth(testBytes, selectedPrinter);
    setPrintFeedback(res);
    setIsPrinting(false);

    addPrintLog({
      document_type: 'test',
      printer_name: selectedPrinter ? selectedPrinter.name : 'Web Bluetooth Thermal',
      interface_type: 'bluetooth',
      paper_width: formatOptions.paperWidth,
      status: res.success ? 'success' : 'failed',
      error_message: res.success ? undefined : res.message,
      bytes_sent: testBytes.length,
      operator_name: currentProfile?.name || 'Staff Cashier',
    });

    setTimeout(() => setPrintFeedback(null), 4000);
  };

  const handleKickDrawer = () => {
    const res = triggerCashDrawerKick();
    setPrintFeedback(res);

    addPrintLog({
      document_type: 'drawer_kick',
      printer_name: selectedPrinter ? selectedPrinter.name : 'Cash Drawer Till Solenoid',
      interface_type: 'bluetooth',
      paper_width: formatOptions.paperWidth,
      status: res.success ? 'success' : 'failed',
      error_message: res.success ? undefined : res.message,
      bytes_sent: 5,
      operator_name: currentProfile?.name || 'Staff Cashier',
    });

    setTimeout(() => setPrintFeedback(null), 3000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-4xl w-full border border-[#E9E0D6] shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header Bar */}
        <div className="p-4 bg-[#FFF9F2] border-b border-[#E9E0D6] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F97316]/10 text-[#F97316] flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[#1C1917]">
                  Manual Print Receipt & Thermal Workstation
                </h2>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                  <Bluetooth className="w-3 h-3" /> Web Bluetooth Ready
                </span>
              </div>
              <div className="text-xs text-[#57534E]">
                Format POS order summaries & direct print via ESC/POS to thermal printers
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Paper Width Selector */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-[#E9E0D6] text-xs font-mono font-bold">
              <button
                onClick={() => setFormatOptions((prev) => ({ ...prev, paperWidth: '80mm' }))}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  formatOptions.paperWidth === '80mm'
                    ? 'bg-[#1C1917] text-white shadow-xs'
                    : 'text-[#57534E] hover:bg-[#F5F0EB]'
                }`}
                title="80mm desktop roll (48 characters/line)"
              >
                80mm (Desktop)
              </button>
              <button
                onClick={() => setFormatOptions((prev) => ({ ...prev, paperWidth: '58mm' }))}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  formatOptions.paperWidth === '58mm'
                    ? 'bg-[#1C1917] text-white shadow-xs'
                    : 'text-[#57534E] hover:bg-[#F5F0EB]'
                }`}
                title="58mm compact roll (32 characters/line)"
              >
                58mm (Mobile)
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-[#F5F0EB] text-[#57534E] flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Order Selector & Status strip */}
        <div className="px-4 py-2.5 bg-white border-b border-[#E9E0D6] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#57534E]">Selected Order:</span>
            <div className="relative">
              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="pl-3 pr-8 py-1.5 rounded-xl border border-[#E9E0D6] bg-[#FFF9F2] text-[#1C1917] font-bold text-xs focus:outline-hidden focus:border-[#F97316] appearance-none"
              >
                {availableOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    Order #{o.order_number} • ₹{o.grand_total.toFixed(2)} ({o.table_label || o.order_type})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#57534E] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {activeOrder && (
              <span className="text-[11px] font-mono text-[#10B981] font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                {(activeOrder.payment_status || 'PAID').toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-[#57534E]">
              <Radio className="w-3.5 h-3.5 text-[#2563EB] animate-pulse" />
              <span>Printer:</span>
              <span className="font-bold text-[#1C1917]">{selectedPrinter?.name}</span>
              {selectedPrinter?.batteryLevel && (
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 rounded-full border border-emerald-200 font-mono">
                  {selectedPrinter.batteryLevel}% Bat
                </span>
              )}
            </div>

            <button
              onClick={() => setActiveTab('printers')}
              className="text-[11px] font-bold text-[#2563EB] hover:underline flex items-center gap-1"
            >
              <Bluetooth className="w-3 h-3" /> Change Printer
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 py-2 bg-[#FAF7F2] border-b border-[#E9E0D6] flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'preview'
                  ? 'bg-white text-[#1C1917] shadow-xs'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Receipt Preview</span>
            </button>
            <button
              onClick={() => setActiveTab('options')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'options'
                  ? 'bg-white text-[#1C1917] shadow-xs'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Format Options</span>
            </button>
            <button
              onClick={() => setActiveTab('printers')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'printers'
                  ? 'bg-white text-[#1C1917] shadow-xs'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              <Bluetooth className="w-3.5 h-3.5" />
              <span>Bluetooth Printers ({printersList.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('hex')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'hex'
                  ? 'bg-white text-[#1C1917] shadow-xs'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>ESC/POS Stream</span>
            </button>
          </div>

          <div className="text-[11px] text-[#A8A29E] font-mono">
            {formatOptions.paperWidth === '58mm' ? '32 chars/line' : '48 chars/line'} • ESC/POS
          </div>
        </div>

        {/* Feedback Alert if any */}
        {printFeedback && (
          <div
            className={`px-4 py-2.5 text-xs font-bold flex items-center justify-between border-b animate-in fade-in ${
              printFeedback.success
                ? 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]'
                : 'bg-[#FEF2F2] text-[#B42318] border-[#FECACA]'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{printFeedback.message}</span>
            </div>
            <button onClick={() => setPrintFeedback(null)} className="hover:opacity-75">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#F5F0EB]">
          {/* TAB 1: RECEIPT PREVIEW */}
          {activeTab === 'preview' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
              {/* Left Column: Realistic Physical Thermal Paper Receipt */}
              <div className="md:col-span-7 flex justify-center">
                <div
                  className={`bg-[#FFFEFC] border border-[#DDD6CE] shadow-xl p-5 relative font-mono text-xs text-[#1C1917] transition-all ${
                    formatOptions.paperWidth === '58mm' ? 'max-w-[320px] w-full' : 'max-w-[420px] w-full'
                  }`}
                  style={{
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                  }}
                >
                  {/* Top jagged cut edge effect */}
                  <div
                    className="absolute -top-1.5 left-0 right-0 h-2 bg-repeat-x pointer-events-none"
                    style={{
                      backgroundImage: `radial-gradient(circle at 4px 0, transparent 4px, #FFFEFC 4px)`,
                      backgroundSize: '8px 8px',
                    }}
                  />

                  {/* Mono styled physical receipt content */}
                  <div className="whitespace-pre font-mono text-[11px] leading-[1.35] select-text">
                    {previewText}
                  </div>

                  {/* Bottom jagged cut edge effect */}
                  <div
                    className="absolute -bottom-1.5 left-0 right-0 h-2 bg-repeat-x pointer-events-none rotate-180"
                    style={{
                      backgroundImage: `radial-gradient(circle at 4px 0, transparent 4px, #FFFEFC 4px)`,
                      backgroundSize: '8px 8px',
                    }}
                  />
                </div>
              </div>

              {/* Right Column: Quick Toggles & Print Actions */}
              <div className="md:col-span-5 space-y-4">
                <div className="bg-white rounded-2xl p-4 border border-[#E9E0D6] shadow-xs space-y-3">
                  <h3 className="text-xs font-bold text-[#1C1917] flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-[#F97316]" />
                    <span>Quick Format Controls</span>
                  </h3>

                  <div className="space-y-2 text-xs">
                    <label className="flex items-center justify-between p-2 rounded-xl bg-[#FFF9F2] hover:bg-[#FFF4E5] cursor-pointer transition-colors">
                      <span className="text-[#1C1917] font-medium">Detailed GST Breakdown (CGST+SGST)</span>
                      <input
                        type="checkbox"
                        checked={formatOptions.showGstBreakdown}
                        onChange={(e) =>
                          setFormatOptions((prev) => ({ ...prev, showGstBreakdown: e.target.checked }))
                        }
                        className="rounded-md text-[#F97316] focus:ring-[#F97316] w-4 h-4 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2 rounded-xl bg-[#FFF9F2] hover:bg-[#FFF4E5] cursor-pointer transition-colors">
                      <span className="text-[#1C1917] font-medium">Platform Fee Transparency Line</span>
                      <input
                        type="checkbox"
                        checked={formatOptions.showPlatformFee}
                        onChange={(e) =>
                          setFormatOptions((prev) => ({ ...prev, showPlatformFee: e.target.checked }))
                        }
                        className="rounded-md text-[#F97316] focus:ring-[#F97316] w-4 h-4 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2 rounded-xl bg-[#FFF9F2] hover:bg-[#FFF4E5] cursor-pointer transition-colors">
                      <span className="text-[#1C1917] font-medium">BharatQR / UPI Payment Code</span>
                      <input
                        type="checkbox"
                        checked={formatOptions.showUpiQr}
                        onChange={(e) =>
                          setFormatOptions((prev) => ({ ...prev, showUpiQr: e.target.checked }))
                        }
                        className="rounded-md text-[#F97316] focus:ring-[#F97316] w-4 h-4 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2 rounded-xl bg-[#FFF9F2] hover:bg-[#FFF4E5] cursor-pointer transition-colors">
                      <span className="text-[#1C1917] font-medium">Auto-Cut Paper After Print</span>
                      <input
                        type="checkbox"
                        checked={formatOptions.autoCut}
                        onChange={(e) =>
                          setFormatOptions((prev) => ({ ...prev, autoCut: e.target.checked }))
                        }
                        className="rounded-md text-[#F97316] focus:ring-[#F97316] w-4 h-4 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2 rounded-xl bg-[#FFF9F2] hover:bg-[#FFF4E5] cursor-pointer transition-colors">
                      <span className="text-[#1C1917] font-medium">Kick Cash Drawer Pulse (Pin 2)</span>
                      <input
                        type="checkbox"
                        checked={formatOptions.openCashDrawer}
                        onChange={(e) =>
                          setFormatOptions((prev) => ({ ...prev, openCashDrawer: e.target.checked }))
                        }
                        className="rounded-md text-[#F97316] focus:ring-[#F97316] w-4 h-4 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>

                {/* Target Printer Specs Card */}
                <div className="bg-white rounded-2xl p-4 border border-[#E9E0D6] shadow-xs space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1C1917] flex items-center gap-1.5">
                      <Bluetooth className="w-3.5 h-3.5 text-[#2563EB]" /> Connected Hardware
                    </span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                      {selectedPrinter?.type === 'web_bluetooth' ? 'Direct GATT' : 'Preset Driver'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#F5F0EB] text-[#57534E] space-y-1 font-mono text-[11px]">
                    <div>Device: {selectedPrinter?.name}</div>
                    <div>Interface: Web Bluetooth / Serial Port (ESC/POS)</div>
                    <div>Roll Width: {formatOptions.paperWidth} ({getLineWidth(formatOptions.paperWidth)} columns)</div>
                  </div>
                </div>

                {/* Diagnostic Hardware Test */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTestPrint}
                    disabled={isPrinting}
                    className="flex-1 py-2 px-3 rounded-xl border border-[#D5C9BD] hover:bg-white text-[#57534E] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isPrinting ? 'animate-spin' : ''}`} />
                    <span>Print Test Roll</span>
                  </button>

                  <button
                    onClick={handleKickDrawer}
                    className="py-2 px-3 rounded-xl border border-[#D5C9BD] hover:bg-white text-[#57534E] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <DollarSign className="w-3.5 h-3.5 text-[#10B981]" />
                    <span>Pulse Drawer</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FULL FORMAT OPTIONS */}
          {activeTab === 'options' && (
            <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-[#E9E0D6] p-5 shadow-xs space-y-5">
              <div>
                <h3 className="text-sm font-bold text-[#1C1917]">Thermal Receipt Layout & Formatting</h3>
                <p className="text-xs text-[#57534E]">
                  Configure exact sections, tax itemization, and hardware commands for POS receipts.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Header Options */}
                <div className="p-3.5 rounded-xl bg-[#FFF9F2] border border-[#E9E0D6] space-y-2.5">
                  <span className="font-bold text-[#1C1917] block">Store Header Details</span>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formatOptions.showHeader}
                      onChange={(e) => setFormatOptions((p) => ({ ...p, showHeader: e.target.checked }))}
                      className="rounded-md text-[#F97316]"
                    />
                    <span>Show Cafe Name</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formatOptions.showAddress}
                      onChange={(e) => setFormatOptions((p) => ({ ...p, showAddress: e.target.checked }))}
                      className="rounded-md text-[#F97316]"
                    />
                    <span>Show Location Address</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formatOptions.showPhone}
                      onChange={(e) => setFormatOptions((p) => ({ ...p, showPhone: e.target.checked }))}
                      className="rounded-md text-[#F97316]"
                    />
                    <span>Show Phone Number</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formatOptions.showGstin}
                      onChange={(e) => setFormatOptions((p) => ({ ...p, showGstin: e.target.checked }))}
                      className="rounded-md text-[#F97316]"
                    />
                    <span>Show GSTIN Registration</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formatOptions.showFssai}
                      onChange={(e) => setFormatOptions((p) => ({ ...p, showFssai: e.target.checked }))}
                      className="rounded-md text-[#F97316]"
                    />
                    <span>Show FSSAI Food License</span>
                  </label>
                </div>

                {/* Line Item & Order Meta Options */}
                <div className="p-3.5 rounded-xl bg-[#FFF9F2] border border-[#E9E0D6] space-y-2.5">
                  <span className="font-bold text-[#1C1917] block">Order & Items Metadata</span>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formatOptions.showWaiter}
                      onChange={(e) => setFormatOptions((p) => ({ ...p, showWaiter: e.target.checked }))}
                      className="rounded-md text-[#F97316]"
                    />
                    <span>Show Cashier/Server Name</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formatOptions.showTable}
                      onChange={(e) => setFormatOptions((p) => ({ ...p, showTable: e.target.checked }))}
                      className="rounded-md text-[#F97316]"
                    />
                    <span>Show Table Identifier</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formatOptions.showItemAddons}
                      onChange={(e) => setFormatOptions((p) => ({ ...p, showItemAddons: e.target.checked }))}
                      className="rounded-md text-[#F97316]"
                    />
                    <span>Show Custom Add-ons & Modifiers</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formatOptions.showItemNotes}
                      onChange={(e) => setFormatOptions((p) => ({ ...p, showItemNotes: e.target.checked }))}
                      className="rounded-md text-[#F97316]"
                    />
                    <span>Show Special Kitchen Notes</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formatOptions.showCustomerLoyalty}
                      onChange={(e) =>
                        setFormatOptions((p) => ({ ...p, showCustomerLoyalty: e.target.checked }))
                      }
                      className="rounded-md text-[#F97316]"
                    />
                    <span>Show Customer Name & Loyalty Points</span>
                  </label>
                </div>
              </div>

              {/* Custom Footer Input */}
              <div className="space-y-1 text-xs">
                <label className="font-bold text-[#1C1917]">Custom Receipt Footer Message</label>
                <input
                  type="text"
                  value={formatOptions.customFooterText}
                  onChange={(e) => setFormatOptions((p) => ({ ...p, customFooterText: e.target.value }))}
                  placeholder="e.g. Thank you for visiting! Tag @thesensoryoasis on Instagram"
                  className="w-full px-3 py-2 rounded-xl border border-[#E9E0D6] text-xs focus:outline-hidden focus:border-[#F97316]"
                />
              </div>

              {/* Extra Feed Lines */}
              <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-[#F5F0EB]">
                <span className="font-medium text-[#1C1917]">Extra Paper Feed Lines Before Cut</span>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setFormatOptions((p) => ({ ...p, extraFeedLines: n }))}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                        formatOptions.extraFeedLines === n
                          ? 'bg-[#1C1917] text-white'
                          : 'bg-white text-[#57534E] hover:bg-[#E9E0D6]'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BLUETOOTH PRINTERS SELECTION */}
          {activeTab === 'printers' && (
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E9E0D6]">
                <div>
                  <h3 className="text-sm font-bold text-[#1C1917] flex items-center gap-2">
                    <Bluetooth className="w-4 h-4 text-[#2563EB]" />
                    <span>Web Bluetooth Thermal Printers</span>
                  </h3>
                  <p className="text-xs text-[#57534E]">
                    Connect directly to wireless Bluetooth thermal printers without external print drivers.
                  </p>
                </div>

                <button
                  onClick={handleScanWebBluetooth}
                  disabled={isScanningBluetooth}
                  className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2"
                >
                  <Bluetooth className={`w-3.5 h-3.5 ${isScanningBluetooth ? 'animate-spin' : ''}`} />
                  <span>{isScanningBluetooth ? 'Scanning...' : 'Pair Web Bluetooth Device'}</span>
                </button>
              </div>

              {bluetoothStatusMessage && (
                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium rounded-xl">
                  {bluetoothStatusMessage}
                </div>
              )}

              {/* Printers List */}
              <div className="space-y-2.5">
                {printersList.map((printer) => {
                  const isSelected = printer.id === selectedPrinterId;
                  return (
                    <div
                      key={printer.id}
                      onClick={() => handleSelectPrinter(printer)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-white border-[#2563EB] ring-2 ring-[#2563EB]/20 shadow-md'
                          : 'bg-white border-[#E9E0D6] hover:border-[#CBD5E1]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isSelected ? 'bg-[#2563EB]/10 text-[#2563EB]' : 'bg-[#F5F0EB] text-[#57534E]'
                          }`}
                        >
                          <Printer className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-[#1C1917]">{printer.name}</span>
                            {isSelected && (
                              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                                ACTIVE SELECTION
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#57534E]">
                            {printer.model} • {printer.paperWidth} Roll
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-right">
                        {printer.batteryLevel && (
                          <div className="text-right">
                            <span className="text-[10px] text-[#10B981] font-mono font-bold block">
                              {printer.batteryLevel}% Battery
                            </span>
                            <span className="text-[10px] text-[#A8A29E]">LE Wireless</span>
                          </div>
                        )}
                        <input
                          type="radio"
                          name="printer-select"
                          checked={isSelected}
                          onChange={() => handleSelectPrinter(printer)}
                          className="w-4 h-4 text-[#2563EB] focus:ring-[#2563EB]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: ESC/POS HEX CODE INSPECTOR */}
          {activeTab === 'hex' && (
            <div className="max-w-2xl mx-auto bg-[#1C1917] text-emerald-400 p-4 rounded-2xl font-mono text-xs space-y-3 shadow-lg">
              <div className="flex items-center justify-between text-gray-300 border-b border-gray-800 pb-2">
                <span className="font-bold flex items-center gap-2">
                  <Code className="w-4 h-4 text-emerald-400" />
                  <span>Raw ESC/POS Byte Stream Inspector</span>
                </span>
                <span className="text-[11px] font-mono text-gray-400">
                  {escPosBytes.length} total bytes generated
                </span>
              </div>

              <div className="text-[11px] leading-relaxed break-all bg-black/40 p-3 rounded-xl border border-gray-800">
                {hexPreview} ...
              </div>

              <div className="text-[10px] text-gray-400 space-y-1">
                <div>• Initializer: 1B 40 (ESC @)</div>
                <div>• Alignments: 1B 61 00 (Left), 1B 61 01 (Center), 1B 61 02 (Right)</div>
                <div>• Paper Cut: 1D 56 42 00 (GS V 66 0)</div>
                <div>• Cash Drawer Pulse: 1B 70 00 19 FA (ESC p 0 25 250)</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-[#E9E0D6] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[#57534E]">
            <Info className="w-4 h-4 text-[#F97316]" />
            <span>
              Target: <strong className="text-[#1C1917]">{selectedPrinter?.name}</strong> (
              {formatOptions.paperWidth})
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleBrowserPrint}
              className="px-4 py-2.5 rounded-xl border border-[#D5C9BD] hover:bg-[#F5F0EB] text-[#1C1917] text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4 text-[#57534E]" />
              <span>Print via System / USB</span>
            </button>

            <button
              onClick={handleBluetoothPrint}
              disabled={isPrinting || !activeOrder}
              className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
            >
              <Bluetooth className={`w-4 h-4 ${isPrinting ? 'animate-spin' : ''}`} />
              <span>{isPrinting ? 'Transmitting to Bluetooth...' : 'Print via Web Bluetooth'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
