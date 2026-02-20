import { mount } from 'svelte';
import './assets/css/styles.css';
import './assets/css/calendar-navigation.css';
import './assets/css/agenda-professional.css';
import './assets/css/dark-mode.css';
import './assets/css/mobile-improvements.css';
import './assets/css/header-footer-minimal.css';
import './assets/css/design-polish.css';
import App from './App.svelte';

const app = mount(App, {
    target: document.getElementById('app')!,
});

export default app;
