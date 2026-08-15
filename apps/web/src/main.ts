import { createApp } from 'vue';
import App from './App.vue';
import { createAppRouter } from './router';
import './styles/tactical-theme.css';

const app = createApp(App);
app.use(createAppRouter());
app.mount('#app');
