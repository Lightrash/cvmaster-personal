export type ColumnStatus = 'New' | 'Screening' | 'Interview' | 'Test Task' | 'Offer' | 'Hired' | 'Rejected';

export interface Candidate {
    id: string;
    name: string;
    surname: string;
    position: string;
    avatar: string;
    progress: number;
    deadline: string;
    email?: string;
    phone?: string;
    linkedin?: string;
    status: ColumnStatus;
    resumeFile?: File | null;
    resumeAnalysis?: ResumeAnalysis | null;
}

export interface Column {
    id: ColumnStatus;
    title: string;
    color: string;
    dotClass: string;
    candidates: Candidate[];
}

// --- Jobs ---
export interface Job {
    id: string;
    title: string;
    department: string;
    candidatesCount: number;
    status: 'Active' | 'Closed' | 'Draft';
    postedDate: string;
    description?: string;
    requirements?: string[];
    stack?: string[];
}

// --- AI Resume Analysis (розширений з parsed даними) ---
export interface ResumeAnalysis {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    position: string;
    linkedin: string;
    skills: string[];
    level: 'Junior' | 'Middle' | 'Senior';
    yearsOfExperience: number;
    technologies: string[];
    softSkills: string[];
    overallScore: number; // 1-10
    summary: string;
    education: string;
    languages: string[];
}

// --- Match Result ---
export interface MatchResult {
    matchPercentage: number;
    strengths: string[];
    gaps: string[];
    recommendation: 'Proceed' | 'Review manually' | 'Reject';
}
