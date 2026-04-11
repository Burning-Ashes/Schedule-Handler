import { ReactNode, useState, useEffect } from "react";
import { API_BASE } from "@/lib/api";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { 
  Mail, 
  Settings2, 
  ShieldOff, 
  Bot, 
  User, 
  ChevronDown, 
  ChevronUp, 
  X,
  LogOut,
  RefreshCcw
} from "lucide-react";

// Sub-component for individual email filtration categories
function FilterSection({ 
  title, 
  description, 
  icon: Icon, 
  colorClass 
}: { 
  title: string, 
  description: string, 
  icon: any, 
  colorClass: string 
}) {
  const [emails, setEmails] = useState<string[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const handleAdd = () => {
    // Basic validation, just checking for an '@' for this UI demo
    if (inputVal && inputVal.includes("@") && !emails.includes(inputVal)) {
      setEmails([...emails, inputVal.trim()]);
      setInputVal("");
      setIsExpanded(true); // Auto-expand when a new email is added
    }
  };

  const handleRemove = (emailToRemove: string) => {
    setEmails(emails.filter(email => email !== emailToRemove));
  };

  return (
    <div className="rounded-xl border border-border p-4 transition-colors bg-card hover:border-muted-foreground/30">
      <div className="flex items-start gap-3 mb-4">
        <div className={`p-2 rounded-lg bg-secondary/50 ${colorClass}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 space-y-1">
          <Label className="text-sm font-semibold text-foreground tracking-wide">{title}</Label>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <Input 
          placeholder="example@domain.com" 
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          className="h-9 text-xs bg-secondary/30 placeholder:text-muted-foreground/50"
        />
        <Button size="sm" onClick={handleAdd} className="h-9 px-4 text-xs font-semibold">
          Add
        </Button>
      </div>

      {emails.length > 0 && (
        <div className="mt-3 pt-1 border-t border-border/50">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {emails.length} stored {emails.length === 1 ? 'address' : 'addresses'}
          </button>

          {isExpanded && (
            <div className="mt-2 space-y-2 animate-in slide-in-from-top-1 duration-200">
              {emails.map(email => (
                <div key={email} className="flex items-center justify-between bg-secondary/40 border border-border/80 rounded-md px-3 py-2 shadow-sm group hover:bg-secondary/60 transition-colors">
                  <span className="text-xs font-medium text-foreground truncate mr-2">{email}</span>
                  <button 
                    onClick={() => handleRemove(email)}
                    className="text-muted-foreground opacity-50 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 rounded-sm transition-all shrink-0 p-1"
                    title="Remove address"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SettingsOverlay({ children }: { children: ReactNode }) {
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<string>("ok");
  const [dbError, setDbError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/auth/gmail/status`)
      .then(res => {
        if (!res.ok) throw new Error("Backend reachable but returned error");
        return res.json();
      })
      .then(data => {
        setIsOffline(false);
        setDbStatus(data.database_status);
        setDbError(data.database_error);
        if (data.connected) {
          setConnectedEmail(data.email);
        } else {
          setConnectedEmail(null);
        }
      })
      .catch(err => {
        console.error("Connection failed:", err);
        setIsOffline(true);
        setConnectedEmail(null);
      });
  }, []);

  const handleDisconnect = async () => {
    try {
      await fetch(`${API_BASE}/auth/gmail/disconnect`, { method: "POST" });
      setConnectedEmail(null);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col gap-6 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-2xl flex items-center gap-2">
            <Settings2 className="w-6 h-6" />
            System Preferences
          </SheetTitle>
          <SheetDescription>
            Configure your AI orchestration settings. (UI Only - Not connected to backend yet)
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-8 py-2">
          {/* SYSTEM ALERTS */}
          {isOffline && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 animate-in fade-in duration-300">
              <div className="flex items-center gap-3">
                <ShieldOff className="w-5 h-5 text-destructive" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-destructive">Backend Offline</p>
                  <p className="text-xs text-destructive/80 leading-relaxed">
                    The frontend cannot reach your API at <code className="bg-destructive/10 px-1 rounded">{API_BASE}</code>.
                    Please check your Vercel environment variables or ensure the backend is running.
                  </p>
                </div>
              </div>
            </div>
          )}

          {dbStatus === "error" && !isOffline && (
            <div className="rounded-lg border border-orange-500/50 bg-orange-500/10 p-4">
              <div className="flex items-center gap-3">
                <ShieldOff className="w-5 h-5 text-orange-600" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-orange-600">Database Connection Error</p>
                  <p className="text-xs text-orange-600/80 leading-relaxed font-mono">
                    {dbError || "Unable to reach Supabase. Check your URL/KEY keys."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 1: Email UI */}
          <section className="space-y-4">
            <div className="space-y-1 text-center">
              <h3 className="text-sm font-semibold tracking-wide text-foreground uppercase border-b border-border pb-2 mb-4">
                Active Account
              </h3>
            </div>
            
            {connectedEmail ? (
              // CONNECTED STATE
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{connectedEmail}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 mt-1">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">Active Sync</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-3 border-t border-border/50">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 text-xs h-8 bg-secondary/30 hover:bg-secondary/50"
                    onClick={() => {
                      window.location.href = `${API_BASE}/auth/gmail`;
                    }}
                  >
                    <RefreshCcw className="w-3.5 h-3.5 mr-2" />
                    Swap Account
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="text-xs h-8 opacity-90"
                    onClick={handleDisconnect}
                  >
                    <LogOut className="w-3.5 h-3.5 mr-2" />
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              // DISCONNECTED STATE
              <div className="rounded-xl border border-border border-dashed bg-card/50 p-6 flex flex-col items-center text-center">
                <div className="p-3 bg-secondary rounded-full mb-3">
                  <Mail className="w-6 h-6 text-muted-foreground" />
                </div>
                <h4 className="font-semibold text-foreground mb-1">No Account Connected</h4>
                <p className="text-xs text-muted-foreground mb-5 px-4">
                  Connect your Gmail account using Google OAuth to allow the AI to orchestrate your tasks and automatically poll for new emails.
                </p>
                <Button 
                  className="w-full bg-primary text-primary-foreground hover:opacity-90 font-semibold"
                  onClick={() => {
                    window.location.href = `${API_BASE}/auth/gmail`;
                  }}
                >
                  <img src="https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg" alt="Google" className="w-4 h-4 mr-2" />
                  Connect with Google
                </Button>
              </div>
            )}
          </section>

          {/* SECTION 2: Filter Rules */}
          <section className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold tracking-wide text-foreground uppercase border-b border-border pb-2 mb-4">
                Routing Rules
              </h3>
            </div>
            
            <div className="flex flex-col gap-4">
              <FilterSection 
                title="Spammer Rules"
                description="Ignore incoming emails completely and automatically route to the spam vault."
                icon={ShieldOff}
                colorClass="text-orange-500"
              />
              
              <FilterSection 
                title="Always Automate"
                description="Create background tasks and draft auto-responses without manual intervention."
                icon={Bot}
                colorClass="text-destructive"
              />

              <FilterSection 
                title="Never Automate"
                description="Flag as strictly human tasks. No AI automation or parsing will be applied."
                icon={User}
                colorClass="text-primary"
              />
            </div>
          </section>

          {/* DIAGNOSTIC FOOTER */}
          <section className="mt-auto pt-8 border-t border-border/50 opacity-40 hover:opacity-100 transition-opacity">
            <p className="text-[10px] font-mono text-muted-foreground mb-1 uppercase tracking-widest text-center">System Diagnostics</p>
            <div className="flex flex-col gap-1 text-[10px] font-mono text-muted-foreground bg-secondary/20 p-2 rounded">
              <div className="flex justify-between">
                <span>API Endpoint:</span>
                <span className="text-foreground truncate ml-4" title={API_BASE}>{API_BASE}</span>
              </div>
              <div className="flex justify-between">
                <span>Database:</span>
                <span className={dbStatus === "ok" ? "text-emerald-500" : "text-destructive"}>{dbStatus.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span>Environment:</span>
                <span>{process.env.VERCEL ? "Vercel" : "Development"}</span>
              </div>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
