"use client";

import React, { useRef } from "react";
import { createPortal } from "react-dom";
import { Smartphone, X, ChevronDown, Loader2, Link, Search } from "lucide-react";
import { CountryDropdownPortal, COUNTRIES, flagEmoji } from "./country-dropdown-portal";

export interface WhatsAppConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  pairingCode: string;
  phoneNumber: string;
  setPhoneNumber: (val: string) => void;
  selectedCountry: typeof COUNTRIES[0];
  setSelectedCountry: (country: typeof COUNTRIES[0]) => void;
  showCountryDropdown: boolean;
  setShowCountryDropdown: (show: boolean) => void;
  countrySearch: string;
  setCountrySearch: (search: string) => void;
  isGeneratingPairingCode: boolean;
  onGeneratePairingCode: (e: React.FormEvent) => Promise<void>;
  onStopPolling: () => void;
}

function WhatsAppConnectionModal({
  isOpen,
  onClose,
  pairingCode,
  phoneNumber,
  setPhoneNumber,
  selectedCountry,
  setSelectedCountry,
  showCountryDropdown,
  setShowCountryDropdown,
  countrySearch,
  setCountrySearch,
  isGeneratingPairingCode,
  onGeneratePairingCode,
  onStopPolling,
}: WhatsAppConnectionModalProps) {
  const countryTriggerRef = useRef<HTMLButtonElement>(null);
  const phoneInputRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 bg-slate-950/40 dark:bg-black/60 backdrop-blur-[4px] z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      >
        <div
          className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl shadow-slate-950/10 dark:shadow-black/50 animate-in fade-in zoom-in duration-200"
        >
          <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/[0.3] dark:bg-slate-900/[0.15] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#25D366]/10 dark:bg-[#25D366]/20 text-[#128C7E] dark:text-[#25D366] rounded-xl flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <span className="font-sans font-semibold text-[17px] text-slate-900 dark:text-slate-100 tracking-tight">
                Link WhatsApp Channel
              </span>
            </div>
            <button
              onClick={() => {
                onStopPolling();
                onClose();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-400/20"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-6 text-left">
            {!pairingCode ? (
              <form onSubmit={onGeneratePairingCode} className="space-y-6">
                <div className="space-y-2.5 text-slate-600 dark:text-slate-400">
                  <p className="text-[13.5px] font-medium text-slate-750 dark:text-slate-300">
                    Enter the WhatsApp number you want to connect. We&apos;ll send a pairing code to link it.
                  </p>
                  <ul className="space-y-1.5 text-[12.5px] font-medium text-slate-500 dark:text-slate-400 pl-1 ml-1 list-disc marker:text-[#25D366]">
                    <li className="pl-1">Include your country code.</li>
                    <li className="pl-1">
                      Example: <span className="font-semibold text-slate-755 dark:text-slate-300 font-mono">+1 234 567 8900</span>
                    </li>
                    <li className="pl-1">The pairing code is generated securely and expires after a few minutes.</li>
                  </ul>
                </div>

                <div className="relative w-full">
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="whatsapp-phone-input" className="block text-[12.5px] font-semibold text-slate-700 dark:text-slate-400">
                      Phone number
                    </label>
                    {phoneNumber && (
                      <span className="text-[11px] font-medium text-slate-450 dark:text-slate-505 transition-all animate-in fade-in duration-200">
                        {selectedCountry.name}
                      </span>
                    )}
                  </div>

                  <div ref={phoneInputRef} className={`
                    relative flex items-center w-full h-11 rounded-xl bg-slate-50 dark:bg-black/10 border transition-all duration-200
                    ${isGeneratingPairingCode ? "opacity-60 cursor-not-allowed" : ""}
                    ${showCountryDropdown
                      ? "border-[#25D366] ring-2 ring-[#25D366]/10"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-750"
                    }
                  `}>
                    <button
                      ref={countryTriggerRef}
                      type="button"
                      disabled={isGeneratingPairingCode}
                      onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                      aria-haspopup="listbox"
                      aria-expanded={showCountryDropdown}
                      aria-label="Select country code"
                      className="flex items-center justify-between min-w-[110px] h-full pl-3.5 pr-3 hover:bg-slate-100 dark:hover:bg-slate-800/40 rounded-l-xl transition-colors cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-300"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl leading-none">{flagEmoji(selectedCountry.iso)}</span>
                        <span className="text-[14px] font-bold font-mono text-slate-800 dark:text-slate-200">{selectedCountry.code}</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 ml-1 text-slate-400 transition-transform duration-200 ${showCountryDropdown ? "rotate-180" : ""}`} />
                    </button>

                    <div className="w-[1.5px] h-5 bg-slate-200 dark:bg-slate-800 shrink-0" />

                    <input
                      id="whatsapp-phone-input"
                      type="tel"
                      required
                      disabled={isGeneratingPairingCode}
                      value={phoneNumber}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^\d\s\-\(\)\+]/g, "");
                        setPhoneNumber(val);
                      }}
                      placeholder={selectedCountry.code === "+1" ? "(201) 555-0123" : selectedCountry.code === "+91" ? "98765 43210" : "Enter phone number"}
                      className="flex-1 h-full px-3.5 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-[14px] font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                    />

                    {isGeneratingPairingCode && (
                      <div className="pr-3.5 flex items-center">
                        <Loader2 className="w-4 h-4 animate-spin text-[#25D366]" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 inline-flex items-center justify-center font-medium text-[13.5px] rounded-xl h-10 min-h-[40px] bg-transparent hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-slate-400/20 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isGeneratingPairingCode}
                    className="flex-1 inline-flex items-center justify-center font-medium text-[13.5px] rounded-xl h-10 min-h-[40px] bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-950 transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-slate-400/20 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                  >
                    {isGeneratingPairingCode ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Generate Code
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="text-center space-y-3.5">
                  <p className="text-[13.5px] text-slate-600 dark:text-slate-400 font-medium">
                    Enter this pairing code on your mobile device to authorize:
                  </p>

                  <div className="inline-flex items-center justify-center px-10 py-4.5 bg-[#25D366]/[0.06] dark:bg-[#25D366]/10 border border-[#25D366]/30 dark:border-[#25D366]/40 rounded-2xl shadow-sm shadow-[#25D366]/5">
                    <span className="font-mono font-bold text-3xl tracking-[0.2em] text-[#128C7E] dark:text-[#25D366] select-all leading-none">
                      {pairingCode}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-3">
                  <h4 className="font-semibold text-[13px] text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Link className="w-3.5 h-3.5 text-[#25D366]" /> Instructions:
                  </h4>
                  <ol className="text-[12.5px] font-medium text-slate-600 dark:text-slate-400 space-y-2 list-decimal pl-4 leading-relaxed">
                    <li>Open <strong className="text-slate-900 dark:text-slate-200 font-semibold">WhatsApp</strong> on your phone.</li>
                    <li>Go to <strong className="text-slate-900 dark:text-slate-200 font-semibold">Settings</strong> / <strong className="text-slate-900 dark:text-slate-200 font-semibold">Menu</strong> &gt; <strong className="text-slate-900 dark:text-slate-200 font-semibold">Linked Devices</strong>.</li>
                    <li>Select <strong className="text-slate-900 dark:text-slate-200 font-semibold">Link a Device</strong>.</li>
                    <li>Choose <strong className="text-slate-900 dark:text-slate-200 font-semibold">Link with phone number instead</strong>.</li>
                    <li>Type the 8-character code shown above.</li>
                  </ol>
                </div>

                <div className="flex items-center justify-center gap-2 py-1 text-[#25D366] font-semibold text-[13px]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="animate-pulse">Waiting for WhatsApp authorization...</span>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => {
                      onStopPolling();
                      onClose();
                    }}
                    className="w-full inline-flex items-center justify-center font-medium text-[13.5px] rounded-xl h-10 min-h-[40px] bg-transparent hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-slate-400/20 cursor-pointer"
                  >
                    Cancel & Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCountryDropdown && countryTriggerRef.current && createPortal(
        <CountryDropdownPortal
          selectedCountry={selectedCountry}
          countrySearch={countrySearch}
          setCountrySearch={setCountrySearch}
          setSelectedCountry={setSelectedCountry}
          setShowCountryDropdown={setShowCountryDropdown}
          triggerRef={phoneInputRef}
          whatsappPhoneInputId="whatsapp-phone-input"
        />,
        document.body
      )}
    </>
  );
}

export { WhatsAppConnectionModal };
export default WhatsAppConnectionModal;
