import {
  Sparkles,
  Home,
  Users,
  FileText,
  ClipboardList,
  BookOpen,
  Settings,
} from "lucide-react";

const NAV = [
  { label: "Home", icon: Home, active: false },
  { label: "My Classroom", icon: Users, active: false },
  { label: "Assignments", icon: FileText, active: false },
  { label: "Exams", icon: ClipboardList, active: true },
  { label: "My Library", icon: BookOpen, active: false },
];

export default function Sidebar() {
  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-[220px] flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-12">
        <div className="flex h-6 w-6 items-center justify-center rounded-[8px] bg-coral text-[12px] font-semibold text-white">
          V
        </div>
        <span className="text-[14px] font-semibold text-text">VedaAI</span>
      </div>

      <div className="px-3">
        <button className="flex w-full items-center gap-2 rounded-[8px] bg-coral px-3 py-2 text-[12px] font-medium text-white">
          <Sparkles className="h-3.5 w-3.5" />
          AI Teacher&apos;s Toolkit
        </button>
      </div>

      <nav className="mt-4 flex flex-col gap-1 px-3">
        {NAV.map(({ label, icon: Icon, active }) => (
          <div
            key={label}
            className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[14px] ${
              active
                ? "bg-bg font-medium text-text"
                : "text-text-secondary"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </div>
        ))}
      </nav>

      <div className="mt-auto px-3 pb-3">
        <div className="flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[14px] text-text-secondary">
          <Settings className="h-4 w-4" />
          Settings
        </div>
      </div>

      {/* School footer */}
      <div className="flex items-center gap-2 border-t border-border px-4 py-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg text-[12px]">
          🏫
        </div>
        <div className="min-w-0">
          <div className="truncate text-[12px] font-medium text-text">
            Delhi Public School
          </div>
          <div className="truncate text-[12px] text-text-secondary">
            Bokaro Steel City
          </div>
        </div>
      </div>
    </aside>
  );
}
