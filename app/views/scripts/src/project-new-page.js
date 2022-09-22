/* global loggedUser */

import 'nwl-components/dist/style.css';
import NewProjectPage from '../components/NewProjectPage.vue';
import config from './nwl-components-config';
import { createApp } from 'vue';

const app = createApp(NewProjectPage);
app.provide('config', config);
app.provide('user', loggedUser);

app.mount('#app');
