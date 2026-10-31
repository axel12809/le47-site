# Le 47 · site vitrine (maquette)

Site statique : aucune étape de build, aucune dépendance externe (three.js et les polices sont dans le dossier).

## Mettre en ligne sur Vercel

**Option 1 : en ligne de commande** (le plus rapide)

```bash
npx vercel          # 1re fois : connexion + questions, tout laisser par défaut
npx vercel --prod   # donne l'URL publique, ex. https://le47-toulouse.vercel.app
```

Pour choisir le nom de l'URL : dans le tableau de bord Vercel, Project → Settings → Domains, ajoute `le47-toulouse.vercel.app`.

**Option 2 : via GitHub**
1. Crée un dépôt GitHub et pousse le contenu du dossier.
2. Sur vercel.com → Add New → Project → importe le dépôt.
3. Framework Preset : **Other**. Build command : vide. Output directory : vide (racine).
4. Deploy.

## Tester en local

```bash
python3 -m http.server 8047   # puis ouvrir http://localhost:8047
```
(Ouvrir `index.html` en double-cliquant ne marche pas : les modules JS ont besoin d'un serveur.)

## À compléter avec le restaurant

En haut de `main.js`, objet `CONFIG` :
- `ubereats` / `deliveroo` : liens exacts de leurs fiches (les boutons pointent pour l'instant vers l'accueil des plateformes).
- `hours` : horaires d'ouverture (sinon le site affiche le message de réouverture).

Modèles 3D : chaque produit (burger, menu frites + canette, Mega 47, pizza, tacos, sandwich, assiette barbecue)
est modélisé par le code. Pour un rendu « photo », on peut le remplacer par un vrai modèle scanné :
1. Télécharger un modèle `.glb` (ex. Sketchfab ou Fab, filtre « Downloadable », licence CC-BY ou CC0 ; créditer l'auteur si CC-BY).
2. Le placer dans `models/` (ex. `models/burger.glb`).
3. Dans `CONFIG.models`, écrire `burger: 'models/burger.glb'`. Taille, centrage, ombres et rotation au défilement sont appliqués automatiquement.

Dans `index.html` :
- Prix des pizzas : repris d'une ancienne carte (6 € / 8 €), à faire confirmer.
- Le bandeau promo (31 oct. → 3 nov.) disparaît tout seul après le 3 novembre.
- Le pied de page indique « maquette de démonstration » : à retirer une fois le site validé.

## Photos des produits (rotation 360°)

`img/<produit>/0.webp … 6.webp` : vues de 0° à 180° (tous les 30°), détourées. Le site reconstitue le tour complet.
Pour ajouter un produit (ex. pizza, Mega 47) : 7 vues dans `img/pizza/`, puis l'ajouter à `PHOTO` en haut de `main.js`.

## Structure

```
index.html     contenu (carte, commande, infos) + données Google (schema.org Restaurant)
styles.css     mise en page
main.js        scène 3D : un produit par rubrique, éclairage studio, ombres,
               un tour complet (360°) pendant qu'on fait défiler sa rubrique
vendor/        three.js 0.160 (local) + chargeur GLB
fonts/         Unbounded, Manrope, JetBrains Mono (locales, pas de Google Fonts → RGPD)
vercel.json    cache long pour polices et librairies
```
