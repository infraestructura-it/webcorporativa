/**
 * build-site.js
 * Reads all content/*.json files and builds the static index.html
 * Also generates content/index.json (manifest of all articles)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT        = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content');
const PUBLIC_DIR  = path.join(ROOT, 'ia');

// ── Load all content files ────────────────────────────────────────────────────
function loadAllContent() {
  const files = fs.readdirSync(CONTENT_DIR)
    .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.json$/))
    .sort()
    .reverse()
    .slice(0, 10); // máximo 10 días para evitar timeout

  const days = files.map(f => {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, f), 'utf8');
    return JSON.parse(raw);
  }).filter(d => d.articles && d.articles.length > 0); // ignorar días sin artículos

  return days;
}

// ── Format date in Spanish ────────────────────────────────────────────────────
function formatDateES(isoDate) {
  const d = new Date(isoDate + 'T12:00:00Z');
  return d.toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/Bogota'
  });
}

// ── Article card HTML ─────────────────────────────────────────────────────────
function articleCard(article, featured = false) {
  const brandBadge = article.brand
    ? `<span class="card-brand" style="border-color:${article.category_color}50;color:${article.category_color}">
         <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill="currentColor" opacity=".4"/><circle cx="4" cy="4" r="1.5" fill="currentColor"/></svg>
         ${article.brand}
       </span>`
    : '';

  const sourceNote = article.source_title
    ? `<p class="card-source">📰 Fuente: <em>${article.source_title}</em></p>`
    : '';

  return `
  <article class="article-card ${featured ? 'featured' : ''}" data-category="${article.category_id}" data-date="${article.date}">
    <div class="card-header" style="--accent: ${article.category_color}">
      <div class="card-meta">
        <span class="card-icon">${article.category_icon}</span>
        <span class="card-category" style="color: ${article.category_color}">${article.category_label}</span>
        ${brandBadge}
        <span class="card-tag" style="border-color: ${article.category_color}40; color: ${article.category_color}">${article.tag}</span>
      </div>
      <span class="card-read">${article.read_time} min lectura</span>
    </div>
    <h3 class="card-title">${article.title}</h3>
    <p class="card-summary">${article.summary}</p>
    <div class="card-body" ${featured ? '' : 'style="display:none"'}>
      ${article.body}
      ${sourceNote}
    </div>
    <button class="card-toggle" onclick="toggleArticle(this)" data-open="false">
      <span class="toggle-text">Leer artículo</span>
      <svg class="toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
  </article>`;
}

// ── Day section HTML ──────────────────────────────────────────────────────────
function daySection(day, isToday) {
  const articles = day.articles || [];
  const dateLabel = isToday ? 'Hoy — ' + formatDateES(day.date) : formatDateES(day.date);

  return `
<section class="day-section ${isToday ? 'today' : ''}" id="day-${day.date}">
  <div class="day-header">
    <div class="day-label">
      ${isToday ? '<span class="today-badge">● HOY</span>' : ''}
      <span class="day-date">${dateLabel}</span>
    </div>
    <span class="day-count">${articles.length} artículos</span>
  </div>
  <div class="articles-grid">
    ${articles.map((a, i) => articleCard(a, isToday && i === 0)).join('\n')}
  </div>
</section>`;
}

// ── Full HTML page ────────────────────────────────────────────────────────────
function buildHTML(allDays) {
  // Fecha en Colombia, igual que generate-content.js
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

  const totalArticles = allDays.reduce((sum, d) => sum + (d.articles?.length || 0), 0);
  const lastUpdate = allDays[0]?.generated_at
    ? new Date(allDays[0].generated_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })
    : '—';

  const categoryCounts = {};
  allDays.forEach(d => d.articles?.forEach(a => {
    categoryCounts[a.category_id] = (categoryCounts[a.category_id] || 0) + 1;
  }));

  const CATEGORIES = [
    { id: 'all',        label: 'Todos',                  icon: '◎',  color: '#00d4ff' },
    { id: 'news',       label: 'Noticias & Marcas',       icon: '📡', color: '#00d4ff' },
    { id: 'solar_news', label: 'Solar & Almacenamiento',  icon: '☀️', color: '#f59e0b' },
    { id: 'technical',  label: 'Técnicos',                icon: '⚙️', color: '#7c3aed' },
    { id: 'tips',       label: 'Tips IoT & Infra',        icon: '💡', color: '#00ffcc' },
    { id: 'usecase',    label: 'Casos de Uso IA',         icon: '🧠', color: '#f97316' },
  ];

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="InfraestructuraIT — Avances diarios en Inteligencia Artificial, IoT e infraestructura tecnológica. Contenido generado con IA, actualizado cada día.">
<meta property="og:title" content="InfraestructuraIT — IA & Avances Diarios">
<meta property="og:description" content="Noticias, artículos técnicos, tips IoT y casos de uso de IA en Data Centers. Actualizado automáticamente cada día.">
<title>IA & Avances — InfraestructuraIT</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/ai-blog.css">
</head>
<body>

<!-- NAV -->
<nav class="site-nav">
  <a href="index.html" class="nav-brand">
    <svg width="32" height="32" viewBox="0 0 60 60" fill="none">
      <rect x="14" y="14" width="32" height="32" rx="4" stroke="#00d4ff" stroke-width="2" fill="none"/>
      <circle cx="30" cy="30" r="7" fill="#00d4ff" opacity="0.9"/>
      <circle cx="30" cy="30" r="3" fill="#7c3aed"/>
      <line x1="24" y1="14" x2="24" y2="6" stroke="#00d4ff" stroke-width="2"/>
      <line x1="30" y1="14" x2="30" y2="6" stroke="#00d4ff" stroke-width="2"/>
      <line x1="36" y1="14" x2="36" y2="6" stroke="#00d4ff" stroke-width="2"/>
      <line x1="24" y1="46" x2="24" y2="54" stroke="#00d4ff" stroke-width="2"/>
      <line x1="30" y1="46" x2="30" y2="54" stroke="#00d4ff" stroke-width="2"/>
      <line x1="36" y1="46" x2="36" y2="54" stroke="#00d4ff" stroke-width="2"/>
      <line x1="14" y1="24" x2="6" y2="24" stroke="#00d4ff" stroke-width="2"/>
      <line x1="14" y1="30" x2="6" y2="30" stroke="#00d4ff" stroke-width="2"/>
      <line x1="14" y1="36" x2="6" y2="36" stroke="#00d4ff" stroke-width="2"/>
      <line x1="46" y1="24" x2="54" y2="24" stroke="#00d4ff" stroke-width="2"/>
      <line x1="46" y1="30" x2="54" y2="30" stroke="#00d4ff" stroke-width="2"/>
      <line x1="46" y1="36" x2="54" y2="36" stroke="#00d4ff" stroke-width="2"/>
    </svg>
    <span>INFRAESTRUCTURA <strong>IT</strong></span>
  </a>
  <div class="nav-links">
    <a href="../index.html">← Web principal</a>
    <a href="index.html" class="active">IA & Avances</a>
  </div>
</nav>

<!-- HERO -->
<header class="blog-hero">
  <div class="hero-inner">
    <div class="hero-eyebrow">Actualizado automáticamente · Generado con Claude AI</div>
    <h1 class="hero-title">IA & <span class="accent">Avances</span></h1>
    <p class="hero-desc">Noticias, artículos técnicos, tips y casos de uso en Inteligencia Artificial, IoT e infraestructura — publicados cada día de forma automática.</p>
    <div class="hero-stats">
      <div class="stat"><span class="stat-num">${totalArticles}</span><span class="stat-label">Artículos</span></div>
      <div class="stat"><span class="stat-num">${allDays.length}</span><span class="stat-label">Días</span></div>
      <div class="stat"><span class="stat-num">5</span><span class="stat-label">Categorías</span></div>
      <div class="stat"><span class="stat-num">24h</span><span class="stat-label">Ciclo</span></div>
    </div>
    <div class="last-update">Última actualización: <span>${lastUpdate}</span></div>
  </div>
  <div class="hero-grid" aria-hidden="true"></div>
</header>

<!-- FILTER BAR -->
<div class="filter-bar" id="filterBar">
  <div class="filter-inner">
    ${CATEGORIES.map(c => `
    <button class="filter-btn ${c.id === 'all' ? 'active' : ''}"
      onclick="filterBy('${c.id}', this)"
      style="--fc: ${c.color}">
      <span>${c.icon}</span>
      <span>${c.label}</span>
      ${c.id !== 'all' ? `<span class="filter-count">${categoryCounts[c.id] || 0}</span>` : ''}
    </button>`).join('')}

    <!-- Search -->
    <div class="search-wrap">
      <input type="search" id="searchInput" placeholder="Buscar artículos..." oninput="searchArticles(this.value)" />
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
    </div>
  </div>
</div>

<!-- CONTENT -->
<main class="blog-main" id="blogMain">
  <div class="content-wrap">
    ${allDays.map((day) => daySection(day, day.date === today)).join('\n')}

    ${allDays.length === 0 ? `
    <div class="empty-state">
      <div class="empty-icon">🤖</div>
      <h3>Generando primer contenido...</h3>
      <p>El sistema está procesando los artículos del día. Vuelve en unos minutos.</p>
    </div>` : ''}
  </div>

  <!-- SIDEBAR -->
  <aside class="blog-sidebar">
    <div class="sidebar-card">
      <div class="sidebar-title">Categorías</div>
      ${CATEGORIES.filter(c => c.id !== 'all').map(c => `
      <div class="sidebar-cat" onclick="filterBy('${c.id}')" style="--fc: ${c.color}">
        <span>${c.icon}</span>
        <span>${c.label}</span>
        <span class="sidebar-count">${categoryCounts[c.id] || 0}</span>
      </div>`).join('')}
    </div>

    <div class="sidebar-card">
      <div class="sidebar-title">Sobre este feed</div>
      <p class="sidebar-desc">
        Contenido generado automáticamente por <strong>Claude AI</strong> cada día a las 6am hora Colombia.<br><br>
        Temas: IA en infraestructura, IoT, Data Centers, energía solar y redes descentralizadas.
      </p>
    </div>

    <div class="sidebar-card cta-card">
      <div class="sidebar-title">¿Implementamos IA en tu empresa?</div>
      <p class="sidebar-desc">Llevamos estas tecnologías a tu infraestructura real.</p>
      <a href="../index.html#contacto" class="cta-btn">Solicitar propuesta →</a>
    </div>

    <div class="sidebar-card">
      <div class="sidebar-title">Artículos recientes</div>
      ${allDays.slice(0, 3).flatMap(d => d.articles || []).slice(0, 6).map(a => `
      <div class="recent-item" onclick="jumpTo('day-${a.date}')">
        <span class="recent-icon">${a.category_icon}</span>
        <span class="recent-title">${a.title}</span>
      </div>`).join('')}
    </div>
  </aside>
</main>

<!-- FOOTER -->
<footer class="blog-footer">
  <div class="footer-inner">
    <span>© ${new Date().getFullYear()} InfraestructuraIT · Colombia</span>
    <span class="footer-powered">Contenido generado con <strong>Claude AI</strong> · Actualización diaria automática</span>
    <a href="../index.html">← Volver al sitio principal</a>
  </div>
</footer>

<script src="js/ai-blog.js"></script>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  console.log('\n🔨 InfraestructuraIT — Site Builder');

  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  const allDays = loadAllContent();
  console.log(`  ✓ Cargados ${allDays.length} días con contenido`);

  const html = buildHTML(allDays);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'index.html'), html, 'utf8');
  console.log(`  ✓ Construido ia/index.html`);

  const manifest = {
    last_build: new Date().toISOString(),
    total_days: allDays.length,
    total_articles: allDays.reduce((s, d) => s + (d.articles?.length || 0), 0),
    days: allDays.map(d => ({
      date: d.date,
      generated_at: d.generated_at,
      article_count: d.articles?.length || 0,
      articles: d.articles?.map(a => ({
        id: a.id,
        category_id: a.category_id,
        title: a.title,
        summary: a.summary,
        tag: a.tag,
        read_time: a.read_time
      }))
    }))
  };
  fs.writeFileSync(path.join(CONTENT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`  ✓ Construido content/manifest.json`);

  console.log(`\n✅ Sitio construido exitosamente\n`);
}

main();
