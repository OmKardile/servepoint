import { GuidanceItem, TourStep } from '../types';

export const GUIDANCE_ITEMS: Record<string, GuidanceItem> = {
  // Header Features
  surface_switcher: {
    id: 'surface_switcher',
    title: 'Multi-Surface Switcher',
    description: 'Switch between Web POS, Kitchen Display System (KDS), Table-Side QR Storefront, Windows Native Client, and Android Handheld surfaces.',
    actionHint: 'Click to preview how TSOS functions across physical cafe hardware.',
    shortcut: 'Alt + S',
    category: 'general',
  },
  cloud_sync_indicator: {
    id: 'cloud_sync_indicator',
    title: 'Cloud Database Synchronization & Offline Guard',
    description: 'Monitors real-time database health, latency (ping), and offline transaction queues. When internet disconnects, TSOS automatically buffers orders locally and replays them upon reconnection.',
    actionHint: 'Click badge to view latency, test force sync, or simulate offline mode.',
    category: 'sync',
  },
  guidance_toggle: {
    id: 'guidance_toggle',
    title: 'Guidance & Training Mode',
    description: 'Enables contextual assistance badges and hover tooltips across the application for training new cafe staff.',
    actionHint: 'Click to toggle hover guidance badges on or off.',
    shortcut: '?',
    category: 'general',
  },
  thermal_printer_shortcut: {
    id: 'thermal_printer_shortcut',
    title: 'Thermal Bill & KOT Printing',
    description: 'Configure and print ESC/POS thermal receipts (58mm/80mm), cut paper, and kick cash drawers via USB, Network/LAN, Bluetooth, or Browser print.',
    actionHint: 'Open printer settings to configure hardware or run a diagnostic test print.',
    shortcut: 'Ctrl + P',
    category: 'printer',
  },
  audio_toggle: {
    id: 'audio_toggle',
    title: 'Acoustic Feedback & Kitchen Bells',
    description: 'Plays distinct audio chimes for new incoming orders, KDS ticket ready alerts, and successful bill payments.',
    actionHint: 'Toggle on/off to mute cafe speaker notifications.',
    category: 'general',
  },

  // POS Features
  pos_category_nav: {
    id: 'pos_category_nav',
    title: 'Menu Category Filter',
    description: 'Filter cafe catalog by Beverage, Espresso, Food, Bakery, or Desserts with live item counts.',
    actionHint: 'Select category to quickly filter high-volume items during rush hours.',
    category: 'pos',
  },
  pos_item_card: {
    id: 'pos_item_card',
    title: 'Menu Item & Recipe Card',
    description: 'Clicking adds item to cart. Items with variants or milk/syrup add-ons open the customization dialog with automatic ingredient stock calculation.',
    actionHint: 'Click item to add directly, or customize milk, sugar, and shot preferences.',
    category: 'pos',
  },
  pos_order_type: {
    id: 'pos_order_type',
    title: 'Order Type Selection',
    description: 'Choose Dine-In (links to physical table layout), Takeaway (disposable packaging), or Delivery (delivery partner tracking).',
    actionHint: 'Select before checkout to automatically format thermal KOT header.',
    category: 'pos',
  },
  pos_table_picker: {
    id: 'pos_table_picker',
    title: 'Table Side Assignment',
    description: 'Visual floor map showing table occupancy, guest count, and active running bills.',
    actionHint: 'Assign a table to route kitchen tickets and manage dine-in guests.',
    category: 'pos',
  },
  pos_cart_customer: {
    id: 'pos_cart_customer',
    title: 'Customer Attachment & Loyalty Points',
    description: 'Search or add guests by mobile number. Displays current loyalty points, dynamic tier (Bronze, Silver, Gold, Platinum), and projected points earned on this bill.',
    actionHint: 'Attach customer to credit points or redeem existing balances.',
    category: 'loyalty',
  },
  pos_loyalty_redemption: {
    id: 'pos_loyalty_redemption',
    title: '1-Click Loyalty Points Redemption',
    description: 'Redeem customer points directly as a cash discount at 1 point = ₹1. Provides 1-click presets (₹25, ₹50, ₹100, Max) capped at subtotal.',
    actionHint: 'Click any preset chip to instantly deduct points from bill.',
    category: 'loyalty',
  },
  pos_fee_engine: {
    id: 'pos_fee_engine',
    title: 'TSOS Zero-Subscription Fee Engine',
    description: 'Shows whether the ₹1/order platform fee is absorbed by cafe or passed to customer, with auto-flip rules after target monthly volume.',
    actionHint: 'Hover to inspect current fee payer status.',
    category: 'pos',
  },
  pos_checkout_button: {
    id: 'pos_checkout_button',
    title: 'Payment & Checkout Modal',
    description: 'Accepts UPI QR code generation, Cash (with quick change calculator), or Card. Auto-prints thermal bill upon confirmation.',
    actionHint: 'Click to open payment modal and finalize bill.',
    shortcut: 'Space / Enter',
    category: 'pos',
  },

  // KDS Features
  kds_ticket_card: {
    id: 'kds_ticket_card',
    title: 'Kitchen Order Ticket (KOT)',
    description: 'Live ticket showing prep stage (New -> Preparing -> Ready -> Completed), timer countdown against target SLA, and ingredient modifications.',
    actionHint: 'Click advance status button to notify barista and trigger auto-inventory deduction.',
    category: 'kds',
  },

  // Customers & Loyalty
  customers_tier_filter: {
    id: 'customers_tier_filter',
    title: 'Loyalty Tier Classification',
    description: 'Filter customers across Bronze (<100 pts), Silver (100-249 pts), Gold (250-499 pts), and Platinum (500+ pts).',
    actionHint: 'Analyze customer retention and segment high-value regulars.',
    category: 'loyalty',
  },
  customers_ledger_button: {
    id: 'customers_ledger_button',
    title: 'Loyalty Audit Trail Ledger',
    description: 'Immutable ledger logging every earned point, redeemed point, order reference, and balance calculation.',
    actionHint: 'Open to inspect points history or resolve customer billing queries.',
    category: 'loyalty',
  },
  customers_adjust_button: {
    id: 'customers_adjust_button',
    title: 'Manager Points Adjustment',
    description: 'Allows supervisors to credit bonus points for birthdays, customer appreciation, or service recovery apologies.',
    actionHint: 'Click to add or deduct points with mandatory reason logging.',
    category: 'loyalty',
  },

  // Shifts
  shift_reconciliation: {
    id: 'shift_reconciliation',
    title: 'Cash Drawer Float & Shift Audit',
    description: 'Reconcile opening cash float against system recorded cash, UPI, and card sales with automated variance calculation.',
    actionHint: 'Perform drawer audit before closing cash register.',
    category: 'shift',
  },
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'tour-1',
    title: 'Welcome to TSOS (The Cafe Operating System)',
    description: 'TSOS is the all-in-one operating platform engineered for Indian specialty cafes, bakeries, and QSRs with zero monthly software fees, lightning-fast offline POS, and thermal printer integration.',
    targetTab: 'pos',
    category: 'Introduction',
  },
  {
    id: 'tour-2',
    title: 'Multi-Surface Architecture & Cloud Sync',
    description: 'Notice the top header: you can seamlessly toggle between Web POS, Kitchen Display System (KDS), Table-Side QR Storefront, and Native Windows/Android clients. The green status pill confirms bidirectional cloud database sync with latency monitoring and offline auto-caching.',
    targetTab: 'pos',
    category: 'Infrastructure',
  },
  {
    id: 'tour-3',
    title: 'High-Speed POS Catalog & Customizers',
    description: 'Browse items by category, search instantly, and click any item to add to the cart. Beverage items feature milk substitutions (Oat, Almond, Soy), sugar levels, and extra espresso shots that calculate recipe deductions automatically.',
    targetTab: 'pos',
    category: 'POS Billing',
  },
  {
    id: 'tour-4',
    title: 'Customer CRM & Loyalty Points System',
    description: 'Attach returning guests or register new customers with a +25 points welcome bonus. Points accrue automatically at 1 pt per ₹10 spent, with instant 1 pt = ₹1 redemption right inside the cart drawer with 1-click preset chips!',
    targetTab: 'pos',
    category: 'Loyalty Engine',
  },
  {
    id: 'tour-5',
    title: 'Thermal Bill Printing & Cash Drawer Control',
    description: 'Generate ESC/POS receipts formatted for 58mm or 80mm thermal rolls. TSOS supports browser printing, network thermal printers, Bluetooth mobile printers, automated paper cutting, and RJ11/RJ12 cash drawer kick pulses.',
    targetTab: 'settings',
    category: 'Hardware & Printing',
  },
  {
    id: 'tour-6',
    title: 'Live Kitchen Display System (KDS)',
    description: 'Kitchen tickets appear in real time with SLA preparation countdowns. Advancing ticket status updates the live order tracker for guests, deducts ingredients from inventory stock, and logs audit timestamps.',
    targetTab: 'kds',
    category: 'Kitchen Ops',
  },
  {
    id: 'tour-7',
    title: 'Staff Shifts & Cash Drawer Reconciliation',
    description: 'Manage staff clock-in/out hours, break deductions, and conduct blind cash audits with denomination counting to guarantee zero shrinkage.',
    targetTab: 'shifts',
    category: 'Cash & Staff',
  },
  {
    id: 'tour-8',
    title: 'Interactive Hover Guidance Active',
    description: 'Guidance Mode is enabled! Hover over any feature, badge, button, or tab throughout TSOS at any time to view contextual instructions, staff best practices, and keyboard shortcuts.',
    targetTab: 'pos',
    category: 'Guidance Ready',
  },
];
