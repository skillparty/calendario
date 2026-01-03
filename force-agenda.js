// FORCE AGENDA MODULE TO ALWAYS BE VISIBLE
(function() {
    'use strict';
    
    function forceAgendaVisible() {
        const agendaView = document.getElementById('agenda-view');
        if (agendaView) {
            // Remove hidden class
            agendaView.classList.remove('hidden');
            
            // Force styles
            agendaView.style.display = 'block';
            agendaView.style.visibility = 'visible';
            agendaView.style.opacity = '1';
            agendaView.style.position = 'relative';
            agendaView.style.zIndex = '999';
            agendaView.style.width = '100%';
            agendaView.style.height = 'auto';
            
            // Override any inline styles that might hide it
            if (agendaView.style.display === 'none') {
                agendaView.style.display = 'block';
            }
            if (agendaView.style.visibility === 'hidden') {
                agendaView.style.visibility = 'visible';
            }
            if (agendaView.style.opacity === '0') {
                agendaView.style.opacity = '1';
            }
        }
    }
    
    // Force visibility immediately
    forceAgendaVisible();
    
    // Force visibility on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', forceAgendaVisible);
    } else {
        forceAgendaVisible();
    }
    
    // Force visibility every 50ms to override any JavaScript that tries to hide it
    setInterval(forceAgendaVisible, 50);
    
    // Additional nuclear option - force on every possible event
    ['click', 'scroll', 'resize', 'focus', 'blur', 'mouseenter', 'mouseleave'].forEach(event => {
        document.addEventListener(event, forceAgendaVisible, true);
    });
    
    // Override attempts to hide agenda view
    window.addEventListener('click', function(e) {
        setTimeout(forceAgendaVisible, 50);
    });
    
    // Watch for mutations that might hide the agenda
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && 
                mutation.target instanceof Element &&
                mutation.target.id === 'agenda-view' && 
                (mutation.attributeName === 'class' || mutation.attributeName === 'style')) {
                forceAgendaVisible();
            }
        });
    });
    
    // Start observing when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            const agendaView = document.getElementById('agenda-view');
            if (agendaView) {
                observer.observe(agendaView, {
                    attributes: true,
                    attributeFilter: ['class', 'style']
                });
            }
        });
    } else {
        const agendaView = document.getElementById('agenda-view');
        if (agendaView) {
            observer.observe(agendaView, {
                attributes: true,
                attributeFilter: ['class', 'style']
            });
        }
    }
    
})();