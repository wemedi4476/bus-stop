import { onRequestGet as __api_eta__id__js_onRequestGet } from "D:\\work\\PM_Development\\AI\\bustop\\functions\\api\\eta\\[id].js"

export const routes = [
    {
      routePath: "/api/eta/:id",
      mountPath: "/api/eta",
      method: "GET",
      middlewares: [],
      modules: [__api_eta__id__js_onRequestGet],
    },
  ]