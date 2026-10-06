import { Check, Download, FileSpreadsheet } from 'lucide-react';

/* v5.275.0 — the export verb's ONE shape. 5.274.0 taught the first two
 * verbs to speak (the bills list, the guests book); this is the grammar
 * those two spoke, extracted so every CSV verb in the house says the same
 * thing the same way. The resting verb wears its surface's own register —
 * the white header frame (tone="header") or the section chip's amber
 * (tone="chip") — and after the tap it wears the paid chip's green
 * register (#2E7D32 on the #E8F5EC ghost) with the Check ear and the word
 * "Saved" for a breath (useExportFlash owns the breath), then returns. The
 * aria flips with the word so a screen reader hears it too.
 *
 * THE GEOMETRY RIDES THE CALL SITE — heights, radius, type size: each
 * surface keeps its own proportions (the defaults are the two shapes the
 * census actually found). THE REGISTER IS THE HOUSE'S and lives here,
 * once — one green for every "Saved" in the building; no call site carries
 * its own copy of the colors, so a future retint is one edit, not
 * eighteen. The resting chips gain the focus ring and the disabled
 * grammar the header buttons already had — keyboard users hear these
 * verbs too. */

type CsvExportButtonProps = {
  /** true for the breath after the tap — the hook's own word. */
  saved: boolean;
  /** the verb itself — hand the export through the hook's speak(). */
  onExport: () => void;
  idleAria: string;
  savedAria: string;
  title: string;
  disabled?: boolean;
  /** 'header' — the white toolbar frame; 'chip' — the section's amber chip. */
  tone?: 'header' | 'chip';
  /** geometry only — NO color tokens (the register is the house's). */
  geometry?: string;
  earSize?: number;
  idleWord?: string;
  /** 'sheet' — the catalog's own spreadsheet ear. */
  idleEar?: 'download' | 'sheet';
};

const IDLE_REGISTER: Record<'header' | 'chip', string> = {
  header:
    'border-[#E3E7E0] bg-white text-[#0F3D3E] hover:border-[#B88E2F] hover:text-[#B88E2F] focus-visible:outline-[#B88E2F]',
  chip:
    'border-[#B88E2F]/45 bg-[#FDF9F0] text-[#8A5A00] hover:bg-[#B88E2F] hover:text-white active:scale-[0.97] focus-visible:outline-[#B88E2F]',
};

const DEFAULT_GEOMETRY: Record<'header' | 'chip', string> = {
  header: 'flex h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[12.5px] font-bold',
  chip: 'inline-flex h-7 items-center rounded-lg border px-2.5 text-[11px] font-bold',
};

const DEFAULT_EAR: Record<'header' | 'chip', number> = { header: 14, chip: 11 };

/* the saved register — the paid chip's own green, the ONE voice every
 * "Saved" in the house wears (#2E7D32 on its #E8F5EC ghost). */
const SAVED_REGISTER =
  'border-[#2E7D32] bg-[#E8F5EC] text-[#2E7D32] focus-visible:outline-[#2E7D32]';

const FRAME =
  'transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40';

export function CsvExportButton({
  saved,
  onExport,
  idleAria,
  savedAria,
  title,
  disabled,
  tone = 'header',
  geometry,
  earSize,
  idleWord = 'CSV',
  idleEar = 'download',
}: CsvExportButtonProps) {
  const IdleEar = idleEar === 'sheet' ? FileSpreadsheet : Download;
  return (
    <button
      onClick={onExport}
      disabled={disabled}
      aria-label={saved ? savedAria : idleAria}
      title={title}
      className={`${geometry ?? DEFAULT_GEOMETRY[tone]} ${
        saved ? SAVED_REGISTER : IDLE_REGISTER[tone]
      } ${FRAME}`}
    >
      {saved ? <Check size={earSize ?? DEFAULT_EAR[tone]} aria-hidden /> : <IdleEar size={earSize ?? DEFAULT_EAR[tone]} aria-hidden />}
      {saved ? 'Saved' : idleWord}
    </button>
  );
}
