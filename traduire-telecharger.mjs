import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Fabrique `en/download.html` depuis `telecharger.html`, par substitutions.
 *
 * Même procédé que `traduire-decouvrir.mjs`, et pour la même raison : deux
 * pages écrites à la main divergent au premier correctif. Le CSS et le
 * JavaScript ne sont pas touchés — seul le texte change.
 *
 * **Le script s'arrête si une chaîne est introuvable.** Une traduction
 * silencieusement absente laisserait un paragraphe français au milieu d'une
 * page anglaise, et personne ne le verrait avant un lecteur anglophone.
 *
 *   node traduire-telecharger.mjs
 */
const RACINE = dirname(fileURLToPath(import.meta.url))

/** Les substitutions, dans l'ordre. Les plus longues d'abord. */
const TRADUCTIONS = [
  ['<html lang="fr">', '<html lang="en">'],
  ['<title>ResonLab — télécharger</title>', '<title>ResonLab — download</title>'],
  [
    'Les quatre applications de ResonLab pour Windows et Linux. Gratuites, libres, sans compte.',
    "ResonLab's four applications for Windows and Linux. Free, open source, no account."
  ],

  // ─ En-tête et navigation ─
  ['<a href="index.html#applications">Applications</a>', '<a href="index.html#applications">Applications</a>'],
  ['<a href="index.html#multipostes" class="hide-sm">Multi-postes</a>', '<a href="index.html#multipostes" class="hide-sm">Multi-workstation</a>'],
  ['<a href="index.html#principes" class="hide-sm">Nos principes</a>', '<a href="index.html#principes" class="hide-sm">What we stand for</a>'],
  ['<a href="suite.html" class="hide-sm">La suite</a>', '<a href="roadmap.html" class="hide-sm">Roadmap</a>'],
  ['<a href="telecharger.html">Télécharger</a>', '<a href="download.html">Download</a>'],
  ['<a href="en/download.html" class="langue" hreflang="en">EN</a>', '<a href="../telecharger.html" class="langue" hreflang="fr">FR</a>'],
  ['aria-label="Changer le thème"', 'aria-label="Switch theme"'],

  // ─ Le chapeau ─
  ['<h1 class="titre reveal">Télécharger</h1>', '<h1 class="titre reveal">Download</h1>'],
  [
    `      Les quatre applications, pour Windows et pour Linux. Gratuites, libres, sans compte. Ce que
      vous téléchargez tourne entièrement sur votre machine.`,
    `      All four applications, for Windows and for Linux. Free, open source, no account. What you
      download runs entirely on your own machine.`
  ],
  [
    `      <strong>Aucun numéro de version n'est écrit sur cette page.</strong> Les boutons visent
      toujours la dernière version publiée, et les détails ci-dessous sont lus sur GitHub au
      moment où vous ouvrez la page. Un numéro recopié à la main finirait par mentir.`,
    `      <strong>No version number is written on this page.</strong> The buttons always point at the
      latest published release, and the details below are read from GitHub the moment you open the
      page. A number copied out by hand would end up lying.`
  ],

  // ─ Les téléchargements ─
  ['<h2 class="titre reveal">Choisissez votre système</h2>', '<h2 class="titre reveal">Choose your system</h2>'],
  [
    `      Windows : l'installateur <code>.exe</code>. Linux : l'<code>AppImage</code>, qui se lance sans
      installation, ou le paquet <code>.deb</code> pour Debian et Ubuntu.`,
    `      Windows: the <code>.exe</code> installer. Linux: the <code>AppImage</code>, which runs with no
      installation, or the <code>.deb</code> package for Debian and Ubuntu.`
  ],
  ['<h3>Gestion pour indépendant</h3>', '<h3>Freelance business management</h3>'],
  ['<p>Facturation, devis, suivi du temps, inventaire, comptabilité simplifiée.</p>', '<p>Invoicing, quotes, time tracking, inventory, simplified accounting.</p>'],
  ['<h3>Parc, locations, puissance, DMX</h3>', '<h3>Inventory, rentals, power, DMX</h3>'],
  ['<p>Le parc matériel son et lumière, les locations, la puissance par circuit, le patch.</p>', '<p>The audio and lighting inventory, rentals, power per circuit, the patch.</p>'],
  ['<h3>Simulation acoustique</h3>', '<h3>Acoustic simulation</h3>'],
  ['<p>Zones, pentes, carte de couverture, vue en coupe, retards, conseil de placement.</p>', '<p>Zones, rakes, coverage map, section view, delays, placement advice.</p>'],
  ['<h3>Plan de feu de théâtre</h3>', '<h3>Theatre lighting plot</h3>'],
  ['<p>Perches, inventaire, patch gradateur ou DMX, gélatines, feuille de patch imprimable.</p>', '<p>Bars, inventory, dimmer or DMX patch, gels, printable patch sheet.</p>'],
  ['>Lecture des fichiers publiés…<', '>Reading the published files…<'],
  ['>Télécharger</a></p>', '>Download</a></p>'],

  // ─ Le serveur ─
  ['<h2 class="titre reveal">Et le serveur</h2>', '<h2 class="titre reveal">And the server</h2>'],
  [
    `        Nexika ne se télécharge pas ici : il n'a pas d'installateur. C'est un fichier unique que
        l'on copie sur la machine qui héberge les données, et que l'on met en service en une
        commande. Il ne sert que si plusieurs postes doivent partager les mêmes données.`,
    `        Nexika is not downloaded here: it has no installer. It is a single file you copy onto the
        machine that holds the data, and bring up with one command. It is only useful when several
        workstations must share the same data.`
  ],
  ['<a class="btn" href="https://resonlab.github.io/nexika/">Voir Nexika</a>', '<a class="btn" href="https://resonlab.github.io/nexika/en/">See Nexika</a>'],

  // ─ Les mises en garde ─
  ["<h2 class=\"titre reveal\">À savoir avant d'installer</h2>", '<h2 class="titre reveal">Before you install</h2>'],
  ["<h3>Un avertissement va s'afficher</h3>", '<h3>A warning will appear</h3>'],
  [
    `        <p>Les installateurs ne sont pas signés par un certificat payant. Windows affiche donc un
        écran bleu « SmartScreen » qui déconseille l'exécution. Cliquez sur
        <strong>Informations complémentaires</strong>, puis <strong>Exécuter quand même</strong>.
        Nous préférons le dire ici que vous laisser le découvrir.</p>`,
    `        <p>The installers are not signed with a paid certificate. Windows therefore shows a blue
        "SmartScreen" panel advising against running them. Click <strong>More info</strong>, then
        <strong>Run anyway</strong>. We would rather say so here than let you find out.</p>`
  ],
  ['<h3>AppImage ou .deb</h3>', '<h3>AppImage or .deb</h3>'],
  [
    `        <p>L'AppImage ne s'installe pas : rendez le fichier exécutable et lancez-le. Le
        <code>.deb</code> s'installe sur Debian, Ubuntu et leurs dérivées. Les deux contiennent la
        même application.</p>`,
    `        <p>The AppImage is not installed: make the file executable and run it. The <code>.deb</code>
        installs on Debian, Ubuntu and their derivatives. Both contain the same application.</p>`
  ],
  ["<h3>Ce qui n'a pas été éprouvé</h3>", '<h3>What has not been proven</h3>'],
  [
    `        <p>Les installateurs se construisent automatiquement et passent toutes les vérifications
        du projet. <strong>Ils n'ont pas été installés sur un grand nombre de machines
        réelles.</strong> C'est écrit dans chaque note de version, et c'est écrit ici.</p>`,
    `        <p>The installers are built automatically and pass every check in the project.
        <strong>They have not been installed on a large number of real machines.</strong> That is
        written in every release note, and it is written here.</p>`
  ],
  ['<h3>Elles ne partent pas</h3>', '<h3>It stays with you</h3>'],
  [
    `        <p>Aucun compte, aucun envoi, aucune statistique d'usage. Le seul accès réseau possible est
        la vérification de mise à jour, et elle est désactivée par défaut.</p>`,
    `        <p>No account, nothing sent, no usage tracking. The only possible network access is the
        update check, and it is off by default.</p>`
  ],

  // ─ Le code ─
  ['<h2 class="titre reveal">Le code source</h2>', '<h2 class="titre reveal">The source code</h2>'],
  [
    `      Tout est publié sous licence MIT. Vous pouvez lire le code, le construire vous-même, ou le
      reprendre. <a href="https://github.com/ResonLab">github.com/ResonLab</a>`,
    `      Everything is published under the MIT licence. You can read the code, build it yourself, or
      take it further. <a href="https://github.com/ResonLab">github.com/ResonLab</a>`
  ],

  // ─ Les libellés visibles du script ─
  ["nom: 'Debian / Ubuntu' }", "nom: 'Debian / Ubuntu' }"],
  ["' Mo'", "' MB'"],
  ["' — publiée le '", "' — published '"],
  ["'fr-CH'", "'en-GB'"],

  // ─ Le pied de page ─
  ['<span class="num">WINDOWS</span>', '<span class="num">WINDOWS</span>'],
  ['Logiciels libres, sous licence MIT.', 'Open source, MIT licensed.'],
  ["<strong>ResonLab</strong> — Valais, Suisse.", '<strong>ResonLab</strong> — Valais, Switzerland.'],
  ["<a href=\"conditions.html\">Conditions d'utilisation</a>", '<a href="terms.html">Terms of use</a>'],
  ['<a href="suite.html">La suite</a>', '<a href="roadmap.html">Roadmap</a>']
]

