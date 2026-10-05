import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

/**
 * Guest i18n (v5.7.0) — EN / हिंदी / ಕನ್ನಡ for the customer QR surfaces.
 *
 * Self-contained by design: no external i18n dependency, one flat dictionary
 * per language, `{var}` interpolation. Guest phones in India ship Devanagari
 * and Kannada system fonts, so no webfont download is needed — which keeps
 * the offline PWA story clean (nothing new to precache, nothing to fail).
 *
 * Scope: the guest side only (gate / menu / track). Staff surfaces stay EN.
 */

export type GuestLang = 'en' | 'hi' | 'kn';

const LANG_KEY = 'sp.guest.lang';

export const GUEST_LANGS: { code: GuestLang; native: string; aria: string }[] = [
  { code: 'en', native: 'English', aria: 'English' },
  { code: 'hi', native: 'हिंदी', aria: 'Hindi' },
  { code: 'kn', native: 'ಕನ್ನಡ', aria: 'Kannada' },
];

type Dict = Record<string, string>;

const EN: Dict = {
  // shell
  poweredBy: 'Powered by ServePoint — smartPOS',
  tryAgain: 'Try again',
  langAria: 'Language',
  serviceLine: 'ServePoint table service',
  // gate
  checking: 'Checking this table…',
  missingCode: 'This link is missing its table code. Scan the QR sticker on your table.',
  invalidCode: 'This table code is not valid. Scan the QR sticker on your table.',
  opening: 'Opening your session at {cafe}…',
  sessionFail: 'This table could not be opened right now. Ask our staff for help.',
  gateInvalidTitle: "This link didn't work",
  gateSessionTitle: "Table didn't open",
  // session ribbon
  orderingWindow: 'Ordering window — ',
  endingSoon: 'Session ending soon — ',
  rescanHint: '· rescan the table QR to renew',
  ariaEnds: 'Ordering session ends in {t}',
  windowEnded: 'Window ended — ',
  windowEndedHint: 'scan the table QR to continue',
  // 5.250.0 — the window's word reaches the cart: the drawer's button and its
  // amber note speak the same cause the ribbon does (a dead clock is a
  // different cause from a staff cut — different words, honest ones).
  windowEndedCta: 'Window ended',
  windowEndedNote: 'The ordering window has ended — your cart is kept. Rescan the table QR to order again.',
  windowWarmNote: 'The ordering window closes soon — place your order while it is open. Your cart is kept.',
  windowWarmFab: 'Ordering window closing soon',
  // menu header
  tablesideMenu: 'Tableside menu',
  tableLine: 'Table {n} · {s} seats — scan to order, pay at the counter',
  backToCheckin: 'Back to table check-in',
  searchPh: 'Search the menu…',
  searchAria: 'Search the menu',
  categoriesAria: 'Menu categories',
  offersAria: "Today's offers",
  offer: 'Offer',
  offerTap: 'Tap to apply',
  offerApplied: 'Applied',
  offerAddMore: 'Add {amt} more to unlock',
  offerSaves: 'Tap to apply — saves {amt}',
  offerRemove: 'Remove offer',
  settingTable: 'Setting the table…',
  menuUnavailable: 'Menu unavailable',
  menuFail: 'The menu could not be loaded.',
  docTitleMenu: '{cafe} — order from Table {n}',
  // menu body
  orderingPaused: 'Ordering paused',
  sessionClosed: 'Your ordering window closed. Scan the table QR again to continue.',
  reopen: 'Re-open my session',
  nothingMatches: 'Nothing matches “{q}”.',
  vegOnlyAria: 'Show vegetarian dishes only',
  vegOnly: 'Veg',
  nothingMatchesVeg: 'Nothing vegetarian matches “{q}”.',
  vegEmpty: 'No vegetarian dishes on this menu yet.',
  veg: 'Vegetarian',
  nonveg: 'Non-vegetarian',
  nOptions: '{n} option{s}',
  nAddons: '{n} add-on{s}',
  // customizer
  chooseOne: 'Choose one',
  addons: 'Add-ons',
  cookNotePh: 'Cook note (e.g. less spicy) — optional',
  cookNoteAria: 'Cook note',
  decQty: 'Decrease quantity',
  incQty: 'Increase quantity',
  addToOrder: 'Add to order · {amt}',
  // cart
  nItems: '{n} item{s}',
  viewOrder: 'View order · {amt}',
  yourOrder: 'Your order',
  yourOrderTable: 'Your order · Table {n}',
  closeCart: 'Close cart',
  close: 'Close',
  emptyCart: 'Your order is empty — pick something from the menu.',
  remove: 'Remove',
  justSoldOut: 'Just sold out',
  nameLabel: 'Your name (so we can find you) — optional',
  namePh: 'e.g. Aarav',
  subtotal: 'Subtotal',
  gst: 'GST 5%',
  total: 'Total',
  payNote: 'Pay at the counter after your meal — no online payment.',
  sending: 'Sending to the counter…',
  placeOrder: 'Place order · {amt}',
  orderFail: 'The order did not go through. Please try again.',
  // track
  tableN: 'Table {n}',
  otDineIn: 'Dine-in',
  otTakeaway: 'Takeaway',
  otDelivery: 'Delivery',
  yourTicket: 'Your ticket',
  mute: 'Mute ready chime',
  unmute: 'Unmute ready chime',
  finding: 'Finding your ticket…',
  netTitle: 'Connection trouble',
  netBody: "We couldn't reach the cafe. Retrying automatically…",
  badLinkTitle: 'Order link not valid',
  badLinkBody: "This tracking link is broken or the order doesn't exist. Keep the link from your order screen.",
  cancelledTitle: 'This order was cancelled',
  cancelledBody: 'Nothing was charged. Speak to our staff if this looks wrong — they can re-take your order.',
  flowPlaced: 'Placed',
  flowPlacedHint: 'The counter has your ticket',
  flowKitchen: 'In the kitchen',
  flowKitchenHint: 'Your food is being made',
  flowReady: 'Ready',
  flowReadyHint: 'Heading to your table',
  flowServed: 'Served',
  flowServedHint: 'Enjoy — pay at the counter',
  done: 'Done',
  waiting: 'Waiting',
  stNew: 'Placed',
  stPreparing: 'Preparing',
  stReady: 'Ready',
  stCompleted: 'Served',
  stCancelled: 'Cancelled',
  docTitleTrack: '#{n} · {s} — ServePoint',
  readyBanner: "Your order is ready — it's coming to your table!",
  bill: 'Bill',
  paid: 'PAID',
  due: 'DUE AT COUNTER',
  showCounter: 'Show order #{n} at the counter and pay there.',
  // 5.248.0 — the ticket's clock: the stamp + the live age (lib/guest.ts)
  placedAt: 'Placed {t}',
  ageNow: 'just now',
  ageMin: '{n} min ago',
  ageH: '{h} h ago',
  ageHm: '{h} h {m} min ago',
  ageD: '{d} d ago',
  netStale: 'Connection lost — this is the last word',
  autoUpdate: 'This page updates itself every 10 seconds.',
  copyLink: 'Copy tracking link',
  copied: 'Copied!',
  goHome: 'ServePoint home',
  // v5.252.0 — the ticket's way back: the forward action and the paid word
  orderMore: 'Order more',
  flowServedPaidHint: 'Enjoy — the bill is settled',
  // v5.253.0 — the loop closes: the menu remembers the guest's own ticket
  lastTicketTitle: 'Your ticket #{n}',
  lastTicketSub: 'Placed from this table — tap to follow it',
  lastTicketAria: 'Follow your ticket #{n}',
  // feedback (019)
  fbTitle: 'How was everything?',
  fbSub: 'Tap the stars — it helps the cafe a lot.',
  fbStarsAria: 'Rate from 1 to 5 stars',
  fbStarN: 'Rate {n} star{plural}',
  fbCommentLabel: 'Anything to add? (optional)',
  fbCommentPlaceholder: 'The filter coffee was the best part…',
  fbSubmit: 'Send rating',
  fbSending: 'Sending…',
  fbThanksTitle: 'Thank you!',
  fbThanksSub: 'Your rating reached the counter — they read every one.',
  fbRatedAria: 'You rated this order {n} out of 5 stars',
  fbErr: 'Could not send your rating. Try again.',
  fbAlready: 'You already rated this order — thank you!',
};

