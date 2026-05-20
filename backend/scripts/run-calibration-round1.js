require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { applyDeterministicProfileScoring } = require('../src/services/deterministicScoringService');
const { computeNeuralMatchScore } = require('../src/services/neuralMatchingService');

const scenarios = [
  {
    id: 'same_domain_exact',
    label: 'Middle Python Backend -> Middle Python Backend',
    candidateDescription: 'Middle Python backend developer with FastAPI, PostgreSQL, REST API and Docker.',
    jobDescription: 'Middle Python backend vacancy with matching critical/core stack.',
    candidate: {
      firstName: 'Oleh',
      lastName: 'Pylypenko',
      position: 'Middle Python Backend Developer',
      summary:
        'Middle backend developer building REST APIs and internal services with Python, FastAPI and PostgreSQL. Works with Docker, authentication flows and integrations.',
      yearsOfExperience: 4,
      skills: ['Python', 'FastAPI', 'REST API', 'PostgreSQL', 'Docker', 'Git'],
      technologies: ['Python', 'FastAPI', 'PostgreSQL', 'Docker', 'Redis'],
      softSkills: ['communication', 'ownership'],
      languages: ['English'],
      education: 'Bachelor of Computer Science',
      workHistory: [
        {
          title: 'Python Backend Developer',
          company: 'API Tools',
          summary: 'Built backend services, integrations and auth APIs for B2B platform.',
          responsibilities: ['Design REST APIs', 'Optimize PostgreSQL queries', 'Deploy Dockerized services'],
        },
      ],
      projects: [
        {
          title: 'Billing API',
          description: 'FastAPI service with PostgreSQL, Redis and Docker for payment workflows.',
        },
      ],
    },
    job: {
      title: 'Middle Python Backend Developer',
      description: 'Build backend services and APIs for product platform.',
      requirements: [
        'Required: 3+ years of backend development experience',
        'Required: strong Python and FastAPI or Django background',
        'Required: PostgreSQL and REST API design',
        'Nice to have: Docker and Redis',
      ],
      stack: ['Python', 'FastAPI', 'PostgreSQL', 'Docker', 'Redis'],
      criticalSkills: ['Python', 'FastAPI', 'PostgreSQL'],
      coreSkills: ['REST API', 'Docker'],
      optionalSkills: ['Redis'],
    },
  },
  {
    id: 'same_domain_level_gap',
    label: 'Junior Python -> Middle Python',
    candidateDescription: 'Junior Python developer with good stack overlap but only two years of experience.',
    jobDescription: 'Middle Python backend vacancy expecting independent delivery.',
    candidate: {
      firstName: 'Ira',
      lastName: 'Bondar',
      position: 'Junior Python Developer',
      summary:
        'Junior Python developer with commercial experience in backend tasks, CRUD APIs and SQL. Comfortable with FastAPI and teamwork but still growing to middle level.',
      yearsOfExperience: 2,
      skills: ['Python', 'FastAPI', 'SQL', 'REST API'],
      technologies: ['Python', 'FastAPI', 'PostgreSQL'],
      softSkills: ['learning agility', 'communication'],
      languages: ['English'],
      education: 'Bachelor of Applied Mathematics',
      workHistory: [
        {
          title: 'Junior Python Developer',
          company: 'CRM Lab',
          summary: 'Implemented backend endpoints and fixed bugs in API modules.',
          responsibilities: ['Support REST endpoints', 'Write SQL queries', 'Maintain FastAPI services'],
        },
      ],
      projects: [
        {
          title: 'Task Tracker API',
          description: 'Educational API on FastAPI with PostgreSQL and JWT auth.',
        },
      ],
    },
    job: {
      title: 'Middle Python Developer',
      description: 'Own backend features and maintain Python services.',
      requirements: [
        'Required: 3+ years of Python backend development',
        'Required: FastAPI or Django',
        'Required: PostgreSQL and REST API experience',
      ],
      stack: ['Python', 'FastAPI', 'PostgreSQL', 'Docker'],
      criticalSkills: ['Python', 'FastAPI', 'PostgreSQL'],
      coreSkills: ['REST API', 'Docker'],
      optionalSkills: ['Redis'],
    },
  },
  {
    id: 'adjacent_technical',
    label: 'Python Backend -> Node.js Backend',
    candidateDescription: 'Middle Python backend engineer moving between backend ecosystems.',
    jobDescription: 'Middle Node.js backend vacancy with TypeScript and PostgreSQL.',
    candidate: {
      firstName: 'Dmytro',
      lastName: 'Koval',
      position: 'Middle Python Backend Developer',
      summary:
        'Backend engineer with Python APIs, SQL, integrations and Dockerized services. Strong backend fundamentals, auth, asynchronous jobs and service architecture.',
      yearsOfExperience: 4,
      skills: ['Python', 'FastAPI', 'REST API', 'PostgreSQL', 'Docker', 'Microservices'],
      technologies: ['Python', 'FastAPI', 'PostgreSQL', 'Docker', 'RabbitMQ'],
      softSkills: ['problem solving', 'communication'],
      languages: ['English'],
      education: 'Bachelor of Computer Engineering',
      workHistory: [
        {
          title: 'Backend Developer',
          company: 'FlowOps',
          summary: 'Built APIs and internal platform services for logistics product.',
          responsibilities: ['Develop backend services', 'Design SQL schemas', 'Maintain Docker deployments'],
        },
      ],
      projects: [
        {
          title: 'Notification service',
          description: 'Backend microservice with async workers, queues and API integrations.',
        },
      ],
    },
    job: {
      title: 'Middle Node.js Backend Developer',
      description: 'Develop backend services on Node.js and TypeScript.',
      requirements: [
        'Required: 3+ years of backend development',
        'Required: Node.js and TypeScript',
        'Required: PostgreSQL, REST API and Docker',
      ],
      stack: ['Node.js', 'TypeScript', 'PostgreSQL', 'Docker'],
      criticalSkills: ['Node.js', 'TypeScript'],
      coreSkills: ['PostgreSQL', 'REST API', 'Docker'],
      optionalSkills: ['Microservices'],
    },
  },
  {
    id: 'cross_domain_mismatch',
    label: 'Junior Recruiter -> Middle Python Backend Developer',
    candidateDescription: 'Junior recruiter with HR and sourcing background, no technical delivery skills.',
    jobDescription: 'Technical Python backend vacancy.',
    candidate: {
      firstName: 'Anna',
      lastName: 'Lysenko',
      position: 'Junior Recruiter',
      summary:
        'Junior recruiter with experience in sourcing, screening candidates, coordinating interviews and maintaining ATS processes for hiring teams.',
      yearsOfExperience: 2,
      skills: ['Recruitment', 'Sourcing', 'Interviewing', 'Candidate communication', 'ATS'],
      technologies: ['LinkedIn Recruiter', 'ATS', 'Excel'],
      softSkills: ['communication', 'organization', 'negotiation'],
      languages: ['English'],
      education: 'Bachelor of Psychology',
      workHistory: [
        {
          title: 'Junior Recruiter',
          company: 'TalentHub',
          summary: 'Closed hiring pipeline tasks, sourced candidates and coordinated interviews.',
          responsibilities: ['Source candidates', 'Screen resumes', 'Schedule interviews'],
        },
      ],
      projects: [
        {
          title: 'Hiring funnel improvement',
          description: 'Improved sourcing process and reporting for recruiter team.',
        },
      ],
    },
    job: {
      title: 'Middle Python Backend Developer',
      description: 'Develop backend services, APIs and integrations.',
      requirements: [
        'Required: 3+ years of backend development',
        'Required: Python and FastAPI or Django',
        'Required: PostgreSQL, REST API, Docker',
      ],
      stack: ['Python', 'FastAPI', 'PostgreSQL', 'Docker'],
      criticalSkills: ['Python', 'FastAPI', 'PostgreSQL'],
      coreSkills: ['REST API', 'Docker'],
      optionalSkills: ['Redis'],
    },
  },
  {
    id: 'missing_critical',
    label: 'Backend generalist missing PostgreSQL critical',
    candidateDescription: 'Strong backend profile without direct PostgreSQL evidence.',
    jobDescription: 'Backend vacancy with PostgreSQL as a hard critical requirement.',
    candidate: {
      firstName: 'Taras',
      lastName: 'Melnyk',
      position: 'Middle Backend Developer',
      summary:
        'Backend developer delivering APIs, integrations and authentication flows with Node.js and MongoDB. Works with Docker and cloud deployments.',
      yearsOfExperience: 4,
      skills: ['Node.js', 'Express', 'REST API', 'Docker', 'AWS', 'MongoDB'],
      technologies: ['Node.js', 'Express', 'MongoDB', 'Docker', 'AWS'],
      softSkills: ['ownership', 'communication'],
      languages: ['English'],
      education: 'Bachelor of Software Engineering',
      workHistory: [
        {
          title: 'Backend Developer',
          company: 'CloudCore',
          summary: 'Built backend APIs and auth modules for SaaS product.',
          responsibilities: ['Create REST APIs', 'Deploy Docker services', 'Maintain MongoDB schemas'],
        },
      ],
      projects: [
        {
          title: 'Billing backend',
          description: 'Node.js backend with auth, queues and Docker deployment.',
        },
      ],
    },
    job: {
      title: 'Middle Backend Developer',
      description: 'Build backend services with a PostgreSQL-heavy data layer.',
      requirements: [
        'Required: Node.js backend experience',
        'Required: PostgreSQL',
        'Required: REST API and Docker',
      ],
      stack: ['Node.js', 'PostgreSQL', 'Docker'],
      criticalSkills: ['Node.js', 'PostgreSQL'],
      coreSkills: ['REST API', 'Docker'],
      optionalSkills: ['AWS'],
    },
  },
  {
    id: 'sparse_vacancy',
    label: 'Good candidate -> Sparse backend vacancy',
    candidateDescription: 'Relevant backend candidate against weakly specified vacancy.',
    jobDescription: 'Vacancy with title and very generic description only.',
    candidate: {
      firstName: 'Roman',
      lastName: 'Yaremchuk',
      position: 'Middle Backend Developer',
      summary:
        'Backend developer building REST services and integrations using Node.js, PostgreSQL and Docker in product teams.',
      yearsOfExperience: 4,
      skills: ['Node.js', 'REST API', 'PostgreSQL', 'Docker'],
      technologies: ['Node.js', 'PostgreSQL', 'Docker'],
      softSkills: ['communication', 'ownership'],
      languages: ['English'],
      education: 'Bachelor of Computer Science',
      workHistory: [
        {
          title: 'Backend Developer',
          company: 'CoreApps',
          summary: 'Developed APIs and integrations for internal business tools.',
          responsibilities: ['Develop services', 'Design database queries', 'Deploy Dockerized apps'],
        },
      ],
    },
    job: {
      title: 'Backend Developer',
      description: 'Looking for a proactive specialist to join our team and build product features.',
      requirements: ['Good communication and team spirit.'],
      stack: [],
      criticalSkills: [],
      coreSkills: [],
      optionalSkills: [],
    },
  },
];

