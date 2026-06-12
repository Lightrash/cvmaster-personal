# CVMaster — Інтелектуальна система оцінювання відповідності кандидатів

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?style=for-the-badge&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google%20Gemini-AI-4285F4?style=for-the-badge&logo=google&logoColor=white)

**Кваліфікаційна робота бакалавра · ХНУ · 2026**

</div>

---

## Про проєкт

CVMaster — це повнофункціональна ATS-система (Applicant Tracking System) з інтелектуальним модулем оцінювання відповідності кандидатів. В основі системи лежить **гібридний метод нейромережевого оцінювання** (Hybrid Scoring Method v1.0), який поєднує семантичний аналіз на основі векторних представлень (embeddings) з детермінованим алгоритмом калібрування результату.

Система автоматично обробляє резюме у форматах PDF та DOCX, формує структурований профіль кандидата за допомогою великої мовної моделі (LLM), будує семантичні вектори для кандидата та вакансії, обчислює показники відповідності та формує обґрунтоване рішення щодо кожного кандидата.

**Тема кваліфікаційної роботи:** Метод нейромережевого оцінювання відповідності кандидатів вимогам вакансій за текстовими даними резюме.

---

## Технологічний стек

### Серверна частина

| Компонент | Технологія | Версія |
|---|---|---|
| Середовище виконання | Node.js | 22.x |
| Веб-фреймворк | Express | 5.x |
| База даних | MongoDB + Mongoose | 7.x / 9.x |
| LLM-провайдер | Google Gemini 2.5 Flash | `gemini-2.5-flash` |
| Embedding-модель | Google Gemini Embedding | `gemini-embedding-001` |
| SDK для Gemini API | `@google/generative-ai` | ^0.24.1 |
| Парсинг PDF | `pdf-parse` | ^2.4.5 |
| Парсинг DOCX | `mammoth` | ^1.11.0 |
| Аутентифікація | JWT + bcryptjs | — |
| Завантаження файлів | multer | ^2.0.2 |

### Клієнтська частина

| Компонент | Технологія | Версія |
|---|---|---|
| UI-фреймворк | React | 19.x |
| Мова | TypeScript | ~5.9 |
| Збирач | Vite | 7.x |
| Стилі | Tailwind CSS | 4.x |
| Компоненти | shadcn/ui + Radix UI | — |
| Стан | Zustand | 5.x |
| Маршрутизація | React Router | 7.x |
| HTTP-клієнт | axios | ^1.x |
| DnD (Kanban) | @dnd-kit | — |

---

## Архітектура інтелектуального модуля

Модуль оцінювання відповідності складається з п'яти послідовних шарів обробки:

```
 PDF / DOCX
     │
     ▼
┌─────────────────────────────┐
│  1. Витягування тексту      │  pdf-parse / mammoth → обрізка до 15 000 символів
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  2. LLM-аналіз резюме       │  Gemini 2.5 Flash → структурований JSON-профіль
│                             │  (навички, досвід, освіта, мови, рівень)
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  3. Нормалізація профілю    │  Детермінований підрахунок зваженого
│                             │  скору профілю: досвід×0.40 + hardSkills×0.32
│                             │  + softSkills×0.10 + мови×0.10 + освіта×0.08
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  4. Семантичне зіставлення  │  Gemini Embedding → 6 векторів (кандидат/вакансія:
│     (Neural Match Score)    │  загальний / навички / досвід)
│                             │  cosine similarity → similarity01 → зважена сума:
│                             │  0.50×overall + 0.30×skills + 0.20×experience
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  5. Детермінований          │  9 коригувальних Δ-факторів (покриття критичних
│     калібратор результату   │  навичок, штраф за рівень, домен-гард тощо)
│                             │  → finalMatchScore → рішення:
│                             │  ≥70 Proceed / ≥40 Review manually / <40 Reject
└─────────────────────────────┘
```

### Ключові характеристики методу

- **Neural Match Score** = `100 × (0.50 × overallAlignment + 0.30 × skillsAlignment + 0.20 × experienceAlignment)`
- **Similarity01** = `clamp((cosine(L, R) + 1) / 2, 0, 1)` з L2-нормалізацією векторів
- **9 коригувальних Δ-факторів:** покриття критичних/базових/опційних навичок, відповідність досвіду та рівня, домен-гард, штраф за низьку впевненість, бонус за перекриття стеку, заглушка-мок
- **5 умов пониження рекомендації** Proceed → Review manually (незалежно від числового скору)
- **Ієрархія навичок:** exact=1.00 / synonym=0.85 / related=0.50 / token-overlap=0.35 / none=0
- **9 рольових сімей:** backend / frontend / qa / devops / data / mobile / fullstack / recruiting / generic

