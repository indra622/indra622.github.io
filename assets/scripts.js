// Bootstrap 5 Tooltip initialization
document.addEventListener('DOMContentLoaded', function() {
  var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function(tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });
});

// Dark Mode Toggle
(function() {
  const THEME_KEY = 'theme';
  const DARK = 'dark';
  const LIGHT = 'light';

  // Get saved theme or detect system preference
  function getPreferredTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme) {
      return savedTheme;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? DARK : LIGHT;
  }

  // Apply theme to document
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }

  // Initialize theme on page load
  function initTheme() {
    const theme = getPreferredTheme();
    applyTheme(theme);
  }

  // Toggle between dark and light
  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === DARK ? LIGHT : DARK;
    applyTheme(newTheme);
  }

  // Apply theme immediately (before DOM ready) to prevent flash
  initTheme();

  // Set up toggle button after DOM loads
  document.addEventListener('DOMContentLoaded', function() {
    const toggleBtn = document.getElementById('themeToggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggleTheme);
    }
  });

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
    // Only auto-switch if user hasn't manually set preference
    if (!localStorage.getItem(THEME_KEY)) {
      applyTheme(e.matches ? DARK : LIGHT);
    }
  });
})();

// Scroll Reveal Animation using Intersection Observer
(function() {
  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  document.addEventListener('DOMContentLoaded', function() {
    // Add animation classes to elements
    const postPreviews = document.querySelectorAll('.post-preview');
    postPreviews.forEach((el, index) => {
      el.classList.add('animate-on-scroll', 'fade-in-up');
      el.style.animationDelay = (index * 0.1) + 's';
    });

    // Create intersection observer
    const observerOptions = {
      root: null,
      rootMargin: '0px 0px -50px 0px',
      threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animated');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    // Observe all animate-on-scroll elements
    document.querySelectorAll('.animate-on-scroll').forEach(el => {
      observer.observe(el);
    });
  });
})();
