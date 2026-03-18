const RECOMMENDATION_VALUES = ['Proceed', 'Review manually', 'Reject'];

// Округлення для стабільного та читабельного звіту метрик.
function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function safeRecommendation(value) {
  const normalized = String(value || '').trim();
  return RECOMMENDATION_VALUES.includes(normalized) ? normalized : null;
}

// Розрахунок метрик класифікації:
// predicted = рекомендація методу, actual = recommendation з groundTruth.
function computeRecommendationMetrics(items = []) {
  const rows = items
    .map((item) => {
      const predicted = safeRecommendation(item?.matchResult?.recommendation);
      const actual = safeRecommendation(item?.groundTruth?.recommendation);
      const predictedScore = Number(item?.matchResult?.matchPercentage);
      const actualScore = Number(item?.groundTruth?.score);

      return {
        predicted,
        actual,
        predictedScore: Number.isFinite(predictedScore) ? predictedScore : null,
        actualScore: Number.isFinite(actualScore) ? actualScore : null,
      };
    })
    .filter((row) => row.predicted && row.actual);

  const total = rows.length;
  if (!total) {
    return {
      sampleSize: 0,
      accuracy: null,
      macroPrecision: null,
      macroRecall: null,
      macroF1: null,
      perClass: {},
      confusionMatrix: {},
      scoreError: {
        sampleSize: 0,
        mae: null,
        rmse: null,
      },
    };
  }

  let correct = 0;
  const perClass = {};
  const confusionMatrix = {};

  for (const label of RECOMMENDATION_VALUES) {
    perClass[label] = { tp: 0, fp: 0, fn: 0, precision: 0, recall: 0, f1: 0 };
    confusionMatrix[label] = { Proceed: 0, 'Review manually': 0, Reject: 0 };
  }

  for (const row of rows) {
    if (row.predicted === row.actual) {
      correct += 1;
    }

    confusionMatrix[row.actual][row.predicted] += 1;

    for (const label of RECOMMENDATION_VALUES) {
      if (row.predicted === label && row.actual === label) perClass[label].tp += 1;
      if (row.predicted === label && row.actual !== label) perClass[label].fp += 1;
      if (row.predicted !== label && row.actual === label) perClass[label].fn += 1;
    }
  }

  let precisionSum = 0;
  let recallSum = 0;
  let f1Sum = 0;

  for (const label of RECOMMENDATION_VALUES) {
    const { tp, fp, fn } = perClass[label];
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

    perClass[label].precision = round(precision);
    perClass[label].recall = round(recall);
    perClass[label].f1 = round(f1);

    precisionSum += precision;
    recallSum += recall;
    f1Sum += f1;
  }

  const scoredRows = rows.filter((row) => row.predictedScore !== null && row.actualScore !== null);
  const scoreSampleSize = scoredRows.length;

  let mae = null;
  let rmse = null;
  if (scoreSampleSize > 0) {
    let absErrorSum = 0;
    let squaredErrorSum = 0;
    for (const row of scoredRows) {
      const err = row.predictedScore - row.actualScore;
      absErrorSum += Math.abs(err);
      squaredErrorSum += err * err;
    }
    mae = round(absErrorSum / scoreSampleSize);
    rmse = round(Math.sqrt(squaredErrorSum / scoreSampleSize));
  }

  return {
    sampleSize: total,
    accuracy: round(correct / total),
    macroPrecision: round(precisionSum / RECOMMENDATION_VALUES.length),
    macroRecall: round(recallSum / RECOMMENDATION_VALUES.length),
    macroF1: round(f1Sum / RECOMMENDATION_VALUES.length),
    perClass,
    confusionMatrix,
    scoreError: {
      sampleSize: scoreSampleSize,
      mae,
      rmse,
    },
  };
}

module.exports = {
  RECOMMENDATION_VALUES,
  computeRecommendationMetrics,
};
