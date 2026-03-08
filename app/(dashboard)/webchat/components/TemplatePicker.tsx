'use client';
import React, { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, Edit2, MessageSquare, X, Check, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ChatTemplate {
    id: string;
    title: string;
    content: string;
    sort_order: number;
    created_at: string;
}

interface TemplatePickerProps {
    open: boolean;
    onClose: () => void;
    onSelectTemplate: (content: string) => void;
    onTemplatesChange?: () => void;
}

const TemplatePicker: React.FC<TemplatePickerProps> = ({ open, onClose, onSelectTemplate, onTemplatesChange }) => {
    const [templates, setTemplates] = useState<ChatTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');

    const fetchTemplates = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/chat-templates');
            const data = await res.json();
            if (data.data) setTemplates(data.data);
        } catch {
            toast.error('Gagal memuat template');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchTemplates();
            setIsAdding(false);
            setEditingId(null);
        }
    }, [open]);

    const handleAdd = async () => {
        if (!newTitle.trim() || !newContent.trim()) {
            toast.error('Judul dan isi diperlukan');
            return;
        }
        try {
            const res = await fetch('/api/chat-templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle, content: newContent }),
            });
            const data = await res.json();
            if (data.data) {
                setTemplates(prev => [data.data, ...prev]);
                setNewTitle('');
                setNewContent('');
                setIsAdding(false);
                toast.success('Template disimpan');
                onTemplatesChange?.();
            }
        } catch {
            toast.error('Gagal menyimpan template');
        }
    };

    const handleUpdate = async (id: string) => {
        if (!editTitle.trim() || !editContent.trim()) return;
        try {
            const res = await fetch('/api/chat-templates', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, title: editTitle, content: editContent }),
            });
            const data = await res.json();
            if (data.data) {
                setTemplates(prev => prev.map(t => t.id === id ? data.data : t));
                setEditingId(null);
                toast.success('Template diperbarui');
                onTemplatesChange?.();
            }
        } catch {
            toast.error('Gagal mengubah template');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await fetch(`/api/chat-templates?id=${id}`, { method: 'DELETE' });
            setTemplates(prev => prev.filter(t => t.id !== id));
            toast.success('Template dihapus');
            onTemplatesChange?.();
        } catch {
            toast.error('Gagal menghapus template');
        }
    };

    const handleSelect = (content: string) => {
        onSelectTemplate(content);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col gap-0 p-0">
                {/* Custom header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                    <DialogHeader className="p-0 space-y-0">
                        <DialogTitle className="text-base font-semibold">Template Balasan</DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center gap-2 pr-6">
                        <Button
                            size="sm"
                            variant={isAdding ? "secondary" : "default"}
                            className="h-8 px-3 text-xs rounded-full"
                            onClick={() => { setIsAdding(!isAdding); setEditingId(null); }}
                        >
                            {isAdding ? (
                                <><X className="w-3.5 h-3.5 mr-1.5" />Batal</>
                            ) : (
                                <><Plus className="w-3.5 h-3.5 mr-1.5" />Tambah</>
                            )}
                        </Button>
                    </div>
                </div>

                <div className="h-px bg-border" />

                <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
                    {/* Form tambah template baru */}
                    {isAdding && (
                        <div className="mb-4 p-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 space-y-3">
                            <Input
                                placeholder="Judul template (mis: Sapaan Pembeli)"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                className="h-9 text-sm font-medium"
                                autoFocus
                            />
                            <textarea
                                placeholder="Isi pesan template..."
                                value={newContent}
                                onChange={(e) => setNewContent(e.target.value)}
                                rows={3}
                                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                            <Button size="sm" className="w-full h-9 text-xs rounded-lg" onClick={handleAdd}>
                                <Check className="w-3.5 h-3.5 mr-1.5" /> Simpan Template
                            </Button>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : templates.length === 0 && !isAdding ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                            <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                                <MessageSquare className="w-7 h-7 opacity-50" />
                            </div>
                            <p className="text-sm font-medium">Belum ada template</p>
                            <p className="text-xs mt-1 opacity-70">Klik "Tambah" untuk membuat template baru</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {templates.map((template) => (
                                <div key={template.id}>
                                    {editingId === template.id ? (
                                        /* Edit mode */
                                        <div className="p-4 rounded-xl border-2 border-primary/30 bg-primary/5 space-y-3">
                                            <Input
                                                value={editTitle}
                                                onChange={(e) => setEditTitle(e.target.value)}
                                                className="h-9 text-sm font-medium"
                                                autoFocus
                                            />
                                            <textarea
                                                value={editContent}
                                                onChange={(e) => setEditContent(e.target.value)}
                                                rows={3}
                                                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            />
                                            <div className="flex gap-2">
                                                <Button size="sm" className="flex-1 h-8 text-xs rounded-lg" onClick={() => handleUpdate(template.id)}>
                                                    <Check className="w-3 h-3 mr-1" /> Simpan
                                                </Button>
                                                <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg" onClick={() => setEditingId(null)}>
                                                    Batal
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Template card */
                                        <div className="group relative rounded-xl border border-border hover:border-primary/30 hover:shadow-sm transition-all overflow-hidden">
                                            <button
                                                type="button"
                                                className="w-full text-left p-4 cursor-pointer"
                                                onClick={() => handleSelect(template.content)}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                                        <MessageSquare className="w-4 h-4 text-primary" />
                                                    </div>
                                                    <div className="flex-1 min-w-0 pr-12">
                                                        <p className="text-sm font-semibold truncate">{template.title}</p>
                                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap leading-relaxed">{template.content}</p>
                                                    </div>
                                                </div>
                                            </button>

                                            {/* Action buttons — bottom right, visible on hover */}
                                            <div className="absolute top-1/2 -translate-y-1/2 right-4 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-background/95 backdrop-blur-sm p-1.5 rounded-lg border border-border/50 shadow-sm z-10">
                                                <button
                                                    type="button"
                                                    className="p-1.5 flex items-center gap-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                    title="Edit"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingId(template.id);
                                                        setEditTitle(template.title);
                                                        setEditContent(template.content);
                                                        setIsAdding(false);
                                                    }}
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <div className="w-px h-4 bg-border mx-0.5"></div>
                                                <button
                                                    type="button"
                                                    className="p-1.5 flex items-center gap-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                                    title="Hapus"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(template.id);
                                                    }}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default TemplatePicker;
