import type { ColumnStatus, Job, MatchResult, ResumeAnalysis } from '@/types';

export const PIPELINE_STAGE_LABELS: Record<ColumnStatus, string> = {
  New: 'Новий',
  Screening: 'Первинний відбір',
  Interview: 'Співбесіда',
  'Test Task': 'Тестове завдання',
  Offer: 'Офер',
  Hired: 'Найнято',
  Rejected: 'Відхилено',
};

export const JOB_STATUS_LABELS: Record<Job['status'], string> = {
  Active: 'Активна',
  Closed: 'Закрита',
  Draft: 'Чернетка',
};

const DEPARTMENT_LABELS: Record<string, string> = {
  Engineering: 'Інженерія',
  Design: 'Дизайн',
  Marketing: 'Маркетинг',
  HR: 'HR',
  Sales: 'Продажі',
  General: 'Загальний',
};

export function translatePipelineStage(status: ColumnStatus) {
  return PIPELINE_STAGE_LABELS[status] || status;
}

export function translateJobStatus(status: Job['status']) {
  return JOB_STATUS_LABELS[status] || status;
}

export function translateDepartment(department: string) {
  return DEPARTMENT_LABELS[department] || department;
}

export function translateCandidateLevel(level: ResumeAnalysis['level'] | string) {
  if (level === 'Senior') return 'Senior';
  if (level === 'Middle') return 'Middle';
  if (level === 'Junior') return 'Junior';
  return level;
}

export function translateRecommendation(recommendation: MatchResult['recommendation']) {
  if (recommendation === 'Proceed') return 'Рекомендується';
  if (recommendation === 'Review manually') return 'Потрібна ручна перевірка';
  return 'Низька відповідність';
}

const ROLE_FAMILY_LABELS: Record<string, string> = {
  backend: 'бекенд',
  frontend: 'фронтенд',
  fullstack: 'фулстек',
  devops: 'DevOps',
  qa: 'QA',
  data: 'дані та аналітика',
  mobile: 'мобільна розробка',
  design: 'дизайн',
  product: 'продукт',
  marketing: 'маркетинг',
  sales: 'продажі',
  hr: 'HR',
  recruiting: 'рекрутинг',
  support: 'підтримка',
  finance: 'фінанси',
  operations: 'операційна діяльність',
  management: 'управління',
  generic: 'загальний профіль',
  unknown: 'не визначено',
};

export function translateRoleFamily(family?: string | null) {
  const normalized = String(family || '').trim().toLowerCase();
  return ROLE_FAMILY_LABELS[normalized] || String(family || 'не визначено');
}

export function translateAlignmentBand(band?: string | null) {
  const normalized = String(band || '').trim().toLowerCase();
  if (normalized === 'strong') return 'сильний';
  if (normalized === 'medium') return 'середній';
  if (normalized === 'weak') return 'слабкий';
  if (normalized === 'neutral') return 'нейтральний';
  return String(band || 'н/д');
}
