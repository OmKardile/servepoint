# TSOS Thermal Printer Integration Specification
**Document Version:** 2.0.0  
**Target Hardware:** 58mm (2-inch, 32/384 dots) & 80mm (3-inch, 48/576 dots) Thermal Receipt & Kitchen Printers  
**Supported Protocols:** ESC/POS (Epson Standard Code for Point of Sale), Star Line Mode  
**Hardware Interfaces:** Web Bluetooth (BLE GATT), WebUSB, Raw TCP Socket (Port 9100 / JetDirect), and Browser Fallback (`@media print`)

---

## 1. Architectural Overview

TSOS integrates a hardware-agnostic thermal printing subsystem designed for high-velocity cafe and restaurant operations. The system produces two distinct document classes:
1. **Customer Tax Invoice / Bill:** Formatted with Cafe Branding, GSTIN, FSSAI License, Itemized Subtotals, CGST/SGST Tax Breakup, Applied Loyalty Discounts, Payment Method, and Dynamic QR Codes (UPI Payment / E-Invoice).
2. **Kitchen Order Ticket (KOT):** High-contrast, large-font routing slip featuring Order Type (Dine-In / Takeaway / Delivery), Table Number, Running KOT Sequence, Timestamp, Server Name, Special Cooking Instructions, and Line-Item Ingredient Modifiers.

```
+-------------------------------------------------------------------------+
|                              TSOS App                                   |
|   (useTsosStore: printerConfig { connection_type, paper_width, ... })   |
+------------------------------------+------------------------------------+
                                     |
                                     v
                 +---------------------------------------+
                 |           printerService.ts           |
                 | - formatBillEscPos(order, config)     |
                 | - formatKotEscPos(order, kotSeq)      |
                 | - executePrintJob(job)                |
                 +-------------------+-------------------+
                                     |
         +---------------------------+---------------------------+
         |                           |                           |
         v                           v                           v
+-----------------+         +-----------------+         +-----------------+
|  Web Bluetooth  |         |   Network/LAN   |         | Browser Styling |
| GATT (0x18F0)   |         | TCP Port 9100   |         |  @media print   |
| 512-byte Chunks |         | Raw Binary Stream|         | Monospace CSS   |
+-----------------+         +-----------------+         +-----------------+
```

---

## 2. Low-Level ESC/POS Binary Command Dictionary

All thermal print jobs are compiled into raw binary `Uint8Array` byte sequences adhering to the following standard ESC/POS command codes:

| Command | Hex Sequence | Dec Sequence | Description |
|---|---|---|---|
| `INIT` | `1B 40` | `27, 64` | Clears buffer and resets printer to default state. |
| `ALIGN_LEFT` | `1B 61 00` | `27, 97, 0` | Justifies subsequent text to the left margin. |
| `ALIGN_CENTER` | `1B 61 01` | `27, 97, 1` | Centers subsequent text horizontally. |
| `ALIGN_RIGHT` | `1B 61 02` | `27, 97, 2` | Right-aligns subsequent text. |
| `BOLD_ON` | `1B 45 01` | `27, 69, 1` | Enables emphasized double-strike bold text. |
| `BOLD_OFF` | `1B 45 00` | `27, 69, 0` | Disables bold emphasis. |
| `TEXT_NORMAL` | `1D 21 00` | `29, 33, 0` | Normal 1x width, 1x height font size (Font A 12x24 dots). |
| `TEXT_DOUBLE_H`| `1D 21 01` | `29, 33, 1` | Double-height font (used for KOT item names and Table Nos). |
| `TEXT_DOUBLE_W`| `1D 21 10` | `29, 33, 16` | Double-width font (used for Cafe Title and Grand Total). |
| `TEXT_DOUBLE_WH`| `1D 21 11` | `29, 33, 17` | Quad-size font (Double-width + Double-height). |
| `LINE_FEED` | `0A` | `10` | Prints buffer content and advances paper by 1 line. |
| `FEED_LINES(n)` | `1B 64 n` | `27, 100, n` | Feeds paper forward by `n` lines without altering buffer. |
| `PAPER_CUT` | `1D 56 41 03` | `29, 86, 65, 3` | Partial paper cut leaving 1 connecting bridge tab. |
| `DRAWER_KICK` | `1B 70 00 19 FA` | `27, 112, 0, 25, 250`| Emits 100ms 24V pulse to RJ11/RJ12 drawer solenoid (Pin 2). |
| `CODEPAGE_PC437`| `1B 74 00` | `27, 116, 0` | Sets character code table to Standard USA / PC437. |

