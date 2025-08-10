import { createApp } from 'vue';
import App from './App.vue';
import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';

// Import icons
import * as Icons from '@ant-design/icons-vue';

const app = createApp(App);

// Use Ant Design Vue
app.use(Antd);

// Register icons globally
Object.keys(Icons).forEach(key => {
  app.component(key, Icons[key]);
});

app.mount('#app');