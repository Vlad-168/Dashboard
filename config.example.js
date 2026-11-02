/*
 * Скопируй этот файл в config.local.js и впиши свои данные.
 * config.local.js не попадает в git (там твой GitHub‑токен).
 * Всё это можно поменять и в самом дашборде (⚙︎ Настройки) — тогда значения
 * сохранятся в браузере и перекроют этот файл.
 */
window.DASHBOARD_CONFIG = {
  name: "Влад",
  theme: "damson",            // damson | damson-light | noir | sage | sand | ocean

  github: {
    username: "vlad-168",
    token: "",                 // fine-grained PAT: Issues + Pull requests (read)
  },

  // Пространства: какие виджеты видны и какие репозитории GitHub относятся к ним.
  // Виджеты: today, week, github, todo, stats, focus
  spaces: [
    { id: "work",  name: "Работа", icon: "💼", widgets: ["github", "todo", "focus", "today"], repos: [] },
    { id: "sport", name: "Спорт",  icon: "🏋️", widgets: ["today", "week", "stats", "todo"] },
    { id: "life",  name: "Личное", icon: "🌿", widgets: ["todo", "week", "focus"] },
  ],

  // Расписание тренировок: mon tue wed thu fri sat sun
  schedule: {
    mon: [{ time: "07:30", title: "Силовая — верх тела", duration: 60, type: "strength" }],
    tue: [{ time: "19:00", title: "Бег 5 км", duration: 35, type: "cardio" }],
    wed: [{ time: "07:30", title: "Силовая — низ тела", duration: 60, type: "strength" }],
    thu: [{ time: "20:00", title: "Йога / мобильность", duration: 30, type: "mobility" }],
    fri: [{ time: "07:30", title: "Фулбади", duration: 55, type: "strength" }],
    sat: [{ time: "10:00", title: "Длинная пробежка", duration: 60, type: "cardio" }],
    sun: [],
  },
};