---

## 3. Paper Width & Character Matrix Rules

Thermal printer engines operate with fixed monospace column grids determined by the physical paper width:

### 3.1 58mm (2-inch) Thermal Paper
- **Physical printable width:** 48mm
- **Dot density:** 384 dots/line (8 dots/mm, 203 DPI)
- **Monospace character limit:** **32 characters** per line (Font A, 12x24 dots)
- **Layout Rule:** Items are printed in two columns: Left Column (Item name truncated or wrapped at 22 chars) + Right Column (Price right-aligned in 10 chars).
- **Divider string:** `--------------------------------` (32 hyphens)

### 3.2 80mm (3-inch) Thermal Paper
- **Physical printable width:** 72mm
- **Dot density:** 576 dots/line (8 dots/mm, 203 DPI)
- **Monospace character limit:** **48 characters** per line (Font A, 12x24 dots)
- **Layout Rule:** 3-column table:
  - Column 1 (Item Name & Description): 28 characters
  - Column 2 (Qty x Rate): 10 characters
  - Column 3 (Line Total): 10 characters
- **Divider string:** `------------------------------------------------` (48 hyphens)

---

## 4. Line Formatting & Word-Wrapping Algorithms

In `printerService.ts`, fixed-column layout is generated using pure deterministic string manipulation without external native dependencies:

```typescript
// Column Spacing & Justification
export function padRow(left: string, right: string, width: 32 | 48): string {
  const spaceAvailable = width - left.length - right.length;
  if (spaceAvailable > 0) {
    return left + ' '.repeat(spaceAvailable) + right;
  }
  // Truncate left if text exceeds boundary
  const maxLeft = width - right.length - 1;
  return left.slice(0, maxLeft) + ' ' + right;
}

// Centering Text
export function centerText(text: string, width: 32 | 48): string {
  if (text.length >= width) return text.slice(0, width);
  const leftPad = Math.floor((width - text.length) / 2);
  return ' '.repeat(leftPad) + text;
}
```

---

## 5. Document Layout Specifications

### 5.1 Customer Final Bill (80mm Example)
```
                  THE SENSORY OASIS                  
          Plot 42, HSR Layout, Sector 4, BLR         
                Ph: +91 98765 43210                  
            GSTIN: 29AAAAA0000A1Z5 | FSSAI: 1122...  
------------------------------------------------
Invoice No: TSOS-2026-0842       Table: T-04 (Dine-In)
Date: 19/09/2026 16:45           Cashier: Priya S.
------------------------------------------------
Item Description             Qty x Rate        Total
------------------------------------------------
Flat White (Hot)                   2 x 180.00   360.00
  + Oat Milk (+₹30)
  + Extra Vanilla Shot (+₹25)
Artisan Sourdough Croissant        1 x 160.00   160.00
Truffle Fries                      1 x 220.00   220.00
------------------------------------------------
Subtotal:                                       740.00
CGST (2.5%):                                     18.50
SGST (2.5%):                                     18.50
Loyalty Points Discount (50 pts):               -50.00
TSOS Convenience Fee (Absorbed):                  0.00
------------------------------------------------
GRAND TOTAL:                                 INR 727.00
------------------------------------------------
Payment Mode: UPI / GPay (Ref: UPI84729103)
Customer: Rahul Verma (+91 98450 12345)
Loyalty Balance: 142 pts (+72 pts earned today!)

               Scan for E-Bill & Receipt
                     [ QR CODE ]
           Thank you for visiting The Sensory Oasis!
                  Powered by TSOS
```

### 5.2 Kitchen Order Ticket (KOT) (80mm Example)
```
================================================
              KITCHEN ORDER TICKET              
================================================
KOT #: #0842-1                   Table: T-04 (Dine-In)
Time: 16:45:12                   Server: Priya S.
------------------------------------------------
QTY  ITEM DESCRIPTION / MODIFIERS
------------------------------------------------
 2   FLAT WHITE (HOT)
     ** OAT MILK MODIFIER **
     ** EXTRA VANILLA SHOT **
     Note: Extra hot, milk steamed dry

 1   ARTISAN SOURDOUGH CROISSANT
     Note: Warm before serving

 1   TRUFFLE FRIES
     Note: Salt on the side
------------------------------------------------
TOTAL ITEMS: 4
================================================
```

---

## 6. Hardware Communication Transport Implementations

