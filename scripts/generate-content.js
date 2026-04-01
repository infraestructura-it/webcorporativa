/**
 * generate-content.js — migrado a Google Gemini API
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import Parser    from 'rss-parser';
import fs        from 'fs';
import path      from 'path';
import { fileURLToPath } from 'url';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const ROOT        = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content');

// ── Cliente Gemini ────────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-pro-exp-03-25',
  generationConfig: {
    temperature:     0.7,
    maxOutputTokens: 1300,
  }
});

const rssParser = new Parser({
  timeout: 12000,
  headers: { 'User-Agent': 'InfraestructuraIT-NewsBot/1.0 (+https://infraestructura-it.com)' },
  customFields: { item: ['description', 'content:encoded', 'summary', 'media:description'] }
});

// Fecha en zona horaria Colombia, no UTC
const today      = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const outputFile = path.join(CONTENT_DIR, `${today}.json`);

if (fs.existsSync(outputFile) && process.env.FORCE_REGENERATE !== 'true') {
  console.log(`✓ Contenido del ${today} ya existe. Omitiendo.`);
  process.exit(0);
}

const BRAND_SOURCES = [
  { brand: 'Eaton',             rss: 'https://www.eaton.com/us/en-us/company/news-insights/news-releases.rss.xml' },
  { brand: 'Schneider Electric',rss: 'https://www.se.com/ww/en/about-us/newsroom/news/rss/index.xml' },
  { brand: 'Vertiv',            rss: 'https://www.vertiv.com/en-us/about/newsroom/news-releases/rss/' },
  { brand: 'ABB',               rss: 'https://new.abb.com/news/rss' },
  { brand: 'SMA Solar',         rss: 'https://www.sma.de/en/newsroom/press-releases.html?type=100&rss=1' },
  { brand: 'Fronius',           rss: 'https://www.fronius.com/en/photovoltaics/newsroom/press-releases?format=rss' },
  { brand: 'GoodWe',            rss: 'https://www.goodwe.com/news/rss' },
  { brand: 'Growatt',           rss: 'https://www.ginverter.com/news/rss' },
  { brand: 'Huawei FusionSolar',rss: 'https://solar.huawei.com/en/news-events/news/rss' },
  { brand: 'LONGi Solar',       rss: 'https://longi.com/en/news/rss/' },
  { brand: 'JA Solar',          rss: 'https://www.jasolar.com/html/en/service/news/rss.xml' },
  { brand: 'Canadian Solar',    rss: 'https://www.canadiansolar.com/news/rss.xml' },
  { brand: 'Trina Solar',       rss: 'https://www.trinasolar.com/en-glb/resources/news/rss' },
  { brand: 'Victron Energy',    rss: 'https://www.victronenergy.com/blog/feed/' },
  { brand: 'BYD Energy',        rss: 'https://www.bydenergy.com/news/rss' },
  { brand: 'PV Magazine',       rss: 'https://www.pv-magazine.com/feed/' },
  { brand: 'Energy Storage News',rss: 'https://www.energy-storage.news/feed/' },
  { brand: 'Solar Power World', rss: 'https://www.solarpowerworldonline.com/feed/' },
];

async function fetchFeed(source) {
  if (!source.rss) return null;
  try {
    const feed  = await rssParser.parseURL(source.rss);
    const items = (feed.items || []).slice(0, 4).map(item => ({
      title:   (item.title || '').replace(/\s+/g, ' ').trim(),
      link:    item.link || '',
      date:    item.pubDate || item.isoDate || '',
      snippet: (item['content:encoded'] || item.description || item.summary || item['media:description'] || '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 500)
    })).filter(i => i.title);
    if (!items.length) return null;
    return { brand: source.brand, items };
  } catch {
    return null;
  }
}

async function fetchAllBrandNews() {
  console.log(`  → Consultando ${BRAND_SOURCES.length} fuentes RSS...`);
  const settled = await Promise.allSettled(BRAND_SOURCES.map(s => fetchFeed(s)));
  const feeds   = settled
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);
  console.log(`  ✓ ${feeds.length}/${BRAND_SOURCES.length} feeds con contenido`);
  return feeds;
}

function buildNewsContext(feeds) {
  if (!feeds.length) {
    return 'No se pudieron obtener noticias RSS hoy. Usa tu conocimiento actualizado sobre estas marcas.';
  }
  return feeds.slice(0, 14).map(feed => {
    const items = feed.items.slice(0, 2).map(item => {
      const dateStr = item.date
        ? new Date(item.date).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })
        : 'reciente';
      return `  • [${dateStr}] ${item.title}\n    ${item.snippet.substring(0, 280)}`;
    }).join('\n');
    return `### ${feed.brand}\n${items}`;
  }).join('\n\n');
}

function buildCategories(newsContext) {
  const ctx = newsContext;

  return [
    {
      id: 'news', label: 'Noticias & Marcas', icon: '📡', color: '#00d4ff',
      prompt: `Eres el editor de InfraestructuraIT, empresa colombiana de infraestructura TI y energía.

NOTICIAS REALES de fabricantes (obtenidas hoy vía RSS):

${ctx}

TAREA:
- Elige la noticia más relevante sobre UPS, infraestructura eléctrica crítica, Data Centers, ABB, Eaton, Schneider, Vertiv o similar.
- Escribe un artículo periodístico en español (220-290 palabras).
- Contextualiza para Colombia/Latam: ¿qué significa para empresas locales?
- Menciona marca, producto y al menos un dato técnico (kVA, eficiencia %, precio referencial USD).
- Si los feeds no tienen noticias recientes relevantes, escribe sobre el lanzamiento más importante reciente de Eaton, Vertiv o Schneider.

Responde SOLO JSON sin markdown:
{"title":"máx 85 chars","summary":"dato más impactante, máx 130 chars","body":"HTML con <p> y <strong>","tag":"Marca Categoría","brand":"nombre exacto fabricante","source_title":"título original o null","read_time":número}`
    },
    {
      id: 'solar_news', label: 'Solar & Almacenamiento', icon: '☀️', color: '#f59e0b',
      prompt: `Eres especialista en energía solar de InfraestructuraIT Colombia.

NOTICIAS REALES de fabricantes (obtenidas hoy vía RSS):

${ctx}

TAREA:
- Elige UNA noticia diferente a la anterior, sobre paneles solares, inversores fotovoltaicos o almacenamiento en baterías.
- Marcas prioritarias: Fronius, SMA, GoodWe, Growatt, Huawei FusionSolar, LONGi, JA Solar, Canadian Solar, Trina Solar, Victron Energy, BYD, Felicity Solar, PV Magazine, Solar Power World.
- Escribe artículo en español (200-270 palabras).
- Relaciona con el mercado solar colombiano: irradiación solar promedio Colombia (~4.5 kWh/m²/día en zonas clave), Ley 1715, net-metering, tarifas de Codensa/EPM.
- Incluye eficiencia del panel/inversor, capacidad, o precio referencial si está disponible.

Responde SOLO JSON sin markdown:
{"title":"máx 85 chars","summary":"beneficio clave, máx 130 chars","body":"HTML con <p> y <strong>","tag":"Marca Tipo (ej: LONGi Panel, Fronius Inverter)","brand":"nombre exacto fabricante","source_title":"título original o null","read_time":número}`
    },
    {
      id: 'technical', label: 'Artículos Técnicos', icon: '⚙️', color: '#7c3aed',
      prompt: `Eres ingeniero senior de InfraestructuraIT Colombia.

Escribe un artículo técnico sobre UNO de estos temas (elige el más interesante):
- Comunicación Modbus TCP/RTU con inversores Fronius Symo, SMA Sunny Boy o Victron MultiPlus (registros reales, direcciones, función codes)
- SNMP v3 para monitoreo remoto de UPS Eaton 9PX o Vertiv Liebert en Zabbix 6.x
- Protocolo SunSpec Alliance para interoperabilidad entre inversores (bloques de datos, identificadores)
- ESP32-S3 leyendo BMS de batería Pylontech US5000 o BYD Battery-Box vía CAN bus
- Integración de GoodWe o Growatt con Home Assistant usando inversores RS485 → USB → MQTT
- Arquitectura de microinversores Hoymiles o Enphase con monitoreo en tiempo real

Requisitos:
- Técnicamente preciso: registros Modbus reales, comandos, parámetros de configuración
- 260-330 palabras
- Incluye fragmento de código (Python, Node.js o YAML) o tabla de registros
- Orientado a ingenieros implementadores en Colombia

Responde SOLO JSON sin markdown:
{"title":"máx 85 chars","summary":"qué aprenderá el lector, máx 130 chars","body":"HTML: <p> <strong> <code> <ul><li> <ol><li>","tag":"tecnología exacta","brand":null,"source_title":null,"read_time":número}`
    },
    {
      id: 'tips', label: 'Tips IoT & Infra', icon: '💡', color: '#00ffcc',
      prompt: `Eres consultor IoT de InfraestructuraIT Colombia.

Escribe un tip práctico (mini-tutorial) sobre UNO de estos temas:
- Conectar inversor Victron MultiPlus II a Home Assistant con VenusOS y MQTT
- Leer SOC y tensión de batería Pylontech desde Node-RED con nodo modbus-serial
- Configurar alarmas SMS/Telegram para cuando UPS Eaton pase a batería (SNMP trap → Node-RED)
- Monitorear temperatura del cuarto de equipos con sensor DS18B20 + ESP32 + InfluxDB + Grafana
- Integrar Fronius Symo en dashboard Node-RED con su API JSON nativa (/solar_api/v1/)
- Automatizar carga/descarga de batería BYD según tarifa nocturna CREG Colombia

Requisitos:
- Pasos numerados y accionables
- Código real (fragmento): Python, Node.js, YAML o JSON de flujo Node-RED
- Menciona versión del software o número de registro cuando aplique
- 190-260 palabras

Responde SOLO JSON sin markdown:
{"title":"verbo + acción concreta, máx 85 chars","summary":"problema que resuelve, máx 130 chars","body":"HTML: <p> <code> <ol><li>","tag":"tecnología (ej: Victron+HA, Pylontech CAN, Fronius API)","brand":null,"source_title":null,"read_time":número}`
    },
    {
      id: 'usecase', label: 'Casos de Uso IA', icon: '🧠', color: '#f97316',
      prompt: `Eres arquitecto de soluciones de InfraestructuraIT Colombia.

Escribe un caso de uso realista de IA aplicada a energía solar o infraestructura IT crítica, con equipos reales de marcas conocidas.

Escenario: empresa colombiana o latinoamericana (ficticia pero verosímil, con ciudad, sector, tamaño).
Equipos involucrados: deben ser marcas y modelos reales (Eaton 9PX, Fronius Symo 15kW, LONGi Hi-MO 6, BYD Battery-Box 10kWh, Victron MPPT, etc.)
Problema: algo concreto (costos energéticos, fallas inesperadas, baja eficiencia solar)
Solución IA: cómo se implementó, qué tecnología (TensorFlow Lite, Gemini API, Node-RED ML, anomaly detection)
Resultados: cifras en COP, kWh ahorrados, % mejora, tiempo de ROI

Requisitos: 240-310 palabras, estilo narrativo técnico-comercial

Responde SOLO JSON sin markdown:
{"title":"caso concreto, máx 85 chars","summary":"resultado principal en COP o %, máx 130 chars","body":"HTML: <p> <strong> para cifras","tag":"sector+tecnología (ej: Solar+IA Cali, UPS Predictivo Bogotá)","brand":null,"source_title":null,"read_time":número}`
    }
  ];
}

// ── Llamada a Gemini (reemplaza client.messages.create de Claude) ─────────────
async function generateArticle(category) {
  console.log(`  → [${category.label}]...`);

  const result = await model.generateContent(category.prompt);
  const raw    = result.response.text().trim();

  // Limpiar posibles bloques markdown que Gemini a veces incluye
  const clean = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const art = JSON.parse(clean);
    return {
      id:             `${today}-${category.id}`,
      category_id:    category.id,
      category_label: category.label,
      category_icon:  category.icon,
      category_color: category.color,
      date:           today,
      brand:          art.brand        || null,
      source_title:   art.source_title || null,
      title:          art.title,
      summary:        art.summary,
      body:           art.body,
      tag:            art.tag,
      read_time:      art.read_time    || 3
    };
  } catch (e) {
    console.error(`  ✗ JSON parse error [${category.label}]:`, e.message);
    console.error(`  Raw response: ${raw.substring(0, 200)}`);
    return {
      id: `${today}-${category.id}`,
      category_id: category.id, category_label: category.label,
      category_icon: category.icon, category_color: category.color,
      date: today, brand: null, source_title: null,
      title:   `[${category.label}] — ${today}`,
      summary: 'Artículo en proceso.',
      body:    '<p>Contenido siendo procesado. Vuelve en unos minutos.</p>',
      tag:     category.id, read_time: 2
    };
  }
}

async function main() {
  console.log(`\n🤖 InfraestructuraIT — Daily Content Generator (Gemini)`);
  console.log(`📅 Fecha: ${today}\n`);

  if (!process.env.GEMINI_API_KEY) {
    console.error('✗ GEMINI_API_KEY no configurada'); process.exit(1);
  }
  if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR, { recursive: true });

  console.log('📡 Paso 1: Feeds RSS de fabricantes...');
  const feeds      = await fetchAllBrandNews();
  const newsCtx    = buildNewsContext(feeds);
  const brandNames = feeds.map(f => f.brand);
  if (brandNames.length) console.log(`  Marcas: ${brandNames.slice(0, 8).join(', ')}${brandNames.length > 8 ? '...' : ''}`);

  console.log('\n🧠 Paso 2: Generando artículos con Gemini AI...');
  const categories = buildCategories(newsCtx);
  const articles   = [];

  for (const cat of categories) {
    try {
      const art = await generateArticle(cat);
      articles.push(art);
      const brandStr = art.brand ? ` [${art.brand}]` : '';
      console.log(`  ✓ ${brandStr} "${art.title}"`);
      await new Promise(r => setTimeout(r, 700));
    } catch (err) {
      console.error(`  ✗ [${cat.label}]:`, err.message);
    }
  }

  const output = {
    generated_at:   new Date().toISOString(),
    date:           today,
    brands_fetched: brandNames,
    feeds_ok:       feeds.length,
    feeds_total:    BRAND_SOURCES.length,
    articles
  };

  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\n✅ ${articles.length}/${categories.length} artículos generados`);
  console.log(`   Feeds OK: ${feeds.length}/${BRAND_SOURCES.length} | Archivo: ${outputFile}\n`);
}

main().catch(err => { console.error('Error fatal:', err); process.exit(1); });
