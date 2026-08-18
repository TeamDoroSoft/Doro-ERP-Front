import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { registerSessionBoundaries } from './router/sessionBoundary'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
app.use(router)

registerSessionBoundaries(router, pinia)

app.mount('#app')