### 6.1 Web Bluetooth (BLE GATT)
- **Standard Service UUID:** `000018f0-0000-1000-8000-00805f9b34fb` (Common Chinese & Rongta/Xprinter thermal engines) or `e7810a71-73ae-499d-8c15-faa9aef0c3f2`
- **Write Characteristic UUID:** `00002af1-0000-1000-8000-00805f9b34fb` (Write without response or Write with response)
- **Packet Fragmentation (MTU Slicing):** Bluetooth Low Energy packets are strictly capped by GATT MTU (default 23 bytes, negotiated up to 512 bytes). Sending an entire 4KB ESC/POS print job in a single call causes hardware buffer overflow or disconnection.
- **Slicing Implementation:**
```typescript
async function writeBleChunks(characteristic: BluetoothRemoteGATTCharacteristic, data: Uint8Array) {
  const CHUNK_SIZE = 100; // Safe MTU payload size
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const slice = data.slice(i, i + CHUNK_SIZE);
    await characteristic.writeValue(slice);
    await new Promise((res) => setTimeout(res, 25)); // 25ms throttle avoids buffer drops
  }
}
```

### 6.2 Network / LAN Thermal Printers (Port 9100 / JetDirect)
- In standard desktop environments, network printers listen on raw TCP port 9100.
- On Web clients running without native OS sockets, print jobs are routed via:
  1. A lightweight local node agent (`http://127.0.0.1:3000/api/print/network`) which opens a raw TCP socket:
  ```typescript
  import net from 'net';
  export function sendTcpPrint(ip: string, port = 9100, payload: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      client.setTimeout(5000);
      client.connect(port, ip, () => {
        client.write(payload, () => {
          client.end();
          resolve();
        });
      });
      client.on('error', reject);
      client.on('timeout', () => { client.destroy(); reject(new Error('Printer TCP timeout')); });
    });
  }
  ```

### 6.3 Browser Print Engine Fallback (`@media print`)
- When physical ESC/POS hardware is disconnected, TSOS opens a responsive print modal rendered with CSS typography tuned for 58mm/80mm thermal rolls:
```css
@media print {
  body * { visibility: hidden; }
  #thermal-receipt-printable, #thermal-receipt-printable * { visibility: visible; }
  #thermal-receipt-printable {
    position: absolute;
    left: 0;
    top: 0;
    width: 80mm;
    margin: 0;
    padding: 2mm;
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    line-height: 1.2;
    color: #000;
  }
  @page {
    size: 80mm auto;
    margin: 0mm;
  }
}
```

---

## 7. Error Handling & Hardware Resilience
1. **Paper Out / Cover Open Detection:** Supported via real-time status request command `DLE EOT 1` (`10 04 01`).
2. **Offline Buffer Replay:** If the printer goes offline during lunch rush, tickets are stored in `pendingPrintQueue` in Zustand and `localStorage`. When connectivity is restored, the queue flushes in order with duplicate protection.
3. **Cash Drawer Pulse Protection:** Solenoid trigger pulse duration is limited to 250ms (`1B 70 00 19 FA`) to prevent solenoid burnout.

---

## 8. Manual 'Print Receipt' Workstation & Web Bluetooth Module

TSOS includes a dedicated manual receipt workstation (`ManualPrintReceiptModal.tsx`) providing cashiers and managers with granular control over physical POS slips and direct Web Bluetooth thermal printer discovery:

### 8.1 Web Bluetooth Discovery & GATT Pairing
- **Standard BLE Service UUIDs:**
  - `000018f0-0000-1000-8000-00805f9b34fb` (Standard ESC/POS Service)
  - `49535343-fe7d-4ae5-8fa9-9fafd205e455` (ISSC Transmit Service)
  - `e7810a71-73ae-499d-8c15-faa9aef0c3f2` (Star Micronics BLE)
  - `0000ae00-0000-1000-8000-00805f9b34fb` (Common Mobile POS Service)
- **Supported Hardware Presets:**
  1. *Epson TM-m30 / TM-T20II* (ESC/POS, 80mm, High-speed cutter)
  2. *Star Micronics SM-L200* (Star Line / ESC/POS, 58mm portable)
  3. *MUNBYN ITPP047 / ITPP130* (ESC/POS, 80mm heavy-duty)
  4. *Generic 58mm Mini BLE Printer* (ESC/POS, 32-col portable belt clip)
  5. *Generic 80mm Desktop BLE Printer* (ESC/POS, 48-col counter unit)

