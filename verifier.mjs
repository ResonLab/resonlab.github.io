import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

/**
 * Vérifie que le site de ResonLab reste servable et que ses deux langues
 * restent alignées.
 *
 * Le piège que cette suite empêche : traduire une page, puis modifier la
 * française seule. Les deux divergent en silence, et la moitié des lecteurs
 * voit une version périmée sans que rien ne le signale.
 *
 * On ne peut pas comparer une traduction mot à mot — on compare la structure :
 * autant de sections, autant de cartes, autant de titres. Une section ajoutée
 * d'un seul côté se voit immédiatement.
 *
 * Elle contrôle aussi ce qui casse un site statique sans prévenir : un lien
 * mort, une image absente, une ressource chargée depuis un autre serveur.
 */
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)))
const DOCS = RACINE

/**
 * Lit une page en normalisant les fins de ligne.
 *
 * Sans cela, la suite passe en local et échoue sur un runner Windows, qui
 * extrait les fichiers en CRLF : elle n'annonce pas une erreur mais un
 * comptage faux. Leçon déjà payée ailleurs dans la maison.
 */
const lireNormalise = (relatif) =>
  readFileSync(join(RACINE, relatif), 'utf-8').replaceAll('\r\n', '\n')

let echecs = 0
const echec = (message) => {
  console.log(`  ÉCHEC : ${message}`)
  echecs += 1
}

/* ── 1. Chaque page a sa jumelle, et elles se ressemblent ────────────────── */

/**
 * Les paires de pages, française et anglaise.
 *
 * Ce contrôle ne portait que sur l'accueil, et c'était un piège : les pages
 * ajoutées ensuite — la feuille de route, les conditions — pouvaient diverger
 * sans que rien ne le signale, alors que la suite continuait d'afficher
 * « deux langues alignées ». Une vérification qui ne regarde qu'une partie de
 * ce qu'elle prétend couvrir est pire qu'une absence de vérification.
 */
const PAIRES = [
  ['index.html', 'en/index.html'],
  ['suite.html', 'en/roadmap.html'],
  ['conditions.html', 'en/terms.html']
]

for (const [cheminFr, cheminEn] of PAIRES) {
  if (!existsSync(join(DOCS, cheminEn))) {
    echec(`${cheminEn} est absent`)
    continue
  }

  const fr = lireNormalise(cheminFr)
  const en = lireNormalise(cheminEn)

  const compter = (html, motif) => (html.match(motif) ?? []).length
  const structures = [
    ['sections', /<section/g],
    ['cartes', /class="card reveal/g],
    ['applications', /class="app reveal/g],
    ['titres de section', /<h2 class="titre/g],
    ['titres de carte', /<h3>/g],
    ['boutons', /class="btn/g],
    ['paragraphes d’introduction', /class="intro reveal/g]
  ]
  for (const [nom, motif] of structures) {
    const a = compter(fr, motif)
    const b = compter(en, motif)
    if (a !== b) echec(`${cheminFr} → ${cheminEn} · ${nom} : ${a} en français, ${b} en anglais`)
  }

  // Le CSS et le JavaScript doivent rester identiques : la version anglaise
  // est fabriquée par substitution de texte, elle n'a aucune raison d'avoir sa
  // propre mise en forme. S'ils diffèrent, c'est qu'on a édité la page traduite
  // à la main — et la prochaine génération l'écrasera.
  const style = (html) => html.slice(html.indexOf('<style>'), html.indexOf('</style>'))
  if (style(fr) !== style(en)) {
    echec(`${cheminEn} : le CSS diffère du français — page éditée à la main`)
  }

  if (!/<html lang="en">/.test(en)) echec(`${cheminEn} ne déclare pas lang="en"`)

  // Un mot français resté dans la page anglaise est le symptôme le plus
  // fréquent d'une substitution oubliée.
  const corps = en.slice(en.indexOf('<body'))
  const sansCommentaires = corps.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  for (const mot of [' Nos principes', 'Logiciels libres', 'Découvrir<', 'Valais, Suisse', 'La suite<']) {
    if (sansCommentaires.includes(mot)) {
      echec(`${cheminEn} : texte français resté — « ${mot.trim()} »`)
    }
  }
}

/* ── 2. Aucun lien mort, aucune ressource externe ────────────────────────── */

const pages = [
  ...readdirSync(DOCS).filter((f) => f.endsWith('.html')).map((f) => ['.', f]),
  ...(existsSync(join(DOCS, 'en'))
    ? readdirSync(join(DOCS, 'en')).filter((f) => f.endsWith('.html')).map((f) => ['en', f])
    : [])
]

for (const [dossier, fichier] of pages) {
  const html = readFileSync(join(DOCS, dossier, fichier), 'utf-8')
  const etiquette = `${dossier === '.' ? '' : dossier + '/'}${fichier}`

  for (const [, cible] of html.matchAll(/href="([^"#:]+\.html)"/g)) {
    if (!existsSync(resolve(DOCS, dossier, cible))) echec(`lien mort dans ${etiquette} → ${cible}`)
  }
  for (const [, cible] of html.matchAll(/src="([^"]+\.(?:png|jpg|svg))"/g)) {
    if (!existsSync(resolve(DOCS, dossier, cible))) echec(`image absente dans ${etiquette} → ${cible}`)
  }
  for (const [, ancre] of html.matchAll(/href="#([^"]+)"/g)) {
    if (!html.includes(`id="${ancre}"`)) echec(`ancre morte dans ${etiquette} → #${ancre}`)
  }

  // GitHub Pages doit pouvoir servir ces fichiers seuls : rien ne doit être
  // chargé depuis un autre serveur, ni police, ni script, ni feuille de style.
  if (/<script[^>]+src=/.test(html)) echec(`${etiquette} charge un script externe`)
  if (/<link[^>]*rel="stylesheet"/.test(html)) echec(`${etiquette} charge une feuille de style externe`)
  for (const [, url] of html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)) {
    const permis = url.startsWith('https://github.com/ResonLab') ||
                   url.startsWith('https://resonlab.github.io')
    if (!permis) echec(`${etiquette} référence une ressource externe : ${url}`)
  }
}

console.log(
  echecs === 0
    ? `SITE COHÉRENT (${pages.length} pages, deux langues alignées)`
    : `${echecs} PROBLÈME(S) SUR LE SITE`
)
process.exit(echecs === 0 ? 0 : 1)
