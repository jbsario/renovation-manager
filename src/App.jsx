import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Plus, X, Hammer, Zap, Droplets, Paintbrush, LayoutGrid, Wrench, HardHat,
  AlertTriangle, CheckCircle2, Loader2, Camera, Circle, CircleDot, Image as ImageIcon,
  Home, Building2, Users, DollarSign, Package, CalendarDays, ListChecks, Images,
  ChevronLeft, ChevronRight, Pencil, Trash2, FolderKanban, Sparkles, LogOut,
} from "lucide-react";

// ---------------- constants ----------------

const AREAS = [
  "Demolition","Excavation","Foundation","Structural Works","Masonry","Roofing",
  "Electrical","Plumbing","Ceiling","Flooring","Tile Works","Painting",
  "Doors & Windows","Cabinets","Glass Installation","Exterior Works",
  "Fence & Gate","Landscaping","Final Cleaning",
];

const AREA_ICONS = {
  Demolition: HardHat, Excavation: HardHat, Foundation: Building2, "Structural Works": Building2,
  Masonry: Building2, Roofing: Home, Electrical: Zap, Plumbing: Droplets, Ceiling: LayoutGrid,
  Flooring: LayoutGrid, "Tile Works": LayoutGrid, Painting: Paintbrush, "Doors & Windows": Home,
  Cabinets: Wrench, "Glass Installation": Home, "Exterior Works": Home, "Fence & Gate": Home,
  Landscaping: Home, "Final Cleaning": Sparkles,
};

const SCOPE_STATUS = {
  pending: { label: "Pending", color: "#94A3B8", bg: "#F1F5F9", icon: Circle },
  "in-progress": { label: "In progress", color: "#FF6B4A", bg: "#FFF0EB", icon: CircleDot },
  done: { label: "Done", color: "#10B981", bg: "#E7F8F1", icon: CheckCircle2 },
};

const DAILY_STATUS = {
  "on-track": { label: "On track", color: "#10B981", bg: "#E7F8F1" },
  delay: { label: "Delay", color: "#FF6B4A", bg: "#FFF0EB" },
  issue: { label: "Issue", color: "#FFFFFF", bg: "#F43F5E" },
};

const PUNCH_PRIORITY = {
  low: { label: "Low", color: "#94A3B8" },
  medium: { label: "Medium", color: "#FF6B4A" },
  high: { label: "High", color: "#F43F5E" },
};

const PROJECT_STATUS = ["Planning", "Ongoing", "Delayed", "On Hold", "Completed"];
const PHOTO_TAGS = ["before", "during", "after"];

const INDEX_KEY = "project_index";
const projectKey = (id) => `project:${id}`;

const WORKSPACE_TABS = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "info", label: "Info", icon: FolderKanban },
  { id: "daily", label: "Daily Updates", icon: CalendarDays },
  { id: "progress", label: "Progress", icon: ListChecks },
  { id: "scope", label: "Scope of Works", icon: Wrench },
  { id: "timeline", label: "Timeline", icon: CalendarDays },
  { id: "budget", label: "Budget", icon: DollarSign },
  { id: "materials", label: "Materials", icon: Package },
  { id: "punch", label: "Punch List", icon: AlertTriangle },
  { id: "photos", label: "Photos", icon: Images },
];

// ---------------- helpers ----------------