### 8.2 Real-time Custom Formatting Engine
Operators can toggle specific lines before generating the physical slip:
- `includeGst`: Prints itemized 2.5% CGST + 2.5% SGST tax breakup and Cafe GSTIN.
- `includePlatformFee`: Displays convenience / platform technology fee and fee payer tag.
- `includeTableNumber`: Highlights dine-in table assignment with double-strike font.
- `includeCashierName`: Emits logged-in cashier / server name for operational accountability.
- `includeLoyalty`: Displays loyalty points earned from the transaction and customer balance.
- `openCashDrawer`: Automatically prepends `1B 70 00 19 FA` solenoid pulse to pop the till on cash payments.
- `paperWidth`: On-the-fly toggling between 58mm (32 chars/line) and 80mm (48 chars/line) columns.
- `customFooterNote`: Custom promotional text (e.g. "Scan QR for 15% off your next visit!").

### 8.3 Chunked Transmission Architecture
To eliminate buffer overruns on resource-constrained embedded thermal printers, raw ESC/POS binary payloads are segmented into 256-byte chunks transmitted over BLE with a 15ms throttling interval:
```typescript
const CHUNK_SIZE = 256;
for (let offset = 0; offset < binaryData.length; offset += CHUNK_SIZE) {
  const chunk = binaryData.slice(offset, offset + CHUNK_SIZE);
  await characteristic.writeValue(chunk);
  await new Promise((r) => setTimeout(r, 15));
}
```

---

## 9. Print Logs & Hardware Audit Subsystem (`OrdersScreen`)

To ensure complete accountability, operational reliability, and rapid troubleshooting during rush hours, TSOS incorporates a dedicated **Print Logs & Hardware Audit Workstation** accessible directly within the `OrdersScreen` via the sub-navigation tab switcher.

### 9.1 Data Schema (`PrintLogEntry`)
Every print attempt—whether dispatched automatically upon checkout, manually triggered via the Thermal Workstation, or run as a diagnostic self-test—is recorded in the centralized Zustand store (`printLogs`) and persisted to `localStorage`:

```typescript
export interface PrintLogEntry {
  id: string;                          // Unique log UUID (e.g. 'plog-1726743900-a1b2')
  order_id?: string;                   // Associated POS order ID
  order_number?: number | string;      // Human-readable sequential order number (#101)
  document_type: 'bill' | 'kot' | 'test' | 'drawer_kick';
  printer_name: string;                // Physical device name (e.g. 'Epson TM-m30')
  interface_type: 'bluetooth' | 'browser' | 'network' | 'usb';
  paper_width: '58mm' | '80mm';
  status: 'success' | 'failed';        // Hardware delivery acknowledgement status
  error_message?: string;              // Captured GATT, network socket, or timeout exception
  bytes_sent?: number;                 // Binary ESC/POS byte length transmitted
  operator_name?: string;              // Logged-in cashier/manager who triggered the job
  timestamp: string;                   // ISO 8601 timestamp
}
```

### 9.2 Real-time Diagnostic Features
1. **Real-time KPI Summary:**
   - **Total Print Jobs**: Lifetime counter of tickets dispatched.
   - **Transmission Success Rate**: Percentage calculation (`success / total * 100`) providing immediate visibility into hardware health.
   - **Hardware Failures / Errors**: Prominent alert indicator highlighting unprinted tickets requiring manager review.
   - **Web Bluetooth Device Counter**: Count of GATT BLE direct transmissions.
2. **Interactive Filtering & Search:**
   - Multi-field search querying order number, printer hardware name, operator name, or error keywords.
   - Status filters: `All`, `Success`, and `Failed`.
   - Document type filters: `Customer Bills`, `Kitchen KOTs`, `Diagnostic Tests`, and `Drawer Kicks`.
   - Hardware interface filters: `Web Bluetooth`, `Browser Engine`, and `Network LAN`.
3. **Expandable Error Inspection & Suggested Remediation:**
   - Detailed stack trace and hardware exception messages (e.g. *Buffer underrun*, *GATT write error*, *Port 9100 TCP timeout*).
   - Contextual troubleshooting matrix advising staff on Bluetooth pairing range, roll seating, and printer IP verification.
4. **Instant One-Click Retry:**
   - Each logged failure row features a `Retry` action button that instantly opens the `ManualPrintReceiptModal` pre-populated with the exact failed order payload, allowing the cashier to re-route the print job to an alternate printer or browser print engine without re-entering transaction details.