function summarize(result) {
  return {
    neuralMatchScore: result.neuralMatchScore,
    ruleBasedMatchScore: result.ruleBasedMatchScore,
    finalMatchScore: result.finalMatchScore,
    confidence: result.confidence?.matchConfidenceScore ?? null,
    recommendation: result.recommendation,
    penaltiesApplied: result.penaltiesApplied || null,
    roleContext: result.roleContext
      ? {
          candidateRoleFamily: result.roleContext.candidateRoleFamily,
          jobRoleFamily: result.roleContext.jobRoleFamily,
          alignmentBand: result.roleContext.alignmentBand,
          effectiveAdjustment: result.roleContext.effectiveAdjustment,
        }
      : null,
    missingCriticalSkills: result.missingCriticalSkills || [],
  };
}

async function run() {
  const output = [];
  for (const scenario of scenarios) {
    const scoredCandidate = applyDeterministicProfileScoring(scenario.candidate);
    const result = await computeNeuralMatchScore(scoredCandidate, scenario.candidate, scenario.job);
    output.push({
      id: scenario.id,
      label: scenario.label,
      candidateDescription: scenario.candidateDescription,
      jobDescription: scenario.jobDescription,
      profileLevel: scoredCandidate.level,
      profileOverallScore: scoredCandidate.overallScore,
      result: summarize(result),
    });
  }
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