function uid() { return Math.random().toString(36).slice(2, 10); }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtShort(iso) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function daysBetween(a, b) {
  return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
}
function money(n) {
  const v = Number(n) || 0;
  return v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fileToCompressedDataUrl(file, maxDim = 900, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function newProject(name) {
  return {
    id: uid(),
    name: name || "New Renovation Project",
    address: "",
    homeowner: "",
    contractor: "",
    description: "",
    startDate: todayISO(),
    expectedCompletion: "",
    actualCompletion: "",
    status: "Planning",
    areas: AREAS.map((a) => ({ id: a, name: a, progress: 0, start: "", end: "" })),
    scopeItems: [],
    dailyUpdates: [],
    budget: { estimated: 0, labor: 0, materials: 0, equipment: 0, misc: 0, changeOrders: [] },
    materials: [],
    punchList: [],
    photos: [],
    updatedAt: Date.now(),
  };
}

// ---------------- small UI atoms ----------------

function Field({ label, children }) {
  return (
    <label className="text-xs font-mono text-[#475569] block">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
const inputCls = "w-full border border-[#E6E8EC] bg-white text-[#171A21] px-2 py-1.5 font-body text-sm";

function Badge({ color, bg, children }) {
  return (
    <span className="font-cond font-semibold text-xs tracking-wide px-2 py-0.5 rounded-sm" style={{ color, backgroundColor: bg }}>
      {children}
    </span>
  );
}

function EmptyState({ children }) {
  return <div className="border border-dashed border-[#E6E8EC] p-7 text-center font-cond text-base text-[#94A3B8]">{children}</div>;
}

function SectionHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="flex items-center gap-2 font-cond uppercase tracking-[0.18em] text-sm text-[#475569]">
        <span className="w-3 h-px bg-[#FF6B4A] inline-block" /> {title}
      </h2>
      {action}
    </div>
  );
}

function AddButton({ open, onClick, label = "Add" }) {
  return (
    <button onClick={onClick} className="btn-primary flex items-center gap-1 font-cond text-sm font-semibold tracking-wide bg-[#FF6B4A] text-white px-3.5 py-1.5 rounded-lg">
      {open ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
      {open ? "Cancel" : label}
    </button>
  );
}

// ================================================================
// MAIN APP
// ================================================================

export default function RenovationManager({ user, onSignOut }) {
  const [projects, setProjects] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("projects"); // 'projects' | 'workspace'
  const [tab, setTab] = useState("dashboard");
  const [saveState, setSaveState] = useState("idle");
  const [newProjName, setNewProjName] = useState("");
  const [showNewProj, setShowNewProj] = useState(false);
  const dirtyIds = useRef(new Set());

  // ---- load everything on mount ----
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const idxRes = await window.storage.get(INDEX_KEY, false);
        const idx = idxRes && idxRes.value ? JSON.parse(idxRes.value) : [];
        if (idx.length === 0) {
          const p = newProject("House Renovation");
          if (!cancelled) {
            setProjects([p]);
            setActiveId(p.id);
          }
          await window.storage.set(INDEX_KEY, JSON.stringify([{ id: p.id, name: p.name }]), false);
          await window.storage.set(projectKey(p.id), JSON.stringify(p), false);
        } else {
          const loadedProjects = [];
          for (const entry of idx) {
            try {
              const res = await window.storage.get(projectKey(entry.id), false);
              if (res && res.value) loadedProjects.push(JSON.parse(res.value));
            } catch (e) { /* skip missing */ }
          }
          if (!cancelled) {
            setProjects(loadedProjects);
            setActiveId(loadedProjects[0] ? loadedProjects[0].id : null);
          }
        }
      } catch (e) {
        const p = newProject("House Renovation");
        if (!cancelled) { setProjects([p]); setActiveId(p.id); }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const activeProject = useMemo(() => projects.find((p) => p.id === activeId) || null, [projects, activeId]);

  // ---- update helper: patches active project ----
  const updateProject = useCallback((id, updater) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...updater(p), updatedAt: Date.now() } : p)));
    dirtyIds.current.add(id);
  }, []);

  // ---- debounced save of dirty projects + index ----
  useEffect(() => {
    if (!loaded) return;
    if (dirtyIds.current.size === 0) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      const ids = Array.from(dirtyIds.current);
      dirtyIds.current.clear();
      try {
        for (const id of ids) {
          const proj = projects.find((p) => p.id === id);
          if (proj) await window.storage.set(projectKey(id), JSON.stringify(proj), false);
        }
        await window.storage.set(INDEX_KEY, JSON.stringify(projects.map((p) => ({ id: p.id, name: p.name }))), false);
        setSaveState("saved");
      } catch (e) {
        setSaveState("idle");
      }
    }, 500);
    return () => clearTimeout(t);
  }, [projects, loaded]);

  function createProject(e) {
    e && e.preventDefault();
    if (!newProjName.trim()) return;
    const p = newProject(newProjName.trim());
    setProjects((prev) => [...prev, p]);
    dirtyIds.current.add(p.id);
    setNewProjName("");
    setShowNewProj(false);
    setActiveId(p.id);
    setTab("dashboard");
    setView("workspace");
  }

  async function deleteProject(id) {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    dirtyIds.current.delete(id);
    if (activeId === id) setActiveId(null);
    try {
      await window.storage.delete(projectKey(id), false);
      const remaining = projects.filter((p) => p.id !== id).map((p) => ({ id: p.id, name: p.name }));
      await window.storage.set(INDEX_KEY, JSON.stringify(remaining), false);
    } catch (e) { /* ignore */ }
  }

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F5F8]">
        <Loader2 className="w-6 h-6 animate-spin text-[#FF6B4A]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F5F8] text-[#171A21]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .font-display { font-family: 'Space Grotesk', sans-serif; font-weight: 700; letter-spacing: -0.015em; }
        .font-display-italic { font-family: 'Space Grotesk', sans-serif; font-weight: 500; }
        .font-cond { font-family: 'Inter', sans-serif; letter-spacing: 0.01em; }
        .font-body { font-family: 'Inter', sans-serif; }
        .font-mono { font-family: 'IBM Plex Mono', monospace; }
        .blueprint-grid {
          background-image: radial-gradient(circle at 15% 20%, rgba(255,107,74,0.10), transparent 45%),
                             radial-gradient(circle at 85% 0%, rgba(16,185,129,0.08), transparent 40%);
        }
        .panel {
          background-color: #FFFFFF;
          border: 1px solid #E9EBF0;
          border-radius: 16px;
          box-shadow: 0 1px 2px rgba(23,26,33,0.04), 0 10px 24px -18px rgba(23,26,33,0.18);
        }
        .panel-tight { background-color: #FFFFFF; border: 1px solid #E9EBF0; border-radius: 12px; }
        .hairline { border-color: #E9EBF0; }
        .gold-rule { background: linear-gradient(90deg, transparent, #FF6B4A 15%, #FF8A6C 85%, transparent); height: 2px; opacity: 0.9; }
        .track { background-color: #EEF0F4; border-radius: 999px; overflow: hidden; }
        .fill-gold { background: linear-gradient(90deg, #FF6B4A, #FF8A6C); box-shadow: 0 0 8px 0 rgba(255,107,74,0.35); border-radius: 999px; }
        .btn-primary { transition: filter 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease; box-shadow: 0 6px 16px -8px rgba(255,107,74,0.55); }
        .btn-primary:hover { filter: brightness(1.05); }
        .btn-primary:active { transform: translateY(1px); }
        .lift { transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; }
        .lift:hover { transform: translateY(-3px); border-color: #FFD3C4; box-shadow: 0 20px 34px -20px rgba(23,26,33,0.28); }
        .thumb { transition: transform 0.25s ease, filter 0.25s ease; border-radius: 10px; }
        .thumb:hover { transform: scale(1.03); filter: brightness(1.03); }
        input, select, textarea, button { transition: border-color 0.15s ease, box-shadow 0.15s ease; border-radius: 8px; }
        input:focus, select:focus, textarea:focus { outline: none; border-color: #FF6B4A !important; box-shadow: 0 0 0 3px rgba(255,107,74,0.15); }
        ::selection { background: #FFDCCF; color: #171A21; }
        ::-webkit-scrollbar { height: 8px; width: 8px; }
        ::-webkit-scrollbar-thumb { background: #E2E5EA; border-radius: 999px; }
        ::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      {/* Top bar */}
      <div className="bg-[#14171F] relative">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <button onClick={() => setView("projects")} className="flex items-center gap-2 font-cond font-semibold text-sm tracking-[0.08em] uppercase text-[#F8FAFC] hover:text-[#FF8A6C] transition-colors">
            <FolderKanban className="w-4 h-4 text-[#FF6B4A]" /> All Projects
          </button>
          <div className="flex items-center gap-3">
            {activeProject && view === "workspace" && (
              <select
                value={activeId}
                onChange={(e) => { setActiveId(e.target.value); setTab("dashboard"); }}
                className="bg-[#1D212C] border border-[#2C3242] text-[#F8FAFC] text-sm font-cond px-2 py-1 rounded-md"
              >
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <span className="font-mono text-[10px] text-[#8891A5] flex items-center gap-1">
              {saveState === "saving" ? (<><Loader2 className="w-3 h-3 animate-spin text-[#FF6B4A]" /> syncing</>) : "synced"}
            </span>
            {user && (
              <div className="flex items-center gap-2 pl-3 border-l border-[#2C3242]">
                {user.picture && (
                  <img src={user.picture} alt="" referrerPolicy="no-referrer" className="w-6 h-6 rounded-full border border-[#2C3242]" />
                )}
                <span className="font-cond text-xs text-[#F8FAFC] hidden sm:inline max-w-[120px] truncate">{user.name || user.email}</span>
                <button
                  onClick={onSignOut}
                  className="text-[#8891A5] hover:text-[#FF8A6C] transition-colors"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="gold-rule" />
      </div>

      {view === "projects" && (
        <ProjectsView
          projects={projects}
          onOpen={(id) => { setActiveId(id); setView("workspace"); setTab("dashboard"); }}
          onDelete={deleteProject}
          showNewProj={showNewProj}
          setShowNewProj={setShowNewProj}
          newProjName={newProjName}
          setNewProjName={setNewProjName}
          onCreate={createProject}
        />
      )}

      {view === "workspace" && activeProject && (
        <Workspace
          project={activeProject}
          tab={tab}
          setTab={setTab}
          update={(fn) => updateProject(activeProject.id, fn)}
        />
      )}
    </div>
  );
}

// ================================================================
// PROJECTS LIST VIEW
// ================================================================

function ProjectsView({ projects, onOpen, onDelete, showNewProj, setShowNewProj, newProjName, setNewProjName, onCreate }) {
  return (
    <main className="max-w-5xl mx-auto px-5 py-8">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FF6B4A] mb-2">Renovation Management</div>
          <h1 className="font-display text-4xl sm:text-5xl text-[#171A21]">Your Projects</h1>
        </div>
        <AddButton open={showNewProj} onClick={() => setShowNewProj((s) => !s)} label="New project" />
      </div>

      {showNewProj && (
        <form onSubmit={onCreate} className="panel p-4 mb-6 flex gap-2">
          <input
            autoFocus
            value={newProjName}
            onChange={(e) => setNewProjName(e.target.value)}
            placeholder="e.g. Bacoor Duplex — Unit A"
            className={inputCls + " flex-1"}
          />
          <button type="submit" className="btn-primary bg-[#FF6B4A] text-white font-cond font-semibold text-sm px-5 tracking-wide">Create</button>
        </form>
      )}

      {projects.length === 0 ? (
        <EmptyState>No projects yet. Create one to get started.</EmptyState>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {projects.map((p) => {
            const avgProgress = p.areas.length ? Math.round(p.areas.reduce((a, x) => a + (Number(x.progress) || 0), 0) / p.areas.length) : 0;
            const daysLeft = p.expectedCompletion ? daysBetween(todayISO(), p.expectedCompletion) : null;
            const actual = (Number(p.budget.labor) || 0) + (Number(p.budget.materials) || 0) + (Number(p.budget.equipment) || 0) + (Number(p.budget.misc) || 0) + (p.budget.changeOrders || []).reduce((a, c) => a + (Number(c.amount) || 0), 0);
            return (
              <div key={p.id} className="panel lift p-4 relative group">
                <button
                  onClick={() => onDelete(p.id)}
                  className="absolute top-3 right-3 text-[#94A3B8] hover:text-[#FF6B4A]"
                  aria-label="Delete project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={() => onOpen(p.id)} className="text-left w-full">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B4A] inline-block" /> {p.status}
                  </div>
                  <h3 className="font-display text-2xl mb-1.5 pr-6 text-[#171A21]">{p.name}</h3>
                  <p className="font-body text-xs text-[#94A3B8] mb-4 truncate">{p.address || "No address set"}</p>
                  <div className="h-2 track mb-2">
                    <div className="h-full fill-gold" style={{ width: `${avgProgress}%` }} />
                  </div>
                  <div className="flex justify-between font-mono text-[11px] text-[#475569]">
                    <span>{avgProgress}% complete</span>
                    <span>{daysLeft !== null ? `${daysLeft} days left` : "no due date"}</span>
                    <span>₱{money(actual)} spent</span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

// ================================================================
// WORKSPACE (single project) — tabs
// ================================================================

function Workspace({ project, tab, setTab, update }) {
  const avgProgress = project.areas.length ? Math.round(project.areas.reduce((a, x) => a + (Number(x.progress) || 0), 0) / project.areas.length) : 0;
  const daysLeft = project.expectedCompletion ? daysBetween(todayISO(), project.expectedCompletion) : null;

  return (
    <div>
      <header className="blueprint-grid">
        <div className="max-w-5xl mx-auto px-5 pt-8 pb-5">
          <h1 className="font-display text-3xl sm:text-4xl mb-3 text-[#171A21]">{project.name}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-cond text-base">
            <span className="flex items-baseline gap-1.5">
              <span className="font-mono text-[10px] tracking-widest text-[#94A3B8]">PROGRESS</span>
              <b className="text-[#FF6B4A] text-lg">{avgProgress}%</b>
            </span>
            <span className="w-px h-3.5 bg-[#E6E8EC]" />
            <span className="flex items-baseline gap-1.5">
              <span className="font-mono text-[10px] tracking-widest text-[#94A3B8]">STATUS</span>
              <b className="text-[#171A21]">{project.status}</b>
            </span>
            {daysLeft !== null && (
              <>
                <span className="w-px h-3.5 bg-[#E6E8EC]" />
                <span className="flex items-baseline gap-1.5">
                  <span className="font-mono text-[10px] tracking-widest text-[#94A3B8]">DAYS LEFT</span>
                  <b className="text-[#171A21]">{daysLeft}</b>
                </span>
              </>
            )}
          </div>
          <nav className="flex gap-5 mt-6 overflow-x-auto border-b border-[#E9EBF0]">
            {WORKSPACE_TABS.map((t) => {
              const Icon = t.icon;
              const activeTab = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="flex items-center gap-1.5 pb-3 font-cond font-semibold text-sm whitespace-nowrap shrink-0 relative transition-colors"
                  style={{ color: activeTab ? "#171A21" : "#94A3B8" }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: activeTab ? "#FF6B4A" : "#94A3B8" }} /> {t.label}
                  {activeTab && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#FF6B4A]" />}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-8">
        {tab === "dashboard" && <DashboardTab project={project} avgProgress={avgProgress} daysLeft={daysLeft} setTab={setTab} />}
        {tab === "info" && <InfoTab project={project} update={update} />}
        {tab === "daily" && <DailyTab project={project} update={update} />}
        {tab === "progress" && <ProgressTab project={project} update={update} />}
        {tab === "scope" && <ScopeTab project={project} update={update} />}
        {tab === "timeline" && <TimelineTab project={project} />}
        {tab === "budget" && <BudgetTab project={project} update={update} />}
        {tab === "materials" && <MaterialsTab project={project} update={update} />}
        {tab === "punch" && <PunchTab project={project} update={update} />}
        {tab === "photos" && <PhotosTab project={project} update={update} />}
      </main>
    </div>
  );
}

// ---------------- DASHBOARD ----------------

function DashboardTab({ project, avgProgress, daysLeft, setTab }) {
  const actual = (Number(project.budget.labor) || 0) + (Number(project.budget.materials) || 0) + (Number(project.budget.equipment) || 0) + (Number(project.budget.misc) || 0) + (project.budget.changeOrders || []).reduce((a, c) => a + (Number(c.amount) || 0), 0);
  const remaining = (Number(project.budget.estimated) || 0) - actual;
  const recentUpdates = [...project.dailyUpdates].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const upcoming = project.scopeItems
    .filter((s) => s.status !== "done" && s.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);
  const latestPhotos = [...project.photos].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  return (
    <div className="space-y-8">
      <div className="grid sm:grid-cols-4 gap-3">
        <StatCard label="Overall Progress" value={`${avgProgress}%`} />
        <StatCard label="Status" value={project.status} />
        <StatCard label="Days Remaining" value={daysLeft !== null ? daysLeft : "—"} />
        <StatCard label="Budget Remaining" value={`₱${money(remaining)}`} tone={remaining < 0 ? "#FF6B4A" : "#171A21"} />
      </div>

      <section>
        <SectionHeader title="Budget Summary" />
        <div className="grid grid-cols-3 gap-3 font-cond text-center">
          <MiniStat label="Estimated" value={`₱${money(project.budget.estimated)}`} />
          <MiniStat label="Actual" value={`₱${money(actual)}`} />
          <MiniStat label="Remaining" value={`₱${money(remaining)}`} tone={remaining < 0 ? "#FF6B4A" : "#171A21"} />
        </div>
      </section>

      <div className="grid sm:grid-cols-2 gap-8">
        <section>
          <SectionHeader title="Upcoming Tasks" />
          {upcoming.length === 0 ? <EmptyState>Nothing due soon.</EmptyState> : (
            <ul className="panel divide-y divide-[#E6E8EC]">
              {upcoming.map((s) => (
                <li key={s.id} className="px-3 py-2 flex justify-between items-center">
                  <span className="font-body text-sm truncate pr-2">{s.description}</span>
                  <span className="font-mono text-[10px] text-[#94A3B8] shrink-0">{fmtShort(s.dueDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionHeader title="Recent Activity" />
          {recentUpdates.length === 0 ? <EmptyState>No daily updates logged yet.</EmptyState> : (
            <ul className="panel divide-y divide-[#E6E8EC]">
              {recentUpdates.map((u) => (
                <li key={u.id} className="px-3 py-2">
                  <div className="font-mono text-[10px] text-[#94A3B8]">{fmtShort(u.date)}</div>
                  <p className="font-body text-sm truncate">{u.completedTasks || u.remarks || "Update logged"}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section>
        <SectionHeader title="Latest Photos" action={<button onClick={() => setTab("photos")} className="font-mono text-[10px] text-[#FF6B4A] underline">view gallery</button>} />
        {latestPhotos.length === 0 ? <EmptyState>No photos uploaded yet.</EmptyState> : (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {latestPhotos.map((ph) => (
              <img key={ph.id} src={ph.dataUrl} alt={ph.caption || "Progress photo"} className="w-full h-20 object-cover border hairline thumb" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, tone }) {
  return (
    <div className="panel p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#94A3B8] mb-1.5">{label}</div>
      <div className="font-display text-2xl" style={{ color: tone || "#171A21" }}>{value}</div>
    </div>
  );
}
function MiniStat({ label, value, tone }) {
  return (
    <div className="panel py-4 text-center">
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#94A3B8] mb-1">{label}</div>
      <div className="font-display text-xl" style={{ color: tone || "#171A21" }}>{value}</div>
    </div>
  );
}

// ---------------- INFO ----------------

function InfoTab({ project, update }) {
  const set = (field) => (e) => update((p) => ({ ...p, [field]: e.target.value }));
  return (
    <section className="max-w-xl space-y-4">
      <SectionHeader title="Project Information" />
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Project Name"><input className={inputCls} value={project.name} onChange={set("name")} /></Field>
        <Field label="Status">
          <select className={inputCls} value={project.status} onChange={set("status")}>
            {PROJECT_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Property Address"><input className={inputCls} value={project.address} onChange={set("address")} /></Field>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Homeowner"><input className={inputCls} value={project.homeowner} onChange={set("homeowner")} /></Field>
        <Field label="Contractor"><input className={inputCls} value={project.contractor} onChange={set("contractor")} /></Field>
      </div>
      <Field label="Description">
        <textarea rows={3} className={inputCls + " resize-none"} value={project.description} onChange={set("description")} />
      </Field>
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Start Date"><input type="date" className={inputCls} value={project.startDate} onChange={set("startDate")} /></Field>
        <Field label="Expected Completion"><input type="date" className={inputCls} value={project.expectedCompletion} onChange={set("expectedCompletion")} /></Field>
        <Field label="Actual Completion"><input type="date" className={inputCls} value={project.actualCompletion} onChange={set("actualCompletion")} /></Field>
      </div>
    </section>
  );
}

// ---------------- DAILY UPDATES ----------------

function DailyTab({ project, update }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const blank = {
    date: todayISO(), weather: "", workersPresent: "", hoursWorked: "",
    completedTasks: "", ongoingWork: "", plannedTomorrow: "", materialsDelivered: "",
    equipmentUsed: "", issues: "", safety: "", remarks: "", status: "on-track", photos: [],
  };
  const [form, setForm] = useState(blank);

  async function handlePhotos(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setBusy(true);
    try {
      const urls = await Promise.all(files.map((f) => fileToCompressedDataUrl(f)));
      setForm((f) => ({ ...f, photos: [...f.photos, ...urls] }));
    } finally { setBusy(false); }
  }

  function submit(e) {
    e.preventDefault();
    update((p) => ({ ...p, dailyUpdates: [{ id: uid(), ...form }, ...p.dailyUpdates] }));
    setForm(blank);
    if (fileRef.current) fileRef.current.value = "";
    setShow(false);
  }
  function remove(id) {
    update((p) => ({ ...p, dailyUpdates: p.dailyUpdates.filter((u) => u.id !== id) }));
  }

  const sorted = [...project.dailyUpdates].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section>
      <SectionHeader title="Daily Updates" action={<AddButton open={show} onClick={() => setShow((s) => !s)} label="Add update" />} />

      {show && (
        <form onSubmit={submit} className="panel p-4 mb-5 space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Date"><input type="date" required className={inputCls} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></Field>
            <Field label="Weather"><input className={inputCls} placeholder="Sunny / Rain / Overcast" value={form.weather} onChange={(e) => setForm((f) => ({ ...f, weather: e.target.value }))} /></Field>
            <Field label="Status">
              <div className="flex gap-1">
                {Object.entries(DAILY_STATUS).map(([k, m]) => (
                  <button type="button" key={k} onClick={() => setForm((f) => ({ ...f, status: k }))}
                    className="px-2 py-1.5 text-xs font-cond font-semibold border flex-1"
                    style={{ borderColor: m.color, color: form.status === k ? "#fff" : m.color, backgroundColor: form.status === k ? m.color : "transparent" }}>
                    {m.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Workers Present"><input type="number" className={inputCls} value={form.workersPresent} onChange={(e) => setForm((f) => ({ ...f, workersPresent: e.target.value }))} /></Field>
            <Field label="Hours Worked"><input type="number" className={inputCls} value={form.hoursWorked} onChange={(e) => setForm((f) => ({ ...f, hoursWorked: e.target.value }))} /></Field>
          </div>
          <Field label="Completed Tasks"><textarea rows={2} className={inputCls + " resize-none"} value={form.completedTasks} onChange={(e) => setForm((f) => ({ ...f, completedTasks: e.target.value }))} /></Field>
          <Field label="Ongoing Work"><textarea rows={2} className={inputCls + " resize-none"} value={form.ongoingWork} onChange={(e) => setForm((f) => ({ ...f, ongoingWork: e.target.value }))} /></Field>
          <Field label="Planned Work for Tomorrow"><textarea rows={2} className={inputCls + " resize-none"} value={form.plannedTomorrow} onChange={(e) => setForm((f) => ({ ...f, plannedTomorrow: e.target.value }))} /></Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Materials Delivered"><input className={inputCls} value={form.materialsDelivered} onChange={(e) => setForm((f) => ({ ...f, materialsDelivered: e.target.value }))} /></Field>
            <Field label="Equipment Used"><input className={inputCls} value={form.equipmentUsed} onChange={(e) => setForm((f) => ({ ...f, equipmentUsed: e.target.value }))} /></Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Issues Encountered"><textarea rows={2} className={inputCls + " resize-none"} value={form.issues} onChange={(e) => setForm((f) => ({ ...f, issues: e.target.value }))} /></Field>
            <Field label="Safety Observations"><textarea rows={2} className={inputCls + " resize-none"} value={form.safety} onChange={(e) => setForm((f) => ({ ...f, safety: e.target.value }))} /></Field>
          </div>
          <Field label="Remarks"><textarea rows={2} className={inputCls + " resize-none"} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} /></Field>

          <div>
            <span className="text-xs font-mono text-[#475569] block mb-1">Photos</span>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.photos.map((ph, i) => (
                <div key={i} className="relative">
                  <img src={ph} alt="" className="h-16 w-16 object-cover border hairline thumb" />
                  <button type="button" onClick={() => setForm((f) => ({ ...f, photos: f.photos.filter((_, idx) => idx !== i) }))}
                    className="absolute -top-1.5 -right-1.5 bg-[#171A21] text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
            <label className="flex items-center gap-2 border border-dashed border-[#94A3B8] px-3 py-2 cursor-pointer font-cond text-sm text-[#475569] w-fit">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              {busy ? "Processing…" : "Attach photos"}
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotos} />
            </label>
          </div>

          <button type="submit" className="btn-primary w-full bg-[#FF6B4A] text-white font-cond font-semibold text-sm tracking-wide py-2.5">Save daily update</button>
        </form>
      )}

      {sorted.length === 0 ? <EmptyState>No daily updates logged yet.</EmptyState> : (
        <ol className="relative border-l-2 border-[#FFD9CC] ml-2 space-y-5">
          {sorted.map((u) => {
            const meta = DAILY_STATUS[u.status] || DAILY_STATUS["on-track"];
            return (
              <li key={u.id} className="ml-5 relative">
                <span className="absolute -left-[27px] top-1 w-3 h-3 border-2 border-[#171A21]" style={{ backgroundColor: meta.color }} />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-mono text-[11px] text-[#475569] mb-1 flex-wrap">
                      <span>{fmtDate(u.date)}</span>
                      {u.weather && <><span>·</span><span>{u.weather}</span></>}
                      {u.workersPresent && <><span>·</span><span>{u.workersPresent} workers</span></>}
                      <Badge color={meta.color} bg={meta.bg}>{meta.label}</Badge>
                    </div>
                    {u.completedTasks && <p className="font-body text-sm"><b>Completed:</b> {u.completedTasks}</p>}
                    {u.ongoingWork && <p className="font-body text-sm"><b>Ongoing:</b> {u.ongoingWork}</p>}
                    {u.issues && <p className="font-body text-sm text-[#FF6B4A]"><b>Issues:</b> {u.issues}</p>}
                    {u.remarks && <p className="font-body text-sm text-[#475569]">{u.remarks}</p>}
                    {u.photos && u.photos.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {u.photos.map((ph, i) => <img key={i} src={ph} alt="" className="h-16 w-16 object-cover border hairline thumb" />)}
                      </div>
                    )}
                  </div>
                  <button onClick={() => remove(u.id)} className="text-[#94A3B8] hover:text-[#FF6B4A] shrink-0"><X className="w-4 h-4" /></button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// ---------------- PROGRESS BY AREA ----------------

function ProgressTab({ project, update }) {
  function setArea(id, field, value) {
    update((p) => ({ ...p, areas: p.areas.map((a) => (a.id === id ? { ...a, [field]: value } : a)) }));
  }
  return (
    <section>
      <SectionHeader title="Progress by Area" />
      <div className="grid sm:grid-cols-2 gap-3">
        {project.areas.map((a) => {
          const Icon = AREA_ICONS[a.name] || Wrench;
          return (
            <div key={a.id} className="panel p-3">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-[#FF6B4A]" />
                <span className="font-cond font-semibold text-base">{a.name}</span>
                {a.progress >= 100 && <CheckCircle2 className="w-4 h-4 text-[#10B981] ml-auto" />}
              </div>
              <div className="h-2 track mb-2">
                <div className="h-full fill-gold" style={{ width: `${a.progress}%` }} />
              </div>
              <div className="flex items-center justify-between font-mono text-[11px] text-[#475569] mb-2">
                <input type="range" min="0" max="100" value={a.progress} onChange={(e) => setArea(a.id, "progress", Number(e.target.value))} className="w-24 accent-[#FF6B4A]" />
                <span>{a.progress}%</span>
              </div>
              <div className="flex gap-2 font-mono text-[10px] text-[#94A3B8]">
                <input type="date" value={a.start} onChange={(e) => setArea(a.id, "start", e.target.value)} className="bg-transparent border-b border-[#E6E8EC] outline-none w-full" />
                <input type="date" value={a.end} onChange={(e) => setArea(a.id, "end", e.target.value)} className="bg-transparent border-b border-[#E6E8EC] outline-none w-full" />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------- SCOPE OF WORKS ----------------

function ScopeTab({ project, update }) {
  const [show, setShow] = useState(false);
  const blank = { areaName: AREAS[0], description: "", assignedTo: "", startDate: "", dueDate: "", completionDate: "", status: "pending", progress: 0, remarks: "" };
  const [form, setForm] = useState(blank);

  function submit(e) {
    e.preventDefault();
    if (!form.description.trim()) return;
    update((p) => ({ ...p, scopeItems: [...p.scopeItems, { id: uid(), ...form }] }));
    setForm(blank);
    setShow(false);
  }
  function remove(id) { update((p) => ({ ...p, scopeItems: p.scopeItems.filter((s) => s.id !== id) })); }
  function cycle(id) {
    const order = ["pending", "in-progress", "done"];
    update((p) => ({ ...p, scopeItems: p.scopeItems.map((s) => s.id === id ? { ...s, status: order[(order.indexOf(s.status) + 1) % order.length], progress: order[(order.indexOf(s.status) + 1) % order.length] === "done" ? 100 : s.progress } : s) }));
  }

  const byArea = AREAS.map((a) => ({ area: a, items: project.scopeItems.filter((s) => s.areaName === a) })).filter((g) => g.items.length > 0);

  return (
    <section>
      <SectionHeader title="Scope of Works" action={<AddButton open={show} onClick={() => setShow((s) => !s)} label="Add item" />} />

      {show && (
        <form onSubmit={submit} className="panel p-4 mb-5 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Area">
              <select className={inputCls} value={form.areaName} onChange={(e) => setForm((f) => ({ ...f, areaName: e.target.value }))}>
                {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Assigned Worker / Contractor"><input className={inputCls} value={form.assignedTo} onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))} /></Field>
          </div>
          <Field label="Description"><input required className={inputCls} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Start Date"><input type="date" className={inputCls} value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} /></Field>
            <Field label="Due Date"><input type="date" className={inputCls} value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></Field>
            <Field label="Completion Date"><input type="date" className={inputCls} value={form.completionDate} onChange={(e) => setForm((f) => ({ ...f, completionDate: e.target.value }))} /></Field>
          </div>
          <Field label="Remarks"><input className={inputCls} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} /></Field>
          <button type="submit" className="btn-primary w-full bg-[#FF6B4A] text-white font-cond font-semibold text-sm tracking-wide py-2.5">Add to scope</button>
        </form>
      )}

      {byArea.length === 0 ? <EmptyState>No scope items yet. Break the project into tasks per area above.</EmptyState> : (
        <div className="space-y-4">
          {byArea.map(({ area, items }) => {
            const Icon = AREA_ICONS[area] || Wrench;
            return (
              <div key={area}>
                <div className="flex items-center gap-2 font-cond font-semibold text-sm text-[#FF6B4A] mb-1.5"><Icon className="w-3.5 h-3.5" />{area}</div>
                <ul className="divide-y divide-[#E6E8EC] panel">
                  {items.map((item) => {
                    const meta = SCOPE_STATUS[item.status];
                    const StatusIcon = meta.icon;
                    return (
                      <li key={item.id} className="flex items-start gap-3 px-3 py-2">
                        <button onClick={() => cycle(item.id)} className="shrink-0 mt-0.5" aria-label="Cycle status"><StatusIcon className="w-4 h-4" style={{ color: meta.color }} /></button>
                        <div className="flex-1 min-w-0">
                          <p className="font-body text-sm" style={{ textDecoration: item.status === "done" ? "line-through" : "none", opacity: item.status === "done" ? 0.6 : 1 }}>{item.description}</p>
                          <p className="font-mono text-[10px] text-[#94A3B8]">
                            {item.assignedTo && `${item.assignedTo} · `}
                            {item.dueDate && `due ${fmtShort(item.dueDate)}`}
                          </p>
                        </div>
                        <Badge color={meta.color} bg={meta.bg}>{meta.label}</Badge>
                        <button onClick={() => remove(item.id)} className="text-[#94A3B8] hover:text-[#FF6B4A] shrink-0"><X className="w-4 h-4" /></button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------- TIMELINE (Gantt) ----------------

function TimelineTab({ project }) {
  const dated = project.areas.filter((a) => a.start && a.end);
  const range = useMemo(() => {
    if (dated.length === 0) return null;
    const starts = dated.map((a) => a.start).sort();
    const ends = dated.map((a) => a.end).sort();
    const rangeStart = starts[0], rangeEnd = ends[ends.length - 1];
    return { rangeStart, rangeEnd, totalDays: Math.max(daysBetween(rangeStart, rangeEnd), 1) };
  }, [dated]);

  const delayed = project.scopeItems.filter((s) => s.status !== "done" && s.dueDate && s.dueDate < todayISO());
  const upcoming = project.scopeItems.filter((s) => s.status !== "done" && s.dueDate && s.dueDate >= todayISO()).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6);

  return (
    <div className="space-y-8">
      <section>
        <SectionHeader title="Gantt Timeline" />
        {!range ? <EmptyState>Set start/end dates on areas (Progress tab) to plot the timeline.</EmptyState> : (
          <div className="panel p-4 overflow-x-auto">
            <div className="flex justify-between font-mono text-[10px] text-[#94A3B8] mb-2 min-w-[600px]">
              <span>{fmtShort(range.rangeStart)}</span><span>{fmtShort(range.rangeEnd)}</span>
            </div>
            <div className="space-y-1.5 min-w-[600px]">
              {project.areas.map((a) => {
                const Icon = AREA_ICONS[a.name] || Wrench;
                if (!a.start || !a.end) return null;
                const left = (daysBetween(range.rangeStart, a.start) / range.totalDays) * 100;
                const width = Math.max((daysBetween(a.start, a.end) / range.totalDays) * 100, 1.5);
                const color = a.progress >= 100 ? "#FF6B4A" : "#94A3B8";
                return (
                  <div key={a.id} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 w-28 shrink-0"><Icon className="w-3.5 h-3.5 text-[#FF6B4A]" /><span className="font-cond text-sm font-semibold truncate">{a.name}</span></div>
                    <div className="relative flex-1 h-4 track">
                      <div className="absolute top-0 bottom-0 border hairline" style={{ left: `${left}%`, width: `${width}%`, backgroundColor: color, opacity: 0.85 }} title={`${fmtShort(a.start)} – ${fmtShort(a.end)}`} />
                    </div>
                    <span className="font-mono text-[10px] text-[#94A3B8] w-8 text-right shrink-0">{a.progress}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <div className="grid sm:grid-cols-2 gap-8">
        <section>
          <SectionHeader title="Delayed Tasks" />
          {delayed.length === 0 ? <EmptyState>Nothing overdue.</EmptyState> : (
            <ul className="border border-[#F43F5E] bg-[#FEF0F1] divide-y divide-[#F43F5E]/20">
              {delayed.map((s) => (
                <li key={s.id} className="px-3 py-2 flex justify-between items-center">
                  <span className="font-body text-sm truncate pr-2">{s.description}</span>
                  <span className="font-mono text-[10px] text-[#FF6B4A] shrink-0">was due {fmtShort(s.dueDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <SectionHeader title="Upcoming Milestones" />
          {upcoming.length === 0 ? <EmptyState>Nothing scheduled.</EmptyState> : (
            <ul className="panel divide-y divide-[#E6E8EC]">
              {upcoming.map((s) => (
                <li key={s.id} className="px-3 py-2 flex justify-between items-center">
                  <span className="font-body text-sm truncate pr-2">{s.description}</span>
                  <span className="font-mono text-[10px] text-[#94A3B8] shrink-0">{fmtShort(s.dueDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

// ---------------- BUDGET ----------------

function BudgetTab({ project, update }) {
  const b = project.budget;
  const set = (field) => (e) => update((p) => ({ ...p, budget: { ...p.budget, [field]: e.target.value } }));
  const actual = (Number(b.labor) || 0) + (Number(b.materials) || 0) + (Number(b.equipment) || 0) + (Number(b.misc) || 0) + (b.changeOrders || []).reduce((a, c) => a + (Number(c.amount) || 0), 0);
  const remaining = (Number(b.estimated) || 0) - actual;

  const [show, setShow] = useState(false);
  const [co, setCo] = useState({ desc: "", amount: "", date: todayISO() });
  function addChangeOrder(e) {
    e.preventDefault();
    if (!co.desc.trim()) return;
    update((p) => ({ ...p, budget: { ...p.budget, changeOrders: [...(p.budget.changeOrders || []), { id: uid(), ...co }] } }));
    setCo({ desc: "", amount: "", date: todayISO() });
    setShow(false);
  }
  function removeCo(id) {
    update((p) => ({ ...p, budget: { ...p.budget, changeOrders: p.budget.changeOrders.filter((c) => c.id !== id) } }));
  }

  return (
    <div className="space-y-8">
      <section>
        <SectionHeader title="Budget Summary" />
        <div className="grid grid-cols-3 gap-3">
          <MiniStat label="Estimated" value={`₱${money(b.estimated)}`} />
          <MiniStat label="Actual" value={`₱${money(actual)}`} />
          <MiniStat label="Remaining" value={`₱${money(remaining)}`} tone={remaining < 0 ? "#FF6B4A" : "#171A21"} />
        </div>
      </section>

      <section className="max-w-xl">
        <SectionHeader title="Cost Breakdown" />
        <div className="space-y-3">
          <Field label="Estimated Budget"><input type="number" className={inputCls} value={b.estimated} onChange={set("estimated")} /></Field>
          <Field label="Labor Costs"><input type="number" className={inputCls} value={b.labor} onChange={set("labor")} /></Field>
          <Field label="Material Costs"><input type="number" className={inputCls} value={b.materials} onChange={set("materials")} /></Field>
          <Field label="Equipment Rental"><input type="number" className={inputCls} value={b.equipment} onChange={set("equipment")} /></Field>
          <Field label="Miscellaneous Expenses"><input type="number" className={inputCls} value={b.misc} onChange={set("misc")} /></Field>
        </div>
      </section>

      <section>
        <SectionHeader title="Additional / Change Order Costs" action={<AddButton open={show} onClick={() => setShow((s) => !s)} label="Add" />} />
        {show && (
          <form onSubmit={addChangeOrder} className="panel p-4 mb-4 space-y-3">
            <Field label="Description"><input required className={inputCls} value={co.desc} onChange={(e) => setCo((c) => ({ ...c, desc: e.target.value }))} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount"><input type="number" className={inputCls} value={co.amount} onChange={(e) => setCo((c) => ({ ...c, amount: e.target.value }))} /></Field>
              <Field label="Date"><input type="date" className={inputCls} value={co.date} onChange={(e) => setCo((c) => ({ ...c, date: e.target.value }))} /></Field>
            </div>
            <button type="submit" className="btn-primary w-full bg-[#FF6B4A] text-white font-cond font-semibold text-sm tracking-wide py-2.5">Add change order</button>
          </form>
        )}
        {(!b.changeOrders || b.changeOrders.length === 0) ? <EmptyState>No change orders recorded.</EmptyState> : (
          <ul className="panel divide-y divide-[#E6E8EC]">
            {b.changeOrders.map((c) => (
              <li key={c.id} className="px-3 py-2 flex items-center justify-between">
                <div><p className="font-body text-sm">{c.desc}</p><p className="font-mono text-[10px] text-[#94A3B8]">{fmtShort(c.date)}</p></div>
                <div className="flex items-center gap-3"><span className="font-cond font-semibold">₱{money(c.amount)}</span><button onClick={() => removeCo(c.id)} className="text-[#94A3B8] hover:text-[#FF6B4A]"><X className="w-4 h-4" /></button></div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------- MATERIALS ----------------

function MaterialsTab({ project, update }) {
  const [show, setShow] = useState(false);
  const blank = { name: "", category: "", qty: "", unit: "", unitPrice: "", supplier: "", deliveryDate: "", status: "ordered" };
  const [form, setForm] = useState(blank);

  function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    update((p) => ({ ...p, materials: [...p.materials, { id: uid(), ...form }] }));
    setForm(blank);
    setShow(false);
  }
  function remove(id) { update((p) => ({ ...p, materials: p.materials.filter((m) => m.id !== id) })); }

  const totalCost = project.materials.reduce((a, m) => a + (Number(m.qty) || 0) * (Number(m.unitPrice) || 0), 0);

  return (
    <section>
      <SectionHeader title="Materials Management" action={<AddButton open={show} onClick={() => setShow((s) => !s)} label="Add material" />} />

      {show && (
        <form onSubmit={submit} className="panel p-4 mb-5 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Material Name"><input required className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="Category"><input className={inputCls} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Quantity"><input type="number" className={inputCls} value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))} /></Field>
            <Field label="Unit"><input className={inputCls} value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} /></Field>
            <Field label="Unit Price"><input type="number" className={inputCls} value={form.unitPrice} onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))} /></Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Supplier"><input className={inputCls} value={form.supplier} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} /></Field>
            <Field label="Delivery Date"><input type="date" className={inputCls} value={form.deliveryDate} onChange={(e) => setForm((f) => ({ ...f, deliveryDate: e.target.value }))} /></Field>
          </div>
          <Field label="Stock Status">
            <select className={inputCls} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="ordered">Ordered</option><option value="delivered">Delivered</option><option value="in-stock">In stock</option><option value="used">Used</option>
            </select>
          </Field>
          <button type="submit" className="btn-primary w-full bg-[#FF6B4A] text-white font-cond font-semibold text-sm tracking-wide py-2.5">Add material</button>
        </form>
      )}

      {project.materials.length === 0 ? <EmptyState>No materials logged yet.</EmptyState> : (
        <div className="panel overflow-x-auto">
          <table className="w-full font-body text-sm min-w-[640px]">
            <thead>
              <tr className="font-mono text-[10px] uppercase text-[#475569] border-b hairline">
                <th className="text-left px-3 py-2">Material</th><th className="text-left px-3 py-2">Category</th>
                <th className="text-right px-3 py-2">Qty</th><th className="text-left px-3 py-2">Unit</th>
                <th className="text-right px-3 py-2">Unit Price</th><th className="text-right px-3 py-2">Total</th>
                <th className="text-left px-3 py-2">Supplier</th><th className="text-left px-3 py-2">Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {project.materials.map((m) => (
                <tr key={m.id} className="border-b border-[#E6E8EC]">
                  <td className="px-3 py-2">{m.name}</td><td className="px-3 py-2">{m.category}</td>
                  <td className="px-3 py-2 text-right">{m.qty}</td><td className="px-3 py-2">{m.unit}</td>
                  <td className="px-3 py-2 text-right">₱{money(m.unitPrice)}</td>
                  <td className="px-3 py-2 text-right font-semibold">₱{money((Number(m.qty) || 0) * (Number(m.unitPrice) || 0))}</td>
                  <td className="px-3 py-2">{m.supplier}</td><td className="px-3 py-2 capitalize">{m.status}</td>
                  <td className="px-3 py-2"><button onClick={() => remove(m.id)} className="text-[#94A3B8] hover:text-[#FF6B4A]"><X className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-cond font-semibold"><td colSpan={5} className="px-3 py-2 text-right">Total materials cost</td><td className="px-3 py-2 text-right">₱{money(totalCost)}</td><td colSpan={3}></td></tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------------- PUNCH LIST ----------------

function PunchTab({ project, update }) {
  const [show, setShow] = useState(false);
  const blank = { description: "", priority: "medium", assignedTo: "", dueDate: "", status: "open", remarks: "" };
  const [form, setForm] = useState(blank);

  function submit(e) {
    e.preventDefault();
    if (!form.description.trim()) return;
    update((p) => ({ ...p, punchList: [...p.punchList, { id: uid(), ...form }] }));
    setForm(blank);
    setShow(false);
  }
  function remove(id) { update((p) => ({ ...p, punchList: p.punchList.filter((i) => i.id !== id) })); }
  function toggle(id) { update((p) => ({ ...p, punchList: p.punchList.map((i) => i.id === id ? { ...i, status: i.status === "open" ? "resolved" : "open" } : i) })); }

  const open = project.punchList.filter((i) => i.status === "open");
  const resolved = project.punchList.filter((i) => i.status === "resolved");

  return (
    <section>
      <SectionHeader title="Issues & Punch List" action={<AddButton open={show} onClick={() => setShow((s) => !s)} label="Report issue" />} />

      {show && (
        <form onSubmit={submit} className="panel p-4 mb-5 space-y-3">
          <Field label="Description"><input required className={inputCls} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Priority">
              <select className={inputCls} value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                {Object.entries(PUNCH_PRIORITY).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
              </select>
            </Field>
            <Field label="Assigned To"><input className={inputCls} value={form.assignedTo} onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))} /></Field>
            <Field label="Due Date"><input type="date" className={inputCls} value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></Field>
          </div>
          <Field label="Comments"><input className={inputCls} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} /></Field>
          <button type="submit" className="btn-primary w-full bg-[#FF6B4A] text-white font-cond font-semibold text-sm tracking-wide py-2.5">Log issue</button>
        </form>
      )}

      <div className="grid sm:grid-cols-2 gap-8">
        <div>
          <h3 className="font-cond font-semibold text-sm text-[#F43F5E] mb-2">Open ({open.length})</h3>
          {open.length === 0 ? <EmptyState>No open issues.</EmptyState> : (
            <ul className="panel divide-y divide-[#E6E8EC]">
              {open.map((i) => (
                <li key={i.id} className="px-3 py-2 flex items-start gap-2">
                  <button onClick={() => toggle(i.id)} className="mt-0.5 shrink-0"><Circle className="w-4 h-4" style={{ color: PUNCH_PRIORITY[i.priority].color }} /></button>
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm">{i.description}</p>
                    <p className="font-mono text-[10px] text-[#94A3B8]">{i.assignedTo && `${i.assignedTo} · `}{i.dueDate && `due ${fmtShort(i.dueDate)}`}</p>
                  </div>
                  <Badge color={PUNCH_PRIORITY[i.priority].color} bg="#F4F5F8">{PUNCH_PRIORITY[i.priority].label}</Badge>
                  <button onClick={() => remove(i.id)} className="text-[#94A3B8] hover:text-[#FF6B4A] shrink-0"><X className="w-4 h-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="font-cond font-semibold text-sm text-[#10B981] mb-2">Resolved ({resolved.length})</h3>
          {resolved.length === 0 ? <EmptyState>Nothing resolved yet.</EmptyState> : (
            <ul className="panel divide-y divide-[#E6E8EC]">
              {resolved.map((i) => (
                <li key={i.id} className="px-3 py-2 flex items-start gap-2">
                  <button onClick={() => toggle(i.id)} className="mt-0.5 shrink-0"><CheckCircle2 className="w-4 h-4 text-[#10B981]" /></button>
                  <p className="font-body text-sm flex-1 opacity-60 line-through">{i.description}</p>
                  <button onClick={() => remove(i.id)} className="text-[#94A3B8] hover:text-[#FF6B4A] shrink-0"><X className="w-4 h-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------- PHOTOS ----------------

function PhotosTab({ project, update }) {
  const [filterArea, setFilterArea] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  const [lightbox, setLightbox] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const [meta, setMeta] = useState({ area: AREAS[0], tag: "during", caption: "" });

  async function handleUpload(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setBusy(true);
    try {
      const urls = await Promise.all(files.map((f) => fileToCompressedDataUrl(f)));
      const newPhotos = urls.map((u) => ({ id: uid(), dataUrl: u, date: todayISO(), area: meta.area, tag: meta.tag, caption: meta.caption }));
      update((p) => ({ ...p, photos: [...newPhotos, ...p.photos] }));
      setMeta((m) => ({ ...m, caption: "" }));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  function remove(id) { update((p) => ({ ...p, photos: p.photos.filter((ph) => ph.id !== id) })); }

  const filtered = project.photos
    .filter((ph) => filterArea === "all" || ph.area === filterArea)
    .filter((ph) => filterTag === "all" || ph.tag === filterTag)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section>
      <SectionHeader title="Photo & Video Gallery" />

      <div className="panel p-4 mb-5 space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Area">
            <select className={inputCls} value={meta.area} onChange={(e) => setMeta((m) => ({ ...m, area: e.target.value }))}>
              {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>
          <Field label="Tag">
            <div className="flex gap-1">
              {PHOTO_TAGS.map((t) => (
                <button type="button" key={t} onClick={() => setMeta((m) => ({ ...m, tag: t }))}
                  className="px-2 py-1.5 text-xs font-cond font-semibold border flex-1 capitalize"
                  style={{ borderColor: "#FF6B4A", color: meta.tag === t ? "#fff" : "#FF6B4A", backgroundColor: meta.tag === t ? "#FF6B4A" : "transparent" }}>
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Caption"><input className={inputCls} value={meta.caption} onChange={(e) => setMeta((m) => ({ ...m, caption: e.target.value }))} placeholder="Optional" /></Field>
        </div>
        <label className="flex items-center gap-2 border border-dashed border-[#94A3B8] px-3 py-2 cursor-pointer font-cond text-sm text-[#475569] w-fit">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          {busy ? "Uploading…" : "Upload photos"}
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
        </label>
        <p className="font-mono text-[10px] text-[#94A3B8]">Note: this stores compressed images only — large video files aren't supported here.</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select value={filterArea} onChange={(e) => setFilterArea(e.target.value)} className="font-mono text-xs border hairline bg-white text-[#171A21] px-2 py-1">
          <option value="all">All areas</option>
          {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)} className="font-mono text-xs border hairline bg-white text-[#171A21] px-2 py-1">
          <option value="all">All stages</option>
          {PHOTO_TAGS.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? <EmptyState>No photos match this filter.</EmptyState> : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {filtered.map((ph) => (
            <div key={ph.id} className="relative group">
              <button onClick={() => setLightbox(ph)} className="block w-full">
                <img src={ph.dataUrl} alt={ph.caption || ph.area} className="w-full h-28 object-cover border hairline thumb" />
              </button>
              <div className="absolute top-1 left-1"><Badge color="#FF6B4A" bg="#171A21">{ph.tag}</Badge></div>
              <button onClick={() => remove(ph.id)} className="absolute top-1 right-1 bg-[#171A21] text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={() => setLightbox(null)}>
          <div className="max-h-full max-w-full">
            <img src={lightbox.dataUrl} alt={lightbox.caption} className="max-h-[80vh] max-w-full border-2 border-white mx-auto" />
            <p className="text-center text-white font-cond mt-2">{lightbox.area} · {lightbox.tag} · {fmtDate(lightbox.date)}{lightbox.caption ? ` — ${lightbox.caption}` : ""}</p>
          </div>
        </div>
      )}
    </section>
  );
}
