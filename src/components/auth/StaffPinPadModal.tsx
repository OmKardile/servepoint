import React, { useState, useEffect } from 'react';
import { useTsosStore } from '../../lib/store';
import { authService } from '../../lib/authService';
import { StaffMember } from '../../types';
import {
  KeyRound,
  UserCheck,
  Delete,
  X,
  ShieldCheck,
  AlertCircle,
  Coffee,
} from 'lucide-react';

interface StaffPinPadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (staff: StaffMember) => void;
  title?: string;
}

export const StaffPinPadModal: React.FC<StaffPinPadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = 'Staff Fast PIN Switch',
}) => {
  const { staffMembers, setCurrentProfile } = useTsosStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(null);
    }
  }, [isOpen]);

  // Handle keyboard typing
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pin]);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError(null);

    if (newPin.length === 4) {
      validatePin(newPin);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  const validatePin = (inputPin: string) => {
    const verifiedStaff = authService.verifyStaffPin(inputPin, staffMembers);
    if (verifiedStaff) {
      setCurrentProfile({
        name: verifiedStaff.name,
        // v4.0.0: every staff PIN login resolves to the merged 'staff' role
        role: 'staff',
        pin_code: verifiedStaff.pin_code,
      });
      authService.setActiveStaff(verifiedStaff);
      if (onSuccess) onSuccess(verifiedStaff);
      onClose();
    } else {
      setError('Incorrect 4-digit PIN. Please try again.');
      setPin('');
    }
  };

  const handleSelectStaffQuick = (staff: StaffMember) => {
    const staffPin = staff.pin_code || staff.pin;
    if (staffPin) {
      validatePin(staffPin);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-sm w-full border border-[#E9E0D6] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-[#1C1917] to-[#292524] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#F97316] text-white flex items-center justify-center shadow-xs">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">{title}</h3>
              <p className="text-[10px] text-[#A8A29E]">Authenticate cashier or barista shift</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Staff Chips */}
        <div className="p-3 bg-[#FFF9F2] border-b border-[#E9E0D6]">
          <div className="text-[10px] font-semibold text-[#A8A29E] uppercase tracking-wider mb-1.5 text-center">
            Tap Your Name or Enter PIN
          </div>
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {staffMembers.slice(0, 4).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelectStaffQuick(s)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#E9E0D6] bg-white hover:border-[#F97316] hover:bg-[#FFF1E6] transition-all text-xs"
              >
                <div className="w-5 h-5 rounded-full bg-[#F97316]/10 text-[#F97316] font-bold text-[10px] flex items-center justify-center">
                  {s.name.charAt(0)}
                </div>
                <div className="text-left">
                  <div className="font-bold text-[#1C1917] leading-none">{s.name.split(' ')[0]}</div>
                  <div className="text-[9px] text-[#57534E] capitalize">{s.role}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* PIN Indicators */}
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-3 my-2">
            {[0, 1, 2, 3].map((idx) => {
              const filled = idx < pin.length;
              return (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                    filled
                      ? 'bg-[#F97316] border-[#F97316] scale-110 shadow-xs'
                      : 'border-[#D6D3D1] bg-white'
                  }`}
                />
              );
            })}
          </div>

          {error ? (
            <div className="text-xs text-rose-600 flex items-center justify-center gap-1 mt-2 animate-bounce">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="text-[11px] text-[#A8A29E] mt-2">
              Enter 4 digits using keyboard or touchscreen
            </div>
          )}
        </div>

        {/* Numeric Keypad */}
        <div className="p-4 pt-0 grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-12 rounded-2xl bg-[#FFF9F2] hover:bg-[#F5F0EB] active:bg-[#E9E0D6] border border-[#E9E0D6] font-mono text-lg font-bold text-[#1C1917] transition-all shadow-xs"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-12 rounded-2xl bg-white hover:bg-[#F5F0EB] border border-[#E9E0D6] text-xs font-bold text-[#57534E] transition-all"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-12 rounded-2xl bg-[#FFF9F2] hover:bg-[#F5F0EB] active:bg-[#E9E0D6] border border-[#E9E0D6] font-mono text-lg font-bold text-[#1C1917] transition-all shadow-xs"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-12 rounded-2xl bg-white hover:bg-[#F5F0EB] border border-[#E9E0D6] flex items-center justify-center text-[#57534E] transition-all"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
