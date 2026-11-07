// Ouvre la carte officielle dans un navigateur invisible, attend que la page
// ait décodé les données, puis écrit docs/fleet.json au format attendu par le plugin.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const URL = 'https://carto.routedurhum.com/fr/index.html';
const TRACK_STEP_S = 3600; // un point de trace par heure, pour garder un fichier léger

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(URL, { waitUntil: 'networkidle', timeout: 120000 });

// Attendre que l'objet tracker soit prêt avec le dernier pointage
await page.waitForFunction(
    () => typeof tracker !== 'undefined'
        && tracker.currentReport
        && tracker.currentReport.lines
        && tracker.currentReport.lines.length > 0,
    null,
    { timeout: 120000 },
);

// Attendre que les traces soient chargées (sans bloquer si elles manquent)
try {
    await page.waitForFunction(
        () => tracker._boats.filter(b => b.track && b.track.locations && b.track.locations.length > 1).length
            >= tracker._boats.length * 0.8,
        null,
        { timeout: 60000 },
    );
} catch (e) {
    console.log('Traces incomplètes, on continue avec ce qui est chargé');
}

const data = await page.evaluate(step => {
    const r = tracker.currentReport;
    const boats = r.lines.map(l => {
        const b = tracker._boatsByIds[l.boat] || tracker._boats.find(x => x.id == l.boat);
        const c = tracker._boatClassesByBoatIds[l.boat];
        const s = (b.sailors || [])[0] || {};

        // Trace allégée : un point par pas de temps, plus le dernier point
        const locs = (b.track && b.track.locations) || [];
        const track = [];
        let last = -Infinity;
        locs.forEach((p, i) => {
            if (p.timecode - last >= step || i === locs.length - 1) {
                track.push([Math.round(p.lat * 1000) / 1000, Math.round(p.lng * 1000) / 1000]);
                last = p.timecode;
            }
        });

        return {
            id: b.id,
            name: b.name,
            skipper: ((s.fname || '') + ' ' + (s.lname || '')).trim(),
            cls: c ? (c.name || c.id) : '?',
            rank: l.rank,
            status: l.racestatus,
            lat: b.lat,
            lon: b.lng,
            sog: l.speed,
            cog: l.heading,
            dtf: l.dtf,
            track,
        };
    });
    return { updated: new Date(r.timecode * 1000).toISOString(), boats };
}, TRACK_STEP_S);

await browser.close();

if (!data.boats.length) throw new Error('Aucun bateau extrait');

await mkdir('docs', { recursive: true });
await writeFile('docs/fleet.json', JSON.stringify(data));
const nPts = data.boats.reduce((n, b) => n + b.track.length, 0);
console.log(`OK : ${data.boats.length} bateaux, ${nPts} points de trace, pointage ${data.updated}`);
