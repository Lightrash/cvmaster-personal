const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const MatchEvaluation = require('../src/models/MatchEvaluation');
const { computeRecommendationMetrics } = require('../src/services/evaluationMetricsService');

dotenv.config();

// Друкує один блок метрик у консоль (overall або по версії методу).
function printMetricsBlock(title, metrics) {
  console.log(`\n=== ${title} ===`);
  console.log(`Sample size: ${metrics.sampleSize}`);
  console.log(`Accuracy: ${metrics.accuracy}`);
  console.log(`Macro Precision: ${metrics.macroPrecision}`);
  console.log(`Macro Recall: ${metrics.macroRecall}`);
  console.log(`Macro F1: ${metrics.macroF1}`);
  console.log(`Score MAE: ${metrics.scoreError.mae} (n=${metrics.scoreError.sampleSize})`);
  console.log(`Score RMSE: ${metrics.scoreError.rmse} (n=${metrics.scoreError.sampleSize})`);

  console.log('\nPer class:');
  Object.entries(metrics.perClass || {}).forEach(([label, data]) => {
    console.log(
      `  ${label}: P=${data.precision}, R=${data.recall}, F1=${data.f1}, TP=${data.tp}, FP=${data.fp}, FN=${data.fn}`
    );
  });

  console.log('\nConfusion matrix (actual -> predicted counts):');
  Object.entries(metrics.confusionMatrix || {}).forEach(([actual, row]) => {
    console.log(
      `  ${actual}: Proceed=${row.Proceed || 0}, Review manually=${row['Review manually'] || 0}, Reject=${row.Reject || 0}`
    );
  });
}

// CLI-скрипт для швидкої валідації якості методу на збережених розмічених кейсах.
async function main() {
  await connectDB();

  try {
    // Беремо тільки записи, де є експертна мітка (ground truth).
    const docs = await MatchEvaluation.find({
      'groundTruth.recommendation': { $in: ['Proceed', 'Review manually', 'Reject'] },
    }).select({
      matchResult: 1,
      groundTruth: 1,
      method: 1,
      createdAt: 1,
    });

    if (!docs.length) {
      console.log('No labeled match evaluations found.');
      console.log('Create evaluations and set ground truth via PATCH /api/match-evaluations/:id/ground-truth');
      return;
    }

    // Загальні метрики по всій вибірці.
    const overallMetrics = computeRecommendationMetrics(docs);
    printMetricsBlock('Overall', overallMetrics);

    // Порівняння якості по версіях методу (modelVersion + pipelineVersion).
    const grouped = {};
    for (const doc of docs) {
      const model = String(doc?.method?.modelVersion || 'unknown-model').trim();
      const pipeline = String(doc?.method?.pipelineVersion || 'unknown-pipeline').trim();
      const key = `${model} | ${pipeline}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(doc);
    }

    for (const [version, rows] of Object.entries(grouped)) {
      printMetricsBlock(`By method version: ${version}`, computeRecommendationMetrics(rows));
    }
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(`[eval] failed: ${error.message}`);
    process.exit(1);
  });
