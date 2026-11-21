# rdr-data

Données de flotte de la Route du Rhum, publiées dans [`docs/fleet.json`](docs/fleet.json) et consommées par le plugin Windy.

## `scrape.mjs` en 5 lignes

1. Ouvre la carte officielle `carto.routedurhum.com` dans un navigateur Chromium invisible (Playwright).
2. Attend que la page ait décodé les données (objet `tracker`) et que les traces d'au moins 95 % des bateaux en course soient complètes (dernier point à moins de 2 h du dernier pointage).
3. Extrait pour chaque bateau son identité (nom, skipper, classe), son classement, son statut, sa position, sa vitesse, son cap, sa distance à l'arrivée et sa trace GPS allégée à un point par heure.
4. Écrit le résultat dans `docs/fleet.json`, au format attendu par le plugin.
5. Est exécuté toutes les heures par la GitHub Action [`.github/workflows/update.yml`](.github/workflows/update.yml), qui commit automatiquement le `fleet.json` régénéré.