// **Les fins de ligne sont normalisées avant toute comparaison.** Une page
// extraite en CRLF ferait échouer chaque chaîne écrite sur plusieurs lignes,
// et le script annoncerait une traduction manquante là où le texte est juste.
// Leçon déjà payée sur `tests/traductions.mjs`, qui annonçait « 0 clé trouvée »
// sur le runner Windows.
let page = readFileSync(join(RACINE, 'telecharger.html'), 'utf-8').replace(/\r\n/g, '\n')
const manquantes = []

for (const [avant, apres] of TRADUCTIONS) {
  if (!page.includes(avant)) {
    manquantes.push(avant.slice(0, 72).replace(/\s+/g, ' '))
    continue
  }
  page = page.split(avant).join(apres)
}

if (manquantes.length > 0) {
  console.error('Chaînes introuvables — la page anglaise ne sera pas écrite :')
  for (const m of manquantes) console.error(`  · ${m}…`)
  console.error(
    '\nUne traduction silencieusement absente laisserait un paragraphe français\n' +
      "au milieu d'une page anglaise. Corrigez les chaînes ci-dessus."
  )
  process.exit(1)
}

// Les chemins montent d'un cran : la page anglaise vit dans `en/`.
page = page
  .replaceAll('src="logos/', 'src="../logos/')
  .replaceAll('href="index.html', 'href="../index.html')
  .replaceAll('class="brand" href="./"', 'class="brand" href="../en/"')

writeFileSync(join(RACINE, 'en/download.html'), page, 'utf-8')
console.log(`en/download.html écrit — ${TRADUCTIONS.length} substitutions`)