const HI: Dict = {
  poweredBy: 'ServePoint — smartPOS द्वारा संचालित',
  tryAgain: 'फिर कोशिश करें',
  langAria: 'भाषा',
  serviceLine: 'ServePoint टेबल सेवा',
  checking: 'यह टेबल जाँची जा रही है…',
  missingCode: 'इस लिंक में टेबल कोड नहीं है। अपनी टेबल पर लगा QR स्कैन करें।',
  invalidCode: 'यह टेबल कोड मान्य नहीं है। अपनी टेबल पर लगा QR स्कैन करें।',
  opening: '{cafe} पर आपका सेशन खोला जा रहा है…',
  sessionFail: 'टेबल अभी नहीं खुल सकी। कृपया अपने स्टाफ़ से मदद लें।',
  gateInvalidTitle: 'यह लिंक काम नहीं कर पाया',
  gateSessionTitle: 'टेबल नहीं खुली',
  orderingWindow: 'ऑर्डरिंग समय — ',
  endingSoon: 'सेशन जल्द समाप्त — ',
  rescanHint: '· नवीनीकरण के लिए टेबल QR फिर स्कैन करें',
  ariaEnds: 'ऑर्डरिंग सेशन {t} में समाप्त',
  windowEnded: 'अवधि समाप्त — ',
  windowEndedHint: 'जारी रखने के लिए टेबल QR स्कैन करें',
  windowEndedCta: 'अवधि समाप्त',
  windowEndedNote: 'ऑर्डरिंग की अवधि समाप्त हो गई है — आपकी ट्रे सुरक्षित है। दोबारा ऑर्डर करने के लिए टेबल QR स्कैन करें।',
  windowWarmNote: 'ऑर्डरिंग की अवधि जल्द समाप्त होगी — अवधि खुले रहते ऑर्डर कर दें। आपकी ट्रे सुरक्षित है।',
  windowWarmFab: 'ऑर्डरिंग अवधि जल्द समाप्त',
  tablesideMenu: 'टेबल मेन्यू',
  tableLine: 'टेबल {n} · {s} सीटें — स्कैन करके ऑर्डर करें, काउंटर पर भुगतान करें',
  backToCheckin: 'टेबल चेक-इन पर वापस',
  searchPh: 'मेन्यू खोजें…',
  searchAria: 'मेन्यू खोजें',
  categoriesAria: 'मेन्यू श्रेणियाँ',
  offersAria: 'आज के ऑफ़र',
  offer: 'ऑफ़र',
  offerTap: 'लागू करने के लिए टैप करें',
  offerApplied: 'लागू है',
  offerAddMore: 'अनलॉक करने के लिए {amt} और जोड़ें',
  offerSaves: 'लागू करने के लिए टैप करें — {amt} की बचत',
  offerRemove: 'ऑफ़र हटाएँ',
  settingTable: 'टेबल तैयार हो रही है…',
  menuUnavailable: 'मेन्यू उपलब्ध नहीं',
  menuFail: 'मेन्यू लोड नहीं हो सका।',
  docTitleMenu: '{cafe} — टेबल {n} से ऑर्डर करें',
  orderingPaused: 'ऑर्डरिंग रुकी है',
  sessionClosed: 'आपकी ऑर्डरिंग अवधि समाप्त हो गई। जारी रखने के लिए टेबल QR दोबारा स्कैन करें।',
  reopen: 'मेरा सेशन फिर खोलें',
  nothingMatches: '“{q}” से कुछ मेल नहीं खाया।',
  vegOnlyAria: 'केवल शाकाहारी व्यंजन दिखाएँ',
  vegOnly: 'शाक',
  nothingMatchesVeg: '“{q}” से मेल खाता कोई शाकाहारी व्यंजन नहीं।',
  vegEmpty: 'इस मेन्यू में अभी कोई शाकाहारी व्यंजन नहीं है।',
  veg: 'शाकाहारी',
  nonveg: 'मांसाहारी',
  nOptions: '{n} विकल्प',
  nAddons: '{n} ऐड-ऑन',
  chooseOne: 'एक चुनें',
  addons: 'ऐड-ऑन',
  cookNotePh: 'रसोइये के लिए नोट (जैसे कम तीखा) — वैकल्पिक',
  cookNoteAria: 'रसोइये के लिए नोट',
  decQty: 'मात्रा घटाएँ',
  incQty: 'मात्रा बढ़ाएँ',
  addToOrder: 'ऑर्डर में जोड़ें · {amt}',
  nItems: '{n} आइटम',
  viewOrder: 'ऑर्डर देखें · {amt}',
  yourOrder: 'आपका ऑर्डर',
  yourOrderTable: 'आपका ऑर्डर · टेबल {n}',
  closeCart: 'कार्ट बंद करें',
  close: 'बंद करें',
  emptyCart: 'आपका ऑर्डर खाली है — मेन्यू से कुछ चुनें।',
  remove: 'हटाएँ',
  justSoldOut: 'अभी समाप्त हो गया',
  nameLabel: 'आपका नाम (ताकि हम आपको ढूँढ सकें) — वैकल्पिक',
  namePh: 'जैसे आरव',
  subtotal: 'उप-योग',
  gst: 'GST 5%',
  total: 'कुल',
  payNote: 'भोजन के बाद काउंटर पर भुगतान करें — कोई ऑनलाइन भुगतान नहीं।',
  sending: 'काउंटर को भेजा जा रहा है…',
  placeOrder: 'ऑर्डर करें · {amt}',
  orderFail: 'ऑर्डर नहीं हो सका। कृपया फिर कोशिश करें।',
  tableN: 'टेबल {n}',
  otDineIn: 'डाइन-इन',
  otTakeaway: 'पार्सल',
  otDelivery: 'डिलीवरी',
  yourTicket: 'आपका टिकट',
  mute: 'तैयार घंटी बंद करें',
  unmute: 'तैयार घंटी चालू करें',
  finding: 'आपका टिकट खोजा जा रहा है…',
  netTitle: 'कनेक्शन समस्या',
  netBody: 'हम कैफ़े तक नहीं पहुँच पा रहे हैं। अपने आप फिर कोशिश कर रहे हैं…',
  badLinkTitle: 'ऑर्डर लिंक मान्य नहीं',
  badLinkBody: 'यह ट्रैकिंग लिंक टूटा हुआ है या ऑर्डर मौजूद नहीं है। अपनी ऑर्डर स्क्रीन का लिंक सँभालकर रखें।',
  cancelledTitle: 'यह ऑर्डर रद्द कर दिया गया',
  cancelledBody: 'कोई भुगतान नहीं लिया गया। यदि यह गलत लगे तो स्टाफ़ से बात करें — वे आपका ऑर्डर दोबारा ले सकते हैं।',
  flowPlaced: 'ऑर्डर लग गया',
  flowPlacedHint: 'काउंटर के पास आपका टिकट है',
  flowKitchen: 'रसोई में',
  flowKitchenHint: 'आपका खाना बन रहा है',
  flowReady: 'तैयार',
  flowReadyHint: 'आपकी टेबल की ओर आ रहा है',
  flowServed: 'परोसा गया',
  flowServedHint: 'स्वाद लें — काउंटर पर भुगतान करें',
  done: 'हो गया',
  waiting: 'प्रतीक्षा',
  stNew: 'ऑर्डर लग गया',
  stPreparing: 'बन रहा है',
  stReady: 'तैयार',
  stCompleted: 'परोसा गया',
  stCancelled: 'रद्द',
  docTitleTrack: '#{n} · {s} — ServePoint',
  readyBanner: 'आपका ऑर्डर तैयार है — आपकी टेबल पर आ रहा है!',
  bill: 'बिल',
  paid: 'भुगतान हुआ',
  due: 'काउंटर पर देय',
  showCounter: 'काउंटर पर ऑर्डर #{n} दिखाएँ और वहीं भुगतान करें।',
  placedAt: '{t} पर ऑर्डर लगा',
  ageNow: 'अभी अभी',
  ageMin: '{n} मिनट पहले',
  ageH: '{h} घंटे पहले',
  ageHm: '{h} घं {m} मिनट पहले',
  ageD: '{d} दिन पहले',
  netStale: 'कनेक्शन टूट गया — यह आख़िरी जानकारी है',
  autoUpdate: 'यह पेज हर 10 सेकंड में अपने आप अपडेट होता है।',
  copyLink: 'ट्रैकिंग लिंक कॉपी करें',
  copied: 'कॉपी हो गया!',
  goHome: 'ServePoint होम',
  // v5.252.0 — the ticket's way back: the forward action and the paid word
  orderMore: 'और ऑर्डर करें',
  flowServedPaidHint: 'स्वाद लें — बिल चुक गया',
  // v5.253.0 — the loop closes: the menu remembers the guest's own ticket
  lastTicketTitle: 'आपका टिकट #{n}',
  lastTicketSub: 'इसी टेबल से लगा — देखने के लिए टैप करें',
  lastTicketAria: 'अपना टिकट #{n} देखें',
  // feedback (019)
  fbTitle: 'सब कैसा लगा?',
  fbSub: 'सितारे दबाएँ — इससे कैफ़े को बहुत मदद मिलती है।',
  fbStarsAria: '1 से 5 सितारों तक रेट करें',
  fbStarN: '{n} सितारा{plural} दें',
  fbCommentLabel: 'कुछ और बताना चाहेंगे? (वैकल्पिक)',
  fbCommentPlaceholder: 'फ़िल्टर कॉफ़ी सबसे अच्छी थी…',
  fbSubmit: 'रेटिंग भेजें',
  fbSending: 'भेज रहे हैं…',
  fbThanksTitle: 'धन्यवाद!',
  fbThanksSub: 'आपकी रेटिंग काउंटर तक पहुँच गई — वे हर एक पढ़ते हैं।',
  fbRatedAria: 'आपने इस ऑर्डर को 5 में से {n} सितारों पर रेट किया',
  fbErr: 'आपकी रेटिंग नहीं भेजी जा सकी। फिर कोशिश करें।',
  fbAlready: 'आप इस ऑर्डर को रेट कर चुके हैं — धन्यवाद!',
};

