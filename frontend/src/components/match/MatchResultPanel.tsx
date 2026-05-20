import {
  AlertCircle,
  Brain,
  CheckCircle2,
  ShieldAlert,
  Target,
  XCircle,
} from 'lucide-react';
import type { MatchResult } from '@/types';
import { translateAlignmentBand, translateRoleFamily } from '@/lib/uiText';

interface MatchResultPanelProps {
  matchResult: MatchResult;
  compact?: boolean;
  jobTitle?: string | null;
  detailsVariant?: 'collapsible' | 'expanded';
}

function getRecommendationIcon(recommendation: MatchResult['recommendation']) {
  if (recommendation === 'Proceed') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
  if (recommendation === 'Review manually') return <AlertCircle className="w-3.5 h-3.5 text-amber-500" />;
  return <XCircle className="w-3.5 h-3.5 text-red-500" />;
}

function getRecommendationClasses(recommendation: MatchResult['recommendation']) {
  if (recommendation === 'Proceed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300';
  }
  if (recommendation === 'Review manually') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300';
  }
  return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300';
}

function getScoreColor(score: number) {
  if (score >= 70) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function toPercent(value?: number | null, multiply = false) {
  if (!Number.isFinite(Number(value))) return null;
  const numeric = Number(value);
  return `${Math.round((multiply ? numeric * 100 : numeric) * 10) / 10}%`;
}

function translateRecommendation(recommendation: MatchResult['recommendation']) {
  if (recommendation === 'Proceed') return 'Рекомендується';
  if (recommendation === 'Review manually') return 'Потрібна ручна перевірка';
  return 'Низька відповідність';
}

function getSummaryText(recommendation: MatchResult['recommendation']) {
  if (recommendation === 'Proceed') {
    return 'Кандидат добре відповідає вакансії та може переходити до наступного етапу.';
  }
  if (recommendation === 'Review manually') {
    return 'Є сильні сторони, але варто додатково переглянути профіль вручну.';
  }
  return 'Система бачить суттєву невідповідність між профілем кандидата та вимогами вакансії.';
}

function getAlignmentMeaning(value?: number | null) {
  if (!Number.isFinite(Number(value))) return 'недостатньо даних';
  const numeric = Number(value);
  if (numeric >= 0.75) return 'високий';
  if (numeric >= 0.45) return 'середній';
  return 'низький';
}

function translateDominantSource(source?: string | null) {
  if (source === 'neural') return 'основний змістовий аналіз';
  if (source === 'rule-based-fallback') return 'резервна перевірка за правилами';
  if (source === 'rule-based') return 'додаткова перевірка за правилами';
  return source || 'н/д';
}

export function MatchResultPanel({
  matchResult,
  compact = false,
  jobTitle,
  detailsVariant = 'collapsible',
}: MatchResultPanelProps) {
  const finalScore = Number.isFinite(Number(matchResult.finalMatchScore))
    ? Number(matchResult.finalMatchScore)
    : Number(matchResult.matchPercentage || 0);
  const neuralScore = Number.isFinite(Number(matchResult.neuralMatchScore))
    ? Number(matchResult.neuralMatchScore)
    : null;
  const ruleScore = Number.isFinite(Number(matchResult.ruleBasedMatchScore))
    ? Number(matchResult.ruleBasedMatchScore)
    : null;
  const confidence = matchResult.confidence?.matchConfidenceScore;
  const providerStatus = matchResult.providerStatus || matchResult.neuralBreakdown?.providerStatus || 'ready';
  const providerReasons = matchResult.providerReasons || matchResult.neuralBreakdown?.providerReasons || [];
  const isFallback = providerStatus === 'fallback-rule-based' || (matchResult.providerFlags || []).includes('embeddingProviderUnavailable');
  const similarity = matchResult.neuralBreakdown?.neuralSimilarityComponents;
  const roleContext = matchResult.roleContext;
  const penalties = matchResult.penaltiesApplied;
  const dominantSource = matchResult.finalScoreComposition?.dominantSource || 'neural';

  const detailsContent = (
    <div className="space-y-5">
      <section className="space-y-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Короткий висновок</p>
          <p className="mt-1 text-[13px] text-neutral-600 dark:text-neutral-300">
            {getSummaryText(matchResult.recommendation)}
          </p>
          <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
            Нижче показано, що саме найбільше вплинуло на висновок і на що рекрутеру варто звернути увагу.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
            <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">Підсумкова оцінка</p>
            <p className={`mt-1 text-lg font-bold ${getScoreColor(finalScore)}`}>{finalScore}%</p>
            <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">Це головний показник того, наскільки кандидат підходить саме до цієї вакансії.</p>
          </div>
          <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
            <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">Висновок системи</p>
            <p className="mt-1 text-[13px] font-semibold text-neutral-800 dark:text-neutral-100">{translateRecommendation(matchResult.recommendation)}</p>
            <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">Це коротка підказка, чи варто рухати кандидата далі, чи краще перевірити його вручну.</p>
          </div>
          <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
            <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">Рівень упевненості</p>
            <p className="mt-1 text-[13px] font-semibold text-neutral-800 dark:text-neutral-100">{confidence != null ? toPercent(confidence, true) : 'н/д'}</p>
            <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">Показує, наскільки достатньо в резюме та вакансії даних для надійного автоматичного висновку.</p>
          </div>
        </div>
      </section>

      {similarity && (
        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Як система дійшла цього висновку</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
              <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">Наскільки резюме в цілому підходить</p>
              <p className="mt-1 text-[13px] font-semibold text-neutral-800 dark:text-neutral-100">{toPercent(similarity.neuralOverallAlignment, true)}</p>
              <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">Вищий показник означає, що опис досвіду, ролей і задач кандидата добре збігається з вакансією.</p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
              <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">Наскільки збігаються навички</p>
              <p className="mt-1 text-[13px] font-semibold text-neutral-800 dark:text-neutral-100">{toPercent(similarity.neuralSkillsAlignment, true)}</p>
              <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">Вищий показник означає, що у кандидата є більше потрібних для вакансії навичок та інструментів.</p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
              <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">Наскільки підходить досвід</p>
              <p className="mt-1 text-[13px] font-semibold text-neutral-800 dark:text-neutral-100">{toPercent(similarity.neuralExperienceAlignment, true)}</p>
              <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">Вищий показник означає, що практичний досвід кандидата ближчий до очікувань цієї ролі.</p>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Що ще врахувала система</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
            <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">Перевірка за вимогами вакансії</p>
            <p className="mt-1 text-[13px] font-semibold text-neutral-800 dark:text-neutral-100">{ruleScore != null ? `${ruleScore}%` : 'н/д'}</p>
            <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">Це додаткова перевірка, яка дивиться на важливі навички, рівень і формальні вимоги вакансії.</p>
          </div>

          <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
            <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">Наскільки збігається напрям</p>
            <p className="mt-1 text-[13px] font-semibold text-neutral-800 dark:text-neutral-100">
              {roleContext ? `${translateRoleFamily(roleContext.candidateRoleFamily)} -> ${translateRoleFamily(roleContext.jobRoleFamily)}` : 'н/д'}
            </p>
            {roleContext ? (
              <div className="mt-2 space-y-1 text-[11px] text-neutral-600 dark:text-neutral-300">
                <p>Це показує, наскільки професійний напрям кандидата близький до напряму вакансії.</p>
                <p>Оцінка напряму: {getAlignmentMeaning(roleContext.roleContextAlignment)} ({translateAlignmentBand(roleContext.alignmentBand)}).</p>
                <p>Надійність цього висновку: {toPercent(roleContext.roleContextConfidence, true)}.</p>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">Недостатньо даних, щоб окремо оцінити збіг напряму.</p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Що говорить на користь кандидата</p>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
          <ul className="space-y-1 text-[11px] text-emerald-700/90 dark:text-emerald-300/90">
            {matchResult.strengths.length
              ? matchResult.strengths.map((item) => <li key={item}>- {item}</li>)
              : <li>- Система не виділила окремих сильних сторін.</li>}
          </ul>
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Що може завадити</p>
        <div className="rounded-lg border border-red-200 bg-red-50/60 p-3 dark:border-red-800 dark:bg-red-950/20">
          <ul className="space-y-1 text-[11px] text-red-700/90 dark:text-red-300/90">
            {matchResult.gaps.length
              ? matchResult.gaps.map((item) => <li key={item}>- {item}</li>)
              : <li>- Система не виділила суттєвих прогалин.</li>}
          </ul>
        </div>
      </section>

      {matchResult.missingCriticalSkills && matchResult.missingCriticalSkills.length > 0 && (
        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Чого бракує для цієї вакансії</p>
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-800 dark:bg-amber-950/20">
            <ul className="space-y-1 text-[11px] text-amber-700/90 dark:text-amber-300/90">
              {matchResult.missingCriticalSkills.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Додаткові пояснення</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
            <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">Стан аналізу</p>
            <p className="mt-1 text-[13px] font-semibold text-neutral-800 dark:text-neutral-100">
              {isFallback ? 'Система працює в резервному режимі' : 'Основний режим аналізу активний'}
            </p>
            {providerReasons.length > 0 && (
              <ul className="mt-2 space-y-1 text-[11px] text-neutral-600 dark:text-neutral-300">
                {providerReasons.map((reason) => (
                  <li key={reason}>- {reason}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
            <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">Що зменшило або підсилило оцінку</p>
            {penalties ? (
              <div className="mt-2 space-y-1 text-[11px] text-neutral-600 dark:text-neutral-300">
                <p>Важливі навички: {penalties.criticalPenaltyAdjustment}. Чим нижче значення, тим більше важливих вимог не закрито.</p>
                <p>Надійність оцінки: {penalties.confidenceAdjustment}. Негативне значення означає, що для автоматичного висновку було замало даних.</p>
                <p>Професійний напрям: {penalties.roleContextAdjustment}. Тут видно, чи підтримує або послаблює оцінку збіг напряму кандидата з вакансією.</p>
                <p className="font-semibold text-neutral-800 dark:text-neutral-100">Сумарний вплив додаткових коригувань: {penalties.total}.</p>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">Додаткових пояснень для коригувань немає.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );

  return (
    <div className={`rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 ${compact ? 'p-3 space-y-3' : 'p-4 space-y-4'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-500" />
            <p className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-200">
              Результат оцінювання
            </p>
          </div>
          {jobTitle && (
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Вакансія: {jobTitle}
            </p>
          )}
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
            Основу оцінки формує змістовий аналіз резюме, а окремі перевірки лише уточнюють підсумок.
          </p>
        </div>

        <div className="text-right space-y-2">
          <div className={`text-2xl font-black ${getScoreColor(finalScore)}`}>
            {finalScore}%
          </div>
          <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getRecommendationClasses(matchResult.recommendation)}`}>
            {getRecommendationIcon(matchResult.recommendation)}
            <span>{translateRecommendation(matchResult.recommendation)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px]">
        {neuralScore !== null && (
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
            <Brain className="w-3 h-3" /> Наскільки резюме в цілому підходить: {neuralScore}%
          </span>
        )}
        {ruleScore !== null && (
          <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 font-medium text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300">
            <ShieldAlert className="w-3 h-3" /> Перевірка за вимогами вакансії: {ruleScore}%
          </span>
        )}
        {confidence != null && (
          <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
            Надійність оцінки: {toPercent(confidence, true)}
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
          Тип аналізу: {translateDominantSource(dominantSource)}
        </span>
        {isFallback && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertCircle className="w-3 h-3" /> Резервний режим
          </span>
        )}
      </div>

      {detailsVariant === 'expanded' ? (
        detailsContent
      ) : (
        <details className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
          <summary className="cursor-pointer list-none px-3 py-2.5 text-[12px] font-semibold text-neutral-700 dark:text-neutral-200">
            Деталі оцінювання
          </summary>
          <div className="border-t border-neutral-200 px-3 py-3 dark:border-neutral-700">
            {detailsContent}
          </div>
        </details>
      )}
    </div>
  );
}
