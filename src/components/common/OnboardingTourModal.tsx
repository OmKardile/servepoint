import React from 'react';
import { useTsosStore } from '../../lib/store';
import { TOUR_STEPS } from '../../data/guidanceData';
import {
  Sparkles,
  X,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  CheckCircle2,
  ArrowRight,
  BookOpen,
} from 'lucide-react';

export const OnboardingTourModal: React.FC = () => {
  const {
    isTourOpen,
    currentTourStep,
    nextTourStep,
    prevTourStep,
    closeTour,
    setActiveWebTab,
    guidanceMode,
    toggleGuidanceMode,
  } = useTsosStore();

  if (!isTourOpen) return null;

  const step = TOUR_STEPS[currentTourStep] || TOUR_STEPS[0];
  const isFirst = currentTourStep === 0;
  const isLast = currentTourStep === TOUR_STEPS.length - 1;
  const progressPct = Math.round(((currentTourStep + 1) / TOUR_STEPS.length) * 100);

  const handleNext = () => {
    if (isLast) {
      closeTour();
    } else {
      const nextIdx = currentTourStep + 1;
      const target = TOUR_STEPS[nextIdx]?.targetTab;
      if (target) {
        setActiveWebTab(target);
      }
      nextTourStep();
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      const prevIdx = currentTourStep - 1;
      const target = TOUR_STEPS[prevIdx]?.targetTab;
      if (target) {
        setActiveWebTab(target);
      }
      prevTourStep();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full border border-[#E9E0D6] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Top Gradient Header */}
        <div className="p-5 bg-linear-to-r from-[#1C1917] via-[#292524] to-[#1C1917] text-white flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#F97316] text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-[#F97316] uppercase tracking-wider flex items-center gap-1.5">
                <span>TSOS First-Time Guidance</span>
                <span className="text-white/40">•</span>
                <span className="text-white/80">{step.category}</span>
              </div>
              <h3 className="text-sm font-bold text-white mt-0.5">
                Step {currentTourStep + 1} of {TOUR_STEPS.length}
              </h3>
            </div>
          </div>

          <button
            onClick={closeTour}
            className="p-1.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Close Tour"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#E9E0D6] h-1.5">
          <div
            className="bg-[#F97316] h-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4">
          <div>
            <h4 className="text-base font-bold text-[#1C1917] mb-2 leading-snug">
              {step.title}
            </h4>
            <p className="text-xs text-[#57534E] leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Training Tip Callout */}
          <div className="p-3.5 rounded-2xl bg-[#FFF9F2] border border-[#E9E0D6] flex items-start gap-2.5">
            <BookOpen className="w-4 h-4 text-[#F97316] shrink-0 mt-0.5" />
            <div className="text-xs text-[#57534E]">
              <strong className="text-[#1C1917]">Hover Guidance Available:</strong> Any time you need help, hover over buttons, badges, tabs, and input fields to see contextual guidance, actions, and shortcuts.
            </div>
          </div>

          {/* Quick Toggle for Hover Guidance */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#F5F3FF] border border-[#DDD6FE] text-xs">
            <span className="text-[#7C3AED] font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Hover Guidance Indicators:</span>
            </span>
            <button
              type="button"
              onClick={toggleGuidanceMode}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                guidanceMode
                  ? 'bg-[#7C3AED] text-white'
                  : 'bg-white text-[#57534E] border border-[#DDD6FE]'
              }`}
            >
              {guidanceMode ? 'ENABLED (Hover to Learn)' : 'DISABLED'}
            </button>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="p-4 bg-[#FFF9F2] border-t border-[#E9E0D6] flex items-center justify-between">
          <button
            type="button"
            onClick={closeTour}
            className="px-3 py-1.5 text-xs font-semibold text-[#57534E] hover:text-[#1C1917]"
          >
            Skip Walkthrough
          </button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={handlePrev}
                className="flex items-center gap-1 px-3 py-2 rounded-xl border border-[#E9E0D6] bg-white text-xs font-semibold text-[#57534E] hover:bg-[#F5F0EB]"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold shadow-xs transition-colors"
            >
              <span>{isLast ? 'Complete & Start Using TSOS' : 'Next Step'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
