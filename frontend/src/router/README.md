# 路由架构说明

## 目录结构

```
src/
├── router/                    # 路由核心模块
│   ├── index.ts              # 统一导出入口
│   ├── routes.tsx            # 路由定义和路由树
│   ├── router.tsx            # 路由器实例
│   ├── types.ts              # 类型定义
│   ├── registry.ts           # 路由模块注册中心
│   ├── guards.ts             # 路由守卫
│   └── utils.tsx             # 工具函数
├── layouts/                   # 布局组件
│   ├── index.ts              # 统一导出
│   ├── AdminLayout.tsx       # 后台管理布局
│   ├── AuthLayout.tsx        # 认证页面布局
│   └── BlankLayout.tsx       # 空白布局
└── modules/                   # 功能模块
    ├── index.ts              # 模块统一导出
    └── admin/                # 后台管理模块
        ├── index.ts          # 模块配置（声明式）
        └── pages/            # 页面组件
            ├── Dashboard.tsx
            ├── users/
            ├── roles/
            ├── settings/
            └── logs/
```

## 核心概念

### 1. 路由定义

路由使用 TanStack Router 的代码式路由定义，位于 `src/router/routes.tsx`：

```tsx
// 创建基础路由
export const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: () => (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  ),
})

// 创建懒加载子路由
export const usersRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/users',
}).lazy(() => import('@/modules/admin/pages/users/UserList').then((m) => m.Route))
```

### 2. 页面组件

每个页面组件需要导出一个 `Route` 对象：

```tsx
import { createLazyRoute } from '@tanstack/react-router'

export const Route = createLazyRoute('/admin/users/')({
  component: UserList,
})

function UserList() {
  return <div>用户列表</div>
}
```

### 3. 路由树

路由树在 `routes.tsx` 底部构建：

```tsx
export const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  adminRoute.addChildren([
    adminIndexRoute,
    usersRoute.addChildren([
      usersIndexRoute,
      userDetailRoute,
    ]),
    // ...更多子路由
  ]),
])
```

## 添加新路由

### 步骤 1：创建页面组件

在 `src/modules/admin/pages/` 下创建新的页面文件：

```tsx
// src/modules/admin/pages/example/ExamplePage.tsx
import { createLazyRoute } from '@tanstack/react-router'

export const Route = createLazyRoute('/admin/example')({
  component: ExamplePage,
})

function ExamplePage() {
  return <div>示例页面</div>
}
```

### 步骤 2：注册路由

在 `src/router/routes.tsx` 中添加路由定义：

```tsx
// 添加路由定义
export const exampleRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/example',
}).lazy(() => import('@/modules/admin/pages/example/ExamplePage').then((m) => m.Route))

// 在路由树中添加
export const routeTree = rootRoute.addChildren([
  // ...
  adminRoute.addChildren([
    // ...
    exampleRoute, // 添加新路由
  ]),
])
```

## 路由守卫

### 使用方式

```tsx
import { authGuard, permissionGuard } from '@/router'

export const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/protected',
  beforeLoad: () => {
    authGuard() // 需要登录
  },
})

export const adminOnlyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin-only',
  beforeLoad: () => {
    permissionGuard('admin:access') // 需要特定权限
  },
})
```

### 可用守卫

- `authGuard()` - 需要登录
- `guestGuard()` - 仅限未登录用户
- `permissionGuard(permission)` - 需要特定权限
- `roleGuard(role)` - 需要特定角色

## 布局系统

### AdminLayout

后台管理布局，包含：
- 可折叠侧边栏
- 顶部导航栏
- 面包屑导航
- 用户菜单

### AuthLayout

认证页面布局，包含：
- 左侧品牌展示区
- 右侧表单区

### BlankLayout

空白布局，用于不需要布局的页面。

## 类型定义

### RouteMeta

路由元信息类型：

```tsx
interface RouteMeta {
  title?: string                              // 标题
  icon?: ComponentType<{ className?: string }> // 图标
  hideInMenu?: boolean                         // 菜单中隐藏
  hideInBreadcrumb?: boolean                   // 面包屑中隐藏
  permissions?: string[]                       // 所需权限
  roles?: string[]                            // 所需角色
  order?: number                              // 排序
  keepAlive?: boolean                         // 保持状态
}
```

## 工具函数

```tsx
import {
  flattenRoutes,      // 扁平化路由
  getRouteByPath,     // 根据路径获取路由
  generateMenuFromRoutes, // 生成菜单数据
  generateBreadcrumbs,    // 生成面包屑
  isRouteActive,          // 检查路由是否激活
  parseRouteParams,       // 解析路由参数
} from '@/router'
```

## 最佳实践

1. **模块化组织**：相关页面放在同一模块目录下
2. **懒加载**：使用 `.lazy()` 实现代码分割
3. **类型安全**：使用 TypeScript 确保类型正确
4. **权限控制**：在 `beforeLoad` 中进行权限检查
5. **统一命名**：路由变量使用 `xxxRoute` 命名规范
