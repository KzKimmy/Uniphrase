import { createPinia } from 'pinia'
import { createApp } from 'vue'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import App from './App.vue'
import { applyTheme, readTheme } from './lib/theme'
import './assets/main.css'

applyTheme(readTheme())

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
