# Comparatif : dashboard Revox « Pages » ↔ liseuse-dashboard-kit

Relevé du 2026-10-31, contre `pages.revox.io/dashboard/latest/html/condensed/` (version *condensed*) et
contre le kit en v0.179.2.

Revox « Pages » est un **template d'administration HTML/jQuery** : il vend des écrans entiers autant
que des composants. Le kit, lui, est une bibliothèque React de composants contrôlés. La comparaison
ne peut donc pas être ligne à ligne partout : pour les *écrans* (boîte mail, chat, galerie), Revox
livre une page, le kit livrerait des composants à assembler. C'est noté à chaque fois.

**États employés** — ✅ couvert · 🟡 partiel (existe mais plus étroit) · ❌ absent.

---

## 1. Boutons et actions

| Revox | Kit | État |
|---|---|---|
| Boutons *link / outlined / contained* | `Button` (variantes) | ✅ |
| 6 couleurs sémantiques (primary, success, danger, warning, complete, default) | `Button` | ✅ |
| 4 tailles (xs → lg) | `Button` | ✅ |
| Bouton à icône (gauche / droite) | `Button`, `IconButton` | ✅ |
| Bouton pleine largeur (`btn-block`) | `Button` | ✅ |
| Bouton bascule simple | `Toggle` | ✅ |
| Groupe d'options exclusives (Designer / Developer / Leadership) | `SegmentedControl` | ✅ |
| Boutons arrondis / pilule | `Button` | ✅ |
| Puces non interactives | `Tag`, `Chip` | ✅ |
| Puces sélectionnables à coche | `ChipGroup` | ✅ |
| Bouton déroulant (menu d'actions) | `ContextMenu`, `InputDropdown` | 🟡 pas de « split button » |
| **Groupe de boutons accolés** (Edit / Help / Create) | — | ❌ |
| **Barre d'outils de boutons** (gras, italique, alignement…) | `WysiwygEditor` en interne | 🟡 pas de composant réutilisable |
| **Groupe vertical** | — | ❌ |
| **Barre de navigation basse** (Favorites / Recent / Contacts) | — | ❌ |
| **Boutons de connexion sociale** (Facebook, Twitter, Google) | — | ❌ |
| **Bouton animé** (contenu qui glisse au survol) | — | ❌ |
| Bouton à état de chargement | — | ❌ *(absent chez Revox aussi)* |

## 2. Formulaires

| Revox | Kit | État |
|---|---|---|
| Champ texte, mot de passe, e-mail, désactivé | `Input`, `InputPassword` | ✅ |
| Trois tailles de champ | `Input` | ✅ |
| Texte d'aide sous le champ | `Input`, `FieldGroup` | ✅ |
| Groupes d'addons (préfixe / suffixe) | `Input` | ✅ |
| Case à cocher (+ cercle, alignée à droite, désactivée) | `Checkbox`, `CheckboxButton` | 🟡 pas de variante cercle |
| **Case à cocher indéterminée** | — | ❌ |
| Interrupteur (+ désactivé, grande taille) | `Toggle` | ✅ |
| **Boutons radio** (+ couleurs, désactivé) | — | ❌ **manque franc** |
| Liste déroulante | `Select`, `InputDropdown` | ✅ |
| Déroulante avec recherche | `InputDropdown` (`suggestions`) | ✅ |
| Multi-sélection en étiquettes | `TagInput` (`restrictToSuggestions`) | ✅ |
| Saisie semi-automatique (typeahead) | `InputDropdown` | ✅ |
| Typeahead à gabarit personnalisé | `InputDropdown` | 🟡 à vérifier selon le besoin |
| Champ à étiquettes | `TagInput` | ✅ |
| Sélecteur de date | `DatePicker`, `DateInput` | ✅ |
| Sélecteur de plage de dates | `DateRangePicker` | ✅ |
| Date + heure | `DateTimePicker` | ✅ |
| Masques de saisie (date, téléphone, SSN, libre) | `MaskedInput`, `PhoneInput` | ✅ |
| Nombres formatés (séparateurs, devise, bornes) | `InputNumber` | ✅ |
| Éditeur de texte riche (Quill) | `WysiwygEditor` | ✅ |
| Dépôt de fichiers par glisser | `Dropzone` | ✅ |
| Carte bancaire | `CreditCardInput` | ✅ *(en plus chez nous)* |
| **États de validation** (erreur / succès visibles) | `Input` (état d'erreur) | 🟡 pas d'état succès |
| **Mises en page de formulaire** (`form_layouts`) | `FieldGroup` | 🟡 pas de gabarits prêts |
| **Assistant multi-étapes** (`form_wizard`) | `Stepper` | 🟡 le pas-à-pas existe, pas le formulaire assemblé |

## 3. Curseurs

| Revox | Kit | État |
|---|---|---|
| Curseur simple | `RangeSlider` | ✅ |
| Curseur à deux poignées (plage) | `RangeSlider` | ✅ |
| Pas fixe / incréments | `RangeSlider` | ✅ |
| Préfixe / suffixe sur la valeur (`$`, `EURO`, `Miles`) | `RangeSlider` | 🟡 à confirmer |
| Valeur masquée | `RangeSlider` | 🟡 |
| **Curseur vertical** | — | ❌ |
| **Grille de graduations sous le curseur** | — | ❌ |
| **Écart minimum / maximum entre poignées** | — | ❌ |
| **Valeurs non numériques** (noms de mois) | — | ❌ |
| Répartition à somme constante | `AllocationSlider` | ✅ *(en plus chez nous)* |

## 4. Notifications, alertes, étiquettes

| Revox | Kit | État |
|---|---|---|
| Notification flottante à durée (bar, circle, simple) | `Notification`, `NotificationProvider`, `useNotification` | ✅ |
| **Quatre positions d'affichage** | `Notification` | 🟡 à vérifier |
| Niveaux info / warning / success / danger / default | `Notification`, `AlertList` | ✅ |
| Bandeaux d'alerte en ligne (4 couleurs) | `AlertList` | ✅ |
| Alerte descriptive multi-ligne | `AlertList` | ✅ |
| Alerte avec lien | `AlertList` | ✅ |
| Alerte bordée | `AlertList` | 🟡 |
| Étiquettes colorées (DEFAULT, HOLD, SOLD…) | `Badge`, `Tag` | ✅ |
| Badges numériques | `Badge` | ✅ |
| Compteurs dans la navigation | `Badge` + `SidebarLayout` | ✅ |
| Infobulles 4 directions | `Tooltip` | ✅ |
| Panneau de notifications groupé (Calendrier / Social / Serveur) | `AlertsPanel` | 🟡 orienté marchés |
| Marqueurs d'alerte sur une valeur | `AlertMarker`, `AlertMarkerStack` | ✅ *(en plus chez nous)* |

## 5. Progression et activité

| Revox | Kit | État |
|---|---|---|
| Barre déterminée | `ProgressBar` | ✅ |
| Barre indéterminée | `ProgressBar` | 🟡 à confirmer |
| Variantes de couleur | `ProgressBar` | ✅ |
| Petite taille | `ProgressBar` | ✅ |
| **Cercle de progression déterminé** | `GaugeChart`, `GaugeCard`, `LevelGauge` | 🟡 une jauge n'est pas un indicateur de tâche |
| **Cercle de progression indéterminé** | `Spinner` | 🟡 |
| Épaisseur de trait réglable | — | ❌ |
| Squelette de chargement | `Skeleton` | ✅ *(en plus chez nous)* |

## 6. Onglets, accordéons, panneaux

| Revox | Kit | État |
|---|---|---|
| Onglets | `Tabs`, `TabbedCard` | ✅ |
| Styles d'onglets (linetriangle, fillup) | `Tabs` | 🟡 moins de variantes |
| Transitions fade / slide | `Tabs` | 🟡 |
| **Onglets verticaux** | — | ❌ |
| Groupe repliable (accordéon) | `PanelCollapse`, `ExpandableCard` | ✅ |
| Panneau | `Panel`, `PanelRow` | ✅ |
| Arborescence | `TreeView`, `moveTreeNode` | ✅ |
| **Liste imbriquée réordonnable** (`nestables`) | `TreeView` + `moveTreeNode` | 🟡 déplacement oui, glisser-déposer à vérifier |

## 7. Cartes (portlets)

| Revox | Kit | État |
|---|---|---|
| Carte à titre + menu d'options | `Card`, `Panel` | ✅ |
| Carte à contenu défilant | `Card` | ✅ |
| Carte à séparateur | `Card`, `PanelRow` | ✅ |
| Carte transparente | `Card` | ✅ |
| Carte repliable / fermable | `ExpandableCard` | ✅ |
| **Carte plein écran (maximiser)** | — | ❌ |
| **Carte à rafraîchissement** (spinner + erreur) | — | ❌ |
| **Cartes déplaçables par glisser** | `DashboardGrid`, `DashboardGridItem` | 🟡 grille oui, glisser à confirmer |
| Carte de statistique | `StatCard`, `HighlightStatCard`, `ComparisonCard` | ✅ *(plus riche chez nous)* |
| Jumbotron, témoignage, citation | `Jumbotron`, `Testimonial`, `QuoteMark` | ✅ *(en plus chez nous)* |

## 8. Tableaux

| Revox | Kit | État |
|---|---|---|
| Tableau stylé par défaut | `DataTable` | ✅ |
| Cellules à valeurs multiples | `DataTable` (rendu libre) | ✅ |
| **Lignes ajoutables dynamiquement** | — | ❌ |
| Tri par colonne | `DataTable` (`sortValue`) | ✅ |
| **Pagination** | — | ❌ **manque franc** |
| **Recherche / filtre dans le tableau** | — | ❌ |
| **Sélection de lignes (cases à cocher)** | — | ❌ |
| **Lignes dépliables** | — | ❌ |
| **En-tête figé** | — | ❌ |
| **Export (CSV / Excel / PDF)** | — | ❌ |
| **Choix des colonnes visibles** | — | ❌ |
| **Édition en ligne** | — | ❌ |

## 9. Graphiques

| Revox (Rickshaw / NVD3 / Sparkline) | Kit | État |
|---|---|---|
| Courbe temps réel | `LineAreaChart` | 🟡 pas de flux temps réel intégré |
| Barres empilées | `BarChart` | ✅ |
| Aire avec curseur de plage | `LineAreaChart` + `RangeSlider` | 🟡 pas assemblé |
| Courbe | `LineAreaChart` | ✅ |
| Aires empilées | `LineAreaChart` | ✅ |
| Courbe + aire | `LineAreaChart` | ✅ |
| Sparkline | `Sparkline` | ✅ |
| — | `DonutChart` | ✅ *(en plus)* |
| — | `GaugeChart` | ✅ *(en plus)* |
| — | `Heatmap` | ✅ *(en plus)* |
| — | `SankeyChart` | ✅ *(en plus)* |
| — | `CandlestickChart` + indicateurs, outils de dessin, IA | ✅ *(très en plus)* |
| — | `MatrixChart`, `DeltaChart`, `SeasonalityView` | ✅ *(en plus)* |
| — | `ChartWorkspace`, `ChartAxis`, `ChartTooltip` | ✅ *(en plus)* |

**Le kit est nettement plus fort que Revox sur les graphiques.** Revox en a sept, tous classiques.

## 10. Cartes géographiques

| Revox | Kit | État |
|---|---|---|
| Google Maps | `TileMap` (tuiles raster) | ✅ équivalent |
| Carte vectorielle (choroplèthe pays) | `WorldExposureMap` | 🟡 orientée exposition financière |
| — | `InteractiveGlobe` | ✅ *(en plus)* |

## 11. Mise en page et navigation

| Revox | Kit | État |
|---|---|---|
| Barre d'application haute | `HeaderLayout` | ✅ |
| Barre latérale à niveaux repliables | `SidebarLayout` | ✅ |
| Mises en page default / secondary / boxed | `HeaderLayout`, `SidebarLayout` | 🟡 deux gabarits, pas trois |
| Fil d'Ariane | `Breadcrumbs` | ✅ |
| Menu de compte utilisateur | `UserMenu` | ✅ |
| Recherche rapide dans la barre | `Input` | 🟡 pas de composant dédié |
| **Surcouche de recherche plein écran** (suggestions + résultats sourcés) | `KnowledgeBase`, `searchKnowledge` | 🟡 recherche oui, surcouche non |
| **Panneau latéral « Quickview »** (Notes / Alertes / Chat) | — | ❌ |
| **Bouton d'action flottant** | — | ❌ |
| Visite guidée | `GuidedTour` | ✅ *(en plus chez nous)* |
| Grille de tableau de bord | `DashboardGrid` | ✅ *(en plus chez nous)* |

## 12. Écrans complets (Revox livre des pages, le kit des composants)

| Revox | Kit | État |
|---|---|---|
| Connexion | `LoginPage` | ✅ |
| Inscription | `SignUpPage` | ✅ |
| 404 | `NotFoundPage` | ✅ |
| **500** | — | ❌ |
| **Écran de verrouillage** | — | ❌ |
| **Page blanche (gabarit)** | — | ❌ |
| **Facture** | — | ❌ |
| **Galerie d'images** | `Carousel` | 🟡 pas de galerie ni de visionneuse |
| **Frise chronologique** | `DayTimelineWidget` | 🟡 journée seulement, pas une frise d'activité |
| **Boîte mail** | — | ❌ |
| **Messagerie / chat** | — | ❌ |
| **Fil social** | — | ❌ |
| **Calendrier** (mois, multilingue, chargement paresseux) | `Scheduler` | 🟡 planning de ressources, pas un calendrier mensuel |
| **Constructeur de page** | — | ❌ |
| **Profil utilisateur** | `Avatar`, `UserMenu` | ❌ pas d'écran de profil |
| Tableau Kanban | `KanbanBoard` | ✅ *(en plus chez nous)* |

## 13. Widgets métier

| Revox | Kit | État |
|---|---|---|
| Tuile de statistique à delta | `StatCard`, `ComparisonCard` | ✅ |
| Puces de cotation (AAPL ▲ 2,65 %) | `PriceChangeTag` | ✅ |
| Carte de cotation d'action | `HoldingCard` | ✅ |
| Liste de suivi d'actions | `WatchlistWidget` | ✅ |
| Graphique d'action avec 1D/5D/1M/1Y | `CandlestickChart` | ✅ *(bien au-delà)* |
| Palmarès de marché | `MarketMoversWidget` | ✅ |
| Résumé de portefeuille | `PortfolioSummaryWidget` | ✅ |
| Liste de transactions du jour | `DataTable`, `MetricListWidget` | ✅ |
| Météo actuelle + prévisions horaires et journalières | `WeatherWidget` | 🟡 à comparer en détail |
| Charge serveur (trio de valeurs) | `DemandMeters`, `MetricListWidget` | ✅ |
| Compteur de vues par source (onglets) | `TabbedCard` + `StatCard` | ✅ |
| **Fil d'activité / publications sociales** | — | ❌ |
| **Liste de notes** | — | ❌ |
| — | `EnergyWidget`, `LightsWidget`, `ShuttersWidget` | ✅ *(domotique, en plus)* |
| — | `MusicPlayerWidget`, `AnalogClock`, `ClockWidget` | ✅ *(en plus)* |
| — | `SkillTree`, `ObjectiveTracker`, `IconDock` | ✅ *(en plus)* |
| — | `Equalizer`, `LevelMeter`, `BalanceControl` | ✅ *(audio, en plus)* |
| — | `FpsMeter` | ✅ *(en plus)* |

## 14. Fondations

| Revox | Kit | État |
|---|---|---|
| Nuancier de couleurs | Thème (`LqThemeProvider`, palettes e-ink / couleur) | ✅ |
| Typographie | `Heading`, `Text`, `Highlight` | ✅ |
| Jeu d'icônes | 162 icônes + versions animées | ✅ |
| — | Surface claire / sombre, palette e-ink | ✅ *(en plus)* |

---

## Ce qui manque, par ordre d'utilité

### Rang 1 — trous francs, attendus de toute bibliothèque

1. **`Radio` / `RadioGroup`** — le seul contrôle de formulaire standard absent. `SegmentedControl`
   ne le remplace pas : un groupe radio porte des libellés longs et s'empile verticalement.
2. **Pagination de tableau** — `DataTable` trie mais ne pagine pas. Au-delà de quelques centaines de
   lignes, il n'est plus utilisable.
3. **Sélection de lignes** dans `DataTable` (case par ligne + case d'en-tête tri-état).
4. **Recherche / filtre** dans `DataTable`.
5. **Case à cocher indéterminée** — prérequis du point 3.
6. **Groupe de boutons accolés** (`ButtonGroup`) et **barre d'outils**.

### Rang 2 — complètent des composants déjà là

7. **En-tête de tableau figé** et **lignes dépliables**.
8. **Export de tableau** (CSV au minimum).
9. **Choix des colonnes visibles**.
10. **Cercle de progression** déterminé et indéterminé (distinct d'une jauge de valeur).
11. **Onglets verticaux**.
12. **Curseur vertical** et **graduations** sous le curseur.
13. **État de succès** sur les champs, en pendant de l'état d'erreur.
14. **Carte rafraîchissable** (voile de chargement + état d'erreur) et **carte plein écran**.

### Rang 3 — écrans à assembler

15. **Frise chronologique** d'activité (verticale, jalonnée).
16. **Galerie** d'images avec visionneuse.
17. **Fil d'activité** / publications (avatar, action, horodatage, réactions).
18. **Liste de notes** avec éditeur minimal.
19. **Messagerie** : liste de contacts + fil de conversation + zone de saisie.
20. **Boîte mail**.
21. **Calendrier mensuel** (le `Scheduler` couvre le planning de ressources, pas le mois).
22. **Écran de profil**.
23. **Facture** imprimable.
24. **Écran de verrouillage**, **page 500**, **gabarit vierge**.

### Rang 4 — cosmétique ou spécifique à Revox

25. Boutons de connexion sociale, boutons animés, barre de navigation basse.
26. Panneau latéral « Quickview », surcouche de recherche plein écran, bouton d'action flottant.
27. Constructeur de page.

---

## Lecture d'ensemble

Le kit **dépasse largement Revox** sur les graphiques (dix-sept contre sept, dont un graphique
boursier complet), sur les widgets métier (domotique, audio, finance, jeu), sur le thème (e-ink,
sombre) et sur des pièces que Revox n'a pas du tout — visite guidée, Kanban, planning de ressources,
globe, base de connaissances.

Il est **en retard sur deux fronts seulement**, mais ce sont deux fronts que tout tableau de bord
rencontre : le **tableau de données** (pagination, sélection, filtre, export — tout est à faire) et
les **écrans d'application** que Revox livre tout faits (mail, chat, calendrier mensuel, galerie,
frise, profil, facture).

Le reste — radio, groupes de boutons, cercle de progression, onglets verticaux — est une poignée de
composants à la journée chacun.
