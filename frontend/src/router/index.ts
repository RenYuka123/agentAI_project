import { createRouter, createWebHistory } from "vue-router";

const routes = [
  {
    path: "/",
    redirect: "/home",
  },
  {
    path: "/home",
    name: "home",
    component: () => import("../views/HomeView.vue"),
  },
  {
    path: "/chat",
    name: "chat",
    component: () => import("../views/ChatView.vue"),
  },
  {
    path: "/draw_home",
    name: "draw_home",
    component: () => import("../views/DrawHomeView.vue"),
  },
  {
    path: "/single",
    name: "single",
    component: () => import("../views/SinglePlayerView.vue"),
  },
  {
    path: "/multi",
    name: "multi",
    component: () => import("../views/MultiPlayerView.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
