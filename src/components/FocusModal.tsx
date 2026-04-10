import { X, Clock, Flag, CheckCircle2, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Task {
  title: string;
  description: string;
  time: string;
  priority: string;
}

interface FocusModalProps {
  task: Task | null;
  onClose: () => void;
}

const FocusModal = ({ task, onClose }: FocusModalProps) => {
  if (!task) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-300"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-foreground/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative z-10 flex w-full max-w-2xl overflow-hidden rounded-2xl bg-card shadow-2xl animate-in zoom-in-95 fade-in duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left visual panel */}
        <div className="hidden w-56 shrink-0 sm:block">
          <div className="flex h-full items-center justify-center bg-secondary p-6">
            <div className="relative h-40 w-40">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5" />
              <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-muted to-secondary shadow-inner" />
              <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-card shadow-md" />
            </div>
          </div>
        </div>

        {/* Right content */}
        <div className="flex flex-1 flex-col p-8">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary"
          >
            <X size={18} />
          </button>

          {/* Focus label */}
          <span className="mb-4 inline-flex w-fit items-center rounded-full border border-primary/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
            Focus Mode Active
          </span>

          {/* Title */}
          <h2 className="mb-2 text-2xl font-bold text-foreground">{task.title}</h2>

          {/* Description */}
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
            {task.description}
          </p>

          {/* Meta row */}
          <div className="mb-8 flex items-center gap-5">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock size={14} />
              45 Minutes Remaining
            </span>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Flag size={14} />
              {task.priority}
            </span>
          </div>

          {/* Actions */}
          <Button className="mb-3 w-full gap-2 rounded-xl bg-foreground py-6 text-sm font-semibold text-card hover:bg-foreground/90">
            <CheckCircle2 size={16} />
            Mark Complete
          </Button>
          <button className="flex w-full items-center justify-center gap-2 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <Pause size={14} />
            Pause Focus session
          </button>
        </div>
      </div>
    </div>
  );
};

export default FocusModal;