const KN: Dict = {
  poweredBy: 'ServePoint — smartPOS ನಿಂದ ನಡೆಸಲ್ಪಡುತ್ತಿದೆ',
  tryAgain: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ',
  langAria: 'ಭಾಷೆ',
  serviceLine: 'ServePoint ಟೇಬಲ್ ಸೇವೆ',
  checking: 'ಈ ಟೇಬಲ್ ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…',
  missingCode: 'ಈ ಲಿಂಕ್‌ನಲ್ಲಿ ಟೇಬಲ್ ಕೋಡ್ ಇಲ್ಲ. ನಿಮ್ಮ ಟೇಬಲ್‌ನಲ್ಲಿರುವ QR ಸ್ಕ್ಯಾನ್ ಮಾಡಿ.',
  invalidCode: 'ಈ ಟೇಬಲ್ ಕೋಡ್ ಮಾನ್ಯವಾಗಿಲ್ಲ. ನಿಮ್ಮ ಟೇಬಲ್‌ನಲ್ಲಿರುವ QR ಸ್ಕ್ಯಾನ್ ಮಾಡಿ.',
  opening: '{cafe} ನಲ್ಲಿ ನಿಮ್ಮ ಸೆಷನ್ ತೆರೆಯಲಾಗುತ್ತಿದೆ…',
  sessionFail: 'ಟೇಬಲ್ ಈಗ ತೆರೆಯಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಸಿಬ್ಬಂದಿಯ ಸಹಾಯ ಪಡೆಯಿರಿ.',
  gateInvalidTitle: 'ಈ ಲಿಂಕ್ ಕೆಲಸ ಮಾಡಲಿಲ್ಲ',
  gateSessionTitle: 'ಟೇಬಲ್ ತೆರೆಯಲಾಗಲಿಲ್ಲ',
  orderingWindow: 'ಆರ್ಡರ್ ಸಮಯ — ',
  endingSoon: 'ಸೆಷನ್ ಶೀಘ್ರ ಮುಕ್ತಾಯ — ',
  rescanHint: '· ನವೀಕರಿಸಲು ಟೇಬಲ್ QR ಮತ್ತೆ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ',
  ariaEnds: 'ಆರ್ಡರ್ ಸೆಷನ್ {t} ನಲ್ಲಿ ಮುಕ್ತಾಯ',
  windowEnded: 'ಅವಧಿ ಮುಕ್ತಾಯ — ',
  windowEndedHint: 'ಮುಂದುವರಿಯಲು ಟೇಬಲ್ QR ಸ್ಕ್ಯಾನ್ ಮಾಡಿ',
  windowEndedCta: 'ಅವಧಿ ಮುಕ್ತಾಯ',
  windowEndedNote: 'ಆರ್ಡರಿಂಗ್ ಅವಧಿ ಮುಕ್ತಾಯವಾಗಿದೆ — ನಿಮ್ಮ ಬುಟ್ಟಿ ಉಳಿದಿದೆ. ಮತ್ತೆ ಆರ್ಡರ್ ಮಾಡಲು ಟೇಬಲ್ QR ಸ್ಕ್ಯಾನ್ ಮಾಡಿ.',
  windowWarmNote: 'ಆರ್ಡರಿಂಗ್ ಅವಧಿ ಶೀಘ್ರ ಮುಕ್ತಾಯಗೊಳ್ಳುತ್ತದೆ — ಅವಧಿ ತೆರೆದಿರುವಾಗಲೇ ಆರ್ಡರ್ ಮಾಡಿ. ನಿಮ್ಮ ಬುಟ್ಟಿ ಉಳಿದಿದೆ.',
  windowWarmFab: 'ಆರ್ಡರಿಂಗ್ ಅವಧಿ ಶೀಘ್ರ ಮುಕ್ತಾಯ',
  tablesideMenu: 'ಟೇಬಲ್ ಮೆನು',
  tableLine: 'ಟೇಬಲ್ {n} · {s} ಆಸನಗಳು — ಸ್ಕ್ಯಾನ್ ಮಾಡಿ ಆರ್ಡರ್ ಮಾಡಿ, ಕೌಂಟರ್‌ನಲ್ಲಿ ಪಾವತಿಸಿ',
  backToCheckin: 'ಟೇಬಲ್ ಚೆಕ್-ಇನ್‌ಗೆ ಹಿಂತಿರುಗಿ',
  searchPh: 'ಮೆನು ಹುಡುಕಿ…',
  searchAria: 'ಮೆನು ಹುಡುಕಿ',
  categoriesAria: 'ಮೆನು ವಿಭಾಗಗಳು',
  offersAria: 'ಇಂದಿನ ಆಫರ್‌ಗಳು',
  offer: 'ಆಫರ್',
  offerTap: 'ಅನ್ವಯಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ',
  offerApplied: 'ಅನ್ವಯಿಸಲಾಗಿದೆ',
  offerAddMore: 'ಅನ್‌ಲಾಕ್ ಮಾಡಲು {amt} ಸೇರಿಸಿ',
  offerSaves: 'ಅನ್ವಯಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ — {amt} ಉಳಿತಾಯ',
  offerRemove: 'ಆಫರ್ ತೆಗೆದುಹಾರಿಸಿ',
  settingTable: 'ಟೇಬಲ್ ಸಿದ್ಧಪಡಿಸಲಾಗುತ್ತಿದೆ…',
  menuUnavailable: 'ಮೆನು ಲಭ್ಯವಿಲ್ಲ',
  menuFail: 'ಮೆನು ಲೋಡ್ ಆಗಲಿಲ್ಲ.',
  docTitleMenu: '{cafe} — ಟೇಬಲ್ {n} ನಿಂದ ಆರ್ಡರ್ ಮಾಡಿ',
  orderingPaused: 'ಆರ್ಡರಿಂಗ್ ವಿರಾಮ',
  sessionClosed: 'ನಿಮ್ಮ ಆರ್ಡರ್ ಅವಧಿ ಮುಕ್ತಾಯಗೊಂಡಿದೆ. ಮುಂದುವರಿಸಲು ಟೇಬಲ್ QR ಮತ್ತೆ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ.',
  reopen: 'ನನ್ನ ಸೆಷನ್ ಮತ್ತೆ ತೆರೆಯಿರಿ',
  nothingMatches: '“{q}” ಗೆ ಯಾವುದೂ ಸರಿಹೊಂದಲಿಲ್ಲ.',
  vegOnlyAria: 'ಸಸ್ಯಾಹಾರಿ ಖಾದ್ಯಗಳನ್ನು ಮಾತ್ರ ತೋರಿಸು',
  vegOnly: 'ಸಸ್ಯಾಹಾರಿ',
  nothingMatchesVeg: '“{q}” ಗೆ ಹೊಂದಿಕೆಯಾಗುವ ಯಾವುದೇ ಸಸ್ಯಾಹಾರಿ ಖಾದ್ಯಗಳಿಲ್ಲ.',
  vegEmpty: 'ಈ ಮೆನುವಿನಲ್ಲಿ ಇನ್ನೂ ಯಾವುದೇ ಸಸ್ಯಾಹಾರಿ ಖಾದ್ಯಗಳಿಲ್ಲ.',
  veg: 'ಶಾಕಾಹಾರಿ',
  nonveg: 'ಮಾಂಸಾಹಾರಿ',
  nOptions: '{n} ಆಯ್ಕೆಗಳು',
  nAddons: '{n} ಆಡ್-ಆನ್‌ಗಳು',
  chooseOne: 'ಒಂದನ್ನು ಆರಿಸಿ',
  addons: 'ಆಡ್-ಆನ್‌ಗಳು',
  cookNotePh: 'ಅಡುಗೆಯವರಿಗೆ ಟಿಪ್ಪಣಿ (ಉದಾ. ಕಡಿಮೆ ಖಾರ) — ಐಚ್ಛಿಕ',
  cookNoteAria: 'ಅಡುಗೆಯವರಿಗೆ ಟಿಪ್ಪಣಿ',
  decQty: 'ಪ್ರಮಾಣ ಕಡಿಮೆ ಮಾಡಿ',
  incQty: 'ಪ್ರಮಾಣ ಹೆಚ್ಚಿಸಿ',
  addToOrder: 'ಆರ್ಡರ್‌ಗೆ ಸೇರಿಸಿ · {amt}',
  nItems: '{n} ಐಟಂಗಳು',
  viewOrder: 'ಆರ್ಡರ್ ನೋಡಿ · {amt}',
  yourOrder: 'ನಿಮ್ಮ ಆರ್ಡರ್',
  yourOrderTable: 'ನಿಮ್ಮ ಆರ್ಡರ್ · ಟೇಬಲ್ {n}',
  closeCart: 'ಕಾರ್ಟ್ ಮುಚ್ಚಿ',
  close: 'ಮುಚ್ಚಿ',
  emptyCart: 'ನಿಮ್ಮ ಆರ್ಡರ್ ಖಾಲಿಯಾಗಿದೆ — ಮೆನುವಿನಿಂದ ಏನನ್ನಾದರೂ ಆರಿಸಿ.',
  remove: 'ತೆಗೆದುಹಾಕಿ',
  justSoldOut: 'ಈಗ ಇಲ್ಲ',
  nameLabel: 'ನಿಮ್ಮ ಹೆಸರು (ನಿಮ್ಮನ್ನು ಹುಡುಕಲು) — ಐಚ್ಛಿಕ',
  namePh: 'ಉದಾ. ಆರವ್',
  subtotal: 'ಉಪಮೊತ್ತ',
  gst: 'GST 5%',
  total: 'ಒಟ್ಟು',
  payNote: 'ಊಟದ ನಂತರ ಕೌಂಟರ್‌ನಲ್ಲಿ ಪಾವತಿಸಿ — ಆನ್‌ಲೈನ್ ಪಾವತಿ ಇಲ್ಲ.',
  sending: 'ಕೌಂಟರ್‌ಗೆ ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ…',
  placeOrder: 'ಆರ್ಡರ್ ಮಾಡಿ · {amt}',
  orderFail: 'ಆರ್ಡರ್ ಆಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
  tableN: 'ಟೇಬಲ್ {n}',
  otDineIn: 'ಡೈನ್-ಇನ್',
  otTakeaway: 'ಪಾರ್ಸಲ್',
  otDelivery: 'ಡೆಲಿವರಿ',
  yourTicket: 'ನಿಮ್ಮ ಟಿಕೆಟ್',
  mute: 'ಸಿದ್ಧ ಗಂಟೆ ಮ್ಯೂಟ್ ಮಾಡಿ',
  unmute: 'ಸಿದ್ಧ ಗಂಟೆ ಪ್ಲೇ ಮಾಡಿ',
  finding: 'ನಿಮ್ಮ ಟಿಕೆಟ್ ಹುಡುಕಲಾಗುತ್ತಿದೆ…',
  netTitle: 'ಸಂಪರ್ಕದ ತೊಂದರೆ',
  netBody: 'ಕೆಫೆಗೆ ಸಂಪರ್ಕ ಸಾಧಿಸಲಾಗಲಿಲ್ಲ. ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಲಾಗುತ್ತಿದೆ…',
  badLinkTitle: 'ಆರ್ಡರ್ ಲಿಂಕ್ ಮಾನ್ಯವಾಗಿಲ್ಲ',
  badLinkBody: 'ಈ ಟ್ರ್ಯಾಕಿಂಗ್ ಲಿಂಕ್ ಕೆಟ್ಟಿದೆ ಅಥವಾ ಆರ್ಡರ್ ಅಸ್ತಿತ್ವದಲ್ಲಿಲ್ಲ. ಆರ್ಡರ್ ಸ್ಕ್ರೀನ್‌ನ ಲಿಂಕ್ ಉಳಿಸಿಕೊಳ್ಳಿ.',
  cancelledTitle: 'ಈ ಆರ್ಡರ್ ರದ್ದುಪಡಿಸಲಾಗಿದೆ',
  cancelledBody: 'ಯಾವುದೇ ಪಾವತಿ ವಸೂಲಿ ಮಾಡಲಾಗಿಲ್ಲ. ಇದು ತಪ್ಪು ಎಂದು ಕಂಡರೆ ಸಿಬ್ಬಂದಿಯೊಂದಿಗೆ ಮಾತನಾಡಿ — ಅವರು ಆರ್ಡರ್ ಮತ್ತೆ ತೆಗೆದುಕೊಳ್ಳಬಹುದು.',
  flowPlaced: 'ಆರ್ಡರ್ ಆಗಿದೆ',
  flowPlacedHint: 'ಕೌಂಟರ್ ಬಳಿ ನಿಮ್ಮ ಟಿಕೆಟ್ ಇದೆ',
  flowKitchen: 'ಅಡುಗೆಮನೆಯಲ್ಲಿ',
  flowKitchenHint: 'ನಿಮ್ಮ ಊಟ ತಯಾರಾಗುತ್ತಿದೆ',
  flowReady: 'ಸಿದ್ಧ',
  flowReadyHint: 'ನಿಮ್ಮ ಟೇಬಲ್‌ಗೆ ಬರುತ್ತಿದೆ',
  flowServed: 'ಬಡಿಸಲಾಗಿದೆ',
  flowServedHint: 'ಆನಂದಿಸಿ — ಕೌಂಟರ್‌ನಲ್ಲಿ ಪಾವತಿಸಿ',
  done: 'ಮುಗಿದಿದೆ',
  waiting: 'ನಿರೀಕ್ಷೆ',
  stNew: 'ಆರ್ಡರ್ ಆಗಿದೆ',
  stPreparing: 'ತಯಾರಾಗುತ್ತಿದೆ',
  stReady: 'ಸಿದ್ಧ',
  stCompleted: 'ಬಡಿಸಲಾಗಿದೆ',
  stCancelled: 'ರದ್ದು',
  docTitleTrack: '#{n} · {s} — ServePoint',
  readyBanner: 'ನಿಮ್ಮ ಆರ್ಡರ್ ಸಿದ್ಧ — ನಿಮ್ಮ ಟೇಬಲ್‌ಗೆ ಬರುತ್ತಿದೆ!',
  bill: 'ಬಿಲ್',
  paid: 'ಪಾವತಿಸಲಾಗಿದೆ',
  due: 'ಕೌಂಟರ್‌ನಲ್ಲಿ ಪಾವತಿಸಬೇಕು',
  showCounter: 'ಕೌಂಟರ್‌ನಲ್ಲಿ ಆರ್ಡರ್ #{n} ತೋರಿಸಿ ಅಲ್ಲೇ ಪಾವತಿಸಿ.',
  placedAt: '{t} ಕ್ಕೆ ಆರ್ಡರ್ ಆಗಿದೆ',
  ageNow: 'ಈಗಷ್ಟೇ',
  ageMin: '{n} ನಿಮಿಷ ಹಿಂದೆ',
  ageH: '{h} ಗಂಟೆ ಹಿಂದೆ',
  ageHm: '{h} ಗಂ {m} ನಿಮಿಷ ಹಿಂದೆ',
  ageD: '{d} ದಿನ ಹಿಂದೆ',
  netStale: 'ಸಂಪರ್ಕ ಕಡಿತವಾಗಿದೆ — ಇದು ಕೊನೆಯ ಮಾಹಿತಿ',
  autoUpdate: 'ಈ ಪುಟ ಪ್ರತಿ 10 ಸೆಕೆಂಡುಗಳಲ್ಲಿ ಸ್ವಯಂ ಅಪ್ಡೇಟ್ ಆಗುತ್ತದೆ.',
  copyLink: 'ಟ್ರ್ಯಾಕಿಂಗ್ ಲಿಂಕ್ ನಕಲಿಸಿ',
  copied: 'ನಕಲಾಗಿದೆ!',
  goHome: 'ServePoint ಮುಖಪುಟ',
  // v5.252.0 — the ticket's way back: the forward action and the paid word
  orderMore: 'ಮತ್ತಷ್ಟು ಆರ್ಡರ್ ಮಾಡಿ',
  flowServedPaidHint: 'ಆನಂದಿಸಿ — ಬಿಲ್ ಪಾವತಿಸಲಾಗಿದೆ',
  // v5.253.0 — the loop closes: the menu remembers the guest's own ticket
  lastTicketTitle: 'ನಿಮ್ಮ ಟಿಕೆಟ್ #{n}',
  lastTicketSub: 'ಇದೇ ಟೇಬಲ್‌ನಿಂದ ಆರ್ಡರ್ — ನೋಡಲು ಟ್ಯಾಪ್ ಮಾಡಿ',
  lastTicketAria: 'ನಿಮ್ಮ ಟಿಕೆಟ್ #{n} ನೋಡಿ',
  // feedback (019)
  fbTitle: 'ಎಲ್ಲವೂ ಹೇಗಿತ್ತು?',
  fbSub: 'ನಕ್ಷತ್ರಗಳನ್ನು ಒತ್ತಿ — ಇದು ಕೆಫೆಗೆ ಬಹಳ ಸಹಾಯ ಮಾಡುತ್ತದೆ.',
  fbStarsAria: '1 ರಿಂದ 5 ನಕ್ಷತ್ರಗಳವರೆಗೆ ರೇಟ್ ಮಾಡಿ',
  fbStarN: '{n} ನಕ್ಷತ್ರ{plural} ನೀಡಿ',
  fbCommentLabel: 'ಬೇರೆ ಏನಾದರೂ ಹೇಳಬೇಕೇ? (ಐಚ್ಛಿಕ)',
  fbCommentPlaceholder: 'ಫಿಲ್ಟರ್ ಕಾಫಿ ಅತ್ಯುತ್ತಮವಾಗಿತ್ತು…',
  fbSubmit: 'ರೇಟಿಂಗ್ ಕಳುಹಿಸಿ',
  fbSending: 'ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ…',
  fbThanksTitle: 'ಧನ್ಯವಾದಗಳು!',
  fbThanksSub: 'ನಿಮ್ಮ ರೇಟಿಂಗ್ ಕೌಂಟರ್ ತಲುಪಿದೆ — ಅವರು ಪ್ರತಿಯೊಂದನ್ನೂ ಓದುತ್ತಾರೆ.',
  fbRatedAria: 'ನೀವು ಈ ಆರ್ಡರ್ ಅನ್ನು 5 ರಲ್ಲಿ {n} ನಕ್ಷತ್ರಗಳಿಗೆ ರೇಟ್ ಮಾಡಿದ್ದೀರಿ',
  fbErr: 'ನಿಮ್ಮ ರೇಟಿಂಗ್ ಕಳುಹಿಸಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
  fbAlready: 'ನೀವು ಈ ಆರ್ಡರ್ ಅನ್ನು ರೇಟ್ ಮಾಡಿರುವಿರಿ — ಧನ್ಯವಾದಗಳು!',
};

