import DefaultTheme from 'vitepress/theme';
import './custom.css';
import TapDemo from '../../demos/TapDemo.vue';
import DoubleTapDemo from '../../demos/DoubleTapDemo.vue';
import LongPressDemo from '../../demos/LongPressDemo.vue';
import SwipeDemo from '../../demos/SwipeDemo.vue';
import PanDemo from '../../demos/PanDemo.vue';
import PinchDemo from '../../demos/PinchDemo.vue';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('TapDemo', TapDemo);
    app.component('DoubleTapDemo', DoubleTapDemo);
    app.component('LongPressDemo', LongPressDemo);
    app.component('SwipeDemo', SwipeDemo);
    app.component('PanDemo', PanDemo);
    app.component('PinchDemo', PinchDemo);
  },
};
