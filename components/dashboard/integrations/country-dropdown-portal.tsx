"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";

function flagEmoji(iso: string): string {
  if (!iso || iso.length !== 2) return "";
  const codePoints = iso
    .toUpperCase()
    .split("")
    .map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

const COUNTRIES = [
  { code: "+1", iso: "US", name: "United States" },
  { code: "+91", iso: "IN", name: "India" },
  { code: "+44", iso: "GB", name: "United Kingdom" },
  { code: "+49", iso: "DE", name: "Germany" },
  { code: "+33", iso: "FR", name: "France" },
  { code: "+61", iso: "AU", name: "Australia" },
  { code: "+55", iso: "BR", name: "Brazil" },
  { code: "+81", iso: "JP", name: "Japan" },
  { code: "+65", iso: "SG", name: "Singapore" },
  { code: "+971", iso: "AE", name: "UAE" },
  { code: "+86", iso: "CN", name: "China" },
  { code: "+7", iso: "RU", name: "Russia" },
  { code: "+27", iso: "ZA", name: "South Africa" },
  { code: "+234", iso: "NG", name: "Nigeria" },
  { code: "+52", iso: "MX", name: "Mexico" },
  { code: "+62", iso: "ID", name: "Indonesia" },
  { code: "+39", iso: "IT", name: "Italy" },
  { code: "+34", iso: "ES", name: "Spain" },
  { code: "+31", iso: "NL", name: "Netherlands" },
  { code: "+41", iso: "CH", name: "Switzerland" },
  { code: "+46", iso: "SE", name: "Sweden" },
  { code: "+47", iso: "NO", name: "Norway" },
  { code: "+48", iso: "PL", name: "Poland" },
  { code: "+90", iso: "TR", name: "Turkey" },
  { code: "+966", iso: "SA", name: "Saudi Arabia" },
  { code: "+54", iso: "AR", name: "Argentina" },
  { code: "+64", iso: "NZ", name: "New Zealand" }
];

export interface CountryDropdownPortalProps {
  selectedCountry: typeof COUNTRIES[0];
  countrySearch: string;
  setCountrySearch: (value: string) => void;
  setSelectedCountry: (country: typeof COUNTRIES[0]) => void;
  setShowCountryDropdown: (show: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  whatsappPhoneInputId: string;
}

function CountryDropdownPortal({
  selectedCountry,
  countrySearch,
  setCountrySearch,
  setSelectedCountry,
  setShowCountryDropdown,
  triggerRef,
  whatsappPhoneInputId,
}: CountryDropdownPortalProps) {
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger || !dropdownRef.current) return;

      const triggerRect = trigger.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const spaceBelow = viewportHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;

      const preferredHeight = 280;
      const dropdownWidth = triggerRect.width;

      let top: number;
      let left = triggerRect.left;

      if (spaceBelow < preferredHeight && spaceAbove > spaceBelow) {
        top = triggerRect.top - preferredHeight - 6;
      } else {
        top = triggerRect.bottom + 6;
      }

      if (left + dropdownWidth > viewportWidth - 16) {
        left = viewportWidth - dropdownWidth - 16;
      }
      if (left < 16) left = 16;

      setDropdownStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${dropdownWidth}px`,
        maxHeight: `${preferredHeight}px`,
        zIndex: 9999,
      });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [triggerRef]);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      const trigger = triggerRef.current;
      if (trigger && !trigger.contains(event.target as Node)) {
        setShowCountryDropdown(false);
        setCountrySearch("");
      }
    }
  }, [setShowCountryDropdown, setCountrySearch, triggerRef]);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.code.includes(countrySearch)
  );

  return (
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl animate-in fade-in-50 slide-in-from-top-1 duration-150 flex flex-col"
      role="listbox"
    >
      <div className="shrink-0 bg-white dark:bg-[#0B1120] px-2 pt-2 pb-1.5 border-b border-slate-100 dark:border-slate-800/80 rounded-t-xl">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-450 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={countrySearch}
            onChange={(e) => setCountrySearch(e.target.value)}
            placeholder="Search country or code..."
            className="w-full h-10 pl-9 pr-8 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-[13px] font-medium rounded-lg outline-none focus:border-slate-300 dark:focus:border-slate-600 focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-600 transition-all text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
            autoFocus
          />
          {countrySearch && (
            <button
              type="button"
              onClick={() => setCountrySearch("")}
              className="p-1 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-1 space-y-0.5" role="listbox">
        {filteredCountries.length > 0 ? (
          filteredCountries.map((country) => {
            const isSelected = country.code === selectedCountry.code;
            return (
              <button
                key={country.name + country.code}
                type="button"
                onClick={() => {
                  setSelectedCountry(country);
                  setShowCountryDropdown(false);
                  setCountrySearch("");
                  document.getElementById(whatsappPhoneInputId)?.focus();
                }}
                role="option"
                aria-selected={isSelected}
                className={`
                  w-full flex items-center justify-between px-3 py-2.5 text-[14px] font-medium rounded-lg transition-all duration-150 cursor-pointer text-left
                  ${isSelected
                    ? "bg-[#25D366]/10 text-[#128C7E] dark:bg-[#25D366]/20 dark:text-[#25D366]"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300"
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl leading-none">{flagEmoji(country.iso)}</span>
                  <span className="truncate font-semibold">{country.name}</span>
                </div>
                <span className="text-[13px] font-bold text-slate-500 dark:text-slate-400 font-mono">{country.code}</span>
              </button>
            );
          })
        ) : (
          <div className="py-5 text-center text-[12.5px] text-slate-500 dark:text-slate-500 font-medium">
            No countries found
          </div>
        )}
      </div>
    </div>
  );
}

export { COUNTRIES, flagEmoji, CountryDropdownPortal };
export default CountryDropdownPortal;