---

## Встановлення та запуск

### Вимоги

- Node.js >= 18.x
- MongoDB (локально або Atlas) — необов'язково, є fallback на in-memory
- Ключ Gemini API (`GEMINI_API_KEY`)

### 1. Клонування репозиторію

```bash
git clone https://github.com/Lightrash/cvmaster-personal.git
cd cvmaster-personal
```

### 2. Серверна частина

```bash
cd backend
npm install
```

Створіть файл `.env` у директорії `backend/` (див. розділ [Змінні середовища](#змінні-середовища)).

```bash
npm run dev        # режим розробки (nodemon)
# або
npm start          # продакшн-запуск
```

Сервер запускається на `http://localhost:5000`.

### 3. Клієнтська частина

```bash
cd frontend
npm install
npm run dev        # запуск Vite dev-сервера
```

Клієнт доступний на `http://localhost:5173`.

---

## Змінні середовища

Створіть файл `backend/.env` на основі наступного шаблону:

| Змінна | Обов'язкова | Опис |
|---|---|---|
| `GEMINI_API_KEY` | Так | API-ключ Google Gemini (LLM + Embedding) |
| `MONGO_URI` | Ні | URI підключення до MongoDB. Якщо не задано — використовується in-memory MongoDB |
| `JWT_SECRET` | Так | Секретний рядок для підпису JWT-токенів |
| `PORT` | Ні | Порт API-сервера (за замовчуванням `5000`) |
| `AI_MOCK` | Ні | `true` — відключає реальні Gemini-виклики, використовує regex-евристики |
| `MATCH_METHOD_MODE` | Ні | `llm` — перемикає режим зіставлення; за замовчуванням детермінований |
| `AI_FALLBACK_ON_QUOTA` | Ні | `false` — вимикає fallback при вичерпанні ліміту API |

```env
GEMINI_API_KEY=your_api_key_here
MONGO_URI=mongodb://localhost:27017/cvmaster
JWT_SECRET=your_jwt_secret_here
PORT=5000
```

---

## Структура проєкту

```
cvmaster-personal/
├── backend/
│   ├── src/
│   │   ├── app.js                        # Точка входу Express
│   │   ├── config/
│   │   │   └── db.js                     # Підключення до MongoDB
│   │   ├── models/                       # Mongoose-схеми
│   │   │   ├── User.js
│   │   │   ├── Candidate.js
│   │   │   ├── Vacancy.js
│   │   │   ├── Application.js
│   │   │   ├── MatchEvaluation.js
│   │   │   └── ...
│   │   ├── routes/                       # REST API маршрути
│   │   │   ├── aiRoutes.js               # POST /api/ai/analyze-resume, /match
│   │   │   ├── vacancyRoutes.js
│   │   │   ├── candidateRoutes.js
│   │   │   └── ...
│   │   └── services/                     # Бізнес-логіка
│   │       ├── aiService.js              # LLM-аналіз + оркестрація пайплайну
│   │       ├── deterministicScoringService.js  # Нормалізація + калібрування
│   │       └── evaluationMetricsService.js
│   └── scripts/
│       └── batch-research.js             # Скрипт масового експериментального дослідження
└── frontend/
    └── src/
        ├── pages/                        # Dashboard, Jobs, CandidateProfile, Auth
        ├── components/                   # UI-компоненти
        ├── store/                        # Zustand-стори
        └── services/                     # HTTP-клієнти (axios)
```

---

## API

| Метод | Маршрут | Опис |
|---|---|---|
| `POST` | `/api/ai/analyze-resume` | Завантаження резюме (PDF/DOCX), повертає JSON-профіль |
| `POST` | `/api/ai/match` | Зіставлення профілю з вакансією, повертає скор і рекомендацію |
| `GET` | `/api/vacancies` | Список усіх вакансій |
| `POST` | `/api/vacancies` | Створення вакансії |
| `GET` | `/api/candidates` | Список кандидатів |
| `POST` | `/api/auth/login` | Аутентифікація, повертає JWT |
| `POST` | `/api/auth/register` | Реєстрація користувача |

---

## Автор

**Кузьмук Владислав**
Студент групи КН-22-3
Хмельницький національний університет
2026

---

<div align="center">
  <sub>Кваліфікаційна робота бакалавра · Спеціальність 122 «Комп'ютерні науки» · ХНУ · 2026</sub>
</div>
