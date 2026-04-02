import DefaultTheme from 'vitepress/theme';
import './custom.css';
import TapDemo from '../../demos/TapDemo.vue';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('TapDemo', TapDemo);
  },
};
