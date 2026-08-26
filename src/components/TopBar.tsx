import { ArrowLeft, HelpCircle, Bell, Sparkles } from "lucide-react";

export default function TopBar() {
  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-2 text-text-secondary">
        <ArrowLeft className="h-4 w-4" />
        <span className="text-[14px]">Exams</span>
      </div>

      <div className="flex items-center gap-3">
        <HelpCircle className="h-4 w-4 text-text-secondary" />
        <Bell className="h-4 w-4 text-text-secondary" />
        <Sparkles className="h-4 w-4 text-text-secondary" />
        <div className="ml-1 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-coral/10 text-[12px] font-medium text-coral">
            MR
          </div>
          <span className="hidden text-[14px] text-text sm:inline">
            Madhur Rastogi
          </span>
        </div>
      </div>
    </header>
  );
}
