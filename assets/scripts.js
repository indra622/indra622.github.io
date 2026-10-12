// Bootstrap 5 Tooltip initialization
document.addEventListener('DOMContentLoaded', function() {
  var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function(tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });
});

// Navbar Scroll Effect - Simple and smooth
(function() {
  const mainNav = document.getElementById('mainNav');
  if (!mainNav) return;

  let ticking = false;

  function updateNavbar() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (scrollTop > 100) {
      mainNav.classList.add('is-fixed');
      mainNav.classList.add('is-visible');
    } else {
      mainNav.classList.remove('is-fixed');
      mainNav.classList.remove('is-visible');
    }

    ticking = false;
  }

  window.addEventListener('scroll', function() {
    if (!ticking) {
      window.requestAnimationFrame(updateNavbar);
      ticking = true;
    }
  });

  // Initial check
  updateNavbar();
})();

// Dark Mode Toggle
// 초기 테마는 _includes/head.html 의 window.siteTheme 가 첫 페인트 전에 정한다.
(function() {
  const theme = window.siteTheme;
  if (!theme) return;

  // Toggle between dark and light; only an explicit choice is saved
  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    theme.apply(newTheme);
    theme.save(newTheme);
  }

  // Set up toggle button after DOM loads
  document.addEventListener('DOMContentLoaded', function() {
    const toggleBtn = document.getElementById('themeToggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggleTheme);
    }
  });

  // Follow system theme changes until the user picks one
  if (theme.media && theme.media.addEventListener) {
    theme.media.addEventListener('change', function() {
      if (!theme.saved()) {
        theme.apply(theme.system());
      }
    });
  }
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
