/*
 * Defaults for the dashboard. This file is public — keep personal data out of it.
 * Your name, training, lessons and tournaments are added in the app itself and are
 * stored only on your devices and in your private sync (a secret GitHub Gist).
 *
 * For a local Mac setup you can copy this file to config.local.js (git-ignored).
 */
window.DASHBOARD_CONFIG = {
  name: "",
  theme: "damson",          // damson | damson-light | noir | sage | sand | ocean
  currency: "€",

  github: {
    username: "",           // the account your GitHub tasks come from
    token: "",              // only ever in config.local.js, never here
  },

  // Widgets: today, week, stats, github, todo, focus, lessons, lessonsWeek, coachStats, tournaments, igOverview, igChart, igPosts
  spaces: [
    { id: "work",  name: "Work",     icon: "💼", widgets: ["github", "todo", "focus", "today"], repos: [] },
    { id: "sport", name: "Training", icon: "🏋️", widgets: ["today", "tournaments", "week", "stats", "todo"] },
    { id: "coach", name: "Coaching", icon: "🎾", widgets: ["lessons", "lessonsWeek", "tournaments", "coachStats", "todo"] },
    { id: "insta", name: "Instagram", icon: "📸", widgets: ["igOverview", "igChart", "igPosts"] },
    { id: "life",  name: "Personal", icon: "🌿", widgets: ["todo", "week", "focus"] },
  ],

  // Format (normally edited in the app with +):
  //   schedule: { mon: [{ time: "07:30", title: "Gym", duration: 60, type: "gym" }] }   type: gym | tennis | padel | cardio | mobility
  //   lessons:  { mon: [{ time: "16:00", client: "Anna", sport: "padel", duration: 60, place: "Court 2", price: 50 }] }
  schedule: {},
  lessons: {},
};
