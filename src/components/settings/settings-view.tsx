"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Save, Mail, Layers, X } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EmailTemplate {
  id: string;
  key: string;
  displayName: string;
  subject: string;
  body: string;
  isActive: boolean;
}

interface ProcessTemplate {
  id: string;
  name: string;
  description: string | null;
  steps: Array<{ type: string; processName: string | null }>;
}

// ─── Email Templates ─────────────────────────────────────────────────────────

function EmailTemplatesTab() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newForm, setNewForm] = useState({ key: "", displayName: "", subject: "", body: "" });
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    fetch("/api/settings/email-templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    await fetch(`/api/settings/email-templates/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: editing.displayName, subject: editing.subject, body: editing.body }),
    });
    setSaving(false);
    setEditing(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    await fetch(`/api/settings/email-templates/${id}`, { method: "DELETE" });
    load();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    await fetch("/api/settings/email-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newForm),
    });
    setCreating(false);
    setCreateOpen(false);
    setNewForm({ key: "", displayName: "", subject: "", body: "" });
    load();
  };

  if (loading) return <p className="text-sm text-muted-foreground py-4">Loading...</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{templates.length} template{templates.length !== 1 ? "s" : ""}</p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Template
        </Button>
      </div>

      {templates.length === 0 && (
        <div className="text-center py-10 border-2 border-dashed rounded-lg text-muted-foreground">
          <Mail className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No email templates. Create one to get started.</p>
        </div>
      )}

      <div className="space-y-2">
        {templates.map((t) => (
          <Card key={t.id}>
            <CardContent className="p-4">
              {editing?.id === t.id ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-muted-foreground">{t.key}</span>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditing(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Display Name</Label>
                    <Input
                      value={editing.displayName}
                      onChange={(e) => setEditing((p) => p ? { ...p, displayName: e.target.value } : p)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Subject</Label>
                    <Input
                      value={editing.subject}
                      onChange={(e) => setEditing((p) => p ? { ...p, subject: e.target.value } : p)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Body</Label>
                    <Textarea
                      value={editing.body}
                      onChange={(e) => setEditing((p) => p ? { ...p, body: e.target.value } : p)}
                      rows={8}
                      className="font-mono text-xs"
                    />
                    <p className="text-xs text-muted-foreground">
                      Variables: {"{{orderDisplayId}}"}, {"{{clientName}}"}, {"{{deliveryDate}}"}, {"{{vendorName}}"}, {"{{rfqDueDate}}"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      <Save className="h-3.5 w-3.5 mr-1" /> {saving ? "Saving..." : "Save"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{t.displayName}</span>
                      <Badge className="text-xs bg-slate-100 text-slate-600">{t.key}</Badge>
                      {!t.isActive && <Badge className="text-xs bg-red-100 text-red-600">Inactive</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.subject}</p>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{t.body.slice(0, 120)}...</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditing(t)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(t.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Email Template</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Key (unique identifier)</Label>
                <Input
                  value={newForm.key}
                  onChange={(e) => setNewForm((p) => ({ ...p, key: e.target.value.toLowerCase().replace(/\s+/g, "_") }))}
                  placeholder="e.g. rfq_vendor"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Display Name</Label>
                <Input
                  value={newForm.displayName}
                  onChange={(e) => setNewForm((p) => ({ ...p, displayName: e.target.value }))}
                  placeholder="e.g. RFQ to Vendor"
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Subject</Label>
              <Input
                value={newForm.subject}
                onChange={(e) => setNewForm((p) => ({ ...p, subject: e.target.value }))}
                placeholder="e.g. Request for Quotation — {{orderDisplayId}}"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Body</Label>
              <Textarea
                value={newForm.body}
                onChange={(e) => setNewForm((p) => ({ ...p, body: e.target.value }))}
                rows={6}
                className="font-mono text-xs"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={creating}>{creating ? "Creating..." : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Process Templates ────────────────────────────────────────────────────────

const STEP_TYPES = ["MATERIAL", "MANUFACTURING", "INSPECTION", "POST_PROCESSING", "REWORK"];

function ProcessTemplatesTab() {
  const [templates, setTemplates] = useState<ProcessTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<ProcessTemplate | null>(null);
  const [form, setForm] = useState({ name: "", description: "", steps: [] as { type: string; processName: string }[] });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch("/api/settings/process-templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditTemplate(null);
    setForm({ name: "", description: "", steps: [] });
    setCreateOpen(true);
  };

  const openEdit = (t: ProcessTemplate) => {
    setEditTemplate(t);
    setForm({
      name: t.name,
      description: t.description ?? "",
      steps: t.steps.map((s) => ({ type: s.type, processName: s.processName ?? "" })),
    });
    setCreateOpen(true);
  };

  const addStep = () => {
    setForm((p) => ({ ...p, steps: [...p.steps, { type: "MANUFACTURING", processName: "" }] }));
  };

  const removeStep = (i: number) => {
    setForm((p) => ({ ...p, steps: p.steps.filter((_, idx) => idx !== i) }));
  };

  const setStepField = (i: number, field: "type" | "processName", val: string) => {
    setForm((p) => {
      const steps = [...p.steps];
      steps[i] = { ...steps[i], [field]: val };
      return { ...p, steps };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      description: form.description || null,
      steps: form.steps.map((s) => ({ type: s.type, processName: s.processName || null })),
    };
    if (editTemplate) {
      await fetch(`/api/settings/process-templates/${editTemplate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/settings/process-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setSaving(false);
    setCreateOpen(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    await fetch(`/api/settings/process-templates/${id}`, { method: "DELETE" });
    load();
  };

  if (loading) return <p className="text-sm text-muted-foreground py-4">Loading...</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{templates.length} template{templates.length !== 1 ? "s" : ""}</p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> New Template
        </Button>
      </div>

      {templates.length === 0 && (
        <div className="text-center py-10 border-2 border-dashed rounded-lg text-muted-foreground">
          <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No process templates. Create one to reuse step sequences.</p>
        </div>
      )}

      <div className="space-y-2">
        {templates.map((t) => (
          <Card key={t.id}>
            <CardContent className="p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{t.name}</p>
                {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
                <div className="flex flex-wrap gap-1 mt-2">
                  {t.steps.map((s, i) => (
                    <Badge key={i} className="text-xs bg-slate-100 text-slate-600">
                      {i + 1}. {s.processName || s.type}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(t)}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                  onClick={() => handleDelete(t.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTemplate ? "Edit Process Template" : "New Process Template"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Standard CNC Flow"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Optional description"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Steps</Label>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addStep}>
                  <Plus className="h-3 w-3 mr-1" /> Add Step
                </Button>
              </div>
              {form.steps.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3 border-2 border-dashed rounded">
                  No steps yet. Add the first step.
                </p>
              )}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {form.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-50 rounded p-2">
                    <span className="text-xs text-muted-foreground w-5 flex-shrink-0">{i + 1}.</span>
                    <select
                      value={step.type}
                      onChange={(e) => setStepField(i, "type", e.target.value)}
                      className="h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none"
                    >
                      {STEP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <Input
                      value={step.processName}
                      onChange={(e) => setStepField(i, "processName", e.target.value)}
                      placeholder="Custom name (optional)"
                      className="h-8 text-xs flex-1"
                    />
                    <Button
                      type="button" variant="ghost" size="sm"
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                      onClick={() => removeStep(i)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editTemplate ? "Save Changes" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Settings View ───────────────────────────────────────────────────────

export function SettingsView() {
  return (
    <div className="p-6 max-w-4xl space-y-4">
      <Tabs defaultValue="email-templates">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0 h-auto">
          {[
            { value: "email-templates", label: "Email Templates", icon: Mail },
            { value: "process-templates", label: "Process Templates", icon: Layers },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-2 flex items-center gap-1.5"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="email-templates" className="pt-4">
          <EmailTemplatesTab />
        </TabsContent>
        <TabsContent value="process-templates" className="pt-4">
          <ProcessTemplatesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
