const express = require("express");
const path = require("path");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const {
  analyzeResumeText,
  matchResumeToJob,
} = require("../services/aiService");

const router = express.Router();

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/x-pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/octet-stream",
]);

const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".doc"]);

function getFileExtension(file) {
  return path.extname(file?.originalname || "").toLowerCase();
}

function isAllowedUpload(file) {
  const ext = getFileExtension(file);
  const hasAllowedMime = ALLOWED_MIME_TYPES.has(file?.mimetype);
  const hasAllowedExt = ALLOWED_EXTENSIONS.has(ext);
  return hasAllowedMime && hasAllowedExt;
}

async function extractPdfText(buffer) {
  // pdf-parse v1 API
  if (typeof pdfParse === "function") {
    const result = await pdfParse(buffer);
    return result?.text || "";
  }

  // pdf-parse v2 API
  if (pdfParse && typeof pdfParse.PDFParse === "function") {
    const parser = new pdfParse.PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result?.text || "";
    } finally {
      if (typeof parser.destroy === "function") {
        await parser.destroy().catch(() => {});
      }
    }
  }

  throw new Error("Unsupported pdf-parse API version");
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (isAllowedUpload(file)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only PDF and DOCX files are allowed"), false);
  },
});

/**
 * POST /api/ai/analyze-resume
 * Upload resume (PDF/DOCX), extract text, then analyze via AI service.
 */
router.post("/analyze-resume", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    let resumeText = "";
    const ext = getFileExtension(req.file);

    if (ext === ".pdf") {
      resumeText = await extractPdfText(req.file.buffer);
    } else {
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      resumeText = result.value;
    }

    if (!resumeText || resumeText.trim().length < 50) {
      return res
        .status(400)
        .json({ message: "Could not extract enough text from the file" });
    }

    const trimmedText = resumeText.substring(0, 15000);
    const analysis = await analyzeResumeText(trimmedText);
    return res.json(analysis);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res
      .status(statusCode)
      .json({
        message: error.message || "Failed to analyze resume",
        code: error.code || undefined,
        retryAfterSeconds: error.retryAfterSeconds || undefined,
      });
  }
});

/**
 * POST /api/ai/match
 * Match resume analysis against job requirements.
 */
router.post("/match", async (req, res) => {
  try {
    const { analysis, job } = req.body;

    if (!analysis || !job) {
      return res
        .status(400)
        .json({ message: "Both analysis and job are required" });
    }

    const matchResult = await matchResumeToJob(analysis, job);
    return res.json(matchResult);
  } catch (error) {
    console.error("Match error:", error);
    const statusCode = error.statusCode || 500;
    return res
      .status(statusCode)
      .json({
        message: error.message || "Failed to match candidate",
        code: error.code || undefined,
        retryAfterSeconds: error.retryAfterSeconds || undefined,
      });
  }
});

module.exports = router;
