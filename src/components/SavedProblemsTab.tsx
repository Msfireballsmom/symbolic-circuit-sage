import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bookmark, Trash2, Search, Clock, Tag, FolderOpen } from "lucide-react";

interface SavedProblem {
  id: string;
  title: string;
  description: string;
  category: string;
  solverTab: string;
  savedAt: string;
  inputs?: Record<string, any>;
}

const STORAGE_KEY = 'circuit-solver-saved-problems';

const DEFAULT_PROBLEMS: SavedProblem[] = [
  {
    id: 'default-1',
    title: 'Basic Voltage Divider',
    description: 'Vs=12V, R1=4kΩ, R2=6kΩ. Find V_out across R2.',
    category: 'DC',
    solverTab: 'quick',
    savedAt: new Date().toISOString(),
  },
  {
    id: 'default-2',
    title: 'RC Transient Charging',
    description: 'R=10kΩ, C=47μF, Vs=5V, v(0)=0V. Find v(t) and time to reach 3.15V.',
    category: 'Transient',
    solverTab: 'transient',
    savedAt: new Date().toISOString(),
  },
  {
    id: 'default-3',
    title: 'Series RLC Underdamped',
    description: 'R=50Ω, L=10mH, C=4.7μF, Vs=20V. Find damping type and v_C(t).',
    category: 'RLC',
    solverTab: 'rlc',
    savedAt: new Date().toISOString(),
  },
  {
    id: 'default-4',
    title: 'AC Power Factor',
    description: 'Vs=120V∠0° at 60Hz, Z=30+j40Ω. Find P, Q, S, and power factor.',
    category: 'AC',
    solverTab: 'ac',
    savedAt: new Date().toISOString(),
  },
  {
    id: 'default-5',
    title: '2-Mesh Circuit',
    description: 'Vs=24V, R1=2kΩ, R2=4kΩ (shared), R3=6kΩ. Find mesh currents.',
    category: 'Mesh',
    solverTab: 'mesh',
    savedAt: new Date().toISOString(),
  },
];

const SavedProblemsTab = () => {
  const [problems, setProblems] = useState<SavedProblem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('DC');
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setProblems(JSON.parse(stored));
    } else {
      setProblems(DEFAULT_PROBLEMS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PROBLEMS));
    }
  }, []);

  const saveProblems = (updated: SavedProblem[]) => {
    setProblems(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const addProblem = () => {
    if (!newTitle.trim() || !newDesc.trim()) return;
    const problem: SavedProblem = {
      id: Date.now().toString(),
      title: newTitle,
      description: newDesc,
      category: newCategory,
      solverTab: 'quick',
      savedAt: new Date().toISOString(),
    };
    saveProblems([problem, ...problems]);
    setNewTitle('');
    setNewDesc('');
    setShowAdd(false);
  };

  const deleteProblem = (id: string) => {
    saveProblems(problems.filter(p => p.id !== id));
  };

  const categories = ['all', ...Array.from(new Set(problems.map(p => p.category)))];

  const filtered = problems.filter(p => {
    const matchesSearch = !searchQuery || 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || p.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categoryColors: Record<string, string> = {
    DC: 'bg-primary/10 text-primary border-primary/30',
    Transient: 'bg-accent/10 text-accent border-accent/30',
    RLC: 'bg-success/10 text-success border-success/30',
    AC: 'bg-destructive/10 text-destructive border-destructive/30',
    Mesh: 'bg-secondary text-secondary-foreground border-border',
    Laplace: 'bg-primary/10 text-primary border-primary/30',
    Fourier: 'bg-accent/10 text-accent border-accent/30',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-4 rounded-lg bg-card border border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-primary" />
            Saved Problems
            <Badge variant="secondary" className="text-[10px]">{problems.length}</Badge>
          </h3>
          <Button
            variant={showAdd ? "secondary" : "outline"}
            size="sm"
            className="text-xs gap-1"
            onClick={() => setShowAdd(!showAdd)}
          >
            {showAdd ? 'Cancel' : '+ Add Problem'}
          </Button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="p-3 rounded-md bg-muted/50 border border-border mb-4 space-y-3">
            <Input
              placeholder="Problem title..."
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              className="h-8 text-xs"
            />
            <textarea
              placeholder="Problem description (include values, what to find)..."
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              className="w-full h-20 rounded-md bg-background border border-border p-2 text-xs font-mono resize-y focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex items-center gap-2">
              <div className="flex flex-wrap gap-1.5">
                {['DC', 'Transient', 'RLC', 'AC', 'Mesh', 'Laplace', 'Fourier'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setNewCategory(cat)}
                    className={`px-2 py-1 rounded text-[10px] border transition-colors ${
                      newCategory === cat
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <Button size="sm" className="text-xs ml-auto" onClick={addProblem}>Save</Button>
            </div>
          </div>
        )}

        {/* Search & filter */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search problems..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-8 text-xs pl-8"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-2.5 py-1 rounded text-[10px] font-medium border transition-colors ${
                  filterCategory === cat
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Problem list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No saved problems found</p>
          <p className="text-xs mt-1">Add problems or adjust your search filters</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(problem => (
            <Card key={problem.id} className="border-border hover:border-primary/30 transition-colors group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h4 className="text-sm font-semibold text-foreground truncate">{problem.title}</h4>
                      <Badge variant="outline" className={`text-[9px] shrink-0 ${categoryColors[problem.category] || ''}`}>
                        {problem.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono leading-relaxed">{problem.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(problem.savedAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {problem.solverTab}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={() => deleteProblem(problem.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedProblemsTab;
