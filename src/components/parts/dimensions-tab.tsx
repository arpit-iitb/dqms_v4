"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Ruler } from "lucide-react";

interface Dimension {
  id: string;
  name: string;
  rawText: string;
  dimOrder: number;
}

interface Props {
  partId: string;
  onUpdate?: () => void;
}

export function DimensionsTab({ partId, onUpdate }: Props) {
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newRawText, setNewRawText] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/parts/${partId}/dimensions`);
    const d = await res.json();
    setDimensions(d.dimensions ?? []);
    setLoading(false);
  }, [partId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newRawText.trim()) return;
    setAdding(true);
    await fetch(`/api/parts/${partId}/dimensions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), rawText: newRawText.trim() }),
    });
    setAdding(false);
    setNewName("");
    setNewRawText("");
    load();
    onUpdate?.();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/parts/dimensions/${id}`, { method: "DELETE" });
    load();
    onUpdate?.();
  };

  if (loading) return <p className="text-sm text-muted-foreground py-4">Loading...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Ruler className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium">Critical Dimensions</p>
        <Badge className="text-xs bg-slate-100 text-slate-600">{dimensions.length}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Define key dimensions to be measured during inspection blocks.
      </p>

      {dimensions.length > 0 && (
        <div className="space-y-2">
          {dimensions.map((dim, i) => (
            <Card key={dim.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-5 flex-shrink-0">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{dim.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{dim.rawText}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                  onClick={() => handleDelete(dim.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {dimensions.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground">
          <Ruler className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No dimensions defined yet.</p>
        </div>
      )}

      {/* Add new */}
      <form onSubmit={handleAdd} className="flex gap-2 pt-2 border-t">
        <Input
          placeholder="Name (e.g. Outer Dia)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1"
        />
        <Input
          placeholder="Spec (e.g. 25.00 ± 0.05 mm)"
          value={newRawText}
          onChange={(e) => setNewRawText(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={adding || !newName.trim() || !newRawText.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