const DICTS: Record<GuestLang, Dict> = { en: EN, hi: HI, kn: KN };

export function readGuestLang(): GuestLang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (v === 'hi' || v === 'kn' || v === 'en') return v;
  } catch {
    /* private mode — default below */
  }
  return 'en';
}

export interface GuestT {
  lang: GuestLang;
  setLang: (l: GuestLang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

/**
 * Module-level language store — EVERY component using `useGuestLang` must see
 * the same language the instant one of them switches it (a plain per-component
 * useState would leave the rest of the page in the old language).
 */
let currentLang: GuestLang = readGuestLang();
const listeners = new Set<() => void>();

function subscribeLang(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getLangSnapshot(): GuestLang {
  return currentLang;
}

export function setLangGlobal(l: GuestLang): void {
  if (l === currentLang) return;
  currentLang = l;
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {
    /* private mode — session-only choice */
  }
  listeners.forEach((cb) => cb());
}

/** Hook for the guest surfaces — shared store, EN fallback, `{var}` interpolation. */
export function useGuestLang(): GuestT {
  const lang = useSyncExternalStore(subscribeLang, getLangSnapshot, getLangSnapshot);

  // exposes the active language to the document (screen readers, hyphenation)
  useEffect(() => {
    document.documentElement.lang = lang === 'en' ? 'en-IN' : lang;
  }, [lang]);

  const setLang = useCallback((l: GuestLang) => setLangGlobal(l), []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = DICTS[lang][key] ?? EN[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
      }
      return s;
    },
    [lang],
  );

  return useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
}
