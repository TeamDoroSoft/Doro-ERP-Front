import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { registerUnauthorizedHandler } from './api/http'
import { useOperatorSessionStore } from './stores/operatorSession'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
app.use(router)

registerUnauthorizedHandler(() => {
  useOperatorSessionStore(pinia).clearSession()
  if (router.currentRoute.value.path !== '/login') {
    void router.push({ path: '/login', query: { reason: 'session-expired' } })
  }
})

app.mount('#app')
