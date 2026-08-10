# Le site de ResonLab

La page d'accueil de la maison : <https://resonlab.github.io>

```
index.html       français
en/index.html    anglais
logos/           les cinq marques
verifier.mjs     la vérification — `node verifier.mjs`
```

Servi par GitHub Pages **depuis la racine** de ce dépôt, parce que c'est un
dépôt `<organisation>.github.io`. Les sites des applications, eux, vivent dans
le `docs/` de leur propre dépôt.

## La page anglaise est fabriquée, pas écrite

Elle est produite depuis la française par substitutions explicites, **CSS et
JavaScript inchangés**. Écrire deux pages à la main, c'est les voir diverger au
premier correctif de mise en forme.

`verifier.mjs` compare la structure des deux langues — sections, applications,
cartes, titres, boutons — et **refuse que les deux CSS diffèrent** : s'ils
diffèrent, c'est que la page anglaise a été éditée à la main, et la prochaine
génération l'écrasera. Les deux contrôles ont été éprouvés en les cassant.

Il vérifie aussi qu'aucune ressource n'est chargée depuis un autre serveur : ni
police, ni script, ni feuille de style. Ces fichiers doivent pouvoir être servis
seuls.

## Modifier le site

1. Modifier `index.html`.
2. Reporter la même modification dans le script de traduction, puis régénérer
   `en/index.html`.
3. `node verifier.mjs` avant de pousser.
