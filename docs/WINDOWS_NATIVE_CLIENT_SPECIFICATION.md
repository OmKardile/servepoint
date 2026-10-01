# TSOS Windows Native POS Client Specification
**Document Version:** 1.0.0  
**Framework Target:** .NET 9.0 Desktop (C# 13, WPF / WinUI 3)  
**Target Hardware:** All-in-One Touchscreen POS Terminals (Posiflex, Elo, HP Engage, Sunmi D2), Windows 10/11 IoT Enterprise  
**Peripherals:** Local USB/Serial Thermal Printers, 2x20 VFD Customer Displays, RJ11 Cash Drawers, USB HID Barcode Scanners

---

## 1. Architecture & Design Patterns

The Windows Native TSOS application is structured around the **Model-View-ViewModel (MVVM)** design pattern with strict offline-first resilience. It operates with sub-millisecond local UI response times and direct hardware integration via Win32 APIs.

```
+------------------------------------------------------------------------+
|                          WPF / WinUI 3 Layer                           |
|  - MainWindow.xaml (1920x1080 High-DPI Optimized Layout)               |
|  - Views: PosView, CartView, TablesView, KdsView, CashDrawerAuditView   |
|  - Warm Neutral Design System (Palette #FFF9F2, #1C1917, #F97316)      |
+------------------------------------+-----------------------------------+
                                     | Data Binding & Commands
                                     v
+------------------------------------------------------------------------+
|                          ViewModels Layer                              |
|  - PosViewModel.cs, CartViewModel.cs, SyncViewModel.cs                 |
|  - ReactiveProperty / CommunityToolkit.Mvvm [ObservableObject]         |
+------------------------------------+-----------------------------------+
                                     |
         +---------------------------+---------------------------+
         |                                                       |
         v                                                       v
+----------------------------------+   +---------------------------------+
|      Local SQLite Database       |   |       Hardware Service Bus      |
|  - WAL (Write-Ahead Logging)     |   |  - RawPrinterHelper (winspool)  |
|  - Tables: orders, menu_items,   |   |  - SerialPort (2x20 VFD Display)|
|    inventory, audit_log, sync_q |   |  - BarcodeScannerHook (HID POS) |
+-----------------+----------------+   +---------------------------------+
                  |
                  v Background Worker (IHostedService)
+----------------------------------+
|   Cloud Delta Sync Worker        |
|  - Replays sync_queue to Cloud   |
|  - Pulls updated catalog & stock |
+----------------------------------+
```

---

## 2. Direct Win32 Thermal Printing (Zero-Spooler Delay)

Unlike standard Windows printing which rasterizes documents to XPS/GDI (causing 2-4 second latency), TSOS Windows Native uses the unmanaged Win32 Spooler API (`winspool.drv`) via P/Invoke to send raw ESC/POS binary streams directly to the printer in under **5 milliseconds**:

### 2.1 C# `RawPrinterHelper.cs` Implementation
```csharp
using System;
using System.IO;
using System.Runtime.InteropServices;

public static class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool SendBytesToPrinter(string szPrinterName, byte[] pBytes)
    {
        IntPtr hPrinter;
        var di = new DOCINFOA { pDocName = "TSOS Receipt", pDataType = "RAW" };
        if (!OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero)) return false;

        bool success = false;
        if (StartDocPrinter(hPrinter, 1, di))
        {
            if (StartPagePrinter(hPrinter))
            {
                IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(pBytes.Length);
                Marshal.Copy(pBytes, 0, pUnmanagedBytes, pBytes.Length);
                success = WritePrinter(hPrinter, pUnmanagedBytes, pBytes.Length, out _);
                Marshal.FreeCoTaskMem(pUnmanagedBytes);
                EndPagePrinter(hPrinter);
            }
            EndDocPrinter(hPrinter);
        }
        ClosePrinter(hPrinter);
        return success;
    }
}
```

---

## 3. Customer Pole Display Driver (VFD 2x20 via COM Port)

High-end POS terminals feature an external 2-line vacuum fluorescent display (VFD) facing the customer:
- **Port:** COM1 / COM3 (RS-232 / Virtual USB Serial)
- **Baud Rate:** 9600, 8 Data Bits, No Parity, 1 Stop Bit
- **Protocol:** DSP-800 / ESC/POS Display Mode

```csharp
using System.IO.Ports;

public class VfdCustomerDisplayService : IDisposable
{
    private SerialPort _port;

    public void Connect(string portName = "COM1", int baudRate = 9600)
    {
        _port = new SerialPort(portName, baudRate, Parity.None, 8, StopBits.One);
        _port.Open();
        ClearDisplay();
    }

    public void ClearDisplay()
    {
        // ESC @ (Clear and home cursor)
        _port.Write(new byte[] { 0x1B, 0x40 }, 0, 2);
    }

    public void UpdateLineItem(string itemName, decimal price)
    {
        ClearDisplay();
        // Line 1: Item name truncated to 20 chars
        string line1 = itemName.Length > 20 ? itemName.Substring(0, 20) : itemName.PadRight(20);
        // Line 2: Price right-aligned
        string line2 = ("INR " + price.ToString("F2")).PadLeft(20);
        
        _port.Write(line1 + line2);
    }

    public void ShowTotal(decimal grandTotal)
    {
        ClearDisplay();
        string line1 = "TOTAL AMOUNT DUE:   ";
        string line2 = ("INR " + grandTotal.ToString("F2")).PadLeft(20);
        _port.Write(line1 + line2);
    }

    public void Dispose() => _port?.Close();
}
```

---

## 4. Cash Drawer Kick Automation

Cash drawers connect via an RJ11/RJ12 connector to the DK port on the thermal printer:
1. **Trigger on Cash Transaction:** When the cashier presses `Charge Cash`, the software executes:
```csharp
public static void KickCashDrawer(string printerName)
{
    // ESC p 0 25 250 (1B 70 00 19 FA)
    byte[] drawerPulse = new byte[] { 0x1B, 0x70, 0x00, 0x19, 0xFA };
    RawPrinterHelper.SendBytesToPrinter(printerName, drawerPulse);
}
```

---

## 5. Local Offline SQLite Database Architecture

```sql
-- SQLite Schema (WAL Mode Enabled: PRAGMA journal_mode = WAL;)

CREATE TABLE local_orders (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL,
    order_type TEXT NOT NULL,
    table_id TEXT,
    customer_id TEXT,
    items_json TEXT NOT NULL,
    subtotal REAL NOT NULL,
    tax_total REAL NOT NULL,
    discount_total REAL NOT NULL,
    platform_fee REAL NOT NULL,
    grand_total REAL NOT NULL,
    payment_method TEXT NOT NULL,
    created_at TEXT NOT NULL,
    is_synced INTEGER DEFAULT 0
);

CREATE TABLE offline_sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    retry_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
);
```

---

## 6. Keyboard Hotkeys & Touch Ergonomics
- `F1`: Switch to POS Screen
- `F2`: Switch to Table Map
- `F3`: Switch to Kitchen KDS
- `F4`: Search Menu Items
- `F5`: Attach Customer Phone Number
- `F9`: Quick Cash Checkout
- `F10`: Quick UPI Checkout
- `Space`: Print Final Bill
- `Esc`: Cancel Modal / Clear Cart
