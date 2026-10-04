import React from 'react';

/**
 * ScreenSkeleton (v5.143.0) — the loading register for a lazy screen door.
 *
 * Screens are code-split now: the first walk through any door fetches that
 * screen's chunk. This skeleton stands in the content card for those few
 * milliseconds (instant once the SW precache is warm) so a slow link never
 * paints a blank card or an unstyled flash. It speaks the house's quiet
 * neutrals — the same pulsing language as the boot Splash, at screen scale —
 * and lives INSIDE the screen's error boundary: if the chunk itself fails
 * (offline cache miss), the boundary takes over with its honest snag card,
 * and this skeleton never pretends to be the screen.
 */
const ScreenSkeleton: React.FC = () => (
  <div className="flex h-full min-h-[60vh] flex-col gap-4 p-5 sm:p-6" role="status" aria-label="Loading screen">
    <span className="sr-only">Loading</span>
    {/* Title line — the sp-screen-title register's silhouette */}
    <div className="h-7 w-52 animate-pulse rounded-lg bg-[#E3E7E0]" />
    {/* Tile row — the stat-card grammar */}
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div className="h-24 animate-pulse rounded-2xl bg-[#EFEDE7]" />
      <div className="h-24 animate-pulse rounded-2xl bg-[#EFEDE7]" />
      <div className="hidden h-24 animate-pulse rounded-2xl bg-[#EFEDE7] sm:block" />
      <div className="hidden h-24 animate-pulse rounded-2xl bg-[#EFEDE7] lg:block" />
    </div>
    {/* Main content mass */}
    <div className="min-h-40 flex-1 animate-pulse rounded-2xl bg-[#EFEDE7]" />
  </div>
);

export default ScreenSkeleton;
