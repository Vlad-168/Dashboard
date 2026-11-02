/*
 * Скопируй этот файл в config.local.js и впиши свои данные.
 * config.local.js не попадает в git (там твой GitHub‑токен).
 * Всё это можно поменять и в самом дашборде (⚙︎ Настройки) — тогда значения
 * сохранятся в браузере и перекроют этот файл.
 */
window.DASHBOARD_CONFIG = {
  name: "",            // имя для приветствия — задаётся в ⚙︎ и синхронизируется
  theme: "damson",            // damson | damson-light | noir | sage | sand | ocean

  github: {
    username: "",          // ник аккаунта, с которого нужны задачи (задаётся в ⚙︎)
    token: "",                 // fine-grained PAT: Issues + Pull requests (read)
  },

  // Пространства: какие виджеты видны и какие репозитории GitHub относятся к ним.
  // Виджеты: today, week, stats, github, todo, focus, lessons, lessonsWeek, coachStats, tournaments
  spaces: [
    { id: "work",  name: "Работа",  icon: "💼", widgets: ["github", "todo", "focus", "today"], repos: [] },
    { id: "sport", name: "Спорт",   icon: "🏋️", widgets: ["today", "tournaments", "week", "stats", "todo"] },
    { id: "coach", name: "Коучинг", icon: "🎾", widgets: ["lessons", "lessonsWeek", "tournaments", "coachStats", "todo"] },
    { id: "life",  name: "Личное",  icon: "🌿", widgets: ["todo", "week", "focus"] },
  ],

  // Мои тренировки и занятия с учениками задаются в ⚙︎ и хранятся только
  // на твоих устройствах и в приватной синхронизации — не в этом публичном файле.
  // Формат (для config.local.js):
  //   schedule: { mon: [{ time: "07:30", title: "Зал", duration: 60, type: "gym" }], ... }
  //     type: gym | tennis | padel | cardio | mobility
  //   lessons:  { mon: [{ time: "16:00", client: "Анна", sport: "padel", duration: 60, place: "Корт 2", price: 50 }], ... }
  //     sport: tennis | padel;  duration: 60 | 90 | 120
  currency: "€",
  schedule: {},
  lessons: {},
};
