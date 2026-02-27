import type { ResumeAnalysis, MatchResult, Job, Candidate, ColumnStatus, AuthUser } from '@/types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

function getNetworkErrorMessage(error: unknown): string {
    if (error instanceof TypeError) {
        return 'Cannot connect to backend API. Start backend server and check VITE_API_URL.';
    }
    return 'Request failed';
}

async function parseError(res: Response, fallback: string): Promise<Error> {
    const err = await res.json().catch(() => ({ message: fallback }));
    return new Error(err.message || fallback);
}

function normalizeAuthUser(payload: unknown): AuthUser {
    const data = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
    const id = String(data.id || data._id || '');
    const name = String(data.name || '');
    const token = String(data.token || '');

    if (!id || !token) {
        throw new Error('Invalid auth response');
    }

    return { id, name, token };
}

export async function loginUser(email: string, password: string): Promise<AuthUser> {
    let res: Response;
    try {
        res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }

    if (!res.ok) {
        throw await parseError(res, 'Failed to login');
    }

    return normalizeAuthUser(await res.json());
}

export async function registerUser(name: string, email: string, password: string): Promise<AuthUser> {
    let res: Response;
    try {
        res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password }),
        });
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }

    if (!res.ok) {
        throw await parseError(res, 'Failed to register');
    }

    return normalizeAuthUser(await res.json());
}

export async function analyzeResume(file: File): Promise<ResumeAnalysis> {
    const formData = new FormData();
    formData.append('resume', file);

    let res: Response;
    try {
        res = await fetch(`${API_URL}/ai/analyze-resume`, {
            method: 'POST',
            body: formData,
        });
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }

    if (!res.ok) {
        throw await parseError(res, 'Failed to analyze resume');
    }

    return res.json();
}

export async function matchCandidateToJob(
    analysis: ResumeAnalysis,
    job: Job
): Promise<MatchResult> {
    let res: Response;
    try {
        res = await fetch(`${API_URL}/ai/match`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ analysis, job }),
        });
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }

    if (!res.ok) {
        throw await parseError(res, 'Failed to match');
    }

    return res.json();
}

// Jobs CRUD
export async function fetchJobs(): Promise<Job[]> {
    let res: Response;
    try {
        res = await fetch(`${API_URL}/jobs`);
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }
    if (!res.ok) throw await parseError(res, 'Failed to fetch jobs');
    return res.json();
}

export async function createJob(job: Omit<Job, 'id'>): Promise<Job> {
    let res: Response;
    try {
        res = await fetch(`${API_URL}/jobs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(job),
        });
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }
    if (!res.ok) throw await parseError(res, 'Failed to create job');
    return res.json();
}

export async function updateJob(
    id: string,
    patch: Partial<Omit<Job, 'id'>>
): Promise<Job> {
    let res: Response;
    try {
        res = await fetch(`${API_URL}/jobs/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
        });
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }
    if (!res.ok) throw await parseError(res, 'Failed to update job');
    return res.json();
}

export async function deleteJob(id: string): Promise<void> {
    let res: Response;
    try {
        res = await fetch(`${API_URL}/jobs/${id}`, { method: 'DELETE' });
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }
    if (!res.ok) throw await parseError(res, 'Failed to delete job');
}

// Candidates CRUD
export async function fetchCandidates(params?: { includeRejected?: boolean; vacancyId?: string }): Promise<Candidate[]> {
    let res: Response;
    const search = new URLSearchParams();
    if (params?.includeRejected) search.set('includeRejected', 'true');
    if (params?.vacancyId) search.set('vacancyId', params.vacancyId);
    const query = search.toString();
    try {
        res = await fetch(`${API_URL}/candidates${query ? `?${query}` : ''}`);
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }
    if (!res.ok) throw await parseError(res, 'Failed to fetch candidates');
    return res.json();
}

export async function fetchTrashCandidates(): Promise<{ retentionDays: number; items: Candidate[] }> {
    let res: Response;
    try {
        res = await fetch(`${API_URL}/candidates/trash`);
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }
    if (!res.ok) throw await parseError(res, 'Failed to fetch trash candidates');
    return res.json();
}

export async function createCandidate(candidate: Omit<Candidate, 'id'>): Promise<Candidate> {
    const { resumeFile, ...payload } = candidate;
    let res: Response;
    try {
        res = await fetch(`${API_URL}/candidates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }
    if (!res.ok) throw await parseError(res, 'Failed to create candidate');
    return res.json();
}

export async function fetchCandidateById(id: string): Promise<Candidate> {
    let res: Response;
    try {
        res = await fetch(`${API_URL}/candidates/${id}`);
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }
    if (!res.ok) throw await parseError(res, 'Failed to fetch candidate');
    return res.json();
}

export async function updateCandidate(
    id: string,
    payload: Partial<Omit<Candidate, 'id' | 'resumeFile'>>
): Promise<Candidate> {
    let res: Response;
    try {
        res = await fetch(`${API_URL}/candidates/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }
    if (!res.ok) throw await parseError(res, 'Failed to update candidate');
    return res.json();
}

export async function updateCandidateStatus(
    id: string,
    status: ColumnStatus,
    options?: { rejectionReason?: string; comment?: string }
): Promise<Candidate> {
    let res: Response;
    try {
        res = await fetch(`${API_URL}/candidates/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status,
                rejectionReason: options?.rejectionReason,
                comment: options?.comment,
            }),
        });
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }
    if (!res.ok) throw await parseError(res, 'Failed to update candidate status');
    return res.json();
}

export async function restoreCandidateFromTrash(
    id: string,
    status: Exclude<ColumnStatus, 'Rejected'> = 'New'
): Promise<Candidate> {
    let res: Response;
    try {
        res = await fetch(`${API_URL}/candidates/${id}/restore`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }
    if (!res.ok) throw await parseError(res, 'Failed to restore candidate');
    return res.json();
}

