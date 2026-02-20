const express = require("express");
const router = express.Router(); // <--- ОЦЕЙ РЯДОК БУВ ПРОПУЩЕНИЙ
const { 
  createVacancy, 
  getVacancies, 
  updateVacancy, 
  deleteVacancy 
} = require("../controllers/vacancyController");
const { protect } = require("../middleware/authMiddleware");

// Маршрут для роботи зі списком (GET та POST)
router.route("/")
  .get(protect, getVacancies)
  .post(protect, createVacancy);

// Маршрут для конкретної вакансії (PUT та DELETE)
router.route("/:id")
  .put(protect, updateVacancy)
  .delete(protect, deleteVacancy);

module.exports = router;