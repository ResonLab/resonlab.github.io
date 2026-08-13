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

/* ── 0. Aucun caractère de contrôle dans ce fichier ──────────────────────── */

/**
 * **Un caractère invisible a déjà tué deux contrôles de ce fichier.**
 *
 * Les motifs `sections` et `boutons` s'écrivaient `/<section\b/g` — sauf que le
 * fichier contenait un vrai octet 0x08, le retour arrière, à la place de la
 * séquence `\b`. Le motif cherchait donc « <section suivi d'un retour arrière »,
 * ce qu'aucune page ne contiendra jamais. Les deux comptages rendaient zéro des
 * deux côtés, donc toujours égaux : **la vérification affichait OK sans
 * regarder quoi que ce soit**, et sur toutes les pages, depuis toujours.
 *
 * Trouvé en ajoutant une section d'un seul côté et en constatant que rien
 * n'échouait. Aucune relecture ne pouvait le voir : le caractère ne s'affiche
 * pas.
 *
 * Ce contrôle-ci passe donc avant les autres, et il regarde ce fichier
 * lui-même. C'est la troisième fois qu'un octet de contrôle finit dans une
 * source de la maison.
 */
{
  const source = readFileSync(join(RACINE, 'verifier.mjs'), 'utf-8')
  // Tabulation, saut de ligne et retour chariot sont légitimes ; le reste non.
  const invisibles = [...source].filter((c) => {
    const code = c.charCodeAt(0)
    return (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127
  })
  if (invisibles.length > 0) {
    const codes = [...new Set(invisibles.map((c) => '0x' + c.charCodeAt(0).toString(16)))]
    echec(
      `verifier.mjs contient ${invisibles.length} caractère(s) de contrôle (${codes.join(', ')}) — ` +
        'un motif écrit avec un octet invisible ne correspond jamais, et le contrôle dit OK sans rien regarder'
    )
  }
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
  ['conditions.html', 'en/terms.html'],
  // La page découverte est produite par `traduire-decouvrir.mjs`. Elle est donc
  // alignée par construction — jusqu'au jour où quelqu'un éditera la page
  // anglaise à la main plutôt que de relancer le script, et où la prochaine
  // génération écrasera son travail sans prévenir.
  ['decouvrir.html', 'en/discover.html']
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
    ['sections', /<section\b/g],
    ['cartes', /class="card reveal/g],
    ['applications', /class="app reveal/g],
    ['titres de section', /<h2 class="titre/g],
    ['titres de carte', /<h3>/g],
    ['boutons', /class="btn\b/g],
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
  for (const mot of [' Nos principes', 'Logiciels libres', 'Découvrir<', 'Valais, Suisse', 'La suite<', 'PUBLIÉ<']) {
    if (sansCommentaires.includes(mot)) {
      echec(`${cheminEn} : texte français resté — « ${mot.trim()} »`)
    }
  }
}

/* ── 1 ter. Aucune substitution oubliée sur la page découverte ───────────── */

/**
 * **Le contrôle se déduit de la table de traduction, il ne l'énumère pas.**
 *
 * Le relevé du français résiduel ci-dessus repose sur une liste de mots écrite
 * à la main. Elle a rendu service, mais c'est une liste figée : elle ne connaît
 * que ce qu'on a pensé à y mettre le jour où on l'a écrite. Tout texte ajouté
 * ensuite passe dessous — et c'est exactement ce qui est arrivé aux ancres des
 * guides et au numéro de version d'un badge. **Avant d'écrire une valeur à la
 * main, se demander qui la met à jour quand elle change.** Ici, personne.
 *
 * `traduire-decouvrir.mjs` porte déjà la réponse : chaque couple qu'il contient
 * dit « ce texte français devient ce texte anglais ». Si le français d'un couple
 * se retrouve encore dans la page anglaise, c'est qu'une substitution n'a pas
 * mordu — et le script, lui, ne peut pas le voir, puisqu'il s'arrête seulement
 * quand une chaîne est **introuvable**, jamais quand elle survit à côté.
 *
 * La table grandit avec la page : le contrôle grandit avec elle, sans que
 * personne ait à y penser.
 */
{
  const script = readFileSync(join(RACINE, 'traduire-decouvrir.mjs'), 'utf-8')
  const en = readFileSync(join(RACINE, 'en/discover.html'), 'utf-8').replaceAll('\r\n', '\n')

  // Le premier membre de chaque couple `[français, anglais]`, quel que soit le
  // guillemet employé. On ne garde que les couples porteurs de texte affiché :
  // les substitutions de chemins et d'attributs n'ont rien à faire ici.
  const couples = [
    ...script.matchAll(/\[\s*(['"`])((?:[^\\]|\\.)*?)\1\s*,\s*(['"`])((?:[^\\]|\\.)*?)\3\s*\]/gs)
  ]

  /**
   * **Les échappements du source ne sont pas dans la page.**
   *
   * Un couple écrit entre guillemets doubles porte ses guillemets intérieurs
   * échappés — `class=\"apercu-note\"` — alors que la page contient un
   * guillemet nu. Comparés tels quels, ces couples-là ne pouvaient **jamais**
   * mordre : le contrôle les examinait, les comptait dans son total, et ne
   * pouvait rien y trouver.
   *
   * **Trouvé en le sabotant, pas en le relisant** : un texte français laissé
   * dans une note d'aperçu passait au vert, alors que le même sabotage sur une
   * entrée à guillemets simples échouait correctement. Un contrôle qui mord sur
   * une partie de ce qu'il examine donne exactement la même confiance qu'un
   * contrôle complet — et c'est là qu'il est dangereux.
   */
  const denuder = (texte) =>
    texte.replaceAll('\\"', '"').replaceAll("\\'", "'").replaceAll('\\\\', '\\')

  let examines = 0
  for (const couple of couples) {
    const francais = denuder(couple[2])
    const anglais = denuder(couple[4])
    // Une substitution qui ne change pas le texte — un chemin, un attribut —
    // ne prouve rien : le français y « survit » légitimement.
    if (francais === anglais) continue
    /**
     * On écarte ce qui ne porte pas de texte affiché — un chemin, un attribut.
     *
     * **Le premier filtre était trop fin et personne ne l'aurait vu.** Il
     * exigeait un mot de quatre lettres suivi d'un espace, ce que
     * « Pas d'adressage » n'a pas : le couple était écarté sans bruit, et le
     * contrôle affichait OK sur un titre resté en français. Un filtre trop
     * large produit des faux échecs qu'on remarque ; un filtre trop étroit
     * produit des trous qu'on ne remarque jamais.
     *
     * On se contente donc de deux exclusions franches : une substitution de
     * chemin, et une chaîne sans la moindre lettre.
     */
    if (/^(href|src|class|id)=/.test(francais)) continue
    if (!/[A-Za-zÀ-ÿ]{3,}/.test(francais.replace(/<[^>]*>/g, ''))) continue
    // Un fragment dont l'anglais contient le français en entier ne peut pas
    // servir de témoin : il serait présent des deux côtés par construction.
    if (anglais.includes(francais)) continue

    examines += 1
    if (en.includes(francais)) {
      echec(
        `en/discover.html : substitution oubliée — le texte français subsiste : ` +
          `« ${francais.trim().slice(0, 70)}… »`
      )
    }
  }

  // Un contrôle qui n'examine rien dirait OK. Si le motif de lecture de la
  // table cesse un jour de correspondre, on veut le savoir, pas le supposer.
  if (examines < 20) {
    echec(
      `seulement ${examines} substitution(s) examinée(s) dans traduire-decouvrir.mjs — ` +
        'le motif ne correspond plus, ce contrôle ne regarde plus rien'
    )
  }
}

/* ── 1 bis. Aucun numéro de version écrit à la main ──────────────────────── */

// **Cette page annonçait « PUBLIÉ — 0.1.0 » le jour où la 0.2.0 est sortie**,
// dans les deux langues, et rien ne pouvait le voir : un numéro de version
// recopié à la main dans une page vit loin de ce qui le fait changer, et il ne
// change donc jamais. C'est de la documentation qui ment, et la maison préfère
// une vérification qui échoue.
//
// La réponse n'est pas de mieux se souvenir : c'est de ne plus l'écrire. Le
// badge dit qu'une application est publiée, les boutons visent
// `releases/latest`, et **la page des releases est seule à porter le numéro** —
// elle, elle est produite par le workflow qui construit la version.
//
// Ce contrôle interdit de le réintroduire. Sans lui, la prochaine main qui
// trouve le badge un peu sec y remettra un numéro, et il pourrira pareil.
for (const chemin of ['index.html', 'en/index.html']) {
  const html = lireNormalise(chemin)
  for (const [, badge] of html.matchAll(/<span class="etat">([^<]*)<\/span>/g)) {
    if (/\d+\.\d+\.\d+/.test(badge)) {
      echec(
        `${chemin} : le badge « ${badge.trim()} » porte un numéro de version écrit ` +
          `à la main — il périmera sans que rien ne le signale. La page des releases le porte déjà.`
      )
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
