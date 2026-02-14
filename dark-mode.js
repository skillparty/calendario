// Dark Mode Toggle for Calendar10
import { icons } from './icons.js';

// Initialize theme on page load
function initTheme() {
    // Check for saved theme preference or default to light mode
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

// Toggle between light and dark mode
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    // Add animation class
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
        toggleBtn.classList.add('animating');
        setTimeout(() => toggleBtn.classList.remove('animating'), 500);
    }
    
    // Apply new theme
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update icon
    updateThemeIcon(newTheme);
}

// Update the theme toggle icon
/** @param {string} theme */
function updateThemeIcon(theme) {
    const iconContainer = document.getElementById('theme-icon');
    if (iconContainer) {
        // Show sun icon in dark mode (to switch to light)
        // Show moon icon in light mode (to switch to dark)
        iconContainer.innerHTML = theme === 'dark' ? icons.sun : icons.moon;
    }
}

// Setup theme toggle button
function setupThemeToggle() {
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleTheme);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupThemeToggle();
});

// Export for use in other modules
export { toggleTheme, initTheme };
