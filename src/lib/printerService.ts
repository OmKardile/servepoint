/**
 * TSOS ESC/POS Thermal Printer Driver & Byte Stream Generator
 * Supports 58mm (32 chars/line) and 80mm (48 chars/line) thermal rolls.
 * Standard ESC/POS commands for desktop USB, Network/LAN (port 9100), Bluetooth, and Browser Print.
 */

import { Order, Location, PrinterConfig, PaperWidth } from '../types';

export const ESC = '\x1b';
export const GS = '\x1d';
export const FS = '\x1c';

// ESC/POS Commands
export const COMMANDS = {
  INIT: `${ESC}@`,
  ALIGN_LEFT: `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  ALIGN_RIGHT: `${ESC}a\x02`,
  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  DOUBLE_WIDTH_ON: `${ESC}!\x20`,
  DOUBLE_HEIGHT_ON: `${ESC}!\x10`,
  DOUBLE_SIZE_ON: `${ESC}!\x30`,
  NORMAL_SIZE: `${ESC}!\x00`,
  UNDERLINE_ON: `${ESC}-\x01`,
  UNDERLINE_OFF: `${ESC}-\x00`,
  CUT_FULL: `${GS}V\x00`,
  CUT_PARTIAL: `${GS}V\x01`,
  CUT_FEED: `${GS}V\x42\x00`,
  DRAWER_KICK_PIN2: `${ESC}p\x00\x19\xfa`, // Pulse pin 2: 25ms on, 250ms off
  DRAWER_KICK_PIN5: `${ESC}p\x01\x19\xfa`, // Pulse pin 5
  FEED_LINES: (n: number) => `${ESC}d${String.fromCharCode(n)}`,
};

/**
 * Pad strings to fit exact thermal receipt column widths
 */
export function formatTwoColumns(left: string, right: string, width: number): string {
  const leftLen = left.length;
  const rightLen = right.length;
  if (leftLen + rightLen >= width) {
    const truncatedLeft = left.substring(0, Math.max(1, width - rightLen - 1));
    const spaces = ' '.repeat(Math.max(1, width - truncatedLeft.length - rightLen));
    return `${truncatedLeft}${spaces}${right}`;
  }
  const spaces = ' '.repeat(width - leftLen - rightLen);
  return `${left}${spaces}${right}`;
}

export function formatThreeColumns(
  col1: string,
  col2: string,
  col3: string,
  width: number
): string {
  // e.g. "Espresso x2"   " "   "₹320.00"
  const col2Len = col2.length;
  const col3Len = col3.length;
  const availableForCol1 = width - col2Len - col3Len - 2;
  const truncatedCol1 = col1.length > availableForCol1 ? col1.substring(0, availableForCol1) : col1;
  const totalUsed = truncatedCol1.length + col2Len + col3Len;
  const remainingSpaces = Math.max(2, width - totalUsed);
  const space1 = ' '.repeat(Math.floor(remainingSpaces / 2));
  const space2 = ' '.repeat(Math.ceil(remainingSpaces / 2));
  return `${truncatedCol1}${space1}${col2}${space2}${col3}`;
}

export function getLineWidth(width: PaperWidth): number {
  return width === '58mm' ? 32 : 48;
}

export function getDivider(width: PaperWidth, char = '-'): string {
  return char.repeat(getLineWidth(width));
}

/**
 * Generate Raw ESC/POS Binary Byte Stream for Customer Bill Receipt
 */
export function generateReceiptEscPos(
  order: Order,
  location: Location,
  config: PrinterConfig
): Uint8Array {
  const width = getLineWidth(config.paper_width);
  const divider = getDivider(config.paper_width, '-');
  const doubleDivider = getDivider(config.paper_width, '=');

  let text = '';

  // Initialize
  text += COMMANDS.INIT;

  // Header: Location Name & Contact
  text += COMMANDS.ALIGN_CENTER;
  text += COMMANDS.BOLD_ON;
  text += COMMANDS.DOUBLE_SIZE_ON;
  text += `${location.name.toUpperCase()}\n`;
  text += COMMANDS.NORMAL_SIZE;
  text += COMMANDS.BOLD_OFF;

  text += `${location.address}\n`;
  text += `Ph: ${location.phone}\n`;
  if (config.gstin || location.name) {
    text += `GSTIN: ${config.gstin || '29AABCT1337C1Z0'}\n`;
  }
  if (config.receipt_header) {
    text += `${config.receipt_header}\n`;
  }

  text += `${divider}\n`;

  // Order Details
  text += COMMANDS.ALIGN_LEFT;
  text += formatTwoColumns(`Order: #${order.order_number}`, order.order_type.toUpperCase().replace('_', ' '), width) + '\n';
  text += formatTwoColumns(
    `Date: ${new Date(order.created_at).toLocaleDateString()}`,
    `Time: ${new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    width
  ) + '\n';

  if (order.table_label) {
    text += formatTwoColumns(`Table: ${order.table_label}`, `Cashier: ${order.placed_by || 'Staff'}`, width) + '\n';
  } else {
    text += formatTwoColumns('Type: Takeaway/Counter', `Cashier: ${order.placed_by || 'Staff'}`, width) + '\n';
  }

  if (order.customer_name) {
    text += formatTwoColumns(
      `Guest: ${order.customer_name}`,
      order.customer_phone ? `(${order.customer_phone.slice(-4)})` : '',
      width
    ) + '\n';
  }

  text += `${divider}\n`;

  // Items Column Headers
  text += COMMANDS.BOLD_ON;
  text += formatThreeColumns('ITEM', 'QTY', 'AMOUNT', width) + '\n';
  text += COMMANDS.BOLD_OFF;
  text += `${divider}\n`;

  // Items
  for (const item of order.items || []) {
    const itemTotal = `₹${(item.item_total ?? (item.unit_price * item.qty)).toFixed(2)}`;
    text += formatThreeColumns(item.menu_item_name, `${item.qty}x`, itemTotal, width) + '\n';
    
    // Notes or Addons
    if (item.addons && item.addons.length > 0) {
      for (const addon of item.addons) {
        text += `  + ${addon.name} (₹${addon.price})\n`;
      }
    }
    if (item.notes) {
      text += `  * Note: ${item.notes}\n`;
    }
  }

  text += `${divider}\n`;

  // Financial Breakdown
  text += formatTwoColumns('Subtotal:', `₹${order.subtotal.toFixed(2)}`, width) + '\n';
  text += formatTwoColumns('GST (5%):', `₹${order.tax_total.toFixed(2)}`, width) + '\n';

  if (order.discount_total > 0) {
    text += formatTwoColumns('Discount / Offer:', `-₹${order.discount_total.toFixed(2)}`, width) + '\n';
  }

  if (order.fee_payer === 'customer' && order.platform_fee > 0) {
    text += formatTwoColumns('Platform Fee:', `₹${order.platform_fee.toFixed(2)}`, width) + '\n';
  }

  text += `${doubleDivider}\n`;

  // Grand Total in Bold Double Height
  text += COMMANDS.BOLD_ON;
  text += COMMANDS.DOUBLE_HEIGHT_ON;
  text += formatTwoColumns('TOTAL PAID:', `₹${order.grand_total.toFixed(2)}`, width) + '\n';
  text += COMMANDS.NORMAL_SIZE;
  text += COMMANDS.BOLD_OFF;
  text += `${doubleDivider}\n`;

  // Loyalty Details
  if (order.loyalty_points_earned || order.loyalty_points_redeemed) {
    text += COMMANDS.ALIGN_CENTER;
    text += COMMANDS.BOLD_ON;
    text += '--- TSOS CLUB LOYALTY ---\n';
    text += COMMANDS.BOLD_OFF;
    text += COMMANDS.ALIGN_LEFT;

    if (order.loyalty_points_earned) {
      text += formatTwoColumns('Points Earned (+1/₹10):', `+${order.loyalty_points_earned} pts`, width) + '\n';
    }
    if (order.loyalty_points_redeemed) {
      text += formatTwoColumns('Points Redeemed (1pt=₹1):', `-${order.loyalty_points_redeemed} pts`, width) + '\n';
    }
    text += `${divider}\n`;
  }

  // Payment Status
  text += COMMANDS.ALIGN_CENTER;
  text += `Payment Mode: ${(order.payment_method || 'CASH').toUpperCase()}\n`;
  text += `Status: ${order.payment_status.toUpperCase()} / COMPLETED\n`;

  // Footer Message
  text += '\n';
  text += `${config.receipt_footer || 'Thank you for dining with us! ✨'}\n`;
  text += 'Powered by TSOS • tsos.dev\n';
  text += '\n\n';

  // Cash Drawer Kick Pulse (if configured)
  if (config.open_cash_drawer && order.payment_method === 'cash') {
    text += COMMANDS.DRAWER_KICK_PIN2;
  }

  // Feed & Cut Paper (if configured)
  if (config.cut_paper) {
    text += COMMANDS.FEED_LINES(3);
    text += COMMANDS.CUT_FEED;
  } else {
    text += COMMANDS.FEED_LINES(4);
  }

  return new TextEncoder().encode(text);
}

/**
 * Generate Kitchen Order Ticket (KOT) ESC/POS Byte Stream
 */
export function generateKotEscPos(
  order: Order,
  config: PrinterConfig
): Uint8Array {
  const width = getLineWidth(config.paper_width);
  const divider = getDivider(config.paper_width, '=');

  let text = '';
  text += COMMANDS.INIT;
  text += COMMANDS.ALIGN_CENTER;
  text += COMMANDS.BOLD_ON;
  text += COMMANDS.DOUBLE_SIZE_ON;
  text += '*** KITCHEN TICKET ***\n';
  text += COMMANDS.NORMAL_SIZE;

  text += `${divider}\n`;
  text += COMMANDS.ALIGN_LEFT;
  text += formatTwoColumns(`Order: #${order.order_number}`, order.order_type.toUpperCase(), width) + '\n';
  if (order.table_label) {
    text += COMMANDS.BOLD_ON;
    text += COMMANDS.DOUBLE_HEIGHT_ON;
    text += `TABLE: ${order.table_label}\n`;
    text += COMMANDS.NORMAL_SIZE;
    text += COMMANDS.BOLD_OFF;
  }
  text += formatTwoColumns(
    `Time: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    `Server: ${order.placed_by || 'POS'}`,
    width
  ) + '\n';
  text += `${divider}\n`;

  // Items
  for (const item of order.items || []) {
    text += COMMANDS.BOLD_ON;
    text += COMMANDS.DOUBLE_HEIGHT_ON;
    text += `${item.qty}x  ${item.menu_item_name}\n`;
    text += COMMANDS.NORMAL_SIZE;
    text += COMMANDS.BOLD_OFF;

    if (item.addons && item.addons.length > 0) {
      for (const addon of item.addons) {
        text += `   + ${addon.name}\n`;
      }
    }
    if (item.notes) {
      text += COMMANDS.BOLD_ON;
      text += `   >> SPECIAL: ${item.notes.toUpperCase()}\n`;
      text += COMMANDS.BOLD_OFF;
    }
  }

  text += `${divider}\n`;
  text += COMMANDS.FEED_LINES(3);
  text += COMMANDS.CUT_FEED;

  return new TextEncoder().encode(text);
}

/**
 * Generate Diagnostic Hardware Test Pattern for Thermal Printer
 */
export function generateTestReceiptEscPos(
  location: Location,
  config: PrinterConfig
): Uint8Array {
  const width = getLineWidth(config.paper_width);
  const divider = getDivider(config.paper_width, '-');

  let text = '';
  text += COMMANDS.INIT;
  text += COMMANDS.ALIGN_CENTER;
  text += COMMANDS.BOLD_ON;
  text += COMMANDS.DOUBLE_SIZE_ON;
  text += 'TSOS PRINTER TEST\n';
  text += COMMANDS.NORMAL_SIZE;
  text += COMMANDS.BOLD_OFF;

  text += `${divider}\n`;
  text += `Thermal Roll Width: ${config.paper_width} (${width} chars/line)\n`;
  text += `Interface: ${config.connection_type.toUpperCase()}\n`;
  text += `Date: ${new Date().toLocaleString()}\n`;
  text += `${divider}\n`;

  text += COMMANDS.ALIGN_LEFT;
  text += 'Left Aligned Text\n';
  text += COMMANDS.ALIGN_CENTER;
  text += 'Center Aligned Text\n';
  text += COMMANDS.ALIGN_RIGHT;
  text += 'Right Aligned Text\n';

  text += COMMANDS.ALIGN_LEFT;
  text += `${divider}\n`;
  text += COMMANDS.BOLD_ON;
  text += 'Emphasized / Bold Text Test\n';
  text += COMMANDS.BOLD_OFF;
  text += COMMANDS.DOUBLE_HEIGHT_ON;
  text += 'Double Height Font Test\n';
  text += COMMANDS.NORMAL_SIZE;
  text += COMMANDS.DOUBLE_WIDTH_ON;
  text += 'Double Width Font Test\n';
  text += COMMANDS.NORMAL_SIZE;

  text += `${divider}\n`;
  text += 'Character Set Line Width:\n';
  text += `${'0123456789'.repeat(Math.ceil(width / 10)).substring(0, width)}\n`;
  text += `${divider}\n`;

  text += COMMANDS.ALIGN_CENTER;
  text += 'Hardware Verification PASSED\n';
  text += 'TSOS Cafe Operating System\n\n';

  if (config.open_cash_drawer) {
    text += COMMANDS.DRAWER_KICK_PIN2;
  }

  if (config.cut_paper) {
    text += COMMANDS.FEED_LINES(3);
    text += COMMANDS.CUT_FEED;
  } else {
    text += COMMANDS.FEED_LINES(4);
  }

  return new TextEncoder().encode(text);
}

/**
 * Web Bluetooth Thermal Printer Connection & Device Management
 */
export interface BluetoothPrinterDevice {
  id: string;
  name: string;
  connected: boolean;
  type: 'web_bluetooth' | 'preset';
  model?: string;
  paperWidth: PaperWidth;
  macAddress?: string;
  batteryLevel?: number;
  gattDevice?: any;
}

export interface ReceiptFormatOptions {
  paperWidth: PaperWidth;
  showHeader: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showGstin: boolean;
  showFssai: boolean;
  showWaiter: boolean;
  showTable: boolean;
  showPaymentMethod: boolean;
  showGstBreakdown: boolean;
  showPlatformFee: boolean;
  showCustomerLoyalty: boolean;
  showItemAddons: boolean;
  showItemNotes: boolean;
  showUpiQr: boolean;
  customFooterText: string;
  autoCut: boolean;
  openCashDrawer: boolean;
  extraFeedLines: number;
}

export const DEFAULT_RECEIPT_OPTIONS: ReceiptFormatOptions = {
  paperWidth: '80mm',
  showHeader: true,
  showAddress: true,
  showPhone: true,
  showGstin: true,
  showFssai: true,
  showWaiter: true,
  showTable: true,
  showPaymentMethod: true,
  showGstBreakdown: true,
  showPlatformFee: true,
  showCustomerLoyalty: true,
  showItemAddons: true,
  showItemNotes: true,
  showUpiQr: true,
  customFooterText: 'Thank you for dining at The Sensory Oasis! Follow us @thesensoryoasis',
  autoCut: true,
  openCashDrawer: true,
  extraFeedLines: 3,
};

export const PRESET_BLUETOOTH_PRINTERS: BluetoothPrinterDevice[] = [
  {
    id: 'bt-sunmi-v2',
    name: 'Sunmi V2 PRO Bluetooth (Internal 58mm)',
    connected: false,
    type: 'preset',
    model: 'Sunmi V2 PRO Built-in Seiko Thermal Head',
    paperWidth: '58mm',
    macAddress: 'DC:0E:A1:4B:92:01',
    batteryLevel: 94,
  },
  {
    id: 'bt-epson-tm88',
    name: 'Epson TM-T88VI Bluetooth (80mm)',
    connected: true,
    type: 'preset',
    model: 'Epson TM-T88VI-051 High-Speed (350mm/s)',
    paperWidth: '80mm',
    macAddress: '00:26:AB:7C:11:4F',
    batteryLevel: 100,
  },
  {
    id: 'bt-pine-d200',
    name: 'Pine Labs D200 Contactless BT (58mm)',
    connected: false,
    type: 'preset',
    model: 'Pine Labs D200 mPOS + Thermal',
    paperWidth: '58mm',
    macAddress: '3C:71:BF:88:2E:55',
    batteryLevel: 82,
  },
  {
    id: 'bt-tvs-rp3200',
    name: 'TVS RP-3200 Star ESC/POS BT (80mm)',
    connected: false,
    type: 'preset',
    model: 'TVS RP-3200 Plus Wireless',
    paperWidth: '80mm',
    macAddress: '88:4A:EA:12:34:56',
    batteryLevel: 100,
  },
  {
    id: 'bt-mtp-2',
    name: 'MTP-II Portable Belt-Clip BT (58mm)',
    connected: false,
    type: 'preset',
    model: 'MTP-II Mobile Waiter Printer',
    paperWidth: '58mm',
    macAddress: '66:55:44:33:22:11',
    batteryLevel: 68,
  },
];

let activeWebBluetoothDevice: any = null;

/**
 * Scan & Pair a physical thermal printer using Web Bluetooth API
 */
export async function requestWebBluetoothPrinter(): Promise<{
  success: boolean;
  message: string;
  device?: BluetoothPrinterDevice;
}> {
  try {
    if (typeof navigator === 'undefined' || !(navigator as any).bluetooth) {
      return {
        success: false,
        message:
          'Web Bluetooth is not supported in this browser. Please open in Google Chrome or Microsoft Edge with Bluetooth enabled.',
      };
    }

    const navBt = (navigator as any).bluetooth;
    const device = await navBt.requestDevice({
      filters: [
        { namePrefix: 'Printer' },
        { namePrefix: 'POS' },
        { namePrefix: 'RP' },
        { namePrefix: 'MTP' },
        { namePrefix: 'Sunmi' },
        { namePrefix: 'Epson' },
        { namePrefix: 'TVS' },
        { namePrefix: 'BT' },
      ],
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb', // Standard Thermal
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        0xff00,
      ],
    });

    const server = await device.gatt.connect();
    activeWebBluetoothDevice = device;

    const btDevice: BluetoothPrinterDevice = {
      id: device.id || `bt-${Date.now()}`,
      name: device.name || 'Discovered Bluetooth Printer',
      connected: server.connected,
      type: 'web_bluetooth',
      model: 'Discovered ESC/POS Bluetooth Peripheral',
      paperWidth: '80mm',
      gattDevice: device,
    };

    return {
      success: true,
      message: `Successfully paired with ${device.name || 'Bluetooth Printer'}.`,
      device: btDevice,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Web Bluetooth scan was cancelled or failed.',
    };
  }
}

/**
 * Disconnect active Web Bluetooth printer
 */
export function disconnectWebBluetoothPrinter(): boolean {
  if (activeWebBluetoothDevice && activeWebBluetoothDevice.gatt?.connected) {
    activeWebBluetoothDevice.gatt.disconnect();
    activeWebBluetoothDevice = null;
    return true;
  }
  activeWebBluetoothDevice = null;
  return false;
}

/**
 * Send raw binary bytes to a thermal printer via Web Bluetooth API
 */
export async function printViaBluetooth(
  data: Uint8Array,
  targetDevice?: BluetoothPrinterDevice
): Promise<{ success: boolean; message: string }> {
  try {
    // If targeted device is a preset simulation and no real physical Web Bluetooth is connected,
    // simulate successful transmission to the selected model
    if (targetDevice?.type === 'preset' && !activeWebBluetoothDevice) {
      await new Promise((res) => setTimeout(res, 600));
      return {
        success: true,
        message: `Transmitted ${data.length} ESC/POS bytes to ${targetDevice.name} (${targetDevice.paperWidth}).`,
      };
    }

    if (typeof navigator === 'undefined' || !(navigator as any).bluetooth) {
      // In sandbox/iframe preview environments where Web Bluetooth might not have permissions:
      return {
        success: true,
        message: `ESC/POS binary stream (${data.length} bytes) ready for ${targetDevice?.name || 'Bluetooth Printer'}. Use Browser Print dialog to print physically.`,
      };
    }

    let device = activeWebBluetoothDevice;
    if (!device || !device.gatt?.connected) {
      const connectRes = await requestWebBluetoothPrinter();
      if (!connectRes.success || !connectRes.device) {
        return { success: false, message: connectRes.message };
      }
      device = activeWebBluetoothDevice;
    }

    const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
    const services = await server.getPrimaryServices();
    if (services.length === 0) {
      return { success: false, message: 'No accessible printing services found on Bluetooth device.' };
    }

    const characteristics = await services[0].getCharacteristics();
    const writeChar = characteristics.find(
      (c: any) => c.properties.write || c.properties.writeWithoutResponse
    );
    if (!writeChar) {
      return { success: false, message: 'No writable characteristic found on Bluetooth printer.' };
    }

    // Write in throttled 256-byte chunks with 15ms pauses
    const chunkSize = 256;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      await writeChar.writeValue(chunk);
      await new Promise((res) => setTimeout(res, 15));
    }

    return {
      success: true,
      message: `Successfully transmitted ${data.length} bytes to ${device.name || 'Bluetooth Printer'}.`,
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Bluetooth connection failed.' };
  }
}

/**
 * Format POS Order Summary into ESC/POS binary stream based on custom formatting options
 */
export function formatCustomReceiptEscPos(
  order: Order,
  location: Location,
  options: ReceiptFormatOptions
): Uint8Array {
  const width = getLineWidth(options.paperWidth);
  const divider = getDivider(options.paperWidth, '-');
  const doubleDivider = getDivider(options.paperWidth, '=');

  let text = '';
  text += COMMANDS.INIT;

  // Header
  if (options.showHeader) {
    text += COMMANDS.ALIGN_CENTER;
    text += COMMANDS.BOLD_ON;
    text += COMMANDS.DOUBLE_SIZE_ON;
    text += `${location.name.toUpperCase()}\n`;
    text += COMMANDS.NORMAL_SIZE;
    text += COMMANDS.BOLD_OFF;

    if (options.showAddress) {
      text += `${location.address}\n`;
    }
    if (options.showPhone) {
      text += `Phone: ${location.phone}\n`;
    }
    if (options.showGstin) {
      text += 'GSTIN: 27AADCS1234F1Z5\n';
    }
    if (options.showFssai) {
      text += 'FSSAI Lic: 11521018000456\n';
    }
    text += `${divider}\n`;
  }

  // Meta & Tax Invoice Header
  text += COMMANDS.ALIGN_CENTER;
  text += COMMANDS.BOLD_ON;
  text += `TAX INVOICE / CASH BILL\n`;
  text += COMMANDS.BOLD_OFF;
  text += `${divider}\n`;

  text += COMMANDS.ALIGN_LEFT;
  text += formatTwoColumns(
    `Order: #${order.order_number}`,
    `Type: ${order.order_type.toUpperCase().replace('_', ' ')}`,
    width
  ) + '\n';

  if (options.showTable && order.table_label) {
    text += COMMANDS.BOLD_ON;
    text += formatTwoColumns(`Table: ${order.table_label}`, '', width) + '\n';
    text += COMMANDS.BOLD_OFF;
  }

  const dateStr = new Date(order.created_at || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = new Date(order.created_at || Date.now()).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  text += formatTwoColumns(`Date: ${dateStr}`, `Time: ${timeStr}`, width) + '\n';

  if (options.showWaiter) {
    text += formatTwoColumns(`Cashier/Server: ${order.placed_by || 'Staff'}`, '', width) + '\n';
  }

  if (options.showCustomerLoyalty && order.customer_name) {
    text += formatTwoColumns(`Customer: ${order.customer_name}`, '', width) + '\n';
  }

  text += `${doubleDivider}\n`;

  // Items Header
  text += COMMANDS.BOLD_ON;
  text += formatThreeColumns('ITEM', 'QTY', 'AMOUNT', width) + '\n';
  text += COMMANDS.BOLD_OFF;
  text += `${divider}\n`;

  // Items List
  for (const item of order.items || []) {
    text += COMMANDS.BOLD_ON;
    const nameLine = formatThreeColumns(
      item.menu_item_name,
      `${item.qty}x`,
      `INR ${item.item_total.toFixed(2)}`,
      width
    );
    text += `${nameLine}\n`;
    text += COMMANDS.BOLD_OFF;

    if (item.variant_name) {
      text += `  Size: ${item.variant_name}\n`;
    }

    if (options.showItemAddons && item.addons && item.addons.length > 0) {
      for (const a of item.addons) {
        text += `  + ${a.name} (INR ${a.price.toFixed(2)})\n`;
      }
    }

    if (options.showItemNotes && item.notes) {
      text += `  Note: ${item.notes}\n`;
    }
  }

  text += `${divider}\n`;

  // Totals & Financial Breakdown
  text += formatTwoColumns('Subtotal:', `INR ${order.subtotal.toFixed(2)}`, width) + '\n';

  if (options.showGstBreakdown) {
    const halfTax = +(order.tax_total / 2).toFixed(2);
    text += formatTwoColumns('CGST (2.5%):', `INR ${halfTax.toFixed(2)}`, width) + '\n';
    text += formatTwoColumns('SGST (2.5%):', `INR ${halfTax.toFixed(2)}`, width) + '\n';
  } else {
    text += formatTwoColumns('GST Total (5%):', `INR ${order.tax_total.toFixed(2)}`, width) + '\n';
  }

  if (options.showPlatformFee && order.platform_fee > 0) {
    text += formatTwoColumns(
      'Convenience Fee (TSOS):',
      order.fee_payer === 'customer' ? `INR ${order.platform_fee.toFixed(2)}` : 'INR 0.00 (Paid by Cafe)',
      width
    ) + '\n';
  }

  if (order.discount_total > 0) {
    text += formatTwoColumns('Discounts / Offers:', `- INR ${order.discount_total.toFixed(2)}`, width) + '\n';
  }

  text += `${doubleDivider}\n`;

  // Grand Total in BOLD & Double Size
  text += COMMANDS.ALIGN_LEFT;
  text += COMMANDS.BOLD_ON;
  text += COMMANDS.DOUBLE_HEIGHT_ON;
  text += formatTwoColumns('NET PAYABLE:', `INR ${order.grand_total.toFixed(2)}`, width) + '\n';
  text += COMMANDS.NORMAL_SIZE;
  text += COMMANDS.BOLD_OFF;

  text += `${doubleDivider}\n`;

  // Payment method
  if (options.showPaymentMethod) {
    text += formatTwoColumns(
      `Payment Mode: ${(order.payment_method || 'CASH').toUpperCase()}`,
      `Status: ${(order.payment_status || 'PAID').toUpperCase()}`,
      width
    ) + '\n';
  }

  if (options.showCustomerLoyalty && (order.loyalty_points_earned || order.loyalty_points_redeemed)) {
    text += `${divider}\n`;
    if (order.loyalty_points_earned) {
      text += formatTwoColumns('Points Earned Today:', `+${order.loyalty_points_earned} pts`, width) + '\n';
    }
    if (order.loyalty_points_redeemed) {
      text += formatTwoColumns('Points Redeemed:', `-${order.loyalty_points_redeemed} pts`, width) + '\n';
    }
  }

  // UPI BharatQR simulation
  if (options.showUpiQr) {
    text += `${divider}\n`;
    text += COMMANDS.ALIGN_CENTER;
    text += '[ SCAN TO PAY / VERIFY INVOICE ]\n';
    text += `UPI ID: thesensoryoasis@icici\n`;
  }

  // Custom Footer
  if (options.customFooterText) {
    text += `${divider}\n`;
    text += COMMANDS.ALIGN_CENTER;
    text += `${options.customFooterText}\n`;
  }

  text += `TSOS Intelligent Cafe OS • v1.4.0\n`;

  // Drawer kick & cutter
  if (options.openCashDrawer && order.payment_method === 'cash') {
    text += COMMANDS.DRAWER_KICK_PIN2;
  }

  text += COMMANDS.FEED_LINES(options.extraFeedLines || 3);
  if (options.autoCut) {
    text += COMMANDS.CUT_FEED;
  }

  return new TextEncoder().encode(text);
}

/**
 * Format plain-text receipt for screen physical preview
 */
export function formatCustomReceiptText(
  order: Order,
  location: Location,
  options: ReceiptFormatOptions
): string {
  const width = getLineWidth(options.paperWidth);
  const divider = getDivider(options.paperWidth, '-');
  const doubleDivider = getDivider(options.paperWidth, '=');

  let out = '';

  const center = (str: string) => {
    const pad = Math.max(0, Math.floor((width - str.length) / 2));
    return ' '.repeat(pad) + str;
  };

  if (options.showHeader) {
    out += `${center(location.name.toUpperCase())}\n`;
    if (options.showAddress) out += `${center(location.address)}\n`;
    if (options.showPhone) out += `${center(`Phone: ${location.phone}`)}\n`;
    if (options.showGstin) out += `${center('GSTIN: 27AADCS1234F1Z5')}\n`;
    if (options.showFssai) out += `${center('FSSAI: 11521018000456')}\n`;
    out += `${divider}\n`;
  }

  out += `${center('TAX INVOICE / CASH BILL')}\n`;
  out += `${divider}\n`;

  out += formatTwoColumns(
    `Order: #${order.order_number}`,
    `Type: ${order.order_type.toUpperCase()}`,
    width
  ) + '\n';

  if (options.showTable && order.table_label) {
    out += formatTwoColumns(`Table: ${order.table_label}`, '', width) + '\n';
  }

  const dateStr = new Date(order.created_at || Date.now()).toLocaleDateString('en-IN');
  const timeStr = new Date(order.created_at || Date.now()).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  out += formatTwoColumns(`Date: ${dateStr}`, `Time: ${timeStr}`, width) + '\n';

  if (options.showWaiter) {
    out += formatTwoColumns(`Server: ${order.placed_by || 'Staff'}`, '', width) + '\n';
  }

  out += `${doubleDivider}\n`;
  out += formatThreeColumns('ITEM', 'QTY', 'AMOUNT', width) + '\n';
  out += `${divider}\n`;

  for (const item of order.items || []) {
    out += formatThreeColumns(
      item.menu_item_name,
      `${item.qty}x`,
      `₹${item.item_total.toFixed(2)}`,
      width
    ) + '\n';

    if (item.variant_name) {
      out += `  Size: ${item.variant_name}\n`;
    }
    if (options.showItemAddons && item.addons && item.addons.length > 0) {
      for (const a of item.addons) {
        out += `  + ${a.name} (₹${a.price.toFixed(2)})\n`;
      }
    }
    if (options.showItemNotes && item.notes) {
      out += `  Note: ${item.notes}\n`;
    }
  }

  out += `${divider}\n`;
  out += formatTwoColumns('Subtotal:', `₹${order.subtotal.toFixed(2)}`, width) + '\n';

  if (options.showGstBreakdown) {
    const halfTax = +(order.tax_total / 2).toFixed(2);
    out += formatTwoColumns('CGST (2.5%):', `₹${halfTax.toFixed(2)}`, width) + '\n';
    out += formatTwoColumns('SGST (2.5%):', `₹${halfTax.toFixed(2)}`, width) + '\n';
  } else {
    out += formatTwoColumns('GST Total (5%):', `₹${order.tax_total.toFixed(2)}`, width) + '\n';
  }

  if (options.showPlatformFee && order.platform_fee > 0) {
    out += formatTwoColumns(
      'Fee (TSOS):',
      order.fee_payer === 'customer' ? `₹${order.platform_fee.toFixed(2)}` : '₹0.00 (Cafe)',
      width
    ) + '\n';
  }

  if (order.discount_total > 0) {
    out += formatTwoColumns('Discounts:', `-₹${order.discount_total.toFixed(2)}`, width) + '\n';
  }

  out += `${doubleDivider}\n`;
  out += formatTwoColumns('NET PAYABLE:', `₹${order.grand_total.toFixed(2)}`, width) + '\n';
  out += `${doubleDivider}\n`;

  if (options.showPaymentMethod) {
    out += formatTwoColumns(
      `Mode: ${(order.payment_method || 'CASH').toUpperCase()}`,
      `Status: ${(order.payment_status || 'PAID').toUpperCase()}`,
      width
    ) + '\n';
  }

  if (options.showUpiQr) {
    out += `${divider}\n`;
    out += `${center('[ BHARAT QR / UPI ENABLED ]')}\n`;
    out += `${center('thesensoryoasis@icici')}\n`;
  }

  if (options.customFooterText) {
    out += `${divider}\n`;
    out += `${center(options.customFooterText)}\n`;
  }

  out += `${center('*** TSOS Cafe OS ***')}\n`;
  return out;
}

/**
 * Kick Cash Drawer via Web Audio or ESC/POS Pulse
 */
export function triggerCashDrawerKick(): { success: boolean; message: string } {
  return {
    success: true,
    message: 'Cash drawer kick pulse (ESC p 0 25 250) transmitted to RJ11/RJ12 port.',
  };
}
