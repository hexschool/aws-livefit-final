import axios from "axios";
import { getDataFromCookieByKey } from "../utils/cookie.js";
import { ROUTE_TABLE } from "../config/routeTable.js";

function verifyRoute(prefix, route, method) {
  const key = `${method}-${prefix}`;
  let notNeedAuth = false;

  const hasSubRoute = route.length > prefix.length;

  if (!Object.hasOwn(ROUTE_TABLE, key) && !hasSubRoute) {
    return notNeedAuth;
  }

  const config = ROUTE_TABLE[key];
  const subRoute = route.replace(prefix, "");

  if (subRoute === "") {
    notNeedAuth = true;
    return notNeedAuth;
  }

  if (config === Array) {
    for (const pattern of config) {
      // 字串完全匹配
      if (typeof pattern === "string" && subRoute === pattern) {
        notNeedAuth = true;
        break;
      }

      // 正則表達式匹配
      if (pattern instanceof RegExp && pattern.test(subRoute)) {
        notNeedAuth = true;
        break;
      }
    }
  }

  return notNeedAuth;
}

function notNeedAuth(url, method) {
  const prefix = url.split("/")[0];

  const isPublicRoute = verifyRoute(prefix, url, method);

  return isPublicRoute;
}

// 建立 axios 實例
const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api/",
  timeout: 10000, // 請求超時時間
});

// 請求攔截器 - 自動添加 token
request.interceptors.request.use(
  (config) => {
    if (notNeedAuth(config.url, config.method)) {
      return config;
    }

    // 從 cookie 中取得 token
    const token = getDataFromCookieByKey("token");

    // 如果有 token 就自動加到 header
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 回應攔截器 - 統一處理錯誤
request.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response) {
      switch (error.response.status) {
        case 400:
          console.error("請求錯誤");
          break;
        case 401:
          console.error("未授權，請重新登入");
          break;
        case 403:
          console.error("沒有權限");
          break;
        case 404:
          console.error("請求的資源不存在");
          break;
        case 500:
          console.error("伺服器錯誤");
          break;
      }
    }
    return Promise.reject(error);
  }
);

export default request;
