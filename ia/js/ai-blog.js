/* ai-blog.js — InfraestructuraIT AI Section */

// ── Article toggle ────────────────────────────────────────────────────────────
function toggleArticle(btn) {
  const card  = btn.closest('.article-card');
  const body  = card.querySelector('.card-body');
  const label = btn.querySelector('.toggle-text');
  const isOpen = btn.dataset.open === 'true';

  if (isOpen) {
    body.style.display = 'none';
    label.textContent  = 'Leer artículo';
    btn.dataset.open   = 'false';
    btn.classList.remove('open');
  } else {
    body.style.display = 'block';
    label.textContent  = 'Cerrar';
    btn.dataset.open   = 'true';
    btn.classList.add('open');
    // Smooth scroll to card if below viewport
    const rect = card.getBoundingClientRect();
    if (rect.top < 0) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ── Filter by category ────────────────────────────────────────────────────────
let activeFilter = 'all';
let activeSearch = '';

function filterBy(categoryId, btnEl) {
  activeFilter = categoryId;

  // Update button states
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.sidebar-cat').forEach(b => b.classList.remove('active'));

  if (btnEl) btnEl.classList.add('active');

  applyFilters();
}

function searchArticles(query) {
  activeSearch = query.toLowerCase().trim();
  applyFilters();
}

function applyFilters() {
  const cards = document.querySelectorAll('.article-card');

  cards.forEach(card => {
    const matchCat  = activeFilter === 'all' || card.dataset.category === activeFilter;
    const titleText = card.querySelector('.card-title')?.textContent.toLowerCase() || '';
    const summText  = card.querySelector('.card-summary')?.textContent.toLowerCase() || '';
    const bodyText  = card.querySelector('.card-body')?.textContent.toLowerCase() || '';
    const matchSearch = !activeSearch ||
      titleText.includes(activeSearch) ||
      summText.includes(activeSearch)  ||
      bodyText.includes(activeSearch);

    card.classList.toggle('hidden', !(matchCat && matchSearch));
  });

  // Hide empty day sections
  document.querySelectorAll('.day-section').forEach(section => {
    const visibleCards = section.querySelectorAll('.article-card:not(.hidden)');
    section.classList.toggle('hidden', visibleCards.length === 0);
  });

  // Show no-results message
  const main   = document.getElementById('blogMain');
  let noResult = document.getElementById('noResults');
  const anyVisible = document.querySelectorAll('.article-card:not(.hidden)').length > 0;

  if (!anyVisible) {
    if (!noResult) {
      noResult = document.createElement('div');
      noResult.id = 'noResults';
      noResult.className = 'empty-state';
      noResult.innerHTML = `
        <div class="empty-icon">🔍</div>
        <h3>Sin resultados</h3>
        <p>No se encontraron artículos para esta búsqueda o categoría.</p>
        <button onclick="resetFilters()" style="margin-top:1rem;padding:.5rem 1.25rem;background:transparent;border:1px solid #00d4ff40;color:#00d4ff;cursor:pointer;font-family:monospace;font-size:.75rem;letter-spacing:.1em;border-radius:4px;">Limpiar filtros</button>
      `;
      document.querySelector('.content-wrap').appendChild(noResult);
    }
    noResult.style.display = 'block';
  } else {
    if (noResult) noResult.style.display = 'none';
  }
}

function resetFilters() {
  activeFilter = 'all';
  activeSearch = '';
  document.getElementById('searchInput').value = '';
  document.querySelectorAll('.filter-btn').forEach((b, i) => {
    b.classList.toggle('active', i === 0);
  });
  applyFilters();
}

// ── Jump to day section ───────────────────────────────────────────────────────
function jumpTo(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Sticky filter bar shadow on scroll ───────────────────────────────────────
const filterBar = document.getElementById('filterBar');
window.addEventListener('scroll', () => {
  if (filterBar) {
    filterBar.style.boxShadow = window.scrollY > 120
      ? '0 4px 24px rgba(0,0,0,.4)'
      : 'none';
  }
}, { passive: true });

// ── Auto-open first featured article on today's section ──────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const featured = document.querySelector('.day-section.today .article-card.featured .card-toggle');
  if (featured) {
    const body  = featured.closest('.article-card').querySelector('.card-body');
    const label = featured.querySelector('.toggle-text');
    if (body && body.style.display !== 'block') {
      body.style.display  = 'block';
      label.textContent   = 'Cerrar';
      featured.dataset.open = 'true';
      featured.classList.add('open');
    }
  }
});

// ── Keyboard shortcut: / = focus search ──────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault();
    document.getElementById('searchInput')?.focus();
  }
  if (e.key === 'Escape') {
    document.getElementById('searchInput')?.blur();
    resetFilters();
  }
});
