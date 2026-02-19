// Initialize static icons in HTML on page load
import { icons } from './icons.js';

document.addEventListener('DOMContentLoaded', () => {
    // Replace calendar nav icon
    const calendarNavIcon = document.querySelector('#calendar-btn .nav-icon');
    if (calendarNavIcon) {
        calendarNavIcon.innerHTML = icons.calendar;
        calendarNavIcon.classList.add('icon');
    }

    // Replace agenda nav icon
    const agendaNavIcon = document.querySelector('#agenda-btn .nav-icon');
    if (agendaNavIcon) {
        agendaNavIcon.innerHTML = icons.agenda;
        agendaNavIcon.classList.add('icon');
    }

    // Replace weekly nav icon
    const weeklyNavIcon = document.querySelector('#weekly-btn .nav-icon');
    if (weeklyNavIcon) {
        weeklyNavIcon.innerHTML = icons.weekly;
        weeklyNavIcon.classList.add('icon');
    }

    // Replace user icon
    const loginIcon = document.getElementById('login-icon');
    if (loginIcon) {
        loginIcon.innerHTML = icons.user;
        loginIcon.classList.add('icon');
    }
});
