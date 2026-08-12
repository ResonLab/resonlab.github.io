import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Fabrique `en/discover.html` depuis `decouvrir.html`, par substitutions.
 *
 * **Deux pages écrites à la main divergent au premier correctif** : on corrige
 * une tournure d'un côté, on oublie l'autre, et la moitié des lecteurs voit une
 * version périmée. Ici le CSS et le JavaScript ne sont pas touchés du tout —
 * seul le texte change.
 *
 * **Le script s'arrête si une chaîne est introuvable.** Une traduction
 * silencieusement absente est pire qu'une erreur bruyante : elle laisse un
 * paragraphe français au milieu d'une page anglaise, et personne ne le voit
 * avant un lecteur anglophone.
 *
 *   node traduire-decouvrir.mjs
 */
const RACINE = dirname(fileURLToPath(import.meta.url))

/** Les substitutions, dans l'ordre. Les plus longues d'abord. */
const TRADUCTIONS = [
  // ─ Entête du document ─
  ['<html lang="fr">', '<html lang="en">'],
  ['<title>ResonLab — découvrir</title>', '<title>ResonLab — discover</title>'],
  [
    '<meta name="description" content="Quatre logiciels pour ceux qui font le travail. Vos données ne quittent pas votre ordinateur. Découvrez ResonLab en une page." />',
    '<meta name="description" content="Four programs for people who do the actual work. Your data never leaves your computer. Discover ResonLab in one page." />'
  ],
  ['<meta property="og:title" content="ResonLab — découvrir" />', '<meta property="og:title" content="ResonLab — discover" />'],
  [
    '<meta property="og:description" content="Quatre logiciels pour ceux qui font le travail. Vos données restent chez vous." />',
    '<meta property="og:description" content="Four programs for people who do the actual work. Your data stays with you." />'
  ],

  // ─ Chemins : la page anglaise vit un cran plus bas ─
  ['href="logos/resonlab.svg" type="image/svg+xml"', 'href="../logos/resonlab.svg" type="image/svg+xml"'],
  ['src="logos/resonlab.svg"', 'src="../logos/resonlab.svg"'],
  ['src="logos/ohmnia.svg"', 'src="../logos/ohmnia.svg"'],
  ['src="logos/scenika.svg"', 'src="../logos/scenika.svg"'],
  ['src="logos/acustika.svg"', 'src="../logos/acustika.svg"'],
  ['src="logos/lumika.svg"', 'src="../logos/lumika.svg"'],
  ['src="logos/nexika.svg"', 'src="../logos/nexika.svg"'],
  ['<a href="en/discover.html" class="langue" hreflang="en">EN</a>', '<a href="../decouvrir.html" class="langue" hreflang="fr">FR</a>'],
  ['href="suite.html"', 'href="roadmap.html"'],
  ['href="conditions.html"', 'href="terms.html"'],
  ['https://resonlab.github.io/ohmnia/', 'https://resonlab.github.io/ohmnia/en/'],
  ['https://resonlab.github.io/scenika/', 'https://resonlab.github.io/scenika/en/'],
  ['https://resonlab.github.io/acustika/', 'https://resonlab.github.io/acustika/en/'],

  // ─ Navigation et pied ─
  ['<a href="./">Le site</a>', '<a href="./">The site</a>'],
  ['>La suite<', '>Roadmap<'],
  ['aria-label="Changer le thème"', 'aria-label="Change theme"'],
  ["<a href=\"terms.html\">Conditions d'utilisation</a>", '<a href="terms.html">Terms of use</a>'],
  ['<p>Logiciels libres, sous licence MIT.</p>', '<p>Free software, MIT licence.</p>'],
  ['<p><strong>ResonLab</strong> — Valais, Suisse.</p>', '<p><strong>ResonLab</strong> — Valais, Switzerland.</p>'],

  // ─ Le hero ─
  ['<span style="--d:.05s">Vos</span>', '<span style="--d:.05s">Your</span>'],
  ['<span style="--d:.12s">données</span>', '<span style="--d:.12s">data</span>'],
  ['<span style="--d:.19s">ne</span>', '<span style="--d:.19s">goes</span>'],
  ['<span style="--d:.26s">partent</span>', '<span style="--d:.26s">absolutely</span>'],
  ['<span style="--d:.33s" class="grad-text">nulle part</span>', '<span style="--d:.33s" class="grad-text">nowhere</span>'],
  [
    `Quatre logiciels pour des gens qui font un travail précis : facturer, charger un camion,
      couvrir une salle, accrocher un plan de feu. Pas de compte. Pas d'abonnement.
      Pas de serveur qui écoute.`,
    `Four programs for people doing precise work: invoicing, loading a truck,
      covering a room, hanging a lighting plan. No account. No subscription.
      No server listening in.`
  ],
  ['>Voir ce que ça donne<', '>See what it looks like<'],
  [">Pourquoi c'est comme ça<", '>Why it works this way<'],
  ['<div class="indice"><i></i> Faites défiler</div>', '<div class="indice"><i></i> Scroll down</div>'],

  // ─ Ohmnia ─
  ['<h2>Le classeur Excel qui finit par vous trahir.</h2>', '<h2>The spreadsheet that eventually betrays you.</h2>'],
  [
    `Une formule effacée par erreur, un total qui ne tombe plus juste, et personne pour le voir
          avant le contrôle.`,
    `A formula deleted by mistake, a total that no longer adds up, and nobody to spot it
          before the audit.`
  ],
  [
    `Ohmnia fait la facturation, les devis, le suivi du temps, l'inventaire et la comptabilité
          simplifiée d'un indépendant. Toute division est protégée, tout calcul vit à un seul
          endroit, et la numérotation ne saute pas.`,
    `Ohmnia handles invoicing, quotes, time tracking, inventory and simplified bookkeeping
          for a sole trader. Every division is guarded, every calculation lives in one place,
          and the numbering never skips.`
  ],
  ['>Voir Ohmnia →<', '>See Ohmnia →<'],
  ['<div class="apercu-titre">Facture 2026-0148</div>', '<div class="apercu-titre">Invoice 2026-0148</div>'],
  ['<span>Dépannage sur site</span>', '<span>On-site repair</span>'],
  ['<span>Fourniture — carte relais</span>', '<span>Parts — relay board</span>'],
  ['<span>Déplacement</span>', '<span>Travel</span>'],
  ['<span>Total</span>', '<span>Total</span>'],
  [
    "<div class=\"apercu-note\">Sans TVA : la mention légale du pays s'imprime toute seule.</div>",
    '<div class="apercu-note">Not VAT-registered: the country\'s legal wording prints itself.</div>'
  ],

  // ─ Scenika ─
  ['<div class="apercu-titre">Univers DMX — 512 canaux</div>', '<div class="apercu-titre">DMX universe — 512 channels</div>'],
  ['<span><i class="u-bloc"></i>occupé</span>', '<span><i class="u-bloc"></i>used</span>'],
  ['<span><i class="u-conflit"></i>chevauchement</span>', '<span><i class="u-conflit"></i>overlap</span>'],
  ['<span><i class="u-libre"></i>libre</span>', '<span><i class="u-libre"></i>free</span>'],
  [
    '<div class="apercu-note">Deux appareils sur la même adresse : trouvé avant le montage, pas pendant.</div>',
    '<div class="apercu-note">Two fixtures on the same address: caught before the rig, not during.</div>'
  ],
  ['<h2>Le camion est chargé. Il manque un pied.</h2>', '<h2>The truck is loaded. One stand is missing.</h2>'],
  [
    `Le parc son et lumière d'un loueur ou d'un technicien : ce qu'on possède, ce qui est
          sorti, ce qui n'est pas revenu.`,
    `The audio and lighting inventory of a rental company or a technician: what you own,
          what is out, what never came back.`
  ],
  [
    `Avec le calcul de puissance par circuit et l'adressage DMX relié au parc réel.
          Le stock ne bouge pas quand du matériel part : ce qui est dehors se calcule, sinon une
          location oubliée laisse un chiffre que rien ne rattrape.`,
    `With power calculation per circuit and DMX addressing tied to the real inventory.
          Stock does not move when equipment leaves: what is out is calculated, otherwise one
          forgotten rental leaves a figure nothing ever puts right.`
  ],
  ['>Voir Scenika →<', '>See Scenika →<'],

  // ─ Acustika ─
  [
    '<h2>Une carte de couleurs est très convaincante. Même quand elle est fausse.</h2>',
    '<h2>A colour map is very convincing. Even when it is wrong.</h2>'
  ],
  [
    `Acustika calcule la couverture d'une salle — et dit <em>où</em> poser les enceintes,
          pas seulement une carte qu'il faut savoir lire.`,
    `Acustika computes the coverage of a room — and says <em>where</em> to put the boxes,
          not just a map you have to know how to read.`
  ],
  [
    `Zones dessinées librement, gradins, directivité par bande, vue en coupe, retards
          d'alignement. Et la salle elle-même : absorption, réverbération, distance critique.
          Le conseil reste une proposition — la salle réelle ne ressemble jamais au modèle,
          et l'application le dit au lieu de le taire.`,
    `Freely drawn zones, raked seating, directivity per band, section view, alignment
          delays. And the room itself: absorption, reverberation, critical distance.
          The advice stays a proposal — the real room never matches the model,
          and the application says so instead of keeping quiet.`
  ],
  ['>Voir Acustika →<', '>See Acustika →<'],
  ['<div class="apercu-titre">Couverture à 1 kHz</div>', '<div class="apercu-titre">Coverage at 1 kHz</div>'],
  [
    "<div class=\"apercu-note\">L'écart sur toute la salle compte plus que le niveau au centre.</div>",
    '<div class="apercu-note">The spread across the whole room matters more than the level at the centre.</div>'
  ],

  // ─ Lumika ─
  ['<div class="apercu-titre">Perche 2 — patch</div>', '<div class="apercu-titre">Bar 2 — patch</div>'],
  [
    '<div class="apercu-note">Rose : circuit de gradateur. Vert : adresse DMX. Jamais les deux.</div>',
    '<div class="apercu-note">Pink: dimmer channel. Green: DMX address. Never both.</div>'
  ],
  [
    "<h2>Le bloc de gradateurs mange vingt-quatre canaux. On l'oublie toujours.</h2>",
    '<h2>The dimmer rack eats twenty-four channels. Everyone forgets.</h2>'
  ],
  [
    `Le plan de feu d'un théâtre : les perches, l'inventaire, les appareils accrochés, et le
          patch.`,
    `The lighting plan of a theatre: the bars, the inventory, the hung fixtures, and the
          patch.`
  ],
  [
    `Un projecteur traditionnel veut un circuit ; un LED veut une adresse. Une barre posée
          dans la plage d'un bloc marche parfaitement sur le papier et allume des circuits au
          hasard sur le plateau — Lumika compare les deux dans le même espace, et le dit avant le
          montage.`,
    `A conventional fixture wants a channel; a LED wants an address. A bar placed inside a
          rack's range works perfectly on paper and lights random circuits on stage — Lumika
          compares the two in the same space, and says so before the rig.`
  ],
  ['>Voir Lumika →<', '>See Lumika →<'],

  // ─ Le principe ─
  [
    '<h2 class="reveal">Rien ne sort de votre <span class="grad-text">ordinateur</span>.</h2>',
    '<h2 class="reveal">Nothing leaves your <span class="grad-text">computer</span>.</h2>'
  ],
  [
    `Pas de compte à créer, pas d'abonnement qui expire, pas de statistiques d'usage. Le seul
        accès réseau possible est la vérification de mise à jour, et elle est désactivée par défaut.`,
    `No account to create, no subscription to expire, no usage tracking. The only possible
        network access is the update check, and it is off by default.`
  ],
  [
    `Une seule exception, et c'est vous qui la choisissez : le mode multi-postes, qui fait parler
        vos postes à un serveur que vous installez vous-même, sur votre réseau. Sans lui, tout
        fonctionne hors ligne — c'est le défaut, pas une version dégradée.`,
    `One exception, and you are the one who chooses it: multi-workstation mode, which makes
        your machines talk to a server you install yourself, on your network. Without it everything
        works offline — that is the default, not a lesser version.`
  ],
  [
    `Formats lisibles, code simple, licence MIT. Dans dix ans, vos fichiers s'ouvriront encore.`,
    `Readable formats, simple code, MIT licence. In ten years your files will still open.`
  ],

  // ─ L'appel final ─
  [
    '<h2 class="reveal" style="--d:.06s">Voilà. C\'est tout ce qu\'il y a à savoir.</h2>',
    '<h2 class="reveal" style="--d:.06s">That is it. That is the whole idea.</h2>'
  ],
  [
    `Le reste — ce que chaque application fait exactement, ce qu'elle ne fait pas, et comment
        la télécharger — est sur le site.`,
    `The rest — what each program does exactly, what it does not do, and how to download it —
        is on the site.`
  ],
  ['>Découvrir ResonLab<', '>Discover ResonLab<']
]

const source = readFileSync(join(RACINE, 'decouvrir.html'), 'utf-8')
let page = source
const manquantes = []

for (const [avant, apres] of TRADUCTIONS) {
  if (!page.includes(avant)) {
    manquantes.push(avant.slice(0, 72).replace(/\s+/g, ' '))
    continue
  }
  page = page.replaceAll(avant, apres)
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

// Le commentaire des chemins n'a plus de sens dans la page produite.
writeFileSync(join(RACINE, 'en/discover.html'), page, 'utf-8')
console.log(`en/discover.html écrit — ${TRADUCTIONS.length} substitutions`)
