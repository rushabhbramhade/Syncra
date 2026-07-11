"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X, ArrowRight } from "lucide-react";

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 8) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Features", href: "#features" },
    { label: "Integrations", href: "#integrations" },
    { label: "AI Brain", href: "#ai-capabilities" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-surface-white/95 border-b-[2.5px] border-secondary py-3 neo-shadow-sm"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-[1280px] mx-auto px-6 md:px-12 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 focus-visible:ring-2 focus-visible:ring-primary rounded-lg outline-none">
          <span className="font-display font-black text-[22px] tracking-tight text-secondary">
            Syncar
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="font-sans font-medium text-text-slate hover:text-secondary focus-visible:ring-2 focus-visible:ring-primary rounded px-2 py-1 outline-none transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-4">
          <Link href="/sign-in" passHref>
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
          </Link>
          <Link href="/sign-up" passHref>
            <Button variant="primary" size="sm" className="group">
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4 ml-1.5 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </div>

        {/* Mobile Hamburger Menu button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 rounded-lg neo-border bg-surface-white text-secondary neo-shadow-sm focus-visible:ring-2 focus-visible:ring-primary outline-none"
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Panel */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 top-[65px] bg-background-mist z-40 md:hidden flex flex-col justify-between p-8 border-t-[2.5px] border-secondary">
          <nav className="flex flex-col gap-6">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="font-display font-bold text-2xl text-secondary hover:text-primary transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex flex-col gap-4 mt-8">
            <Link href="/sign-in" passHref className="w-full">
              <Button variant="secondary" size="lg" className="w-full" onClick={() => setIsMobileMenuOpen(false)}>
                Sign In
              </Button>
            </Link>
            <Link href="/sign-up" passHref className="w-full">
              <Button variant="primary" size="lg" className="w-full" onClick={() => setIsMobileMenuOpen(false)}>
                Get Started Free
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

