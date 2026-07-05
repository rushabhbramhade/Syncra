import React from "react";

export function Footer() {
  const columns = [
    {
      title: "Product",
      links: [
        { label: "Features", href: "#features" },
        { label: "Integrations", href: "#integrations" },
        { label: "Pricing", href: "#pricing" },
        { label: "Changelog", href: "#" },
      ]
    },
    {
      title: "Resources",
      links: [
        { label: "Documentation", href: "#" },
        { label: "API Reference", href: "#" },
        { label: "Help Center", href: "#" },
        { label: "System Status", href: "#" },
      ]
    },
    {
      title: "Security",
      links: [
        { label: "Privacy Policy", href: "#" },
        { label: "Terms of Service", href: "#" },
        { label: "GDPR Compliance", href: "#" },
        { label: "Data Encryption", href: "#" },
      ]
    },
    {
      title: "Company",
      links: [
        { label: "About Us", href: "#" },
        { label: "Careers", href: "#" },
        { label: "Contact Sales", href: "#" },
        { label: "Press Kit", href: "#" },
      ]
    }
  ];

  return (
    <footer className="bg-secondary text-white py-16 border-t-[2.5px] border-secondary">
      <div className="max-w-[1280px] mx-auto px-6 md:px-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-12 mb-16">
          {/* Logo & Info column */}
          <div className="col-span-2 flex flex-col items-start gap-4">
            <a href="#" className="flex items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
              <div className="w-8 h-8 rounded-lg bg-primary border-[2px] border-white flex items-center justify-center text-white font-black text-xl">
                S
              </div>
              <span className="font-display font-black text-[22px] tracking-tight text-white">
                Syncar
              </span>
            </a>
            <p className="font-sans text-xs text-text-fog/70 leading-relaxed max-w-[280px] mt-2">
              Syncar is a secure personal productivity workspace that merges and prioritizes messaging streams with localized artificial intelligence.
            </p>
            <span className="font-mono text-[10px] text-text-fog/40 mt-4 block">
              © {new Date().getFullYear()} Syncar Inc. All rights reserved.
            </span>
          </div>

          {/* Dynamic Link columns */}
          {columns.map((col, index) => (
            <div key={index} className="flex flex-col items-start gap-4 col-span-1">
              <h4 className="font-display font-bold text-sm text-white tracking-wide">
                {col.title}
              </h4>
              <ul className="flex flex-col items-start gap-2.5 font-sans text-xs text-text-fog/70">
                {col.links.map((link, idx) => (
                  <li key={idx}>
                    <a
                      href={link.href}
                      className="hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-primary rounded outline-none"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Legal bottom bar */}
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 font-mono text-[10px] text-text-fog/50">
          <div className="flex gap-6">
            <span>Security Certified</span>
            <span>E2E TLS Encrypted</span>
            <span>GDPR Compliant</span>
          </div>
          <div>
            <span>Made by Syncar design team</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
