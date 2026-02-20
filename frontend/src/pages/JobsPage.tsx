import { useEffect, useState } from 'react';
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
import { Search, Filter, Plus, Briefcase, Trash2 } from 'lucide-react';
import type { Job } from '@/types';

export function JobsPage() {
  const {
    addJob,
    removeJob,
    searchQuery,
    setSearchQuery,
    setFilter,
    getFilteredJobs,
    loadJobs,
    isLoading,
    error,
    hasLoaded,
  } = useJobsStore();

  const [activeTab, setActiveTab] = useState<'all' | 'Active' | 'Closed'>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDept, setNewDept] = useState('Engineering');
  const [newDesc, setNewDesc] = useState('');
  const [newReqs, setNewReqs] = useState('');
  const [newStack, setNewStack] = useState('');
  const [newStatus, setNewStatus] = useState<Job['status']>('Active');

  useEffect(() => {
    if (!hasLoaded) {
      void loadJobs();
    }
  }, [hasLoaded, loadJobs]);

  const filteredJobs = getFilteredJobs();

  const tabs: { id: 'all' | 'Active' | 'Closed'; label: string }[] = [
    { id: 'all', label: 'All Jobs' },
    { id: 'Active', label: 'Active' },
    { id: 'Closed', label: 'Closed' },
  ];

  const handleTabClick = (tabId: 'all' | 'Active' | 'Closed') => {
    setActiveTab(tabId);
    setFilter(tabId);
  };

  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      await addJob({
        title: newTitle.trim(),
        department: newDept,
        candidatesCount: 0,
        status: newStatus,
        postedDate: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        description: newDesc,
        requirements: newReqs
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        stack: newStack
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });

      setNewTitle('');
      setNewDept('Engineering');
      setNewDesc('');
      setNewReqs('');
      setNewStack('');
      setNewStatus('Active');
      setAddOpen(false);
    } catch (err) {
      console.error('Failed to create job:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30';
      case 'Closed':
        return 'text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800';
      case 'Draft':
        return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30';
      default:
        return '';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen max-h-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950 transition-colors duration-300">
      <PageHeader
        title="Jobs"
        icon={<Briefcase className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />}
        actions={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[13px] h-9 cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Job
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px] rounded-xl p-0 overflow-hidden border-none shadow-2xl">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 px-5 pt-5 pb-3">
                <DialogHeader>
                  <DialogTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    Create New Job
                  </DialogTitle>
                  <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Define the position, requirements and tech stack.
                  </p>
                </DialogHeader>
              </div>
              <form
                onSubmit={handleAddJob}
                className="px-5 pb-5 pt-3 space-y-4 bg-white dark:bg-neutral-900"
              >
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                    Job Title *
                  </label>
                  <Input
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="h-9 text-[13px] rounded-lg"
                    placeholder="e.g. Senior React Developer"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                      Department
                    </label>
                    <Select value={newDept} onValueChange={setNewDept}>
                      <SelectTrigger className="h-9 text-[13px] rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Engineering">Engineering</SelectItem>
                        <SelectItem value="Design">Design</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="HR">HR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                      Status
                    </label>
                    <Select value={newStatus} onValueChange={(v) => setNewStatus(v as Job['status'])}>
                      <SelectTrigger className="h-9 text-[13px] rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Closed">Closed</SelectItem>
                        <SelectItem value="Draft">Draft</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                    Tech Stack
                  </label>
                  <Input
                    value={newStack}
                    onChange={(e) => setNewStack(e.target.value)}
                    className="h-9 text-[13px] rounded-lg"
                    placeholder="React, TypeScript, Tailwind..."
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAddOpen(false)}
                    className="text-[13px]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 text-[13px]"
                  >
                    Create Job
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="px-6 py-4 bg-white dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                  : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 w-[240px] rounded-lg text-[13px] bg-neutral-50 dark:bg-neutral-800 border-none"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-neutral-500 border-neutral-200 dark:border-neutral-700"
          >
            <Filter className="w-3.5 h-3.5" /> Filter
          </Button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        {error && <div className="mb-3 text-[13px] text-red-500">{error}</div>}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 overflow-hidden shadow-sm">
          <div className="grid grid-cols-[auto_1fr_1fr_100px_120px_150px_40px] gap-4 items-center px-5 py-3 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
            <div className="w-5">
              <input type="checkbox" className="accent-blue-600" />
            </div>
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Job Title</span>
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Department</span>
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider text-center">Candidates</span>
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Status</span>
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Posted Date</span>
            <div />
          </div>

          <div className="divide-y divide-neutral-50 dark:divide-neutral-800">
            {filteredJobs.length === 0 ? (
              <div className="py-20 flex flex-col items-center opacity-50">
                <Briefcase className="w-10 h-10 mb-2" />
                <p className="text-sm">{isLoading ? 'Loading jobs...' : 'No jobs found'}</p>
              </div>
            ) : (
              filteredJobs.map((job) => (
                <div
                  key={job.id}
                  className="grid grid-cols-[auto_1fr_1fr_100px_120px_150px_40px] gap-4 items-center px-5 py-4 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors group"
                >
                  <div className="w-5">
                    <input type="checkbox" className="accent-blue-600" />
                  </div>
                  <span className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-100">{job.title}</span>
                  <span className="text-[13px] text-neutral-500">{job.department}</span>
                  <span className="text-[13px] font-medium text-center">{job.candidatesCount}</span>
                  <div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${getStatusColor(job.status)}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${job.status === 'Active' ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                      {job.status}
                    </span>
                  </div>
                  <span className="text-[13px] text-neutral-500">{job.postedDate}</span>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
                    <button
                      onClick={() => {
                        void removeJob(job.id);
                      }}
                      className="p-1.5 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
