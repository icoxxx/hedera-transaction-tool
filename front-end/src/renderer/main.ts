import './styles/styles.scss';

import { createApp } from 'vue';
import { createPinia } from 'pinia';

import router from '@renderer/router';
import { addGuards } from '@renderer/router/guards';

import ToastPlugin, { useToast } from 'vue-toast-notification';

import DatePicker from '@vuepic/vue-datepicker';

import App from './App.vue';

const app = createApp(App);

/* App use */
app.use(router);

app.use(createPinia());

addGuards(router);

app.use(ToastPlugin);

/* App config */
const toast = useToast();

app.config.errorHandler = (err: any) => {
  console.log(err);

  let message = 'An error occured';

  if (err.message) {
    message = err.message;
  }

  toast.error(message, { position: 'bottom-right' });
};

/* Custom Components */
app.component('DatePicker', DatePicker);

/* App mount */
app.mount('#app');
