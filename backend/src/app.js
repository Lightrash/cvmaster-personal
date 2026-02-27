const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { startTrashCleanupScheduler } = require('./services/trashCleanupService');

const authRoutes = require('./routes/authRoutes');
const candidateRoutes = require('./routes/candidateRoutes');

dotenv.config();

const app = express();

// Models
require('./models/User');
require('./models/Candidate');
require('./models/CV');
require('./models/Position');
require('./models/Vacancy');
require('./models/CandidateStatus');
require('./models/Application');

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/vacancies', require('./routes/vacancyRoutes'));
app.use('/api/applications', require('./routes/applicationRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/jobs', require('./routes/jobRoutes'));

app.get('/', (req, res) => {
  res.send('HR CRM API is running');
});

const PORT = Number(process.env.PORT) || 5000;

const start = async () => {
  let cleanupTimer = null;
  try {
    await connectDB();
    cleanupTimer = startTrashCleanupScheduler();
    app.listen(PORT, () => {
      console.log(`[server] listening on port ${PORT}`);
    });
  } catch (error) {
    if (cleanupTimer) {
      clearInterval(cleanupTimer);
    }
    console.error(`[server] startup failed: ${error.message}`);
    process.exit(1);
  }
};

start();
