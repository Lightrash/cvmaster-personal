import { useEffect, useMemo, useState } from 'react';
import { useJobsStore } from '@/store/useJobsStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus, Briefcase, Trash2, Users, CalendarClock } from 'lucide-react';
import type { Job } from '@/types';
import { translateDepartment, translateJobStatus } from '@/lib/uiText';

export function JobsPage() {
  const {
    jobs,
    addJob,
    removeJob,
    updateJob,
    updateJobStatus,
    loadJobs,
    searchQuery,
    setSearchQuery,
    filter,
    setFilter,
    getFilteredJobs,
    isLoading,
    hasLoaded,
    error,
  } = useJobsStore();

  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDept, setNewDept] = useState('Engineering');
  const [newDesc, setNewDesc] = useState('');
  const [newReqs, setNewReqs] = useState('');
  const [newStack, setNewStack] = useState('');
  const [newCriticalSkills, setNewCriticalSkills] = useState('');
  const [newCoreSkills, setNewCoreSkills] = useState('');
  const [newOptionalSkills, setNewOptionalSkills] = useState('');
  const [newStatus, setNewStatus] = useState<Job['status']>('Active');
  const [showAdvancedCreate, setShowAdvancedCreate] = useState(false);

  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isEditingJob, setIsEditingJob] = useState(false);
  const [isSavingJob, setIsSavingJob] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editReqs, setEditReqs] = useState('');
  const [editStack, setEditStack] = useState('');
  const [editCriticalSkills, setEditCriticalSkills] = useState('');
  const [editCoreSkills, setEditCoreSkills] = useState('');
  const [editOptionalSkills, setEditOptionalSkills] = useState('');
  const [editStatus, setEditStatus] = useState<Job['status']>('Active');
  const [showAdvancedEdit, setShowAdvancedEdit] = useState(false);

  const statusFilteredJobs = getFilteredJobs();
  const filteredJobs = useMemo(
    () =>
      statusFilteredJobs.filter((job) =>
        departmentFilter === 'all' ? true : job.department === departmentFilter
      ),
    [statusFilteredJobs, departmentFilter]
  );

  const stats = useMemo(() => {
    const active = jobs.filter((job) => job.status === 'Active').length;
    const closed = jobs.filter((job) => job.status === 'Closed').length;
    const draft = jobs.filter((job) => job.status === 'Draft').length;
    return {
      total: jobs.length,
      active,
      closed,
      draft,
    };
  }, [jobs]);

  const departments = useMemo(
    () => Array.from(new Set(jobs.map((job) => job.department))).sort((a, b) => a.localeCompare(b)),
    [jobs]
  );

  useEffect(() => {
    if (filteredJobs.length === 0) {
      setSelectedJobId(null);
      return;
    }

    const selectedStillExists = filteredJobs.some((job) => job.id === selectedJobId);
    if (!selectedStillExists) {
      setSelectedJobId(filteredJobs[0].id);
    }
  }, [filteredJobs, selectedJobId]);

  const selectedJob = filteredJobs.find((job) => job.id === selectedJobId) || null;

  useEffect(() => {
    if (!selectedJob) {
      setIsEditingJob(false);
      return;
    }

    setIsEditingJob(false);
    setEditTitle(selectedJob.title);
    setEditDept(selectedJob.department);
    setEditDesc(selectedJob.description || '');
    setEditReqs((selectedJob.requirements || []).join(', '));
    setEditStack((selectedJob.stack || []).join(', '));
    setEditCriticalSkills((selectedJob.criticalSkills || []).join(', '));
    setEditCoreSkills((selectedJob.coreSkills || []).join(', '));
    setEditOptionalSkills((selectedJob.optionalSkills || []).join(', '));
    setEditStatus(selectedJob.status);
    setShowAdvancedEdit(
      Boolean(
        (selectedJob.criticalSkills || []).length ||
        (selectedJob.coreSkills || []).length ||
        (selectedJob.optionalSkills || []).length
      )
    );
  }, [selectedJob?.id]);

  useEffect(() => {
    if (!hasLoaded) {
      void loadJobs();
    }
  }, [hasLoaded, loadJobs]);

  const handleAddJob = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newTitle.trim()) return;

    try {
      await addJob({
        title: newTitle.trim(),
        department: newDept,
        candidatesCount: 0,
        status: newStatus,
        postedDate: new Date().toLocaleDateString('uk-UA', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
        description: newDesc.trim(),
        requirements: newReqs
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        stack: newStack
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        criticalSkills: splitCommaList(newCriticalSkills),
        coreSkills: splitCommaList(newCoreSkills),
        optionalSkills: splitCommaList(newOptionalSkills),
      });
    } catch {
      return;
    }

    setNewTitle('');
    setNewDept('Engineering');
    setNewDesc('');
    setNewReqs('');
    setNewStack('');
    setNewCriticalSkills('');
    setNewCoreSkills('');
    setNewOptionalSkills('');
    setNewStatus('Active');
    setShowAdvancedCreate(false);
    setAddOpen(false);
  };

  const getStatusStyles = (status: Job['status']) => {
    if (status === 'Active') {
      return 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800';
    }
    if (status === 'Closed') {
      return 'text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700';
    }
    return 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800';
  };

  const splitCommaList = (value: string) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  const handleSaveSelectedJob = async () => {
    if (!selectedJob || !editTitle.trim()) return;

    setIsSavingJob(true);
    try {
      await updateJob(selectedJob.id, {
        title: editTitle.trim(),
        department: editDept.trim() || 'General',
        description: editDesc.trim(),
        requirements: splitCommaList(editReqs),
        stack: splitCommaList(editStack),
        criticalSkills: splitCommaList(editCriticalSkills),
        coreSkills: splitCommaList(editCoreSkills),
        optionalSkills: splitCommaList(editOptionalSkills),
        status: editStatus,
      });
      setIsEditingJob(false);
    } catch {
      return;
    } finally {
      setIsSavingJob(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen max-h-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950 transition-colors duration-300">
      <PageHeader
        title="Вакансії"
        subtitle="Керуйте вакансіями, статусами та поточним навантаженням"
        icon={<Briefcase className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />}
        actions={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[13px] h-9 cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Додати вакансію
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[560px] rounded-xl p-0 overflow-hidden border-none shadow-2xl">
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/40 dark:to-cyan-950/40 px-5 pt-5 pb-3">
                <DialogHeader>
                  <DialogTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    Створення вакансії
                  </DialogTitle>
                  <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Заповніть основні дані. Воронка та оцінювання кандидатів будуть використовувати саме їх.
                  </p>
                </DialogHeader>
              </div>

              <form onSubmit={handleAddJob} className="px-5 pb-5 pt-3 space-y-4 bg-white dark:bg-neutral-900">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Назва вакансії *</label>
                  <Input required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="h-9 text-[13px] rounded-lg" placeholder="Наприклад: Senior React Developer" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Відділ</label>
                    <Select value={newDept} onValueChange={setNewDept}>
                      <SelectTrigger className="h-9 text-[13px] rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Engineering">Інженерія</SelectItem>
                        <SelectItem value="Design">Дизайн</SelectItem>
                        <SelectItem value="Marketing">Маркетинг</SelectItem>
                        <SelectItem value="HR">HR</SelectItem>
                        <SelectItem value="Sales">Продажі</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Статус</label>
                    <Select value={newStatus} onValueChange={(v) => setNewStatus(v as Job['status'])}>
                      <SelectTrigger className="h-9 text-[13px] rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Активна</SelectItem>
                        <SelectItem value="Closed">Закрита</SelectItem>
                        <SelectItem value="Draft">Чернетка</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Опис</label>
                  <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="w-full min-h-[88px] rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="Короткий опис обов'язків" />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Вимоги через кому</label>
                  <Input value={newReqs} onChange={(e) => setNewReqs(e.target.value)} className="h-9 text-[13px] rounded-lg" placeholder="REST API, Командна робота, Комунікація" />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Технічний стек через кому</label>
                  <Input value={newStack} onChange={(e) => setNewStack(e.target.value)} className="h-9 text-[13px] rounded-lg" placeholder="React, TypeScript, Node.js" />
                </div>

                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-950/40">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedCreate((value) => !value)}
                    className="w-full px-4 py-3 flex items-start justify-between gap-3 text-left"
                  >
                    <div>
                      <p className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
                        Додаткові налаштування для точнішого оцінювання
                      </p>
                      <p className="text-[12px] text-neutral-500 mt-1">
                        Необов'язково. Якщо не заповнювати, система сама орієнтуватиметься на опис, вимоги та стек.
                      </p>
                    </div>
                    <span className="text-[12px] text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {showAdvancedCreate ? 'Згорнути' : 'Відкрити'}
                    </span>
                  </button>

                  {showAdvancedCreate && (
                    <div className="px-4 pb-4 grid gap-4 md:grid-cols-3 border-t border-neutral-200 dark:border-neutral-800">
                      <div className="space-y-1 pt-4">
                        <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Критично важливі навички</label>
                        <Input value={newCriticalSkills} onChange={(e) => setNewCriticalSkills(e.target.value)} className="h-9 text-[13px] rounded-lg" placeholder="React, TypeScript" />
                        <p className="text-[11px] text-neutral-500">Тільки якщо хочеш явно виділити must-have вимоги.</p>
                      </div>

                      <div className="space-y-1 pt-4">
                        <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Основні навички</label>
                        <Input value={newCoreSkills} onChange={(e) => setNewCoreSkills(e.target.value)} className="h-9 text-[13px] rounded-lg" placeholder="REST API, Git, Командна робота" />
                        <p className="text-[11px] text-neutral-500">Можна вказати, якщо потрібно точніше налаштувати метод.</p>
                      </div>

                      <div className="space-y-1 pt-4">
                        <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Додаткові навички</label>
                        <Input value={newOptionalSkills} onChange={(e) => setNewOptionalSkills(e.target.value)} className="h-9 text-[13px] rounded-lg" placeholder="Next.js, Docker, Англійська" />
                        <p className="text-[11px] text-neutral-500">Підійде для бажаних, але не обов'язкових переваг.</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAddOpen(false)}>Скасувати</Button>
                  <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white px-6">Створити</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-4"><p className="text-[11px] uppercase tracking-wide text-neutral-500">Усього вакансій</p><p className="text-2xl font-bold mt-1">{stats.total}</p></div>
          <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-4"><p className="text-[11px] uppercase tracking-wide text-neutral-500">Активні</p><p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{stats.active}</p></div>
          <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-4"><p className="text-[11px] uppercase tracking-wide text-neutral-500">Чернетки</p><p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">{stats.draft}</p></div>
          <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-4"><p className="text-[11px] uppercase tracking-wide text-neutral-500">Закриті</p><p className="text-2xl font-bold mt-1 text-neutral-700 dark:text-neutral-300">{stats.closed}</p></div>
        </div>

        <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-3 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input placeholder="Пошук вакансій..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9 rounded-lg" />
          </div>

          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Статус" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Усі</SelectItem>
                <SelectItem value="Active">Активні</SelectItem>
                <SelectItem value="Draft">Чернетки</SelectItem>
                <SelectItem value="Closed">Закриті</SelectItem>
              </SelectContent>
            </Select>

            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="Відділ" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Усі відділи</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department} value={department}>{translateDepartment(department)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-600 px-3 py-2 text-[12px]">{error}</div>}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] gap-4 min-h-[480px]">
          <section className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 overflow-hidden">
            <div className="grid grid-cols-[1.6fr_1fr_0.8fr_0.9fr_0.8fr_36px] gap-3 px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 text-[11px] uppercase tracking-wide text-neutral-500">
              <span>Назва</span><span>Відділ</span><span className="text-center">Кандидати</span><span>Статус</span><span>Дата</span><span />
            </div>

            <div className="divide-y divide-neutral-100 dark:divide-neutral-800 max-h-[640px] overflow-auto">
              {filteredJobs.length === 0 ? (
                <div className="py-16 text-center text-neutral-500"><Briefcase className="w-10 h-10 mx-auto mb-2 opacity-40" /><p className="text-sm">{isLoading && !hasLoaded ? 'Завантажуємо вакансії...' : 'Немає вакансій для поточних фільтрів'}</p></div>
              ) : (
                filteredJobs.map((job) => (
                  <div key={job.id} onClick={() => setSelectedJobId(job.id)} className={`grid grid-cols-[1.6fr_1fr_0.8fr_0.9fr_0.8fr_36px] gap-3 px-4 py-3 items-center cursor-pointer transition-colors ${selectedJobId === job.id ? 'bg-blue-50/70 dark:bg-blue-900/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40'}`}>
                    <div className="min-w-0"><p className="text-[13px] font-medium truncate">{job.title}</p><p className="text-[11px] text-neutral-500 truncate">{job.description || 'Опис поки не додано'}</p></div>
                    <span className="text-[12px] text-neutral-600 dark:text-neutral-300">{translateDepartment(job.department)}</span>
                    <span className="text-[12px] text-neutral-600 dark:text-neutral-300 text-center">{job.candidatesCount}</span>
                    <div onClick={(event) => event.stopPropagation()}>
                      <Select value={job.status} onValueChange={(value) => { void updateJobStatus(job.id, value as Job['status']); }}>
                        <SelectTrigger className={`h-8 text-[12px] border ${getStatusStyles(job.status)}`}><SelectValue>{translateJobStatus(job.status)}</SelectValue></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Активна</SelectItem>
                          <SelectItem value="Draft">Чернетка</SelectItem>
                          <SelectItem value="Closed">Закрита</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <span className="text-[12px] text-neutral-500">{job.postedDate}</span>
                    <button onClick={(event) => { event.stopPropagation(); void removeJob(job.id); }} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-neutral-400 hover:text-red-500 transition-colors" title="Видалити вакансію"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))
              )}
            </div>
          </section>

          <aside className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-4">
            {!selectedJob ? (
              <div className="h-full flex items-center justify-center text-center text-neutral-500"><div><Briefcase className="w-10 h-10 mx-auto mb-2 opacity-40" /><p className="text-sm">Оберіть вакансію, щоб переглянути деталі</p></div></div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{selectedJob.title}</h3><p className="text-[13px] text-neutral-500 mt-0.5">{translateDepartment(selectedJob.department)}</p></div>
                  <div className="flex items-center gap-2">
                    {isEditingJob ? (
                      <>
                        <Button size="sm" variant="outline" className="h-8" onClick={() => { setIsEditingJob(false); setEditTitle(selectedJob.title); setEditDept(selectedJob.department); setEditDesc(selectedJob.description || ''); setEditReqs((selectedJob.requirements || []).join(', ')); setEditStack((selectedJob.stack || []).join(', ')); setEditCriticalSkills((selectedJob.criticalSkills || []).join(', ')); setEditCoreSkills((selectedJob.coreSkills || []).join(', ')); setEditOptionalSkills((selectedJob.optionalSkills || []).join(', ')); setEditStatus(selectedJob.status); setShowAdvancedEdit(Boolean((selectedJob.criticalSkills || []).length || (selectedJob.coreSkills || []).length || (selectedJob.optionalSkills || []).length)); }} disabled={isSavingJob}>Скасувати</Button>
                        <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => { void handleSaveSelectedJob(); }} disabled={isSavingJob || !editTitle.trim()}>{isSavingJob ? 'Зберігаємо...' : 'Зберегти'}</Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" className="h-8" onClick={() => setIsEditingJob(true)}>Редагувати</Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${getStatusStyles(selectedJob.status)}`}>{translateJobStatus(selectedJob.status)}</span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500 bg-neutral-100 dark:bg-neutral-800 rounded-full px-2.5 py-0.5"><Users className="w-3 h-3" />{selectedJob.candidatesCount} кандидатів</span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500 bg-neutral-100 dark:bg-neutral-800 rounded-full px-2.5 py-0.5"><CalendarClock className="w-3 h-3" />{selectedJob.postedDate}</span>
                </div>

                {isEditingJob ? (
                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
                    <div className="space-y-1"><label className="text-[11px] uppercase tracking-wide text-neutral-500">Назва</label><Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-9" /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1"><label className="text-[11px] uppercase tracking-wide text-neutral-500">Відділ</label><Input value={editDept} onChange={(e) => setEditDept(e.target.value)} className="h-9" /></div>
                      <div className="space-y-1"><label className="text-[11px] uppercase tracking-wide text-neutral-500">Статус</label><Select value={editStatus} onValueChange={(v) => setEditStatus(v as Job['status'])}><SelectTrigger className="h-9"><SelectValue>{translateJobStatus(editStatus)}</SelectValue></SelectTrigger><SelectContent><SelectItem value="Active">Активна</SelectItem><SelectItem value="Draft">Чернетка</SelectItem><SelectItem value="Closed">Закрита</SelectItem></SelectContent></Select></div>
                    </div>
                    <div className="space-y-1"><label className="text-[11px] uppercase tracking-wide text-neutral-500">Опис</label><textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="w-full min-h-[88px] rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-blue-500/30" /></div>
                    <div className="space-y-1"><label className="text-[11px] uppercase tracking-wide text-neutral-500">Стек через кому</label><Input value={editStack} onChange={(e) => setEditStack(e.target.value)} className="h-9" /></div>
                    <div className="space-y-1"><label className="text-[11px] uppercase tracking-wide text-neutral-500">Вимоги через кому</label><Input value={editReqs} onChange={(e) => setEditReqs(e.target.value)} className="h-9" /></div>
                    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-950/40">
                      <button
                        type="button"
                        onClick={() => setShowAdvancedEdit((value) => !value)}
                        className="w-full px-4 py-3 flex items-start justify-between gap-3 text-left"
                      >
                        <div>
                          <p className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
                            Додаткові налаштування для точнішого оцінювання
                          </p>
                          <p className="text-[12px] text-neutral-500 mt-1">
                            Розкривай тільки якщо хочеш вручну уточнити важливість окремих навичок.
                          </p>
                        </div>
                        <span className="text-[12px] text-blue-600 dark:text-blue-400 whitespace-nowrap">
                          {showAdvancedEdit ? 'Згорнути' : 'Відкрити'}
                        </span>
                      </button>

                      {showAdvancedEdit && (
                        <div className="px-4 pb-4 grid gap-3 border-t border-neutral-200 dark:border-neutral-800">
                          <div className="space-y-1 pt-4"><label className="text-[11px] uppercase tracking-wide text-neutral-500">Критично важливі навички</label><Input value={editCriticalSkills} onChange={(e) => setEditCriticalSkills(e.target.value)} className="h-9" /></div>
                          <div className="space-y-1"><label className="text-[11px] uppercase tracking-wide text-neutral-500">Основні навички</label><Input value={editCoreSkills} onChange={(e) => setEditCoreSkills(e.target.value)} className="h-9" /></div>
                          <div className="space-y-1"><label className="text-[11px] uppercase tracking-wide text-neutral-500">Додаткові навички</label><Input value={editOptionalSkills} onChange={(e) => setEditOptionalSkills(e.target.value)} className="h-9" /></div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div><p className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1.5">Опис</p><p className="text-[13px] text-neutral-700 dark:text-neutral-300 leading-relaxed">{selectedJob.description || 'Опис поки не додано'}</p></div>
                    <div><p className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1.5">Стек</p><div className="flex flex-wrap gap-1.5">{(selectedJob.stack || []).length === 0 ? <span className="text-[12px] text-neutral-500">Стек ще не вказано</span> : (selectedJob.stack || []).map((item) => (<span key={`${selectedJob.id}-stack-${item}`} className="inline-flex items-center text-[11px] bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full px-2.5 py-0.5">{item}</span>))}</div></div>
                    <div><p className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1.5">Основні вимоги</p>{(selectedJob.requirements || []).length === 0 ? <span className="text-[12px] text-neutral-500">Вимоги ще не вказано</span> : <ul className="space-y-1">{(selectedJob.requirements || []).map((item) => (<li key={`${selectedJob.id}-req-${item}`} className="text-[12px] text-neutral-700 dark:text-neutral-300">- {item}</li>))}</ul>}</div>
                    {Boolean(
                      (selectedJob.criticalSkills || []).length ||
                      (selectedJob.coreSkills || []).length ||
                      (selectedJob.optionalSkills || []).length
                    ) && (
                      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-950/40 p-3 space-y-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-neutral-500">Додаткові параметри оцінювання</p>
                          <p className="text-[12px] text-neutral-500 mt-1">
                            Ці поля заповнюються лише тоді, коли потрібно точніше налаштувати автоматичну оцінку.
                          </p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1.5">Критично важливі</p>
                            {(selectedJob.criticalSkills || []).length === 0 ? (
                              <span className="text-[12px] text-neutral-500">Не задано</span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {(selectedJob.criticalSkills || []).map((item) => (
                                  <span key={`${selectedJob.id}-critical-${item}`} className="inline-flex items-center text-[11px] bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full px-2.5 py-0.5">{item}</span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1.5">Основні</p>
                            {(selectedJob.coreSkills || []).length === 0 ? (
                              <span className="text-[12px] text-neutral-500">Не задано</span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {(selectedJob.coreSkills || []).map((item) => (
                                  <span key={`${selectedJob.id}-core-${item}`} className="inline-flex items-center text-[11px] bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full px-2.5 py-0.5">{item}</span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1.5">Додаткові</p>
                            {(selectedJob.optionalSkills || []).length === 0 ? (
                              <span className="text-[12px] text-neutral-500">Не задано</span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {(selectedJob.optionalSkills || []).map((item) => (
                                  <span key={`${selectedJob.id}-optional-${item}`} className="inline-flex items-center text-[11px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full px-2.5 py-0.5">{item}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-2"><p className="text-[11px] uppercase tracking-wide text-neutral-500">Швидка зміна статусу</p><div className="flex gap-2">{(['Active', 'Draft', 'Closed'] as Job['status'][]).map((status) => (<button key={status} onClick={() => { void updateJobStatus(selectedJob.id, status); }} className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${selectedJob.status === status ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}>{translateJobStatus(status)}</button>))}</div></div>
                  </>
                )}
                {isEditingJob && <div className="text-[11px] text-neutral-500">Зміни застосуються до цієї вакансії та будуть збережені в базі даних.</div>}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
