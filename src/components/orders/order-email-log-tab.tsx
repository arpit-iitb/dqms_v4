"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Mail, Clock, Plus, AlertTriangle, CheckCircle2 } from "lucide-react";

interface EmailLog {
  id: string;
  subject: string;
  recipientEmail: string;
  recipientName: string | null;
  templateKey: string | null;
  sentAt: string;
}

interface EmailTemplate {
  id: string;
  key: string;
  displayName: string;
  subject: string;
  body: string;
}

interface Props {
  orderId: string;
  emailLogs: EmailLog[];
  onUpdate: () => void;
  // For pre-filling variables
  orderContext?: {
    displayId: string;
    clientName: string;
    clientEmail: string;
    deliveryDate?: string | null;
  };
}

export function OrderEmailLogTab({ orderId, emailLogs, onUpdate, orderContext }: Props) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [form, setForm] = useState({ recipientEmail: "", recipientName: "", subject: "", body: "" });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const openDialog = async () => {
    setResult(null);
    const res = await fetch("/api/settings/email-templates");
    const d = await res.json();
    const tpls: EmailTemplate[] = (d.templates ?? []).filter((t: any) => t.isActive);
    setTemplates(tpls);

    // Pre-fill recipient from order context
    setForm({
      recipientEmail: orderContext?.clientEmail ?? "",
      recipientName: orderContext?.clientName ?? "",
      subject: "",
      body: "",
    });
    setSelectedKey("");
    setOpen(true);
  };

  const applyTemplate = (key: string) => {
    setSelectedKey(key);
    const tpl = templates.find((t) => t.key === key);
    if (!tpl) return;
    setForm((f) => ({ ...f, subject: tpl.subject, body: tpl.body }));
  };

  const handleSend = async () => {
    if (!form.recipientEmail.trim() || !form.subject.trim() || !form.body.trim()) return;
    setSending(true);
    setResult(null);

    const variables: Record<string, string> = {
      orderDisplayId: orderContext?.displayId ?? "",
      clientName: orderContext?.clientName ?? "",
      deliveryDate: orderContext?.deliveryDate
        ? new Date(orderContext.deliveryDate).toLocaleDateString("en-IN")
        : "",
    };

    const res = await fetch(`/api/orders/${orderId}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateKey: selectedKey || undefined,
        subject: form.subject,
        body: form.body,
        recipientEmail: form.recipientEmail.trim(),
        recipientName: form.recipientName.trim() || undefined,
        variables,
      }),
    });

    const d = await res.json();
    setSending(false);

    if (res.status === 207) {
      setResult({ ok: false, message: `Logged but not sent: ${d.warning}` });
    } else if (res.ok) {
      setResult({ ok: true, message: "Email sent successfully." });
      onUpdate();
      setTimeout(() => { setOpen(false); setResult(null); }, 1500);
    } else {
      setResult({ ok: false, message: d.error ?? "Failed to send" });
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{emailLogs.length} email{emailLogs.length !== 1 ? "s" : ""} sent</p>
        <Button size="sm" onClick={openDialog}>
          <Plus className="h-4 w-4 mr-1" /> Send Email
        </Button>
      </div>

      {/* Log list */}
      {emailLogs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          <Mail className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No emails sent yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {emailLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border bg-white hover:bg-slate-50">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Mail className="h-4 w-4 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 truncate">{log.subject}</p>
                <p className="text-xs text-muted-foreground">To: {log.recipientName ? `${log.recipientName} <${log.recipientEmail}>` : log.recipientEmail}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3" />
                  {new Date(log.sentAt).toLocaleString("en-IN")}
                </p>
              </div>
              {log.templateKey && (
                <Badge className="text-xs bg-slate-100 text-slate-600 flex-shrink-0">{log.templateKey}</Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Send dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Send Email</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            {/* Template picker */}
            {templates.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Use Template (optional)</Label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => { setSelectedKey(""); setForm((f) => ({ ...f, subject: "", body: "" })); }}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${!selectedKey ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 hover:border-slate-300 text-slate-600"}`}
                  >
                    Custom
                  </button>
                  {templates.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => applyTemplate(t.key)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${selectedKey === t.key ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 hover:border-slate-300 text-slate-600"}`}
                    >
                      {t.displayName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Recipient Email *</Label>
                <Input
                  type="email"
                  value={form.recipientEmail}
                  onChange={(e) => setForm((f) => ({ ...f, recipientEmail: e.target.value }))}
                  placeholder="client@example.com"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Recipient Name</Label>
                <Input
                  value={form.recipientName}
                  onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
                  placeholder="John Doe"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Subject *</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Production update for order ..."
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Body *</Label>
              <textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                rows={6}
                placeholder="Email body... Use {{orderDisplayId}}, {{clientName}}, {{deliveryDate}} as variables."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Variables: <code className="bg-slate-100 px-1 rounded">{"{{orderDisplayId}}"}</code>{" "}
                <code className="bg-slate-100 px-1 rounded">{"{{clientName}}"}</code>{" "}
                <code className="bg-slate-100 px-1 rounded">{"{{deliveryDate}}"}</code>
              </p>
            </div>

            {result && (
              <div className={`flex items-start gap-2 text-xs rounded px-3 py-2 ${result.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                {result.ok ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
                {result.message}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSend}
              disabled={sending || !form.recipientEmail.trim() || !form.subject.trim() || !form.body.trim()}
            >
              <Mail className="h-4 w-4 mr-1" />
              {sending ? "Sending..." : "Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
