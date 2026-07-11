import React from "react";
import { Construction } from "lucide-react";

interface ComingSoonProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}

export function ComingSoon({ title, description, icon }: ComingSoonProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8 font-sans">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-5 bg-primary/10 border-[2.5px] border-primary/30 rounded-2xl text-primary">
            {icon ?? <Construction className="w-10 h-10" />}
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="font-display font-black text-3xl text-secondary">
            {title}
          </h1>
          <p className="text-text-slate text-[15px] font-medium leading-relaxed">
            {description ??
              "This workspace module is currently under construction. Check back soon — it's going to be powerful."}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border-[1.5px] border-primary/30 text-primary text-sm font-bold rounded-full">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Coming Soon
        </div>
      </div>
    </div>
  );
}
