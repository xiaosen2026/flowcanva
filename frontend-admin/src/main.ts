import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import './style.css'

const routes = [
  {
    path: '/',
    name: 'MyAssets',
    component: () => import('./pages/MyAssets.vue'),
    meta: { title: '画布项目' },
  },
  {
    path: '/assets',
    name: 'AssetManager',
    component: () => import('./pages/AssetManager.vue'),
    meta: { title: '资产管理' },
  },
  {
    path: '/admin',
    name: 'Dashboard',
    component: () => import('./pages/Dashboard.vue'),
    meta: { title: '仪表盘' },
  },
  {
    path: '/admin/nodes/text',
    component: () => import('./pages/TextNodeConfig.vue'),
    meta: { title: '文本节点' },
  },
  {
    path: '/admin/nodes/image',
    component: () => import('./pages/ImageNodeConfig.vue'),
    meta: { title: '图片节点' },
  },
  {
    path: '/admin/nodes/video',
    component: () => import('./pages/VideoNodeConfig.vue'),
    meta: { title: '视频节点' },
  },
  {
    path: '/admin/nodes/table',
    component: () => import('./pages/TableNodeConfig.vue'),
    meta: { title: '剧本节点' },
  },
  {
    path: '/admin/nodes/full_image',
    component: () => import('./pages/FullImageNodeConfig.vue'),
    meta: { title: '全图节点' },
  },
  {
    path: '/admin/nodes/agent',
    component: () => import('./pages/AgentNodeConfig.vue'),
    meta: { title: '智能体节点' },
  },
  {
    path: '/admin/nodes/workflow',
    component: () => import('./pages/WorkflowNodeConfig.vue'),
    meta: { title: '工作流节点' },
  },
  {
    path: '/admin/nodes/asset',
    component: () => import('./pages/AssetNodeConfig.vue'),
    meta: { title: '资产加载节点' },
  },
  {
    path: '/admin/nodes/director',
    component: () => import('./pages/DirectorNodeConfig.vue'),
    meta: { title: '导演台节点' },
  },
  {
    path: '/admin/logs',
    component: () => import('./pages/Logs.vue'),
    meta: { title: '日志' },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

const app = createApp(App)
app.use(router)
app.mount('#app')
