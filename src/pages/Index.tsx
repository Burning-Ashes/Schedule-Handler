import {
  Calendar,
  ClipboardList,
  Users,
  Bot,
  Plus,
  Search,
  Bell,
  Settings,
  Clock,
  CheckCircle2,
  User,
  PenSquare,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FocusModal from "@/components/FocusModal";
import PotionBottle from "@/components/PotionBottle";

const tasks = [
  {
    id: "strategy",
    title: "Weekly Strategy Sync",
    description: "Human-to-human collaboration on Q4 planning. Review team alignment, discuss resource allocation, and finalize the roadmap for the upcoming sprint cycle.",
    time: "10:30 AM",
    priority: "High Priority",
  },
  {
    id: "architecture",
    title: "Deep Work: Architecture Design",
    description: "Refining the persistent data layer architecture. Analyze the current schema, identify bottlenecks, and propose a scalable solution for the sanctuary's resource allocation.",
    time: "2:00 PM",
    priority: "High Priority",
  },
  {
    id: "api",
    title: "API Integration Failure",
    description: "Script 'Alpha' encountered unexpected 403 error. Investigate authentication token expiry, review API gateway logs, and implement a retry mechanism with exponential backoff.",
    time: "ASAP",
    priority: "Critical",
  },
];

const navItems = [
  { label: "Today", icon: Calendar, active: true },
  { label: "Planned", icon: ClipboardList, active: false },
  { label: "Human Tasks", icon: Users, active: false },
  { label: "Automations", icon: Bot, active: false },
];

const Index = () => {
  const [focusTask, setFocusTask] = useState<typeof tasks[number] | null>(null);

  return (
    <div className="min-h-screen bg-background p-4">
      <FocusModal task={focusTask} onClose={() => setFocusTask(null)} />
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1400px] overflow-hidden rounded-2xl bg-card shadow-lg">
        {/* Sidebar */}
        <aside className="flex w-52 flex-col border-r border-border bg-sidebar p-5">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-sidebar-foreground">Focused Sanctuary</h2>
            <p className="text-xs font-semibold tracking-widest text-primary">THE DIGITAL CURATOR</p>
          </div>

          <Button className="mb-8 w-full gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus size={16} />
            New Task
          </Button>

          <nav className="flex flex-1 flex-col gap-1">
            {navItems.map((item) => (
              <div key={item.label} className="flex items-center">
                <a
                  href="#"
                  className={`flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    item.active
                      ? "text-primary"
                      : "text-sidebar-foreground hover:text-primary"
                  }`}
                >
                  <item.icon size={18} />
                  {item.label}
                </a>
                {item.active && (
                  <div className="h-8 w-0.5 rounded-full bg-primary" />
                )}
              </div>
            ))}
          </nav>

          <div className="mt-auto flex items-center gap-3 pt-4">
            <Avatar className="h-9 w-9">
              <AvatarImage src="" />
              <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">AR</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold text-sidebar-foreground">Alex Rivera</p>
              <p className="text-xs text-muted-foreground">Deep Work Mode</p>
            </div>
          </div>
        </aside>

        {/* Main area */}
        <div className="flex flex-1 flex-col">
          {/* Top Bar */}
          <header className="flex items-center gap-4 border-b border-border px-8 py-4">
            <h1 className="text-xl font-bold text-foreground">Zen Scheduler</h1>
            <div className="relative ml-4 w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Search task sanctuary..."
                className="h-9 rounded-full border-border bg-secondary pl-9 text-sm"
              />
            </div>
            <div className="ml-auto flex items-center gap-3">
              <button className="rounded-full p-2 text-muted-foreground hover:bg-secondary">
                <Bell size={20} />
              </button>
              <button className="rounded-full p-2 text-muted-foreground hover:bg-secondary">
                <Settings size={20} />
              </button>
            </div>
          </header>

          {/* Content */}
          <div className="flex flex-1 gap-8 overflow-y-auto px-8 py-6">
            {/* Left column */}
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-foreground">Today's Rhythm</h2>
              <p className="mb-6 mt-1 text-sm text-muted-foreground">4 active threads requiring presence</p>

              {/* Human Tasks */}
              <Badge className="mb-3 rounded-md bg-primary px-3 py-1 text-xs font-bold uppercase text-primary-foreground hover:bg-primary/90">
                Human Tasks
              </Badge>

              <div onClick={() => setFocusTask(tasks[0])} className="mb-4 cursor-pointer rounded-xl border-l-4 border-l-primary bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-foreground">Weekly Strategy Sync</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">Human-to-human collaboration on Q4...</p>
                  </div>
                  <User size={20} className="text-muted-foreground" />
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock size={13} /> 10:30 AM
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CheckCircle2 size={13} /> Priority
                  </span>
                </div>
              </div>

              <div onClick={() => setFocusTask(tasks[1])} className="mb-6 cursor-pointer rounded-xl border-l-4 border-l-primary bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-foreground">Deep Work: Architecture Design</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">Refining the persistent data layer...</p>
                  </div>
                  <PenSquare size={20} className="text-primary" />
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock size={13} /> 2:00 PM
                  </span>
                  <span className="text-xs text-muted-foreground">Focus Mode</span>
                </div>
              </div>

              {/* Automation Review */}
              <Badge className="mb-3 rounded-md bg-destructive px-3 py-1 text-xs font-bold uppercase text-destructive-foreground hover:bg-destructive/90">
                Automation Review
              </Badge>

              <div onClick={() => setFocusTask(tasks[2])} className="cursor-pointer rounded-xl border-l-4 border-l-destructive bg-[hsl(0_72%_60%/0.06)] p-4 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-foreground">API Integration Failure</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Script 'Alpha' encountered unexpected 403 error.
                    </p>
                  </div>
                  <Bot size={20} className="text-destructive" />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs font-semibold text-destructive">
                    <AlertTriangle size={13} /> Action Required
                  </span>
                  <Button size="sm" className="h-7 rounded-md bg-destructive px-4 text-xs font-bold uppercase text-destructive-foreground hover:bg-destructive/90">
                    Fix Now
                  </Button>
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="w-80 shrink-0">
              <div className="rounded-xl bg-card p-6 shadow-sm">
                <h3 className="mb-1 text-lg font-bold text-foreground">Progress Made</h3>
                <p className="mb-4 text-sm text-muted-foreground">Tasks completed today</p>
                <div className="flex justify-center">
                  <PotionBottle value={65} />
                </div>
                <p className="mt-2 text-center text-xs font-semibold uppercase text-primary">Steady Flow</p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Time Focus</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">4h 12m</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tasks Left</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">3 Units</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
