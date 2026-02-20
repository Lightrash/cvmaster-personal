const Application = require('../models/Application');

exports.applyToVacancy = async (req, res) => {
  try {
    const { candidateId, vacancyId } = req.body;
    
    // Створюємо запис про відгук
    const application = await Application.create({
      candidate: candidateId,
      vacancy: vacancyId,
      status: 'Новий'
    });

    res.status(201).json(application);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getApplications = async (req, res) => {
  try {
    // populate підтягне реальні дані Кандидата та Вакансії замість просто ID
    const apps = await Application.find()
      .populate('candidate', 'name email')
      .populate('vacancy', 'title salary');
    res.json(apps);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};