import { useState, useRef, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus, Upload, FileText, Loader2, Trash2, FileIcon, Sparkles } from 'lucide-react';
import { useNavStore } from '@/store/useNavStore';
import { analyzeResume } from '@/services/api';
import { useNavigate } from 'react-router-dom';

export function AddCandidateModal() {
    const navigate = useNavigate();
    const { setPendingCandidate } = useNavStore();
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = useCallback((f: File) => {
        const ext = f.name.split('.').pop()?.toLowerCase();
        if ((ext === 'pdf' || ext === 'docx' || ext === 'doc') && f.size <= 25 * 1024 * 1024) {
            setFile(f);
            setError('');
        } else {
            setError('Only PDF/DOCX up to 25MB');
        }
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            handleFile(e.target.files[0]);
            e.target.value = '';
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
    }, [handleFile]);

    const handleAnalyze = async () => {
        if (!file) return;
        setIsAnalyzing(true);
        setError('');
        try {
            const analysis = await analyzeResume(file);
            // Переходимо на екран профілю кандидата
            setPendingCandidate(analysis, file);
            navigate('/candidate/new');
            setOpen(false);
            resetForm();
        } catch (err: any) {
            console.error('Error during resume analysis:', err);
            setError(err.message || 'Failed to analyze resume');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const resetForm = () => {
        setFile(null);
        setIsDragOver(false);
        setIsAnalyzing(false);
        setError('');
    };

    const getFileIcon = () => {
        if (!file) return null;
        const ext = file.name.split('.').pop()?.toLowerCase();
        return ext === 'pdf'
            ? <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center shrink-0"><FileText className="w-4 h-4 text-red-500" /></div>
            : <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0"><FileIcon className="w-4 h-4 text-blue-500" /></div>;
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg font-medium text-[13px] h-9 cursor-pointer transition-all"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Add Candidate
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px] rounded-xl p-0 overflow-hidden">
                <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-blue-950/40 dark:to-indigo-950/40 px-6 pt-5 pb-4">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                            Upload new CV
                        </DialogTitle>
                        <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-1 font-medium">
                            Upload a resume and AI will extract all candidate data automatically
                        </p>
                    </DialogHeader>
                </div>

                <div className="px-6 pb-5 pt-3 space-y-4">
                    {/* Drop Zone */}
                    {!file && (
                        <div
                            onDrop={handleDrop}
                            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                            onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
                            onClick={() => fileInputRef.current?.click()}
                            className={`flex flex-col items-center justify-center py-10 px-6 rounded-xl border-2 border-dashed transition-all cursor-pointer group ${isDragOver
                                ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 scale-[1.01]'
                                : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30 hover:border-blue-300 dark:hover:border-blue-700'
                                }`}
                        >
                            <div className="w-14 h-14 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 flex items-center justify-center mb-4 shadow-sm">
                                <Upload className={`w-6 h-6 transition-colors ${isDragOver ? 'text-blue-500' : 'text-neutral-300 dark:text-neutral-600 group-hover:text-blue-400'}`} />
                            </div>
                            <p className="text-[13px] text-neutral-600 dark:text-neutral-300 text-center">
                                <span className="font-semibold text-blue-600 dark:text-blue-400">Drag-and-drop</span> or{' '}
                                <span className="font-semibold text-blue-600 dark:text-blue-400">click</span> to upload
                            </p>
                            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1.5">
                                Max 25MB • .pdf or .docx
                            </p>
                        </div>
                    )}

                    <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc" onChange={handleFileChange} className="hidden" />

                    {/* File preview */}
                    {file && (
                        <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50">
                            {getFileIcon()}
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium text-neutral-800 dark:text-neutral-200 truncate">{file.name}</p>
                                <p className="text-[11px] text-neutral-400">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                            </div>
                            <button
                                onClick={() => setFile(null)}
                                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
                            >
                                <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                        </div>
                    )}

                    {error && (
                        <p className="text-[12px] text-red-500 font-medium">{error}</p>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { resetForm(); setOpen(false); }}
                            className="rounded-lg text-[13px] cursor-pointer font-medium"
                        >
                            Discard
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleAnalyze}
                            disabled={!file || isAnalyzing}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-5 text-[13px] cursor-pointer font-medium gap-1.5 disabled:opacity-50"
                        >
                            {isAnalyzing ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-3.5 h-3.5" />
                                    Analyze with AI
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
