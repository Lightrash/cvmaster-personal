const strongProfile = {
  position: 'Senior Backend Engineer',
  summary: 'Backend engineer building Node.js APIs and cloud systems',
  skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'AWS', 'Redis'],
  technologies: ['Node', 'TS', 'Postgres', 'Kubernetes', 'CI/CD'],
  softSkills: ['Communication', 'Leadership'],
  languages: ['English', 'Ukrainian'],
  education: 'Master of Computer Science',
  yearsOfExperience: 6,
  relevantYearsExperience: 5,
  workHistory: [
    {
      title: 'Senior Backend Engineer',
      startDate: '2021',
      endDate: 'Present',
      description: 'Node.js TypeScript PostgreSQL AWS Docker',
    },
  ],
};

const noisyProfile = {
  position: 'Developer',
  summary: 'Generalist developer',
  skills: [
    'HTML', 'CSS', 'JavaScript', 'TypeScript', 'React', 'Vue', 'Angular', 'Node.js', 'Express', 'MongoDB',
    'PostgreSQL', 'Redis', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'GraphQL', 'REST API', 'Jest'
  ],
  technologies: ['HTML', 'CSS'],
  yearsOfExperience: 2,
  workHistory: [
    {
      title: 'Developer',
      startDate: '2023',
      endDate: 'Present',
      description: 'Did web development',
    },
  ],
};

const weakHardSoftProfile = {
  position: 'Junior Specialist',
  summary: 'Fast learner',
  skills: ['Word'],
  technologies: [],
  softSkills: ['Communication', 'Empathy', 'Teamwork', 'Creativity', 'Leadership', 'Adaptability'],
  yearsOfExperience: 0,
};

const heuristicYearsProfile = {
  position: 'Backend Developer',
  skills: ['Node.js', 'TypeScript'],
  technologies: ['PostgreSQL'],
  yearsOfExperience: 8,
  workHistory: [
    {
      title: 'Backend Developer',
      startDate: '2021',
      endDate: 'Present',
      description: 'Node.js TypeScript PostgreSQL APIs',
    },
    {
      title: 'Frontend Developer',
      startDate: '2017',
      endDate: '2021',
      description: 'React UI work',
    },
  ],
};

const explicitYearsProfile = {
  ...heuristicYearsProfile,
  relevantYearsExperience: 3,
};

const strongJob = {
  title: 'Senior Backend Engineer',
  requirements: ['Must have Node.js', 'Required TypeScript', 'Mandatory PostgreSQL', 'Nice to have Redis'],
  stack: ['Docker', 'AWS'],
};

const partialJob = {
  title: 'Middle Backend Engineer',
  requirements: ['Must have Node.js', 'Required PostgreSQL', 'Mandatory AWS'],
  stack: ['Docker'],
};

const sparseJob = {
  title: 'Engineer',
  requirements: ['Node.js'],
};

const explicitOnlyJob = {
  title: 'Backend Engineer',
  criticalSkills: ['Node.js'],
  coreSkills: ['TypeScript'],
  optionalSkills: ['Redis'],
  requirements: ['Must have Java', 'Nice to have Kafka'],
  stack: ['PostgreSQL'],
};

module.exports = {
  strongProfile,
  noisyProfile,
  weakHardSoftProfile,
  heuristicYearsProfile,
  explicitYearsProfile,
  strongJob,
  partialJob,
  sparseJob,
  explicitOnlyJob,
};
