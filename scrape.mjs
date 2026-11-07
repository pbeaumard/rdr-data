// Ouvre la carte officielle dans un navigateur invisible, attend que la page
// ait décodé les données, puis écrit docs/fleet.json au format attendu par le plugin.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const URL = 'https://carto.routedurhum.com/fr/index.html';

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

const data = await page.evaluate(() => {
    const r = tracker.currentReport;
    const boats = r.lines.map(l => {
        const b = tracker._boatsByIds[l.boat] || tracker._boats.find(x => x.id == l.boat);
        const c = tracker._boatClassesByBoatIds[l.boat];
        const s = (b.sailors || [])[0] || {};
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
        };
    });
    return { updated: new Date(r.timecode * 1000).toISOString(), boats };
});

await browser.close();

if (!data.boats.length) throw new Error('Aucun bateau extrait');

await mkdir('docs', { recursive: true });
await writeFile('docs/fleet.json', JSON.stringify(data));
console.log(`OK : ${data.boats.length} bateaux, pointage ${data.updated}`);
