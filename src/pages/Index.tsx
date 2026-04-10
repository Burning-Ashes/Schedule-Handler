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
  AlertTriangle,
  Loader2,
  CheckCheck,
  ShieldOff,
} from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FocusModal, { Task } from "@/components/FocusModal";
import PotionBottle from "@/components/PotionBottle";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const NAV_ITEMS = [
  { label: "Today", id: "today", icon: Calendar },
  { label: "Planned", id: "planned", icon: ClipboardList },
  { label: "Human Tasks", id: "human", icon: Users },
  { label: "Automations", id: "automation", icon: Bot },
  { label: "Spam", id: "spam", icon: ShieldOff },
];

const fetchTasks = async (): Promise<Task[]> => {
  const res = await fetch("http://localhost:8000/tasks");
  if (!res.ok) throw new Error("Failed to fetch tasks");
  const data = await res.json();
  return data.tasks || [];
};

const fetchCompletedTasks = async (): Promise<Task[]> => {
  const res = await fetch("http://localhost:8000/tasks/completed");
  if (!res.ok) throw new Error("Failed to fetch completed tasks");
  const data = await res.json();
  return data.tasks || [];
};

const completeTask = async (taskId: string) => {
  const res = await fetch(`http://localhost:8000/tasks/${taskId}/complete`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to complete task");
  return res.json();
};

const reopenTask = async (taskId: string) => {
  const res = await fetch(`http://localhost:8000/tasks/${taskId}/reopen`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to reopen task");
  return res.json();
};

const Index = () => {
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [activeTab, setActiveTab] = useState("today");
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
  });

  const { data: completedTasks = [], isLoading: isLoadingCompleted } = useQuery({
    queryKey: ["completedTasks"],
    queryFn: fetchCompletedTasks,
  });

  const completeMutation = useMutation({
    mutationFn: completeTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["completedTasks"] });
      setFocusTask(null);
    },
  });

  const reopenMutation = useMutation({
    mutationFn: reopenTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["completedTasks"] });
    },
  });

  const humanTasks = tasks
    .filter((t) => t.type === "human")
    .sort((a, b) => (b.urgency_score || 0) - (a.urgency_score || 0));
  const automationTasks = tasks
    .filter((t) => t.type === "automation")
    .sort((a, b) => (b.urgency_score || 0) - (a.urgency_score || 0));
  const spamTasks = tasks
    .filter((t) => t.type === "spam")
    .sort((a, b) => (b.urgency_score || 0) - (a.urgency_score || 0));

  const progressPercentage = Math.max(0, Math.min(100, 100 - tasks.length * 10));
  const totalFocusMins = tasks.reduce((acc, t) => acc + (t.time_estimate_mins || 0), 0);
  const hours = Math.floor(totalFocusMins / 60);
  const mins = totalFocusMins % 60;

  return (
    <div className="min-h-screen bg-background p-4">
      <FocusModal 
        task={focusTask} 
        onClose={() => setFocusTask(null)} 
        onComplete={(id) => completeMutation.mutate(id)} 
      />
      
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1400px] overflow-hidden rounded-2xl bg-card shadow-lg">
        {/* Sidebar */}
        <aside className="flex w-52 flex-col border-r border-border bg-sidebar p-5">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-sidebar-foreground">Focused Sanctuary</h2>
            <p className="text-xs font-semibold tracking-widest text-primary">THE DIGITAL CURATOR</p>
          </div>



          <nav className="flex flex-1 flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
              <div key={item.label} className="flex items-center">
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); setActiveTab(item.id); }}
                  className={`flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "text-primary bg-primary/10"
                      : "text-sidebar-foreground hover:text-primary hover:bg-secondary/50"
                  }`}
                >
                  <item.icon size={18} />
                  {item.label}
                </a>
                {isActive && (
                  <div className="h-8 w-0.5 rounded-full bg-primary ml-2" />
                )}
              </div>
            )})}
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
              <h2 className="text-3xl font-bold text-foreground">
                {activeTab === 'today' ? "Today's Rhythm" :
                 activeTab === 'planned' ? "Planned Tasks" :
                 activeTab === 'human' ? "Human Workspace" :
                 activeTab === 'automation' ? "Automation Inbox" :
                 activeTab === 'spam' ? "Spam Folder" :
                 "Completed Tasks"}
              </h2>
              <p className="mb-6 mt-1 text-sm text-muted-foreground">
                {activeTab === 'spam'
                  ? `${tasks.filter((t) => t.type === 'spam').length} spam emails filtered`
                  : `${activeTab === 'human' ? humanTasks.length : activeTab === 'automation' ? automationTasks.length : tasks.length} active threads requiring presence`}
              </p>

              {/* Human Tasks */}
              {(activeTab === "today" || activeTab === "planned" || activeTab === "human") && (
                <>
                  <Badge className="mb-3 rounded-md bg-primary px-3 py-1 text-xs font-bold uppercase text-primary-foreground hover:bg-primary/90">
                    Human Tasks
                  </Badge>

                  {isLoading && <Loader2 className="animate-spin text-primary my-4" />}
                  {!isLoading && humanTasks.length === 0 && (
                    <p className="text-sm text-muted-foreground mb-6">No human tasks pending.</p>
                  )}

                  {humanTasks.map((task) => (
                    <div key={task.id} onClick={() => setFocusTask(task)} className="mb-4 cursor-pointer rounded-xl border-l-4 border-l-primary bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-foreground">{task.title}</h3>
                          <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">{task.description}</p>
                        </div>
                        <User size={20} className="text-muted-foreground shrink-0 ml-2" />
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock size={13} /> {task.time_estimate_mins} mins
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CheckCircle2 size={13} /> Priority: {task.urgency_score}
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Automation Review */}
              {(activeTab === "today" || activeTab === "planned" || activeTab === "automation") && (
                <>
                  <Badge className="mb-3 mt-4 rounded-md bg-destructive px-3 py-1 text-xs font-bold uppercase text-destructive-foreground hover:bg-destructive/90">
                    Automation Review
                  </Badge>

                  {!isLoading && automationTasks.length === 0 && (
                    <p className="text-sm text-muted-foreground mb-6">No automations pending review.</p>
                  )}

                  {automationTasks.map((task) => (
                    <div key={task.id} onClick={() => setFocusTask(task)} className="mb-4 cursor-pointer rounded-xl border-l-4 border-l-destructive bg-[hsl(0_72%_60%/0.06)] p-4 shadow-sm transition-shadow hover:shadow-md">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-foreground">{task.title}</h3>
                          <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">{task.description}</p>
                        </div>
                        <Bot size={20} className="text-destructive shrink-0 ml-2" />
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-xs font-semibold text-destructive">
                          <AlertTriangle size={13} /> Urgency: {task.urgency_score}
                        </span>
                        <Button 
                          size="sm" 
                          onClick={(e) => { e.stopPropagation(); completeMutation.mutate(task.id); }}
                          className="h-7 rounded-md bg-destructive px-4 text-xs font-bold uppercase text-destructive-foreground hover:bg-destructive/90">
                          Resolve
                        </Button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Completed Tasks */}
              {(activeTab === "today") && (
                <>
                  <Badge className="mb-3 mt-4 rounded-md bg-emerald-600 px-3 py-1 text-xs font-bold uppercase text-white hover:bg-emerald-600/90">
                    Completed
                  </Badge>

                  {isLoadingCompleted && <Loader2 className="animate-spin text-emerald-500 my-4" />}
                  {!isLoadingCompleted && completedTasks.length === 0 && (
                    <p className="text-sm text-muted-foreground mb-6">No completed tasks yet. Get to work!</p>
                  )}

                  {completedTasks.map((task) => (
                    <div key={task.id} className="mb-4 rounded-xl border-l-4 border-l-emerald-500 bg-emerald-500/5 p-4 shadow-sm opacity-70">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-muted-foreground line-through">{task.title}</h3>
                          <p className="mt-0.5 text-sm text-muted-foreground/70 line-clamp-1">{task.description}</p>
                        </div>
                        <CheckCheck size={20} className="text-emerald-500 shrink-0 ml-2" />
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground/70">
                            <Clock size={13} /> {task.time_estimate_mins} mins
                          </span>
                          <span className="flex items-center gap-1 text-xs text-emerald-500 font-semibold">
                            <CheckCircle2 size={13} /> Done
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reopenMutation.mutate(task.id)}
                          disabled={reopenMutation.isPending}
                          className="h-7 rounded-md border-border px-3 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary"
                        >
                          Reopen
                        </Button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Spam Tasks */}
              {activeTab === "spam" && (
                <>
                  <Badge className="mb-3 rounded-md bg-orange-600 px-3 py-1 text-xs font-bold uppercase text-white hover:bg-orange-600/90">
                    Spam
                  </Badge>

                  {isLoading && <Loader2 className="animate-spin text-orange-500 my-4" />}
                  {!isLoading && spamTasks.length === 0 && (
                    <p className="text-sm text-muted-foreground mb-6">Inbox is clean — no spam detected.</p>
                  )}

                  {spamTasks.map((task) => (
                    <div key={task.id} className="mb-4 rounded-xl border-l-4 border-l-orange-500 bg-orange-500/5 p-4 shadow-sm opacity-80">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-muted-foreground line-through">{task.title}</h3>
                          <p className="mt-0.5 text-sm text-muted-foreground/70 line-clamp-1">{task.description}</p>
                        </div>
                        <ShieldOff size={20} className="text-orange-500 shrink-0 ml-2" />
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <span className="flex items-center gap-1 text-xs text-orange-500 font-semibold">
                          <AlertTriangle size={13} /> Spam
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Right column */}
            <div className="w-80 shrink-0">
              <div className="rounded-xl bg-card p-6 shadow-sm">
                <h3 className="mb-1 text-lg font-bold text-foreground">Progress Made</h3>
                <p className="mb-4 text-sm text-muted-foreground">Tasks completed today</p>
                <div className="flex justify-center">
                  <PotionBottle value={progressPercentage} />
                </div>
                <p className="mt-2 text-center text-xs font-semibold uppercase text-primary">Steady Flow</p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Time Focus</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{hours}h {mins}m</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tasks Left</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{tasks.length} Units</p>
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
