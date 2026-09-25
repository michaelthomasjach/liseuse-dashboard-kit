import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { IsoCamera, type IsoProjection } from "./isoCamera";
import { viewProjector } from "./three/camera";
import { WarehouseScene, frameBounds, type SceneQuality } from "./three/scene";
import { SnapshotStudio, cachedSnapshot, type SnapshotJob } from "./three/snapshot";
import { BuildPlot, type PlotGroundStyle } from "./BuildPlot";
import { PlannerZones3D, type PlannerZone } from "./PlannerZones";
import { GATE_WIDTH, accessRoadDriveways, accessRoadOpenings, layGates, type PlannerGate } from "./accessRoad";
import { PLANNER_WALL_TOP, PlannerItem3D, rooftopSupport } from "./PlannerItem3D";
import { generatePlot, perimeterFenceRuns, plotArea, plotInside, plotSideFrame, withLockedAreas, type PlotFenceRun, type PlotLockedArea, type PlotRect, type PlotShape } from "./plot";
import {
  PLANNER_LABEL,
  TIERS,
  levelOf,
  sizeOf,
  tierLabel,
  withLevel,
  commitDraft,
  cornersOf,
  createItem,
  draftWalls,
  dragEnd,
  fitsPlot,
  flip,
  footprintOf,
  hitTest,
  isLinear,
  isRooftop,
  moveBy,
  headingOf,
  rotateQuarter,
  rotateTo,
  wallPoint,
  WALL_MOUNTED,
  snapToWall,
  wallMounts,
  type DrawMode,
  type Footprint,
  type PlannerItem,
  type PlannerKind,
  type PlannerLinear,
  type PlannerLinearKind,
  type PlannerPoint,
  type PlannerPointKind,
} from "./plannerModel";
import { STORAGE_CLASSES, STORAGE_LABEL, type StorageClass } from "./storageClass";
import {
  BoltIcon,
  BoxesIcon,
  BuildingWarehouseIcon,
  CartIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CloseIcon,
  ConveyorIcon,
  ForkliftIcon,
  GridIcon,
  HouseRoofIcon,
  MaximizeIcon,
  PackageIcon,
  ParkingIcon,
  RefreshIcon,
  RoadIcon,
  RobotIcon,
  SearchIcon,
  SnowflakeIcon,
  TrashIcon,
  TreeIcon,
  TruckIcon,
} from "../icons";
import { Tooltip } from "../primitives/Tooltip";
import "./WarehousePlanner.css";


/** Les deux projections, dans l'ordre du sélecteur. */
const PROJECTIONS: IsoProjection[] = ["orthographic", "perspective"];

/**
 * Le plan de l'entrepôt : un terrain, une palette, et ce qu'on y construit.
 *
 * ## Ce qu'on voit
 *
 * Deux vues, qu'on bascule en haut à droite. **Dessus** : les modules 3D du kit vus d'aplomb — les
 * toits des voisins, le faîte des racks, les voitures sur la rue. **3D** : la même scène vue de
 * biais. On construit et on modifie **dans les deux** : un clic est ramené au point du sol qu'il vise,
 * sous n'importe quel angle. Et deux projections : **isométrique**, sans fuite, où l'on mesure ; et
 * **perspective**, où la scène prend sa profondeur.
 *
 * La caméra : **clic molette maintenu et glisser** pour tourner autour (de gauche à droite) et
 * l'incliner (de haut en bas) — depuis la vue de dessus, cela passe en 3D ; glisser le fond pour se
 * déplacer ; molette pour zoomer autour du pointeur. Le terrain à bâtir est la zone claire semée de
 * points, bordée d'un pointillé : c'est la seule où l'on peut poser quelque chose.
 *
 * ## Tracer des murs, comme dans les Sims
 *
 * On choisit un outil de mur, on **clique le point de départ**, et le mur **suit le curseur**,
 * d'un nœud de la grille à l'autre, droit ou à 45° ; un **second clic l'arrête**. L'outil reste en
 * main pour le mur suivant ; Échap ou un clic droit le repose.
 *
 * - **Mur**, **Mur de quai** : un segment par tracé ;
 * - **Murs en chaîne**, **Clôture**, **Tapis**, **Rail** : chaque clic pose un segment et commence le suivant
 *   là où il s'arrête — un double-clic, un clic droit ou Échap terminent la chaîne ;
 * - **Murs //** : deux murs parallèles, les grands côtés du rectangle tiré — un couloir, une
 *   travée ;
 * - **Pièce** : les quatre murs du rectangle tiré, d'un coup.
 *
 * Le départ s'accroche au bout d'un mur existant à portée : les murs se raccordent d'eux-mêmes. Le
 * tracé est montré **en 3D** avant d'être posé, sa longueur cotée, et en rouge s'il sort du terrain.
 *
 * ## Modifier
 *
 * Un segment posé porte une **poignée ronde à chaque bout**, qu'on tire pour l'étirer, et une
 * **poignée carrée au milieu**, qui le déplace d'un bloc. Les autres éléments se déplacent en les
 * tirant. Suppr efface, R tourne d'un quart de tour, F retourne un segment (la cour d'un quai
 * change de côté).
 */

export interface WarehousePlannerProps {
  /** La graine du terrain. Contrôlée si `onSeedChange` est donné avec elle. */
  seed?: number;
  defaultSeed?: number;
  onSeedChange?: (seed: number) => void;
  /** Imposer la forme du terrain. */
  shape?: PlotShape;
  /** Ce qui est construit. Contrôlé si `onItemsChange` est donné avec lui. */
  items?: PlannerItem[];
  defaultItems?: PlannerItem[];
  onItemsChange?: (items: PlannerItem[]) => void;
  /** Imposer les cotes du terrain, en cases. */
  plotSize?: { width: number; depth: number };
  /** La vue au départ : de dessus, ou de biais. */
  defaultView?: "top" | "3d";
  /** Le cap et l'inclinaison de la vue de biais au départ, en degrés. */
  defaultOrbit?: { yaw: number; tilt: number };
  /** La projection au départ. */
  defaultProjection?: IsoProjection;
  /**
   * Les projections proposées au joueur. Par défaut les deux ; avec une seule, le sélecteur
   * disparaît et la vue reste dans celle-là.
   */
  projections?: IsoProjection[];
  /** Le grossissement au départ, relatif au cadrage du terrain entier : `2` s'approche deux fois. */
  defaultZoom?: number;
  /** Pixels par case au grossissement 1. */
  cellSize?: number;
  /** Hauteur de l'éditeur. */
  height?: number | string;
  className?: string;

  // --- Piloter l'éditeur depuis une application (un jeu, un outil métier) ---------------------

  /**
   * La palette de l'application, à la place de la palette intégrée : ses entrées, dans ses
   * familles, avec ce qu'elle veut dire de chacune (un prix, une capacité). Chaque entrée pose un
   * élément du kit — ponctuel, ou linéaire à longueur fixe — à un niveau donné.
   */
  entries?: PlannerPaletteEntry[];
  /** L'élément choisi. Contrôlé si `onSelectedIdChange` est donné avec lui. */
  selectedId?: string | null;
  onSelectedIdChange?: (id: string | null) => void;
  /** La vue, de dessus ou de biais. Contrôlée si `onViewChange` est donné avec elle. */
  view?: "top" | "3d";
  onViewChange?: (view: "top" | "3d") => void;
  /**
   * Lecture seule : on regarde, on choisit, on tourne autour — on ne pose, ne déplace, ne tourne
   * et ne supprime rien. Pour un plan qu'on observe pendant qu'il fonctionne.
   */
  readOnly?: boolean;
  /**
   * Une règle de plus que le terrain : `null` si l'élément peut être là, sinon la raison — qui est
   * montrée telle quelle. Consultée pour le fantôme, à la pose, à la fin d'un déplacement, d'une
   * rotation et d'une évolution. `others` est le reste du plan, sans l'élément lui-même ;
   * `entryId` est l'entrée de palette en main, pour un élément qui n'est pas encore posé.
   */
  validate?: (item: PlannerItem, others: PlannerItem[], context: { entryId: string | null }) => string | null;
  /**
   * Un geste **terminé** : une pose, un déplacement lâché, une rotation, une suppression, une
   * évolution. `onItemsChange` suit le geste pendant qu'il se fait (pour l'afficher) ; celui-ci ne
   * parle qu'une fois, à la fin — le bon moment pour enregistrer, facturer, ou refuser.
   */
  onEdit?: (edit: PlannerEdit) => void;
  /** Laisser rétrograder un élément (▼, Maj + U). Défaut : oui. */
  allowDowngrade?: boolean;
  /** Laisser étirer un élément linéaire par ses bouts. Défaut : oui. */
  allowStretch?: boolean;
  /** Le panneau de l'élément choisi, en bas de la vue. Défaut : affiché. */
  showInspector?: boolean;
  /** Le pied de page (terrain, graine, compte). Défaut : affiché. */
  showStatus?: boolean;
  /** Des éléments à montrer du doigt : leur contour clignote, dans les deux vues. */
  highlightIds?: string[];
  /**
   * Cadrer la vue : à chaque nouvelle `key`, la caméra se pose sur les éléments `ids` (ou sur
   * `point`, ou sur tout le terrain) — sans changer de vue ni de projection.
   */
  focus?: { key: string | number; ids?: string[]; point?: { x: number; y: number } };
  /**
   * Un calque de l'application, par-dessus la scène et sous les poignées : étiquettes, flux,
   * carte de chaleur… `toScreen` ramène un point du plan (en cases) à son pixel, sous la caméra
   * du moment. Le calque ne capte pas le pointeur, sauf ce qui le demande (`pointer-events`).
   */
  renderOverlay?: (api: PlannerOverlayApi) => ReactNode;
  /** Des modules 3D de plus, posés dans la scène avec les éléments du plan. */
  sceneChildren?: ReactNode;
  /**
   * L'entrée de palette en main (par son `id`), `null` pour les mains vides. Contrôlée si
   * `onActiveEntryIdChange` est donné avec elle : l'application peut ainsi mettre un élément en
   * main — une suggestion à poser, un copier-coller — et savoir ce que le joueur tient.
   */
  activeEntryId?: string | null;
  onActiveEntryIdChange?: (id: string | null) => void;
  /**
   * Les toitures affichées. Contrôlées si `onRoofsChange` est donné avec elles ; sinon, le bouton
   * « Toits » de la barre les bascule. Masquées, elles emportent ce qui est posé dessus
   * (`ROOFTOP_KINDS`) — qu'on ne voit ni n'attrape plus — et le plafond des chambres froides.
   * Affichées, ce qui est sur les toits passe **devant** au clic. Tant que l'élément en main se pose
   * sur un toit, elles restent affichées, quoi que dise cette prop.
   */
  roofs?: boolean;
  onRoofsChange?: (roofs: boolean) => void;
  /**
   * Des parcelles du terrain **à vendre** : dans le rectangle du terrain, mais pas encore au
   * joueur. Elles ne sont pas constructibles (« Hors du terrain constructible. »), et la scène les
   * montre en friche, closes du côté de ce qu'on possède, un panneau « À VENDRE » en leur milieu —
   * `label` s'y lit dessous. En cases, alignées sur les axes.
   */
  lockedAreas?: PlannerLockedArea[];
  /**
   * La circulation sur la rue autour du terrain, de 0 (la nuit : presque personne) à 1 (l'heure de
   * pointe : beaucoup de voitures, lentes, en paquets). Défaut : 0,4. Un changement ne fait pas
   * sauter les voitures : elles ralentissent ou accélèrent là où elles sont.
   */
  traffic?: number;
  /**
   * La nuit, de 0 (le jour : rien ne change) à 1 (la nuit noire), en passant par le crépuscule :
   * les candélabres de la rue et les éclairages posés (`light`) s'allument et posent au sol une
   * flaque de lumière chaude, d'autant plus franche qu'il fait nuit. Le thème de l'application
   * (clair le jour, sombre la nuit) reste à sa charge.
   */
  night?: number;
  /**
   * L'allure du sol constructible : `"site"` (défaut), un chantier — dalle à joints, grille de points,
   * taches, regards ; `"clean"`, un sol industriel propre et uni, à peine quadrillé. Voir
   * `BuildPlot.groundStyle`.
   */
  groundStyle?: PlotGroundStyle;
  /**
   * Des rectangles (en cases, alignés sur les axes) où la rue ne plante **pas de candélabres** —
   * ni leur flaque de lumière la nuit. Pour dégager la manœuvre des camions devant les quais :
   * `lightExclusions={bays.flatMap((b) => dockTrafficClearance(b))}`.
   */
  lightExclusions?: PlotRect[];
  /** De même pour les arbres du décor (alignements de la rue, parcelles voisines). */
  treeExclusions?: PlotRect[];

  // --- Les flux tracés par le joueur ------------------------------------------------------------

  /**
   * Des **flèches de flux** d'un élément à un autre, dessinées au sol : un ruban de l'emprise de
   * `from` à celle de `to` — de bord à bord, du côté où ils se font face —, une pointe à l'arrivée,
   * et des tirets qui défilent dans le sens du flux. Visibles dans les deux vues. Une flèche dont un
   * bout n'existe plus n'est pas dessinée.
   */
  links?: PlannerLink[];
  /**
   * Le mode « tracer un flux » : on presse sur un élément, on tire — un élastique suit le pointeur et
   * désigne l'élément survolé —, on lâche sur un autre : `onLink(from, to)`. Lâché ailleurs, rien.
   * Dans ce mode, on ne choisit ni ne déplace les éléments ; presser sur le sol déplace toujours la
   * vue.
   */
  linkMode?: boolean;
  onLink?: (from: string, to: string) => void;
  /** Refuser un lien, en disant pourquoi : l'élastique passe au rouge et montre la raison. */
  canLink?: (from: string, to: string) => string | null;
  /** La flèche choisie (hors du mode de tracé, un clic sur une flèche la choisit). */
  selectedLinkId?: string | null;
  onLinkSelect?: (id: string | null) => void;
  /** Suppr ou Retour arrière sur la flèche choisie. */
  onLinkRemove?: (id: string) => void;

  // --- Les zones, à la manière de Cities: Skylines ---------------------------------------------

  /**
   * Des **zones** peintes au sol (voir `PlannerZone`) : un voile translucide, bordé, et une étiquette
   * au milieu — son nom et ses cotes. Une zone **à affecter** est hachurée et neutre ; une zone
   * **affectée** prend sa couleur et un trait plein. Visibles dans les deux vues, sous tout ce qui est
   * posé : ce qui est construit dedans reste cliquable, les éléments passent avant les zones.
   */
  zones?: PlannerZone[];
  /**
   * Le mode « tracer une zone » : on presse sur le sol et on tire — un élastique calé sur les cases
   * entières montre les cotes en mètres et la surface en m², rouge avec la raison tant que la zone
   * est refusée (`canZone`, ou hors du terrain) — et on lâche : `onZoneDraw`. Dans ce mode, on ne
   * choisit ni ne déplace les éléments ; clic droit ou molette maintenus déplacent toujours la vue.
   */
  zoneMode?: boolean;
  onZoneDraw?: (rect: { x: number; y: number; width: number; depth: number }) => void;
  /** Refuser une zone, en disant pourquoi. `null` : elle peut être là. */
  canZone?: (rect: { x: number; y: number; width: number; depth: number }) => string | null;
  /** La zone choisie — hors des modes de tracé, un clic sur une zone (pas sur un élément) la choisit. */
  selectedZoneId?: string | null;
  onZoneSelect?: (id: string | null) => void;
  /** Suppr ou Retour arrière sur la zone choisie. */
  onZoneRemove?: (id: string) => void;

  // --- La clôture et les portails ---------------------------------------------------------------

  /**
   * Clore tout le terrain possédé d'une clôture grillagée (voir `BuildPlot.perimeterFence`). Elle
   * s'ouvre au passage des voies d'accès (`accessRoad`) et des portails (`gates`), et suit le bord
   * quand une parcelle à vendre est achetée.
   */
  perimeterFence?: boolean;
  /**
   * Des **portails coulissants** dans la clôture de pourtour, sur les côtés qui longent la rue : la
   * rue est raccordée au terrain à travers eux (trottoir abaissé, enrobé jusqu'au portail). Voir
   * `gateEntry` pour y faire passer les camions.
   */
  gates?: PlannerGate[];
  /**
   * Un clic sur la clôture de pourtour (hors des modes de tracé, mains vides) : le point, ramené sur
   * la ligne de la clôture et calé à la demi-case, le côté du terrain, et si un portail de largeur
   * `GATE_WIDTH` peut y être percé — sinon pourquoi. Au survol, la place du portail s'y dessine.
   */
  onFenceSelect?: (p: { x: number; y: number; edge: "north" | "south" | "east" | "west"; valid: boolean; reason?: string }) => void;
  /** Le portail choisi ; un clic sur un portail le choisit, Suppr appelle `onGateRemove`. */
  selectedGateId?: string | null;
  onGateSelect?: (id: string | null) => void;
  onGateRemove?: (id: string) => void;

  // --- La palette en bas, à la manière de Cities: Skylines --------------------------------------

  /**
   * `"sidebar"` (défaut) : la palette en colonne, à gauche. `"bottom"` : un **bandeau translucide**
   * posé sur le bas de la scène, sans la rétrécir — une rangée d'onglets en icônes (une famille par
   * onglet, son nom en infobulle), la bande des vignettes de la famille choisie au-dessus, qu'on fait
   * défiler de côté, la recherche au bout, et un chevron qui replie le bandeau sur ses onglets. Sa
   * hauteur est publiée sur la scène dans `--lq-planner-palette-height`, pour que l'application
   * décale ses propres panneaux flottants.
   */
  paletteLayout?: "sidebar" | "bottom";
  /** Les icônes des onglets du bandeau, par nom de famille. Défaut : une icône devinée du nom. */
  groupIcons?: Record<string, ReactNode>;

  /**
   * La qualité de rendu : densité de pixels, ombres, densité du décor. `"auto"` (défaut) choisit
   * `"low"` sur un petit écran tactile ou un appareil modeste.
   */
  quality?: SceneQuality;
}

/** Ce que rend `onFenceSelect`. */
export type PlannerFencePick = Parameters<NonNullable<WarehousePlannerProps["onFenceSelect"]>>[0];

/** Une flèche de flux entre deux éléments du plan (voir `links`). */
export interface PlannerLink {
  id: string;
  /** L'élément de départ, et celui d'arrivée, par leur `id`. */
  from: string;
  to: string;
  /** La couleur du ruban. Défaut : la couleur d'accent. */
  color?: string;
  /** Une étiquette, au milieu de la flèche. */
  label?: string;
  /** Un ruban en pointillés — un flux prévu, secondaire. */
  dashed?: boolean;
}

/** Une parcelle à vendre (voir `lockedAreas`). */
export type PlannerLockedArea = PlotLockedArea;

/** Une entrée de palette fournie par l'application (voir `entries`). */
export interface PlannerPaletteEntry {
  id: string;
  label: string;
  /** L'élément du kit qu'elle pose. */
  kind: PlannerKind;
  /** La famille (un menu de la palette) et, dedans, le rayon. */
  group: string;
  sub?: string;
  /** Élément linéaire : sa longueur à la pose, en cases. */
  length?: number;
  /** Le niveau d'évolution à la pose — et celui de la vignette. */
  level?: number;
  /** Ce que l'application dit de l'entrée, sous son nom : un prix, une capacité. */
  meta?: ReactNode;
  /** Grisée : visible, mais on ne peut pas la prendre (budget insuffisant…). */
  disabled?: boolean;
  /** L'infobulle. */
  description?: string;
}

/** Un geste terminé sur le plan (voir `onEdit`). */
export type PlannerEdit =
  | { type: "add"; items: PlannerItem[]; entryId: string }
  | { type: "update"; before: PlannerItem; after: PlannerItem }
  | { type: "remove"; items: PlannerItem[] }
  | { type: "evolve"; before: PlannerItem; after: PlannerItem };

/** Ce que le calque de l'application reçoit (voir `renderOverlay`). */
export interface PlannerOverlayApi {
  /** Le pixel d'un point du plan, en cases (et d'une hauteur, en cases). */
  toScreen: (x: number, y: number, z?: number) => { x: number; y: number };
  width: number;
  height: number;
  /** Pixels par case au centre de la vue. */
  scale: number;
  view: "top" | "3d";
  items: PlannerItem[];
}

type P = { x: number; y: number };

/** Une entrée de la palette : un outil de tracé, ou un élément à poser. */
type Entry =
  | { id: string; label: string; group: string; type: "draw"; kind: PlannerLinearKind; mode: DrawMode }
  | { id: string; label: string; group: string; type: "place"; kind: PlannerPointKind }
  | { id: string; label: string; group: string; type: "area"; kind: "roof" }
  | { id: string; label: string; group: string; type: "piece"; kind: PlannerKind; length?: number; level?: number; meta?: ReactNode; disabled?: boolean; description?: string };

/** Le point du bord d'une emprise où sort la demi-droite de son centre vers `p`. */
function edgeToward(f: Footprint, p: P): P {
  const dx = p.x - f.cx;
  const dy = p.y - f.cy;
  const c = Math.cos(f.angle);
  const s = Math.sin(f.angle);
  const u = dx * c + dy * s;
  const v = -dx * s + dy * c;
  const k = Math.min(Math.abs(u) > 1e-9 ? f.halfL / Math.abs(u) : Infinity, Math.abs(v) > 1e-9 ? f.halfW / Math.abs(v) : Infinity, 1);
  return { x: f.cx + dx * k, y: f.cy + dy * k };
}

/** L'élément qu'une entrée de l'application pose, centré en `(x, y)`. */
function pieceItem(entry: Extract<Entry, { type: "piece" }>, x: number, y: number): PlannerItem {
  let item = createItem(entry.kind, x, y);
  if (isLinear(item) && entry.length) {
    const cx = (item.x0 + item.x1) / 2;
    const half = entry.length / 2;
    item = { ...item, x0: cx - half, x1: cx + half };
  }
  return entry.level ? withLevel(item, entry.level) : item;
}

/** L'identifiant de la vignette d'une entrée — sa sorte et son niveau y sont, puisqu'ils la dessinent. */
const jobId = (entry: Entry) => (entry.type === "piece" ? `planner-app-${entry.kind}-${entry.level ?? 1}-${entry.length ?? 0}` : `planner-${entry.id}`);

const ENTRIES: Entry[] = [
  { id: "wall", label: "Mur", group: "Murs", type: "draw", kind: "wall", mode: "segment" },
  { id: "chain", label: "Murs en chaîne", group: "Murs", type: "draw", kind: "wall", mode: "chain" },
  { id: "parallel", label: "Murs //", group: "Murs", type: "draw", kind: "wall", mode: "parallel" },
  { id: "room", label: "Pièce", group: "Murs", type: "draw", kind: "wall", mode: "room" },
  { id: "lowWall", label: "Muret", group: "Murs", type: "draw", kind: "lowWall", mode: "chain" },
  { id: "dock", label: "Mur de quai", group: "Murs", type: "draw", kind: "dock", mode: "segment" },
  { id: "door", label: "Porte", group: "Murs", type: "place", kind: "door" },
  { id: "window", label: "Fenêtre", group: "Murs", type: "place", kind: "window" },
  { id: "bay", label: "Baie vitrée", group: "Murs", type: "place", kind: "bay" },
  { id: "roof", label: "Toiture", group: "Murs", type: "area", kind: "roof" },
  { id: "roofSolar", label: "Panneaux en toiture", group: "Murs", type: "place", kind: "roofSolar" },
  { id: "hvac", label: "Climatiseur de toiture", group: "Murs", type: "place", kind: "hvac" },
  { id: "coldRoom", label: "Chambre froide", group: "Stockage", type: "place", kind: "coldRoom" },
  { id: "office", label: "Bureaux", group: "Murs", type: "place", kind: "office" },
  { id: "truckBay", label: "Parking poids lourds", group: "Extérieur", type: "place", kind: "truckBay" },
  { id: "fence", label: "Clôture", group: "Murs", type: "draw", kind: "fence", mode: "chain" },
  { id: "palletRack", label: "Rack à palettes", group: "Stockage", type: "draw", kind: "palletRack", mode: "segment" },
  { id: "shelf", label: "Étagère", group: "Stockage", type: "place", kind: "shelf" },
  { id: "zone", label: "Zone de stockage", group: "Stockage", type: "place", kind: "zone" },
  { id: "conveyor", label: "Tapis droit", group: "Manutention", type: "draw", kind: "conveyor", mode: "chain" },
  { id: "conveyorCorner", label: "Tapis d'angle", group: "Manutention", type: "place", kind: "conveyorCorner" },
  { id: "conveyorTee", label: "Tapis en T", group: "Manutention", type: "place", kind: "conveyorTee" },
  { id: "rail", label: "Rail", group: "Manutention", type: "draw", kind: "rail", mode: "chain" },
  { id: "railCorner", label: "Rail d'angle", group: "Manutention", type: "place", kind: "railCorner" },
  { id: "picker", label: "Picker sur rail", group: "Manutention", type: "draw", kind: "picker", mode: "segment" },
  { id: "arm", label: "Bras robotisé", group: "Manutention", type: "place", kind: "arm" },
  { id: "consolidator", label: "Regroupement de commande", group: "Manutention", type: "place", kind: "consolidator" },
  { id: "delta", label: "Robot delta", group: "Manutention", type: "place", kind: "delta" },
  { id: "palletizer", label: "Palettiseur", group: "Manutention", type: "place", kind: "palletizer" },
  { id: "packer", label: "Machine d'emballage", group: "Manutention", type: "place", kind: "packer" },
  { id: "forklift", label: "Chariot élévateur", group: "Véhicules", type: "place", kind: "forklift" },
  { id: "amr", label: "Robot autonome", group: "Véhicules", type: "place", kind: "amr" },
  { id: "truck", label: "Semi-remorque", group: "Véhicules", type: "place", kind: "truck" },
  { id: "container", label: "Conteneur", group: "Extérieur", type: "place", kind: "container" },
  { id: "worker", label: "Opérateur", group: "Extérieur", type: "place", kind: "worker" },
  { id: "tree", label: "Arbre", group: "Extérieur", type: "place", kind: "tree" },
  { id: "light", label: "Éclairage", group: "Extérieur", type: "place", kind: "light" },
  { id: "parking", label: "Parking", group: "Extérieur", type: "place", kind: "parking" },
  { id: "shrub", label: "Arbuste", group: "Extérieur", type: "place", kind: "shrub" },
  { id: "flowerBed", label: "Parterre de fleurs", group: "Extérieur", type: "place", kind: "flowerBed" },
  { id: "barrier", label: "Barrière", group: "Extérieur", type: "place", kind: "barrier" },
  { id: "gate", label: "Portail coulissant", group: "Extérieur", type: "draw", kind: "gate", mode: "segment" },
  { id: "accessRoad", label: "Voie d'accès", group: "Extérieur", type: "draw", kind: "accessRoad", mode: "segment" },
  { id: "tollBooth", label: "Poste de péage", group: "Extérieur", type: "place", kind: "tollBooth" },
  { id: "transformer", label: "Transformateur", group: "Énergie", type: "place", kind: "transformer" },
  { id: "solar", label: "Panneaux solaires", group: "Énergie", type: "place", kind: "solar" },
  { id: "powerLine", label: "Ligne électrique", group: "Énergie", type: "draw", kind: "powerLine", mode: "chain" },
];
/**
 * La palette, en menus et sous-menus : cinq familles qu'on ouvre et referme, et dans chacune des
 * rayons — de quoi retrouver un outil d'un coup d'œil quand il y en a une vingtaine.
 */
const MENU: { title: string; subs: { title: string; ids: string[] }[] }[] = [
  {
    title: "Murs",
    subs: [
      { title: "Tracer", ids: ["wall", "chain", "parallel", "room", "lowWall"] },
      { title: "Quai et clôtures", ids: ["dock", "fence"] },
      { title: "Ouvertures", ids: ["door", "window", "bay"] },
      { title: "Toiture", ids: ["roof", "roofSolar", "hvac"] },
      { title: "Aménagement", ids: ["office"] },
    ],
  },
  {
    title: "Stockage",
    subs: [
      { title: "Racks", ids: ["palletRack"] },
      { title: "Étagères", ids: ["shelf"] },
      { title: "Au sol", ids: ["zone"] },
      { title: "Froid", ids: ["coldRoom"] },
    ],
  },
  {
    title: "Convoyage",
    subs: [
      { title: "Tapis", ids: ["conveyor", "conveyorCorner", "conveyorTee"] },
      { title: "Rails et pickers", ids: ["rail", "railCorner", "picker"] },
      { title: "Robots", ids: ["arm", "consolidator", "delta", "palletizer"] },
      { title: "Machines", ids: ["packer"] },
    ],
  },
  {
    title: "Véhicules",
    subs: [
      { title: "Engins", ids: ["forklift", "amr"] },
      { title: "Camions", ids: ["truck"] },
    ],
  },
  {
    title: "Extérieur",
    subs: [
      { title: "Accès", ids: ["accessRoad", "barrier", "gate", "tollBooth"] },
      { title: "Cour", ids: ["container", "light", "parking", "truckBay"] },
      { title: "Nature et personnes", ids: ["tree", "shrub", "flowerBed", "worker"] },
    ],
  },
  {
    title: "Énergie",
    subs: [
      { title: "Production", ids: ["solar"] },
      { title: "Réseau", ids: ["powerLine", "transformer"] },
    ],
  },
];

type PanDrag = { t: "pan"; sx: number; sy: number; cx: number; cy: number; gx: number; gy: number; moved: boolean };
type Drag =
  | PanDrag
  | { t: "orbit"; sx: number; sy: number; yaw: number; tilt: number }
  | { t: "end"; id: string; which: 0 | 1; orig: PlannerItem }
  | { t: "move"; id: string; wx: number; wy: number; orig: PlannerItem }
  | { t: "rotate"; id: string; cx: number; cy: number; orig: PlannerItem }
  | { t: "link"; from: string }
  | { t: "zone"; start: P }
  /** Un doigt posé sur un élément : un glisser rapide déplace la vue, un appui tenu prend l'élément. */
  | { t: "hold"; id: string; orig: PlannerItem; wx: number; wy: number; pan: PanDrag; timer: number };

/**
 * Deux doigts sur la scène. On attend de savoir ce qu'ils font : s'ils glissent ensemble à la
 * verticale sans s'écarter, ils **inclinent** la vue ; sinon ils la **pincent** — l'écart zoome, le
 * milieu tient le point du sol qu'il couvrait (on se déplace en même temps), et la rotation des
 * doigts l'un autour de l'autre fait tourner la caméra en vue de biais.
 */
type TwoFingers = {
  mode: "undecided" | "pinch" | "tilt";
  d0: number;
  a0: number;
  m0: P;
  zoom0: number;
  view0: { cx: number; cy: number };
  ground: P;
  yaw0: number;
  tilt0: number;
  twist: boolean;
};

/**
 * L'icône d'un onglet du bandeau, devinée du nom de sa famille — sans accents ni casse : « Stockage »,
 * « Convoyage », « Énergie »… Ce qui ne ressemble à rien de connu prend une grille.
 */
function guessGroupIcon(title: string): ReactNode {
  const t = title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const has = (...words: string[]) => words.some((w) => t.includes(w));
  if (has("toit")) return <HouseRoofIcon />;
  if (has("froid", "frigo")) return <SnowflakeIcon />;
  if (has("energ", "electr", "solaire")) return <BoltIcon />;
  if (has("robot", "automat")) return <RobotIcon />;
  if (has("convoy", "tapis", "manutention")) return <ConveyorIcon />;
  if (has("picking", "prepar", "cueill")) return <CartIcon />;
  if (has("emball", "colis", "condition")) return <PackageIcon />;
  if (has("exped", "quai", "camion", "transport", "livraison")) return <TruckIcon />;
  if (has("vehic", "engin", "chariot")) return <ForkliftIcon />;
  if (has("stock", "rack", "etag", "rayon")) return <BoxesIcon />;
  if (has("parking", "station")) return <ParkingIcon />;
  if (has("route", "voie", "acces", "voirie")) return <RoadIcon />;
  if (has("exter", "nature", "jardin", "paysag", "arbre")) return <TreeIcon />;
  if (has("mur", "batiment", "infra", "structure", "construction", "entrepot")) return <BuildingWarehouseIcon />;
  return <GridIcon />;
}

type ZoneRect = { x: number; y: number; width: number; depth: number };
/** Le rectangle de cases entre deux nœuds de la grille. */
const zoneRect = (a: P, b: P): ZoneRect => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), depth: Math.abs(b.y - a.y) });
type FenceEdge = "north" | "south" | "east" | "west";
/** Un point de la clôture de pourtour, et la place qu'y prendrait un portail (`from` → `to`). */
type FenceSpot = { x: number; y: number; edge: FenceEdge; valid: boolean; reason?: string; from: P; to: P };
/**
 * Le sens de la rotation de la caméra quand deux doigts tournent l'un autour de l'autre : la scène
 * tourne **avec** les doigts, comme une carte qu'on fait pivoter sur la table.
 */
const TWIST_SIGN = 1;

/** Le délai d'un appui tenu, au doigt, avant de prendre l'élément sous lui, en millisecondes. */
const HOLD_MS = 380;
/** Ce qu'un doigt peut bouger sans que son appui cesse d'être un tapotement, en pixels. */
const TAP_SLOP = 9;

const DND = "application/x-lq-planner";
/** Comparer sans casse ni accents : « etagere » trouve « Étagère ». */
const fold = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 6;
/** Le cap qui met les `x` à droite et les `y` en bas de l'écran, en vue de dessus. */
const TOP_YAW = -45;

/** La toiture tracée d'un coin à l'autre, ou rien si le rectangle est trop mince. */
function roofBetween(a: P, b: P): PlannerPoint | null {
  const length = Math.abs(b.x - a.x);
  const width = Math.abs(b.y - a.y);
  if (length < 1 || width < 1) return null;
  return { id: "draft-roof", kind: "roof", level: 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, rotation: 0, size: { length, width } };
}

/** Ce qu'une entrée pose quand on la lâche sur le terrain sans la tracer. */
function dropped(entry: Entry, x: number, y: number): PlannerItem[] {
  if (entry.type === "piece") return [pieceItem(entry, x, y)];
  if (entry.type === "place") return [createItem(entry.kind, x, y)];
  if (entry.type === "area") return [{ ...createItem("roof", x, y), size: { length: 8, width: 6 } } as PlannerItem];
  const cx = Math.round(x);
  const cy = Math.round(y);
  if (entry.mode === "room") return commitDraft(draftWalls(entry.kind, "room", { x: cx - 5, y: cy - 4 }, { x: cx + 5, y: cy + 4 }));
  if (entry.mode === "parallel") return commitDraft(draftWalls(entry.kind, "parallel", { x: cx - 5, y: cy - 2 }, { x: cx + 5, y: cy + 2 }));
  return [createItem(entry.kind, x, y)];
}

/** La prise de vue d'une entrée de la palette : ce qu'elle pose, seul, en perspective. */
function entryJob(entry: Entry): SnapshotJob {
  // Une ouverture se montre dans un bout de mur : seule, elle n'existe pas.
  if (WALL_MOUNTED.includes(entry.kind)) {
    const L = entry.kind === "bay" ? 5 : 3;
    const wall: PlannerItem = { id: `thumb-${entry.id}-wall`, kind: "wall", level: 2, x0: 0, y0: 0, x1: L, y1: 0 };
    const opening = { ...createItem(entry.kind, L / 2, 0), id: `thumb-${entry.id}` } as PlannerItem;
    return {
      id: jobId(entry),
      bounds: { x0: -0.3, x1: L + 0.3, y0: -0.6, y1: 0.6, z0: 0, z1: 3.2 },
      node: <PlannerItem3D item={wall} mounts={wallMounts(wall as PlannerLinear, [opening])} />,
    };
  }
  const items = dropped(entry, 0, 0);
  const pts = items.map(footprintOf).flatMap(cornersOf);
  let x0 = Math.min(...pts.map((p) => p.x)) - 0.3;
  let x1 = Math.max(...pts.map((p) => p.x)) + 0.3;
  let y0 = Math.min(...pts.map((p) => p.y)) - 0.3;
  const y1 = Math.max(...pts.map((p) => p.y)) + 0.3;
  if (entry.kind === "dock") y0 -= 0.6;
  if (entry.kind === "tree" || entry.kind === "light") {
    x0 -= 0.6;
    x1 += 0.6;
  }
  const tall: Partial<Record<string, number>> = {
    light: 6,
    tree: 3.4,
    palletRack: 3.5,
    shelfDecks: 2.8,
    picker: 4,
    parking: 1.5,
    solar: 1.4,
    powerLine: 4.3,
    fence: 1.6,
    conveyor: 1.6,
    conveyorCorner: 1.4,
    conveyorTee: 1.4,
    rail: 0.6,
    railCorner: 0.6,
    roof: 3.5,
    shrub: 0.5,
    flowerBed: 0.4,
    barrier: 1.3,
    gate: 1.2,
    lowWall: 1.2,
    tollBooth: 3,
    transformer: 1.4,
    packer: 2.2,
    consolidator: 2.6,
    delta: 2.3,
    palletizer: 2.4,
    roofSolar: PLANNER_WALL_TOP + 1.2,
    hvac: PLANNER_WALL_TOP + 0.7,
    coldRoom: 2,
    truckBay: 0.3,
    office: 1.4,
    accessRoad: 0.3,
  };
  const h = tall[entry.kind] ?? (entry.type === "place" || (entry.type === "piece" && !isLinear(items[0])) ? 2 : 3);
  // Ce qui est posé sur un toit flotte à sa hauteur : la vignette cadre la dalle, pas le vide dessous.
  const z0 = isRooftop(entry) ? PLANNER_WALL_TOP - 0.1 : 0;
  const node: ReactNode = items.map((it, i) => <PlannerItem3D key={i} item={{ ...it, id: `thumb-${entry.id}-${i}` }} />);
  return { id: jobId(entry), bounds: { x0, x1, y0, y1, z0, z1: h }, node };
}

export function WarehousePlanner({
  seed: seedProp,
  defaultSeed = 7,
  onSeedChange,
  shape,
  items: itemsProp,
  defaultItems = [],
  onItemsChange,
  plotSize,
  defaultView = "top",
  defaultOrbit = { yaw: 30, tilt: 40 },
  defaultProjection = "orthographic",
  projections = PROJECTIONS,
  defaultZoom = 1,
  cellSize = 14,
  height = 640,
  className,
  entries: entriesProp,
  selectedId: selectedIdProp,
  onSelectedIdChange,
  view: viewProp,
  onViewChange,
  readOnly = false,
  validate,
  onEdit,
  allowDowngrade = true,
  allowStretch = true,
  showInspector = true,
  showStatus = true,
  activeEntryId,
  onActiveEntryIdChange,
  highlightIds,
  focus,
  renderOverlay,
  sceneChildren,
  roofs: roofsProp,
  onRoofsChange,
  lockedAreas,
  traffic = 0.4,
  night = 0,
  groundStyle = "site",
  lightExclusions,
  treeExclusions,
  links,
  linkMode = false,
  onLink,
  canLink,
  selectedLinkId = null,
  onLinkSelect,
  onLinkRemove,
  zones,
  zoneMode = false,
  onZoneDraw,
  canZone,
  selectedZoneId = null,
  onZoneSelect,
  onZoneRemove,
  perimeterFence = false,
  gates,
  onFenceSelect,
  selectedGateId = null,
  onGateSelect,
  onGateRemove,
  paletteLayout = "sidebar",
  groupIcons,
  quality = "auto",
}: WarehousePlannerProps) {
  const [ownSeed, setOwnSeed] = useState(defaultSeed);
  const seed = seedProp ?? ownSeed;
  const setSeed = (s: number) => {
    setOwnSeed(s);
    onSeedChange?.(s);
  };
  const [ownItems, setOwnItems] = useState<PlannerItem[]>(defaultItems);
  const items = itemsProp ?? ownItems;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const setItems = useCallback(
    (next: PlannerItem[]) => {
      itemsRef.current = next;
      setOwnItems(next);
      onItemsChange?.(next);
    },
    [onItemsChange]
  );

  const basePlot = useMemo(() => generatePlot(seed, { shape, width: plotSize?.width, depth: plotSize?.depth }), [seed, shape, plotSize?.width, plotSize?.depth]);
  // Les parcelles à vendre rejoignent les échancrures : ce qui n'est pas au joueur ne se construit pas.
  const lockKey = JSON.stringify(lockedAreas ?? []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const plot = useMemo(() => withLockedAreas(basePlot, lockedAreas), [basePlot, lockKey]);
  /** Les entrées de la palette — celles de l'application si elle en donne — et leurs menus. */
  const allEntries = useMemo<Entry[]>(
    () =>
      entriesProp
        ? entriesProp.map((e) => ({
            id: e.id,
            label: e.label,
            group: e.group,
            type: "piece" as const,
            kind: e.kind,
            length: e.length,
            level: e.level,
            meta: e.meta,
            disabled: e.disabled,
            description: e.description,
          }))
        : ENTRIES,
    [entriesProp]
  );
  const menus = useMemo(() => {
    if (!entriesProp) return MENU;
    const out: { title: string; subs: { title: string; ids: string[] }[] }[] = [];
    for (const e of entriesProp) {
      let group = out.find((g) => g.title === e.group);
      if (!group) out.push((group = { title: e.group, subs: [] }));
      const subTitle = e.sub ?? "";
      let sub = group.subs.find((x) => x.title === subTitle);
      if (!sub) group.subs.push((sub = { title: subTitle, ids: [] }));
      sub.ids.push(e.id);
    }
    return out;
  }, [entriesProp]);
  const findEntry = (id: string) => allEntries.find((e) => e.id === id);
  // Une vignette par dessin distinct : deux entrées qui posent la même chose la partagent.
  const jobs = useMemo(() => {
    const seen = new Map<string, SnapshotJob>();
    for (const entry of allEntries) {
      const id = jobId(entry);
      if (!seen.has(id)) seen.set(id, entryJob(entry));
    }
    return [...seen.values()];
  }, [allEntries]);
  const [thumbs, setThumbs] = useState<Record<string, string>>(() => Object.fromEntries(jobs.map((j) => [j.id, cachedSnapshot(j.id)]).filter(([, u]) => u)));

  const [ownSelectedId, setOwnSelectedId] = useState<string | null>(null);
  const selectedId = selectedIdProp !== undefined ? selectedIdProp : ownSelectedId;
  const setSelectedId = (id: string | null) => {
    setOwnSelectedId(id);
    if (id !== selectedId) onSelectedIdChange?.(id);
  };
  const [hoverId, setHoverId] = useState<string | null>(null);
  /** L'élastique du flux en cours de tracé : son départ, l'élément visé, le point sous le pointeur. */
  const [linkDraft, setLinkDraft] = useState<{ from: string; to: string | null; at: P } | null>(null);
  const linkDraftRef = useRef(linkDraft);
  linkDraftRef.current = linkDraft;
  /** L'élastique de la zone en cours de tracé : ses deux coins, sur les nœuds de la grille. */
  const [zoneDraft, setZoneDraft] = useState<{ a: P; b: P } | null>(null);
  const zoneDraftRef = useRef(zoneDraft);
  zoneDraftRef.current = zoneDraft;
  /** La clôture survolée : la place qu'y prendrait un portail. */
  const [fenceHover, setFenceHover] = useState<FenceSpot | null>(null);
  /** Le dernier geste venait d'un doigt : on montre les commandes tactiles de la pose. */
  const [touchUi, setTouchUi] = useState(false);
  /** Les doigts posés sur la scène, et le geste à deux doigts en cours. */
  const touches = useRef(new Map<number, P>());
  const two = useRef<TwoFingers | null>(null);
  /** Après un geste à deux doigts, le doigt qui reste ne fait plus rien jusqu'à ce qu'il se lève. */
  const spent = useRef(false);
  /** Le bandeau de la palette : la famille ouverte, déplié ou non, et sa hauteur. */
  const [bandGroup, setBandGroup] = useState<string | null>(null);
  const [bandOpen, setBandOpen] = useState(true);
  const band = useRef<HTMLDivElement>(null);
  const [bandHeight, setBandHeight] = useState(0);
  useLayoutEffect(() => {
    const el = band.current;
    if (!el) {
      setBandHeight(0);
      return;
    }
    const measure = () => setBandHeight(Math.round(el.getBoundingClientRect().height));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [paletteLayout]);

  // Les voies d'accès : leurs raccordements à la rue, et les ouvertures qu'elles font dans la clôture.
  const roadOpenings = useMemo(() => accessRoadOpenings(items), [items]);
  const driveways = useMemo(() => accessRoadDriveways(items, plot), [items, plot]);
  const gateKey = JSON.stringify(gates ?? []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const laidGates = useMemo(() => layGates(plot, gates ?? [], roadOpenings), [plot, gateKey, roadOpenings]);
  const fenceRuns = useMemo(() => (perimeterFence ? perimeterFenceRuns(plot, [...roadOpenings, ...laidGates.map((g) => g.layout.opening)]) : []), [perimeterFence, plot, roadOpenings, laidGates]);
  /** L'outil en main : une entrée de la palette. */
  const [ownTool, setOwnTool] = useState<Entry | null>(null);
  const tool = activeEntryId !== undefined ? (activeEntryId === null ? null : findEntry(activeEntryId) ?? null) : ownTool;
  const setTool = (entry: Entry | null) => {
    setOwnTool(entry);
    if ((entry?.id ?? null) !== (tool?.id ?? null)) onActiveEntryIdChange?.(entry?.id ?? null);
  };
  /** Le cap de l'élément qu'on s'apprête à poser — R le tourne avant le clic. */
  const [placeRot, setPlaceRot] = useState(0);
  /** Les toitures affichées — on les masque pour voir et construire dedans. */
  const [ownRoofs, setOwnRoofs] = useState(true);
  const roofsWanted = roofsProp ?? ownRoofs;
  const setRoofs = (on: boolean) => {
    setOwnRoofs(on);
    if (on !== roofsWanted) onRoofsChange?.(on);
  };
  /** Le départ du tracé en cours, et le point sous le curseur. */
  const [start, setStart] = useState<P | null>(null);
  const [cursor, setCursor] = useState<P | null>(null);
  const [ownMode3d, setOwnMode3d] = useState(defaultView === "3d");
  const mode3d = viewProp !== undefined ? viewProp === "3d" : ownMode3d;
  const setMode3d = (on: boolean) => {
    setOwnMode3d(on);
    if (on !== mode3d) onViewChange?.(on ? "3d" : "top");
  };
  const [orbit, setOrbit] = useState(defaultOrbit);
  const [chosenProjection, setProjection] = useState<IsoProjection>(defaultProjection);
  // Une projection qui n'est plus proposée cède la place à la première qui l'est.
  const projection = projections.includes(chosenProjection) ? chosenProjection : (projections[0] ?? chosenProjection);
  const [query, setQuery] = useState("");
  // Ce qu'on s'apprête à poser sur un toit ne se pose pas sur un toit masqué : on les montre.
  const showRoofs = roofsWanted || (!!tool && (isRooftop(tool) || tool.kind === "roof"));
  /**
   * L'élément sous un point du plan. Toits masqués, ce qui est dessus n'existe pas pour la main ;
   * toits affichés, ce qui est dessus passe devant tout le reste — c'est ce qu'on voit d'abord.
   */
  const pick = (p: P): PlannerItem | null => {
    const all = itemsRef.current;
    if (!showRoofs) return hitTest(all.filter((it) => !isRooftop(it) && it.kind !== "roof"), p);
    return hitTest(all.filter(isRooftop), p) ?? hitTest(all.filter((it) => !isRooftop(it)), p);
  };
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    entriesProp ? Object.fromEntries(entriesProp.map((e) => [e.group, true])) : { Murs: true, Stockage: true, Convoyage: true }
  );
  const [message, setMessage] = useState<string | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [size, setSize] = useState({ width: 800, height: 520 });
  const [view, setView] = useState({ cx: 0, cy: 0, zoom: 1 });
  const fitted = useRef<number | null>(null);
  const measured = useRef(false);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => {
      measured.current = true;
      setSize({ width: Math.max(100, el.clientWidth), height: Math.max(100, el.clientHeight) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Cadrer le terrain et un peu de sa rue. */
  const fit = useCallback(() => {
    const zoom = Math.min(size.width / (plot.width + 16), size.height / (plot.depth + 16)) / cellSize;
    setView({ cx: plot.width / 2, cy: plot.depth / 2, zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom)) });
  }, [plot, size, cellSize]);
  useEffect(() => {
    if (!measured.current || fitted.current === plot.seed) return;
    // Le tout premier cadrage tient compte du grossissement demandé ; les suivants, non.
    const first = fitted.current === null;
    fitted.current = plot.seed;
    fit();
    if (first && defaultZoom !== 1) setView((v) => ({ ...v, zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.zoom * defaultZoom)) }));
  }, [plot.seed, fit, defaultZoom]);

  // Cadrer à la demande de l'application : les éléments désignés, un point, ou tout le terrain.
  // Une demande faite pendant que l'éditeur est masqué (un onglet voisin, `display: none`) attend
  // qu'il soit affiché et mesuré : cadrer sur une taille nulle poserait la caméra n'importe où.
  const pendingFocus = useRef<typeof focus | null>(null);
  const appliedFocus = useRef<string | number | null>(null);
  useEffect(() => {
    if (focus && focus.key !== appliedFocus.current) pendingFocus.current = focus;
    const target = pendingFocus.current;
    const el = stage.current;
    if (!target || !el || el.clientWidth === 0 || el.clientHeight === 0) return;
    if (Math.abs(size.width - el.clientWidth) > 1 || Math.abs(size.height - el.clientHeight) > 1) return;
    pendingFocus.current = null;
    appliedFocus.current = target.key;
    const targets = target.ids ? itemsRef.current.filter((it) => target.ids!.includes(it.id)) : [];
    if (targets.length === 0 && !target.point) {
      fit();
      return;
    }
    const pts = targets.length > 0 ? targets.map(footprintOf).flatMap(cornersOf) : [target.point!];
    const x0 = Math.min(...pts.map((q) => q.x));
    const x1 = Math.max(...pts.map((q) => q.x));
    const y0 = Math.min(...pts.map((q) => q.y));
    const y1 = Math.max(...pts.map((q) => q.y));
    // Une marge de quelques cases, et pas plus près qu'un élément isolé ne le mérite.
    const w = Math.max(8, x1 - x0 + 6);
    const d = Math.max(8, y1 - y0 + 6);
    const zoom = Math.min(size.width / w, size.height / d) / cellSize;
    setView({ cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom)) });
    // La clé déclenche, la taille rattrape une demande en attente ; le reste ne recadre pas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key, size.width, size.height]);

  // --- La caméra, et le passage écran ↔ sol dans n'importe quelle vue ---------------------------
  const camYaw = mode3d ? orbit.yaw : TOP_YAW;
  const camTilt = mode3d ? orbit.tilt : 90;
  const projectorFor = (cx: number, cy: number, zoom: number) =>
    viewProjector({ yaw: camYaw, tilt: camTilt, scale: cellSize * zoom, width: size.width, height: size.height, center: { x: cx, y: cy }, projection });
  const proj = projectorFor(view.cx, view.cy, view.zoom);
  const toScreen = (x: number, y: number, z = 0) => proj.toScreen(x, y, z);
  /** Le point du sol sous un pixel ; au-dessus de l'horizon, le centre de la vue. */
  const toWorld = (sx: number, sy: number) => proj.toGround(sx, sy) ?? { x: view.cx, y: view.cy };
  const local = (e: { clientX: number; clientY: number }) => {
    const r = stage.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };

  const flash = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage((m) => (m === text ? null : m)), 2600);
  };

  /** Pourquoi un élément ne peut pas être là — le terrain d'abord, puis la règle de l'application —
   *  ou `null` s'il le peut. */
  const problemOf = (item: PlannerItem, entryId: string | null = null): string | null => {
    if (!fitsPlot(item, plot)) return "Hors du terrain constructible.";
    return validate?.(item, itemsRef.current.filter((it) => it.id !== item.id), { entryId }) ?? null;
  };

  /** Poser ce qu'une entrée pose au point `(x, y)`, ou au plus près qui tienne. */
  const place = (entry: Entry, x: number, y: number) => {
    const base = dropped(entry, x, y);
    for (let r = 0; r <= 12; r += 0.5) {
      const steps = r === 0 ? 1 : Math.ceil(r * 8);
      for (let k = 0; k < steps; k += 1) {
        const a = (k / steps) * Math.PI * 2;
        const cand = base.map((it) => moveBy(it, Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r)));
        if (cand.every((it) => problemOf(it, entry.id) === null)) {
          setItems([...itemsRef.current, ...cand]);
          setSelectedId(cand.length === 1 ? cand[0].id : null);
          onEdit?.({ type: "add", items: cand, entryId: entry.id });
          return;
        }
      }
    }
    flash(problemOf(base[0], entry.id) ?? "Pas de place sur le terrain pour cet élément ici.");
  };

  // --- Le tracé en cours -------------------------------------------------------------------------
  const drawing = tool?.type === "draw" ? tool : null;
  const placing = tool?.type === "place" || tool?.type === "piece" ? tool : null;
  /** L'élément que l'outil en main poserait en `(x, y)`, calé et tourné. */
  const armedItem = (x: number, y: number): PlannerItem | null => {
    if (!placing) return null;
    const base = placing.type === "piece" ? pieceItem(placing, x, y) : createItem(placing.kind, x, y);
    return rotateTo(base, placeRot);
  };
  const areaTool = tool?.type === "area" ? tool : null;
  /** L'élément à poser, sous le curseur, calé sur la grille : ce que le clic posera, exactement.
   *  Une porte, une fenêtre, une baie s'accrochent au mur le plus proche — sinon, rien. */
  const rawGhost = placing && cursor ? armedItem(cursor.x, cursor.y) : null;
  const mountedGhost = !!rawGhost && WALL_MOUNTED.includes(rawGhost.kind);
  const ghost = rawGhost && mountedGhost ? snapToWall(rawGhost as PlannerPoint, items) : rawGhost;
  const ghostProblem = ghost ? problemOf(ghost, placing?.id ?? null) : null;
  const ghostOk = !!ghost && ghostProblem === null;
  /** La toiture en cours de tracé : le rectangle entre le coin de départ et le curseur. */
  const areaDraft = areaTool && start && cursor ? roofBetween(start, cursor) : null;
  const areaOk = areaDraft ? fitsPlot(areaDraft, plot) : false;
  const draft: PlannerLinear[] = drawing && start && cursor ? draftWalls(drawing.kind, drawing.mode, start, cursor) : [];
  const draftOk = draft.every((w) => fitsPlot(w, plot));

  const pickTool = (entry: Entry | null) => {
    setTool(entry);
    setStart(null);
    setSelectedId(null);
  };

  const drawClick = (p: P) => {
    if (!drawing) return;
    const q = wallPoint(p, start, drawing.mode, itemsRef.current);
    if (!start) {
      setStart(q);
      setCursor(q);
      return;
    }
    const walls = draftWalls(drawing.kind, drawing.mode, start, q);
    if (!walls.length) return;
    const wallProblem = walls.map((w) => problemOf(w, drawing.id)).find((m) => m !== null);
    if (wallProblem) {
      flash(wallProblem);
      return;
    }
    const committed = commitDraft(walls);
    setItems([...itemsRef.current, ...committed]);
    onEdit?.({ type: "add", items: committed, entryId: drawing.id });
    // Une chaîne continue là où le mur s'arrête ; les autres outils attendent un nouveau départ.
    setStart(drawing.mode === "chain" ? q : null);
  };

  const areaClick = (p: P) => {
    const q = { x: Math.round(p.x), y: Math.round(p.y) };
    if (!start) {
      setStart(q);
      setCursor(q);
      return;
    }
    const roof = roofBetween(start, q);
    if (!roof) return;
    const roofProblem = problemOf(roof, areaTool?.id ?? null);
    if (roofProblem) {
      flash(roofProblem);
      return;
    }
    const placedRoof = { ...roof, id: createItem("roof", 0, 0).id };
    setItems([...itemsRef.current, placedRoof]);
    onEdit?.({ type: "add", items: [placedRoof], entryId: areaTool?.id ?? "roof" });
    setStart(null);
  };

  const update = (id: string, next: PlannerItem) => setItems(itemsRef.current.map((it) => (it.id === id ? next : it)));
  /** Un changement d'un coup (tourner, retourner, une option) : appliqué s'il est permis, puis signalé. */
  const commit = (before: PlannerItem, next: PlannerItem) => {
    if (readOnly) return;
    const problem = problemOf(next);
    if (problem) {
      flash(problem);
      return;
    }
    update(before.id, next);
    onEdit?.({ type: "update", before, after: next });
  };

  // --- Les zones, la clôture, les portails ----------------------------------------------------------
  /** La zone sous un point du sol — la dernière tracée d'abord, comme elle est peinte par-dessus. */
  const zoneAt = (w: P): PlannerZone | null => {
    const list = zones ?? [];
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const z = list[i];
      if (w.x >= z.x && w.x <= z.x + z.width && w.y >= z.y && w.y <= z.y + z.depth) return z;
    }
    return null;
  };
  /** Pourquoi une zone ne peut pas être là, ou `null`. */
  const zoneProblem = (r: ZoneRect): string | null => {
    if (r.width < 1 || r.depth < 1) return "Tirez au moins une case de côté.";
    for (let x = r.x; x < r.x + r.width; x += 1) for (let y = r.y; y < r.y + r.depth; y += 1) if (!plotInside(plot, x, y)) return "Hors du terrain constructible.";
    return canZone?.(r) ?? null;
  };
  /** Le portail sous un point du sol. */
  const gateAt = (w: P): string | null => {
    for (const { gate, layout: g } of laidGates) {
      const f = plotSideFrame(plot, g.side);
      if (Math.abs(f.along(w) - g.along) <= g.width / 2 + 0.2 && Math.abs(f.out(w)) < 0.9) return gate.id;
    }
    return null;
  };
  /**
   * La clôture de pourtour sous un point du sol : le point ramené sur sa ligne et calé à la demi-case,
   * le côté du terrain qu'elle ferme, et la place qu'y prendrait un portail — permise ou non.
   */
  const fenceAt = (w: P): FenceSpot | null => {
    if (!perimeterFence || !onFenceSelect) return null;
    let best: { run: PlotFenceRun; gap: number } | null = null;
    for (const run of fenceRuns) {
      const horizontal = run.y0 === run.y1;
      const lo = horizontal ? Math.min(run.x0, run.x1) : Math.min(run.y0, run.y1);
      const hi = horizontal ? Math.max(run.x0, run.x1) : Math.max(run.y0, run.y1);
      const along = horizontal ? w.x : w.y;
      const gap = horizontal ? Math.abs(w.y - run.y0) : Math.abs(w.x - run.x0);
      if (along < lo - 0.2 || along > hi + 0.2 || gap > 0.45) continue;
      if (!best || gap < best.gap) best = { run, gap };
    }
    if (!best) return null;
    const { run } = best;
    const horizontal = run.y0 === run.y1;
    const line = horizontal ? run.y0 : run.x0;
    const lo = horizontal ? Math.min(run.x0, run.x1) : Math.min(run.y0, run.y1);
    const hi = horizontal ? Math.max(run.x0, run.x1) : Math.max(run.y0, run.y1);
    const along = Math.max(lo, Math.min(hi, Math.round((horizontal ? w.x : w.y) * 2) / 2));
    // Le côté : là où n'est pas le terrain. Une case prise un peu en deçà du bout du tronçon.
    const probe = Math.floor(Math.max(lo + 0.25, Math.min(hi - 0.25, along)));
    const insideAfter = horizontal ? plotInside(plot, probe, line) : plotInside(plot, line, probe);
    const edge: FenceEdge = horizontal ? (insideAfter ? "south" : "north") : insideAfter ? "west" : "east";
    const street = horizontal ? line === 0 || line === plot.depth : line === 0 || line === plot.width;
    const half = GATE_WIDTH / 2;
    let reason: string | undefined;
    if (!street) reason = "Ce côté ne donne pas sur la rue.";
    else if (laidGates.some(({ layout: g }) => g.side === edge && Math.abs(g.along - along) < g.width / 2 + half + 1)) reason = "Trop près d'un autre portail.";
    else if (along - half < lo + 0.5 || along + half > hi - 0.5) reason = "Trop près d'un angle ou d'une ouverture de la clôture.";
    const at = (v: number): P => (horizontal ? { x: v, y: line } : { x: line, y: v });
    return { ...at(along), edge, valid: !reason, reason, from: at(along - half), to: at(along + half) };
  };

  // --- Les gestes -------------------------------------------------------------------------------
  /** Choisir un élément : la zone, le portail et la flèche choisis le cèdent. */
  const selectItem = (id: string) => {
    setSelectedId(id);
    if (selectedZoneId) onZoneSelect?.(null);
    if (selectedGateId) onGateSelect?.(null);
    if (selectedLinkId) onLinkSelect?.(null);
  };
  /**
   * Un tapotement sur le sol, sans élément dessous : un portail, la clôture, une zone — dans cet
   * ordre, les plus fins d'abord — ou rien, et tout ce qui était choisi est laissé.
   */
  const tapGround = (w: P) => {
    const drop = (keep: "zone" | "gate" | "none") => {
      setSelectedId(null);
      if (selectedLinkId) onLinkSelect?.(null);
      if (keep !== "zone" && selectedZoneId) onZoneSelect?.(null);
      if (keep !== "gate" && selectedGateId) onGateSelect?.(null);
    };
    if (!zoneMode && !linkMode) {
      const gate = gateAt(w);
      if (gate) {
        drop("gate");
        onGateSelect?.(gate);
        return;
      }
      const spot = readOnly ? null : fenceAt(w);
      if (spot) {
        drop("none");
        onFenceSelect?.({ x: spot.x, y: spot.y, edge: spot.edge, valid: spot.valid, reason: spot.reason });
        return;
      }
      const zone = zoneAt(w);
      if (zone) {
        drop("zone");
        onZoneSelect?.(zone.id);
        return;
      }
    }
    drop("none");
  };
  /** Poser ce que montre le fantôme, là où il est — pas ailleurs. `keep` : garder l'outil en main. */
  const placeAt = (w: P, keep: boolean) => {
    if (!placing) return;
    let item = armedItem(w.x, w.y) as PlannerItem;
    if (WALL_MOUNTED.includes(item.kind)) {
      const onWall = snapToWall(item as PlannerPoint, itemsRef.current);
      if (!onWall) {
        flash("Une ouverture se pose sur un mur : approchez-la d'un mur.");
        return;
      }
      item = onWall;
    }
    const placeProblem = problemOf(item, placing.id);
    if (placeProblem) {
      flash(placeProblem);
      return;
    }
    setItems([...itemsRef.current, item]);
    selectItem(item.id);
    onEdit?.({ type: "add", items: [item], entryId: placing.id });
    if (!keep) setTool(null);
  };

  /** Les deux doigts posés : leur milieu, leur écart, l'angle de l'un à l'autre. */
  const pair = () => {
    const [a, b] = [...touches.current.values()];
    return { m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, d: Math.hypot(b.x - a.x, b.y - a.y), ang: Math.atan2(b.y - a.y, b.x - a.x) };
  };
  /** Un second doigt se pose : ce que le premier avait commencé est défait, la caméra prend la main. */
  const startTwo = () => {
    const d = drag.current;
    if (d?.t === "hold") window.clearTimeout(d.timer);
    if (d && (d.t === "move" || d.t === "end" || d.t === "rotate")) update(d.id, d.orig);
    if (d?.t === "zone") setZoneDraft(null);
    if (d?.t === "link") setLinkDraft(null);
    drag.current = null;
    const q = pair();
    two.current = {
      mode: "undecided",
      d0: Math.max(10, q.d),
      a0: q.ang,
      m0: q.m,
      zoom0: view.zoom,
      view0: { cx: view.cx, cy: view.cy },
      ground: toWorld(q.m.x, q.m.y),
      yaw0: orbit.yaw,
      tilt0: orbit.tilt,
      twist: false,
    };
  };
  const moveTwo = () => {
    const g = two.current;
    if (!g || touches.current.size < 2) return;
    const q = pair();
    const dx = q.m.x - g.m0.x;
    const dy = q.m.y - g.m0.y;
    const spread = q.d - g.d0;
    let turn = q.ang - g.a0;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    if (g.mode === "undecided") {
      // Les doigts bougent l'un après l'autre, un événement chacun : on attend que le geste ait pris
      // de l'ampleur avant de le lire, sans quoi le premier doigt parti ressemble à une rotation.
      if (Math.hypot(dx, dy) < 16 && Math.abs(spread) < 16 && Math.abs(turn) < 0.3) return;
      if (Math.abs(dy) > Math.abs(dx) * 1.5 && Math.abs(spread) < 24 && Math.abs(turn) < 0.25) {
        g.mode = "tilt";
        if (!mode3d) {
          // Comme au clic molette : depuis la vue de dessus, on part de l'aplomb et on bascule.
          g.yaw0 = TOP_YAW;
          g.tilt0 = 89;
          setOrbit({ yaw: TOP_YAW, tilt: 89 });
          setMode3d(true);
        }
      } else g.mode = "pinch";
    }
    if (g.mode === "tilt") {
      // Les doigts qui montent relèvent la caméra, comme la main au clic molette.
      setOrbit((o) => ({ ...o, tilt: Math.max(10, Math.min(89, g.tilt0 - dy * 0.25)) }));
      return;
    }
    const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, (g.zoom0 * Math.max(10, q.d)) / g.d0));
    let yaw = mode3d ? orbit.yaw : TOP_YAW;
    if (mode3d) {
      if (!g.twist && Math.abs(turn) > 0.1) g.twist = true;
      if (g.twist) yaw = g.yaw0 + (TWIST_SIGN * turn * 180) / Math.PI;
    }
    // Le point du sol pris sous le milieu des doigts y reste : on vise avec la nouvelle caméra, et on
    // recale le centre d'autant.
    const pj = viewProjector({ yaw, tilt: camTilt, scale: cellSize * zoom, width: size.width, height: size.height, center: { x: g.view0.cx, y: g.view0.cy }, projection });
    const hit = pj.toGround(q.m.x, q.m.y);
    setView({ zoom, cx: hit ? g.view0.cx + g.ground.x - hit.x : view.cx, cy: hit ? g.view0.cy + g.ground.y - hit.y : view.cy });
    if (mode3d && g.twist) setOrbit((o) => ({ ...o, yaw }));
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    stage.current?.focus();
    const p = local(e);
    const touch = e.pointerType === "touch";
    if (touch !== touchUi) setTouchUi(touch);
    if (touch) {
      touches.current.set(e.pointerId, p);
      e.currentTarget.setPointerCapture(e.pointerId);
      if (touches.current.size === 2) {
        startTwo();
        return;
      }
      if (touches.current.size > 2) return;
      spent.current = false;
    }
    if (e.button === 2) {
      if (zoneMode) {
        // En traçant des zones, le clic droit tient la vue : on la déplace sans rien tracer.
        setZoneDraft(null);
        e.currentTarget.setPointerCapture(e.pointerId);
        const g = toWorld(p.x, p.y);
        drag.current = { t: "pan", sx: p.x, sy: p.y, cx: view.cx, cy: view.cy, gx: g.x, gy: g.y, moved: true };
        return;
      }
      // Le clic droit repose le tracé en cours, puis l'outil.
      if (start) setStart(null);
      else setTool(null);
      return;
    }
    if (!touch) e.currentTarget.setPointerCapture(e.pointerId);
    const w = toWorld(p.x, p.y);
    const pan: PanDrag = { t: "pan", sx: p.x, sy: p.y, cx: view.cx, cy: view.cy, gx: w.x, gy: w.y, moved: false };
    if (e.button === 1) {
      // Le clic molette tient la caméra : tourner autour, incliner. Depuis la vue de dessus, on part
      // de l'aplomb, au même cap, et on bascule de biais sans à-coup.
      e.preventDefault();
      const from = mode3d ? orbit : { yaw: TOP_YAW, tilt: 89 };
      if (!mode3d) {
        setOrbit(from);
        setMode3d(true);
      }
      drag.current = { t: "orbit", sx: p.x, sy: p.y, yaw: from.yaw, tilt: from.tilt };
      return;
    }
    if (zoneMode) {
      // Tracer une zone : du nœud de la grille pressé au nœud sous le pointeur.
      if (readOnly) {
        drag.current = pan;
        return;
      }
      const q = { x: Math.round(w.x), y: Math.round(w.y) };
      drag.current = { t: "zone", start: q };
      setZoneDraft({ a: q, b: q });
      return;
    }
    if (linkMode) {
      // Tracer un flux : presser sur un élément tend l'élastique ; presser sur le sol déplace la vue.
      const from = pick(w);
      if (from) {
        drag.current = { t: "link", from: from.id };
        setLinkDraft({ from: from.id, to: null, at: w });
      } else drag.current = pan;
      return;
    }
    const linkEl = (e.target as Element).closest?.("[data-link]") as HTMLElement | null;
    if (linkEl) {
      onLinkSelect?.(linkEl.dataset.link ?? null);
      setSelectedId(null);
      if (selectedZoneId) onZoneSelect?.(null);
      if (selectedGateId) onGateSelect?.(null);
      return;
    }
    if (readOnly) {
      // On regarde : un clic choisit, un glisser déplace la vue — rien d'autre.
      const hit = pick(w);
      if (hit) selectItem(hit.id);
      else drag.current = pan;
      return;
    }
    if (drawing) {
      drawClick(w);
      return;
    }
    if (areaTool) {
      areaClick(w);
      return;
    }
    if (placing) {
      if (touch) {
        // Au doigt, on vise d'abord : le fantôme vient sous le doigt, et c'est la coche qui pose.
        const f = footprintOf(armedItem(w.x, w.y) as PlannerItem);
        setCursor({ x: f.cx, y: f.cy });
        return;
      }
      placeAt(w, e.shiftKey);
      return;
    }
    const handle = (e.target as Element).closest?.("[data-handle]") as HTMLElement | null;
    if (handle) {
      const id = handle.dataset.id as string;
      const item = itemsRef.current.find((it) => it.id === id);
      if (!item) return;
      selectItem(id);
      if (handle.dataset.handle === "move") drag.current = { t: "move", id, wx: w.x, wy: w.y, orig: item };
      else if (handle.dataset.handle === "rotate") {
        const f = footprintOf(item);
        drag.current = { t: "rotate", id, cx: f.cx, cy: f.cy, orig: item };
      }
      else if (allowStretch) drag.current = { t: "end", id, which: handle.dataset.handle === "end0" ? 0 : 1, orig: item };
      return;
    }
    const hit = pick(w);
    if (hit) {
      if (touch) {
        // Au doigt, un élément ne se prend qu'après un appui tenu : un glisser franc sur lui déplace
        // la vue, comme partout ailleurs — on ne déménage pas un rack en voulant faire défiler.
        const timer = window.setTimeout(() => {
          const d = drag.current;
          if (d?.t !== "hold" || d.id !== hit.id) return;
          selectItem(hit.id);
          drag.current = { t: "move", id: hit.id, wx: d.wx, wy: d.wy, orig: d.orig };
          navigator.vibrate?.(12);
        }, HOLD_MS);
        drag.current = { t: "hold", id: hit.id, orig: hit, wx: w.x, wy: w.y, pan, timer };
        return;
      }
      selectItem(hit.id);
      drag.current = { t: "move", id: hit.id, wx: w.x, wy: w.y, orig: hit };
      return;
    }
    drag.current = pan;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = local(e);
    if (e.pointerType === "touch") {
      if (!touches.current.has(e.pointerId)) return;
      touches.current.set(e.pointerId, p);
      if (two.current) {
        moveTwo();
        return;
      }
      if (spent.current) return;
    }
    let d = drag.current;
    if (!d) {
      const w = toWorld(p.x, p.y);
      if (drawing) {
        const q = wallPoint(w, start, drawing.mode, itemsRef.current);
        if (!cursor || q.x !== cursor.x || q.y !== cursor.y) setCursor(q);
        return;
      }
      if (areaTool) {
        const q = { x: Math.round(w.x), y: Math.round(w.y) };
        if (!cursor || q.x !== cursor.x || q.y !== cursor.y) setCursor(q);
        return;
      }
      if (placing) {
        // Le fantôme ne bouge que d'un cran de grille à l'autre. Son centre calé, et non ses `x`/`y` :
        // un élément linéaire en main (un rack, un tapis) est un segment, il n'en a pas.
        const f = footprintOf(armedItem(w.x, w.y) as PlannerItem);
        const q = { x: f.cx, y: f.cy };
        if (!cursor || q.x !== cursor.x || q.y !== cursor.y) setCursor(q);
        return;
      }
      if (zoneMode) {
        if (hoverId) setHoverId(null);
        return;
      }
      const id = pick(w)?.id ?? null;
      if (id !== hoverId) setHoverId(id);
      // La clôture survolée montre la place du portail qu'on y percerait.
      const spot = !id && !linkMode && !readOnly ? fenceAt(w) : null;
      if ((spot?.x ?? null) !== (fenceHover?.x ?? null) || (spot?.y ?? null) !== (fenceHover?.y ?? null) || (spot?.valid ?? null) !== (fenceHover?.valid ?? null)) setFenceHover(spot);
      return;
    }
    if (d.t === "hold") {
      // Le doigt a glissé avant la fin de l'appui : ce n'était pas pour prendre l'élément.
      if (Math.hypot(p.x - d.pan.sx, p.y - d.pan.sy) <= TAP_SLOP) return;
      window.clearTimeout(d.timer);
      d = drag.current = d.pan;
    }
    if (d.t === "zone") {
      const w = toWorld(p.x, p.y);
      const q = { x: Math.round(w.x), y: Math.round(w.y) };
      setZoneDraft((z) => (z && (z.b.x !== q.x || z.b.y !== q.y) ? { a: z.a, b: q } : z));
      return;
    }
    if (d.t === "link") {
      const w = toWorld(p.x, p.y);
      const over = pick(w);
      setLinkDraft({ from: d.from, to: over && over.id !== d.from ? over.id : null, at: w });
      return;
    }
    if (d.t === "orbit") {
      // La main qui monte relève la caméra, comme sur la planche : on voit la scène de plus haut.
      setOrbit({ yaw: d.yaw + (p.x - d.sx) * 0.4, tilt: Math.max(10, Math.min(89, d.tilt - (p.y - d.sy) * 0.25)) });
      return;
    }
    if (d.t === "pan") {
      if (Math.hypot(p.x - d.sx, p.y - d.sy) > (e.pointerType === "touch" ? TAP_SLOP : 3)) d.moved = true;
      // On tient le point du sol attrapé sous le pointeur : la vue glisse d'autant, sous tout angle.
      const g = projectorFor(d.cx, d.cy, view.zoom).toGround(p.x, p.y);
      if (g) setView((v) => ({ ...v, cx: d.cx + (d.gx - g.x), cy: d.cy + (d.gy - g.y) }));
      return;
    }
    const w = toWorld(p.x, p.y);
    if (d.t === "move") {
      let next = moveBy(d.orig, w.x - d.wx, w.y - d.wy);
      // Une ouverture glisse le long de son mur, ou passe à un autre ; jamais dans le vide.
      if (WALL_MOUNTED.includes(next.kind)) next = snapToWall(next as PlannerPoint, itemsRef.current.filter((it) => it.id !== d.id)) ?? d.orig;
      update(d.id, next);
    }
    else if (d.t === "rotate") update(d.id, rotateTo(d.orig, (Math.atan2(w.y - d.cy, w.x - d.cx) * 180) / Math.PI, e.altKey));
    else if (isLinear(d.orig)) update(d.id, dragEnd(d.orig, d.which, w, e.altKey));
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const release = () => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    };
    if (e.pointerType === "touch") {
      touches.current.delete(e.pointerId);
      if (two.current) {
        // Un doigt se lève : le geste à deux s'arrête, et celui qui reste ne fait plus rien.
        if (touches.current.size < 2) {
          two.current = null;
          spent.current = touches.current.size > 0;
        }
        release();
        return;
      }
      if (spent.current) {
        if (touches.current.size === 0) spent.current = false;
        release();
        return;
      }
    }
    const d = drag.current;
    drag.current = null;
    release();
    if (!d) return;
    if (d.t === "hold") {
      // Un tapotement sur un élément : il est choisi.
      window.clearTimeout(d.timer);
      selectItem(d.id);
      return;
    }
    if (d.t === "zone") {
      const z = zoneDraftRef.current;
      setZoneDraft(null);
      if (!z) return;
      const rect = zoneRect(z.a, z.b);
      if (rect.width < 1 && rect.depth < 1) return;
      const problem = zoneProblem(rect);
      if (problem) flash(problem);
      else onZoneDraw?.(rect);
      return;
    }
    if (d.t === "link") {
      const draftLink = linkDraftRef.current;
      setLinkDraft(null);
      if (draftLink?.to && !(canLink?.(d.from, draftLink.to) ?? null)) onLink?.(d.from, draftLink.to);
      return;
    }
    if (d.t === "pan") {
      if (!d.moved && !zoneMode) tapGround({ x: d.gx, y: d.gy });
      return;
    }
    if (d.t === "orbit") return;
    const now = itemsRef.current.find((it) => it.id === d.id);
    if (!now || JSON.stringify(now) === JSON.stringify(d.orig)) return;
    const problem = problemOf(now);
    if (problem) {
      update(d.id, d.orig);
      flash(`${problem} L'élément revient à sa place.`);
      return;
    }
    onEdit?.({ type: "update", before: d.orig, after: now });
  };

  // La molette zoome autour du pointeur. Écoutée à la main : React la rend passive. L'écouteur est
  // posé une fois ; il lit la caméra du moment par une référence.
  const zoomProjector = useRef(projectorFor);
  zoomProjector.current = projectorFor;
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Dans le bandeau de la palette, la molette fait défiler les vignettes, pas la caméra.
      if ((e.target as Element | null)?.closest?.(".lq-planner__band")) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
      setView((v) => {
        const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.zoom * Math.exp(-e.deltaY * 0.0015)));
        // Le point du sol sous le pointeur y reste : on le vise avant et après, et on recale.
        const g0 = zoomProjector.current(v.cx, v.cy, v.zoom).toGround(sx, sy);
        const g1 = zoomProjector.current(v.cx, v.cy, zoom).toGround(sx, sy);
        if (!g0 || !g1) return { ...v, zoom };
        return { zoom, cx: v.cx + g0.x - g1.x, cy: v.cy + g0.y - g1.y };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [cellSize]);

  const zoomBy = (k: number) => setView((v) => ({ ...v, zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.zoom * k)) }));

  const selected = items.find((it) => it.id === selectedId) ?? null;
  const remove = () => {
    if (!selected || readOnly) return;
    setItems(itemsRef.current.filter((it) => it.id !== selected.id));
    setSelectedId(null);
    onEdit?.({ type: "remove", items: [selected] });
  };
  const turn = (dir: 1 | -1 = 1) => selected && !WALL_MOUNTED.includes(selected.kind) && commit(selected, rotateQuarter(selected, dir));
  const setOption = (patch: { storage?: StorageClass; passage?: boolean }) => selected && commit(selected, { ...selected, ...patch } as PlannerItem);
  const reverse = () => selected && commit(selected, flip(selected));
  /** Améliorer (`+1`) ou rétrograder (`-1`) l'élément choisi — s'il tient encore sur le terrain. */
  const evolve = (dir: 1 | -1) => {
    if (!selected || readOnly || (dir < 0 && !allowDowngrade)) return;
    const next = withLevel(selected, levelOf(selected) + dir);
    if (levelOf(next) === levelOf(selected)) return;
    const problem = problemOf(next);
    if (problem) {
      flash(fitsPlot(next, plot) ? problem : "Pas la place pour ce niveau ici : déplacez l'élément d'abord.");
      return;
    }
    update(selected.id, next);
    onEdit?.({ type: "evolve", before: selected, after: next });
  };
  const swapDock = () => {
    if (selected && isLinear(selected) && (selected.kind === "wall" || selected.kind === "dock")) commit(selected, { ...selected, kind: selected.kind === "wall" ? "dock" : "wall" });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Dans le champ de recherche, une lettre est une lettre.
    if ((e.target as HTMLElement).closest?.("input, textarea")) return;
    // Un raccourci avec Ctrl, Cmd ou Alt n'est pas pour l'éditeur (annuler, copier…).
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape" && selectedLinkId && !start && !tool) onLinkSelect?.(null);
    if (e.key === "Escape") {
      if (drag.current?.t === "zone") {
        drag.current = null;
        setZoneDraft(null);
      } else if (start) setStart(null);
      else if (tool) setTool(null);
      else {
        setSelectedId(null);
        if (selectedZoneId) onZoneSelect?.(null);
        if (selectedGateId) onGateSelect?.(null);
      }
    } else if (readOnly) return;
    else if (e.key === "Delete" || e.key === "Backspace") {
      // La plus fine d'abord : une flèche, un portail, une zone, puis l'élément.
      if (selectedLinkId && onLinkRemove) onLinkRemove(selectedLinkId);
      else if (selectedGateId && onGateRemove) onGateRemove(selectedGateId);
      else if (selectedZoneId && onZoneRemove) onZoneRemove(selectedZoneId);
      else if (!selected) return;
      else remove();
    }
    else if (e.key === "r" || e.key === "R") {
      // Avant la pose, R tourne le fantôme ; après, l'élément choisi. Maj : dans l'autre sens.
      if (placing) setPlaceRot((r) => (r + (e.shiftKey ? 270 : 90)) % 360);
      else if (selected) turn(e.shiftKey ? -1 : 1);
      else return;
    }
    // F ne retourne qu'un segment : sur un élément posé, la touche reste à l'application.
    else if ((e.key === "f" || e.key === "F") && selected && isLinear(selected)) reverse();
    else if ((e.key === "u" || e.key === "U") && selected) evolve(e.shiftKey ? -1 : 1);
    else if (e.key === "+" || e.key === "=") zoomBy(1.25);
    else if (e.key === "-") zoomBy(0.8);
    else return;
    e.preventDefault();
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    // Lâché sur le bandeau de la palette : ce n'est pas sur le terrain.
    if ((e.target as Element).closest?.(".lq-planner__band")) return;
    const id = e.dataTransfer.getData(DND);
    const entry = findEntry(id);
    if (!entry || readOnly || (entry.type === "piece" && entry.disabled)) return;
    e.preventDefault();
    const p = local(e);
    const w = toWorld(p.x, p.y);
    place(entry, w.x, w.y);
  };

  // --- Le calque : contours, poignées, cotes -----------------------------------------------------
  const outline = (item: PlannerItem, cls: string, key: string) => {
    const poly = cornersOf(footprintOf(item))
      .map((c) => toScreen(c.x, c.y))
      .map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`)
      .join(" ");
    return <polygon key={key} className={cls} points={poly} />;
  };
  const dim = (w: PlannerLinear, key: string) => {
    const L = Math.hypot(w.x1 - w.x0, w.y1 - w.y0);
    const m = toScreen((w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2);
    return (
      <text key={key} className="lq-planner__dim" x={m.x} y={m.y - 12} textAnchor="middle">
        {`${(L * 2).toFixed(0)} m`}
      </text>
    );
  };
  const overlay = (item: PlannerItem, strong: boolean) => {
    const ok = fitsPlot(item, plot);
    const cls = ["lq-planner__outline", strong && "lq-planner__outline--selected", !ok && "lq-planner__outline--invalid"].filter(Boolean).join(" ");
    const parts: ReactNode[] = [outline(item, cls, "o")];
    if (readOnly) return <g key={item.id}>{parts}</g>;
    if (isLinear(item)) {
      const a = toScreen(item.x0, item.y0);
      const b = toScreen(item.x1, item.y1);
      const m = toScreen((item.x0 + item.x1) / 2, (item.y0 + item.y1) / 2);
      if (allowStretch)
        parts.push(
          <circle key="e0" className="lq-planner__handle lq-planner__handle--end" data-handle="end0" data-id={item.id} cx={a.x} cy={a.y} r={7}>
            <title>Tirer pour étirer</title>
          </circle>,
          <circle key="e1" className="lq-planner__handle lq-planner__handle--end" data-handle="end1" data-id={item.id} cx={b.x} cy={b.y} r={7}>
            <title>Tirer pour étirer</title>
          </circle>
        );
      parts.push(
        <g key="m" className="lq-planner__handle lq-planner__handle--move" data-handle="move" data-id={item.id} transform={`translate(${m.x} ${m.y})`}>
          <rect x={-9} y={-9} width={18} height={18} rx={3} />
          <path d="M0 -6 L0 6 M-6 0 L6 0 M0 -6 l-2 2 M0 -6 l2 2 M0 6 l-2 -2 M0 6 l2 -2 M-6 0 l2 -2 M-6 0 l2 2 M6 0 l-2 -2 M6 0 l-2 2" />
          <title>Tirer pour déplacer</title>
        </g>
      );
      if (strong) parts.push(dim(item, "d"));
    } else if (strong && !WALL_MOUNTED.includes(item.kind)) {
      // La poignée de rotation, devant l'élément, dans son cap : on la tire autour de lui.
      const f = footprintOf(item);
      const reach = f.halfL + 0.9;
      const c = toScreen(f.cx, f.cy);
      const h = toScreen(f.cx + Math.cos(f.angle) * reach, f.cy + Math.sin(f.angle) * reach);
      parts.push(
        <line key="rl" className="lq-planner__rotate-arm" x1={c.x} y1={c.y} x2={h.x} y2={h.y} />,
        <g key="r" className="lq-planner__handle lq-planner__handle--rotate" data-handle="rotate" data-id={item.id} transform={`translate(${h.x} ${h.y})`}>
          <circle r={9} />
          <path d="M-4 -3 A5 5 0 1 1 -5 2 M-4 -3 l-2.5 0.5 M-4 -3 l0.5 -2.5" />
          <title>Tirer pour tourner (Alt : sans crans)</title>
        </g>,
        <text key="ra" className="lq-planner__dim" x={h.x} y={h.y - 14} textAnchor="middle">
          {`${Math.round(headingOf(item))}°`}
        </text>
      );
    }
    return <g key={item.id}>{parts}</g>;
  };

  // --- Les flèches de flux ------------------------------------------------------------------------
  /**
   * Une flèche au sol, de l'emprise de `a` à celle de `b` (ou au point `b`) : un ruban projeté sur le
   * sol — il suit la perspective —, sa pointe, et le trait central dont les tirets défilent.
   */
  const arrow = (a: PlannerItem, b: PlannerItem | P, key: string, opts: { cls: string; color?: string; label?: string; dashed?: boolean; linkId?: string; reason?: string | null }) => {
    const fa = footprintOf(a);
    const fb = "kind" in b ? footprintOf(b) : null;
    const target = fb ? { x: fb.cx, y: fb.cy } : (b as P);
    const p0 = edgeToward(fa, target);
    const p1 = fb ? edgeToward(fb, { x: fa.cx, y: fa.cy }) : target;
    const len = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    if (len < 0.3) return null;
    const ux = (p1.x - p0.x) / len;
    const uy = (p1.y - p0.y) / len;
    const nx = -uy;
    const ny = ux;
    const half = 0.28;
    const head = Math.min(1.1, len * 0.45);
    const neck = { x: p1.x - ux * head, y: p1.y - uy * head };
    const Z = 0.03;
    const pt = (x: number, y: number) => {
      const q = toScreen(x, y, Z);
      return `${q.x.toFixed(1)},${q.y.toFixed(1)}`;
    };
    const ribbon = [pt(p0.x + nx * half, p0.y + ny * half), pt(neck.x + nx * half, neck.y + ny * half), pt(neck.x - nx * half, neck.y - ny * half), pt(p0.x - nx * half, p0.y - ny * half)].join(" ");
    const tip = [pt(neck.x + nx * half * 2.2, neck.y + ny * half * 2.2), pt(p1.x, p1.y), pt(neck.x - nx * half * 2.2, neck.y - ny * half * 2.2)].join(" ");
    const s0 = toScreen(p0.x, p0.y, Z);
    const s1 = toScreen(neck.x, neck.y, Z);
    const mid = toScreen((p0.x + neck.x) / 2, (p0.y + neck.y) / 2, Z);
    const tgt = toScreen(p1.x, p1.y, Z);
    const style = opts.color ? ({ ["--lq-link-color" as string]: opts.color } as CSSProperties) : undefined;
    return (
      <g key={key} className={[opts.cls, opts.dashed && "lq-planner__link--dashed"].filter(Boolean).join(" ")} style={style} data-link={opts.linkId}>
        <polygon className="lq-planner__link-ribbon" points={ribbon} />
        <polygon className="lq-planner__link-head" points={tip} />
        <line className="lq-planner__link-flow" x1={s0.x} y1={s0.y} x2={s1.x} y2={s1.y} />
        {opts.label && (
          <text className="lq-planner__link-label" x={mid.x} y={mid.y - 8} textAnchor="middle">
            {opts.label}
          </text>
        )}
        {opts.reason && (
          <text className="lq-planner__link-label lq-planner__link-label--invalid" x={tgt.x} y={tgt.y - 16} textAnchor="middle">
            {opts.reason}
          </text>
        )}
      </g>
    );
  };
  const byId = new Map(items.map((it) => [it.id, it]));
  const linkArrows: ReactNode[] = [];
  for (const l of links ?? []) {
    const a = byId.get(l.from);
    const b = byId.get(l.to);
    if (!a || !b || a === b) continue;
    const on = l.id === selectedLinkId;
    linkArrows.push(arrow(a, b, `link-${l.id}`, { cls: ["lq-planner__link", on && "lq-planner__link--selected", !linkMode && "lq-planner__link--pickable"].filter(Boolean).join(" "), color: l.color, label: l.label, dashed: l.dashed, linkId: l.id }));
  }
  if (linkDraft) {
    const a = byId.get(linkDraft.from);
    const b = linkDraft.to ? byId.get(linkDraft.to) : undefined;
    const reason = a && b ? (canLink?.(a.id, b.id) ?? null) : null;
    if (a) {
      if (b) linkArrows.push(outline(b, ["lq-planner__outline", "lq-planner__outline--draft", reason && "lq-planner__outline--invalid"].filter(Boolean).join(" "), "link-target"));
      linkArrows.push(arrow(a, b ?? linkDraft.at, "link-draft", { cls: ["lq-planner__link", "lq-planner__link--draft", reason && "lq-planner__link--invalid"].filter(Boolean).join(" "), reason }));
    }
  }

  const shown = drawing ? [] : items.filter((it) => (it.id === selectedId || (!zoneMode && it.id === hoverId)) && (showRoofs || (!isRooftop(it) && it.kind !== "roof")));

  // --- Les zones, la clôture, les portails, à l'écran -------------------------------------------------
  /** Un polygone du sol, projeté : une suite de points d'écran pour un `<polygon>`. */
  const groundPoly = (pts: P[], z = 0.03) =>
    pts
      .map((q) => toScreen(q.x, q.y, z))
      .map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`)
      .join(" ");
  const rectCorners = (r: ZoneRect): P[] => [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.depth },
    { x: r.x, y: r.y + r.depth },
  ];
  /** Les cotes d'un rectangle de cases, en mètres, et sa surface. */
  const zoneDims = (r: ZoneRect) => `${r.width * 2} × ${r.depth * 2} m · ${(r.width * r.depth * 4).toLocaleString("fr-FR")} m²`;
  const zoneOverlay: ReactNode[] = [];
  const selectedZone = (zones ?? []).find((z) => z.id === selectedZoneId);
  if (selectedZone) zoneOverlay.push(<polygon key="zone-sel" className="lq-planner__zone-outline" points={groundPoly(rectCorners(selectedZone))} />);
  if (zoneDraft) {
    const r = zoneRect(zoneDraft.a, zoneDraft.b);
    const empty = r.width < 1 || r.depth < 1;
    const problem = empty ? null : zoneProblem(r);
    const c = toScreen(r.x + r.width / 2, r.y + r.depth / 2, 0.03);
    zoneOverlay.push(
      <g key="zone-draft" className={["lq-planner__zone-draft", problem && "lq-planner__zone-draft--invalid"].filter(Boolean).join(" ")}>
        <polygon points={groundPoly(rectCorners(r))} />
        {!empty && (
          <text className="lq-planner__dim" x={c.x} y={c.y} textAnchor="middle">
            {zoneDims(r)}
          </text>
        )}
        {problem && (
          <text className="lq-planner__dim lq-planner__zone-reason" x={c.x} y={c.y + 16} textAnchor="middle">
            {problem}
          </text>
        )}
      </g>
    );
  }
  /** La place d'un portail sur la clôture : un trait épais à mi-hauteur de la clôture. */
  const gateSpan = (a: P, b: P, cls: string, key: string) => {
    const lo = toScreen(a.x, a.y, 0.5);
    const hi = toScreen(b.x, b.y, 0.5);
    return <line key={key} className={cls} x1={lo.x} y1={lo.y} x2={hi.x} y2={hi.y} />;
  };
  if (fenceHover && !drawing && !placing && !zoneMode && !linkMode) {
    zoneOverlay.push(gateSpan(fenceHover.from, fenceHover.to, ["lq-planner__fence-hover", !fenceHover.valid && "lq-planner__fence-hover--invalid"].filter(Boolean).join(" "), "fence-hover"));
    if (!fenceHover.valid && fenceHover.reason) {
      const c = toScreen(fenceHover.x, fenceHover.y, 1.2);
      zoneOverlay.push(
        <text key="fence-reason" className="lq-planner__dim lq-planner__zone-reason" x={c.x} y={c.y - 8} textAnchor="middle">
          {fenceHover.reason}
        </text>
      );
    }
  }
  for (const { gate, layout: g } of laidGates) {
    if (gate.id !== selectedGateId) continue;
    const f = plotSideFrame(plot, g.side);
    zoneOverlay.push(gateSpan(f.at(g.along - g.width / 2, 0), f.at(g.along + g.width / 2, 0), "lq-planner__gate-selected", `gate-${gate.id}`));
  }
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.kind, (m.get(it.kind) ?? 0) + 1);
    return m;
  }, [items]);
  const cur = cursor && drawing ? toScreen(cursor.x, cursor.y) : null;
  const anchor = start && drawing ? toScreen(start.x, start.y) : null;
  /** Le carré de la case sous le curseur, projeté : un losange en vue de biais. */
  const cell = cursor && drawing ? [toScreen(cursor.x - 0.5, cursor.y - 0.5), toScreen(cursor.x + 0.5, cursor.y - 0.5), toScreen(cursor.x + 0.5, cursor.y + 0.5), toScreen(cursor.x - 0.5, cursor.y + 0.5)] : null;
  /** Combien d'éléments une entrée a posés — les murs, sur l'entrée « Mur » seulement. */
  const entryCount = (id: string) => {
    const entry = findEntry(id);
    if (!entry) return undefined;
    // L'application compte elle-même ce qui compte pour elle.
    if (entry.type === "piece") return undefined;
    if (entry.type === "draw" && entry.kind === "wall") return id === "wall" ? counts.get("wall") : undefined;
    return counts.get(entry.kind);
  };
  const toolButton = (entry: Entry) => {
    const url = thumbs[jobId(entry)];
    const n = entryCount(entry.id);
    const piece = entry.type === "piece" ? entry : null;
    const off = readOnly || !!piece?.disabled;
    return (
      <button
        key={entry.id}
        type="button"
        className={["lq-planner__tool", tool?.id === entry.id && "lq-planner__tool--armed", off && "lq-planner__tool--disabled"].filter(Boolean).join(" ")}
        draggable={!off}
        disabled={off}
        onDragStart={(e) => {
          e.dataTransfer.setData(DND, entry.id);
          e.dataTransfer.effectAllowed = "copy";
        }}
        onClick={() => pickTool(tool?.id === entry.id ? null : entry)}
        title={piece?.description ?? `${entry.label} — évolutions : ${TIERS[entry.kind].join(" → ")}`}
        aria-pressed={tool?.id === entry.id}
      >
        {url ? <img className="lq-planner__thumb" src={url} alt="" draggable={false} /> : <span className="lq-planner__thumb lq-planner__thumb--pending" aria-hidden />}
        <span className="lq-planner__tool-label">{entry.label}</span>
        {piece?.meta !== undefined && <span className="lq-planner__tool-meta">{piece.meta}</span>}
        {!piece && TIERS[entry.kind].length > 1 && (
          <span className="lq-planner__tool-tiers" title={TIERS[entry.kind].join(" → ")}>
            {TIERS[entry.kind].length} niveaux
          </span>
        )}
        {n ? <span className="lq-planner__tool-count">{n}</span> : null}
      </button>
    );
  };

  const hint = zoneMode
    ? zoneDraft
      ? "Lâchez pour tracer la zone — Échap pour l'annuler."
      : touchUi
        ? "Zones : posez le doigt sur le terrain et tirez. Deux doigts pour déplacer la vue."
        : "Zones : pressez sur le terrain et tirez. Clic droit + glisser pour déplacer la vue."
    : placing && touchUi
      ? `${placing.label} : touchez le terrain pour viser, puis ✓ pour poser.${ghostProblem ? ` — ${ghostProblem}` : ""}`
      : areaTool
    ? start
      ? "Cliquez le coin opposé de la toiture — Échap pour l'annuler."
      : "Toiture : cliquez un coin de la pièce à couvrir."
    : placing && mountedGhost
      ? "Approchez l'ouverture d'un mur : elle s'y accroche. Cliquez pour la poser."
      : drawing
    ? start
      ? drawing.mode === "chain"
        ? "Cliquez pour poser et continuer — double-clic, clic droit ou Échap pour finir la chaîne."
        : "Cliquez une seconde fois pour arrêter le tracé — Échap pour l'annuler."
      : `${drawing.label} : cliquez le point de départ.`
    : tool
      ? `${tool.label} : cliquez où le poser (Maj pour en poser plusieurs, R pour tourner).${ghostProblem ? ` — ${ghostProblem}` : ""}`
      : null;

  const bottom = paletteLayout === "bottom";
  /**
   * Le bandeau de la palette, en bas de la scène : les vignettes de la famille ouverte (ou les
   * résultats de la recherche), puis la rangée des onglets — une icône par famille —, la recherche et
   * le chevron qui replie le bandeau.
   */
  const renderBand = () => {
    const current = menus.find((m) => m.title === bandGroup) ?? menus[0];
    const searching = query.trim() !== "";
    const shownEntries = searching
      ? allEntries.filter((e) => fold(e.label).includes(fold(query)))
      : (current?.subs.flatMap((sub) => sub.ids) ?? []).map((id) => findEntry(id)).filter((e): e is Entry => !!e);
    return (
      <div
        ref={band}
        className={["lq-planner__band", !bandOpen && "lq-planner__band--collapsed"].filter(Boolean).join(" ")}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        role="region"
        aria-label="Palette d'éléments"
      >
        {bandOpen && (
          <div
            className="lq-planner__band-strip"
            onWheel={(e) => {
              // La molette verticale fait défiler la bande de côté.
              if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY;
            }}
          >
            {shownEntries.length ? shownEntries.map(toolButton) : <p className="lq-planner__band-empty">{searching ? "Aucun élément ne correspond." : "Rien dans cette famille."}</p>}
          </div>
        )}
        <div className="lq-planner__band-bar">
          <div className="lq-planner__band-tabs" role="tablist" aria-label="Familles d'éléments">
            {menus.map((menu) => {
              const on = !searching && menu.title === current?.title;
              const total = menu.subs.flatMap((sub) => sub.ids).reduce((n, id) => n + (entryCount(id) ?? 0), 0);
              return (
                <Tooltip key={menu.title} content={menu.title} placement="top">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={on}
                    aria-label={menu.title}
                    className={["lq-planner__band-tab", on && "is-on"].filter(Boolean).join(" ")}
                    onClick={() => {
                      setBandGroup(menu.title);
                      setQuery("");
                      setBandOpen(true);
                    }}
                  >
                    {groupIcons?.[menu.title] ?? guessGroupIcon(menu.title)}
                    {total ? <span className="lq-planner__band-count">{total}</span> : null}
                  </button>
                </Tooltip>
              );
            })}
          </div>
          <label className="lq-planner__band-search" title="Chercher un élément">
            <SearchIcon size={15} />
            <input
              type="search"
              placeholder="Chercher…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setBandOpen(true);
              }}
              aria-label="Chercher un élément"
            />
          </label>
          <button type="button" className="lq-planner__band-toggle" onClick={() => setBandOpen((o) => !o)} aria-expanded={bandOpen} aria-label={bandOpen ? "Replier la palette" : "Déplier la palette"}>
            {bandOpen ? <ChevronDownIcon size={16} /> : <ChevronUpIcon size={16} />}
          </button>
        </div>
      </div>
    );
  };

  return (
    // Le clavier est écouté sur tout l'éditeur : juste après un clic dans la palette, R doit déjà
    // tourner l'élément à poser.
    <div className={["lq-planner", bottom && "lq-planner--bottom", className].filter(Boolean).join(" ")} style={{ height }} onKeyDown={onKeyDown}>
      <SnapshotStudio jobs={jobs} width={128} height={96} onShot={(id, url) => setThumbs((t) => ({ ...t, [id]: url }))} />
      {!bottom && <aside className="lq-planner__palette" aria-label="Palette d'éléments">
        <p className="lq-planner__intro">
          {readOnly
            ? "Lecture seule : on observe, on choisit, on tourne autour."
            : entriesProp
              ? "Choisissez un élément puis cliquez sur le terrain — ou glissez-le depuis la palette. R le tourne avant la pose."
              : "Choisissez un outil puis cliquez sur le terrain — un mur se trace d'un clic à l'autre. Les éléments se glissent aussi depuis la palette."}
        </p>
        <label className="lq-planner__search">
          <SearchIcon size={13} />
          <input type="search" placeholder="Chercher un élément…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Chercher un élément" />
        </label>
        {query.trim() ? (
          <div className="lq-planner__tools">{allEntries.filter((e) => fold(e.label).includes(fold(query))).map(toolButton)}</div>
        ) : (
          menus.map((menu) => {
            const isOpen = open[menu.title] ?? false;
            const total = menu.subs.flatMap((sub) => sub.ids).reduce((n, id) => n + (entryCount(id) ?? 0), 0);
            return (
              <section key={menu.title} className="lq-planner__group">
                <button type="button" className="lq-planner__menu" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [menu.title]: !isOpen }))}>
                  {isOpen ? <ChevronDownIcon size={13} /> : <ChevronRightIcon size={13} />}
                  <span>{menu.title}</span>
                  {total ? <span className="lq-planner__menu-count">{total}</span> : null}
                </button>
                {isOpen &&
                  menu.subs.map((sub) => (
                    <div key={sub.title} className="lq-planner__sub">
                      {sub.title && <h4 className="lq-planner__sub-title">{sub.title}</h4>}
                      <div className="lq-planner__tools">{sub.ids.map((id) => findEntry(id)).filter((e): e is Entry => !!e).map(toolButton)}</div>
                    </div>
                  ))}
              </section>
            );
          })
        )}
      </aside>}

      <div className="lq-planner__main">
        <div
          ref={stage}
          className={["lq-planner__stage", drawing && "lq-planner__stage--drawing", tool?.type === "place" && "lq-planner__stage--armed", mode3d && "lq-planner__stage--3d", linkMode && "lq-planner__stage--link", zoneMode && "lq-planner__stage--zone", fenceHover && !tool && "lq-planner__stage--fence"].filter(Boolean).join(" ")}
          style={{ ["--lq-planner-palette-height" as string]: `${bottom ? bandHeight : 0}px` } as CSSProperties}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => {
            if (!drag.current) {
              setHoverId(null);
              setFenceHover(null);
            }
          }}
          onDoubleClick={() => {
            if (drawing?.mode === "chain") setStart(null);
          }}
          onContextMenu={(e) => e.preventDefault()}
          // Sans cela, le clic molette lance le défilement automatique du navigateur.
          onMouseDown={(e) => {
            if (e.button === 1) e.preventDefault();
          }}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes(DND)) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={onDrop}
          aria-label="Plan de l'entrepôt"
        >
          <IsoCamera yaw={camYaw} tilt={camTilt} zoom={1} projection={projection}>
            <WarehouseScene
              quality={quality}
              bounds={frameBounds(plot.frame)}
              cellSize={cellSize}
              viewport={{ width: size.width, height: size.height, center: { x: view.cx, y: view.cy }, zoom: view.zoom }}
              lazy={false}
              style={{ position: "absolute", inset: 0 }}
              ariaLabel="Terrain et construction"
            >
              <BuildPlot
                layout={plot}
                traffic={traffic}
                night={night}
                groundStyle={groundStyle}
                lightExclusions={lightExclusions}
                treeExclusions={treeExclusions}
                driveways={driveways}
                perimeterFence={perimeterFence}
                fenceOpenings={roadOpenings}
                gates={gates}
                quality={quality}
              />
              {zones && zones.length > 0 && <PlannerZones3D zones={zones} selectedId={selectedZoneId} />}
              {items.map((it) => (
                <PlannerItem3D
                  key={it.id}
                  item={it}
                  roofs={showRoofs}
                  night={night}
                  // Un équipement de toiture repose sur ce qu'il y a dessous — toit, chambre froide, ou sa
                  // propre ossature : jamais dans le vide.
                  support={isRooftop(it) ? rooftopSupport(it, items) : undefined}
                  // Un mur porte les ouvertures accrochées à lui — et celle qu'on s'apprête à poser.
                  mounts={isLinear(it) && (it.kind === "wall" || it.kind === "dock") ? wallMounts(it, ghost && mountedGhost ? [...items, ghost] : items) : undefined}
                />
              ))}
              {/* Le tracé en cours, déjà en volume : on voit le mur avant de le poser. */}
              {ghost && !mountedGhost && (
                <PlannerItem3D key={`ghost-${ghost.kind}-${placeRot}`} item={{ ...ghost, id: `ghost-${ghost.kind}` }} support={isRooftop(ghost) ? rooftopSupport({ ...ghost, id: `ghost-${ghost.kind}` }, items) : undefined} />
              )}
              {areaDraft && <PlannerItem3D key={`roof-${areaDraft.x}-${areaDraft.y}-${areaDraft.size?.length}-${areaDraft.size?.width}`} item={areaDraft} />}
              {draft.map((w) => (
                <PlannerItem3D key={`${w.id}:${w.x0},${w.y0},${w.x1},${w.y1}`} item={w} />
              ))}
              {sceneChildren}
            </WarehouseScene>
          </IsoCamera>
          {renderOverlay && (
            <div className="lq-planner__app-overlay">
              {renderOverlay({ toScreen, width: size.width, height: size.height, scale: cellSize * view.zoom, view: mode3d ? "3d" : "top", items })}
            </div>
          )}
          {(
            <svg className="lq-planner__overlay" width={size.width} height={size.height}>
              {zoneOverlay}
              {linkArrows}
              {highlightIds && items.filter((it) => highlightIds.includes(it.id)).map((it) => outline(it, "lq-planner__outline lq-planner__outline--highlight", `hl-${it.id}`))}
              {shown.map((it) => overlay(it, it.id === selectedId))}
              {draft.map((w, i) => outline(w, ["lq-planner__outline", "lq-planner__outline--draft", !draftOk && "lq-planner__outline--invalid"].filter(Boolean).join(" "), `draft${i}`))}
              {draft.map((w, i) => dim(w, `dd${i}`))}
              {anchor && <circle className="lq-planner__anchor" cx={anchor.x} cy={anchor.y} r={5} />}
              {(ghost ?? rawGhost) && outline((ghost ?? rawGhost) as PlannerItem, ["lq-planner__outline", "lq-planner__outline--draft", !ghostOk && "lq-planner__outline--invalid"].filter(Boolean).join(" "), "ghost")}
              {areaDraft && outline(areaDraft, ["lq-planner__outline", "lq-planner__outline--draft", !areaOk && "lq-planner__outline--invalid"].filter(Boolean).join(" "), "area")}
              {cur && cell && (
                <g className="lq-planner__cursor">
                  <polygon points={cell.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ")} />
                  <path d={`M${cur.x - 8} ${cur.y} H${cur.x + 8} M${cur.x} ${cur.y - 8} V${cur.y + 8}`} />
                </g>
              )}
            </svg>
          )}
          {zones && zones.length > 0 && (
            <div className="lq-planner__zone-labels" aria-hidden>
              {zones.map((z) => {
                const c = toScreen(z.x + z.width / 2, z.y + z.depth / 2, 0.03);
                if (c.x < -80 || c.y < -40 || c.x > size.width + 80 || c.y > size.height + 40) return null;
                return (
                  <span
                    key={z.id}
                    className={["lq-planner__zone-chip", z.assigned ? "lq-planner__zone-chip--assigned" : "lq-planner__zone-chip--open", z.id === selectedZoneId && "lq-planner__zone-chip--selected"].filter(Boolean).join(" ")}
                    style={{ left: c.x, top: c.y, ...(z.assigned && z.color ? { ["--lq-zone-color" as string]: z.color } : {}) } as CSSProperties}
                  >
                    <strong>{z.label ?? (z.assigned ? "Zone" : "Zone à affecter")}</strong>
                    <small>{zoneDims(z)}</small>
                  </span>
                );
              })}
            </div>
          )}
          {touchUi && placing && ghost && cursor && !readOnly && (() => {
            // Au doigt : la coche pose, la flèche tourne, la croix repose l'outil — sous le fantôme.
            const f = footprintOf(ghost);
            const a = toScreen(f.cx, f.cy);
            const top = Math.min(size.height - 64 - (bottom ? bandHeight : 0), a.y + Math.max(28, Math.min(90, (f.halfL + f.halfW) * cellSize * view.zoom * 0.6)));
            return (
              <div className="lq-planner__touch-place" style={{ left: Math.max(84, Math.min(size.width - 84, a.x)), top }} onPointerDown={(e) => e.stopPropagation()}>
                <button type="button" className="lq-planner__touch-ok" disabled={!ghostOk} onClick={() => placeAt(cursor, false)} aria-label="Poser ici">
                  <CheckIcon size={20} />
                </button>
                <button type="button" onClick={() => setPlaceRot((r) => (r + 90) % 360)} aria-label="Tourner d'un quart de tour">
                  <RefreshIcon size={18} />
                </button>
                <button type="button" onClick={() => setTool(null)} aria-label="Annuler la pose">
                  <CloseIcon size={18} />
                </button>
              </div>
            );
          })()}

          <div className="lq-planner__toolbar" onPointerDown={(e) => e.stopPropagation()}>
            <div className="lq-planner__switch" role="group" aria-label="Vue">
              <button type="button" className={!mode3d ? "is-on" : undefined} aria-pressed={!mode3d} onClick={() => setMode3d(false)}>
                Dessus
              </button>
              <button
                type="button"
                className={mode3d ? "is-on" : undefined}
                aria-pressed={mode3d}
                onClick={() => setMode3d(true)}
              >
                3D
              </button>
            </div>
            {projections.length > 1 && (
              <div className="lq-planner__switch" role="group" aria-label="Projection">
                {projections.includes("orthographic") && (
                  <button type="button" className={projection === "orthographic" ? "is-on" : undefined} aria-pressed={projection === "orthographic"} onClick={() => setProjection("orthographic")} title="Vue isométrique, sans fuite">
                    Iso
                  </button>
                )}
                {projections.includes("perspective") && (
                  <button type="button" className={projection === "perspective" ? "is-on" : undefined} aria-pressed={projection === "perspective"} onClick={() => setProjection("perspective")} title="Vue en perspective">
                    Perspective
                  </button>
                )}
              </div>
            )}
            {mode3d && (
              <>
                <button type="button" onClick={() => setOrbit((o) => ({ ...o, yaw: o.yaw - 45 }))} title="Tourner à gauche" aria-label="Tourner à gauche">
                  ⟲
                </button>
                <button type="button" onClick={() => setOrbit((o) => ({ ...o, yaw: o.yaw + 45 }))} title="Tourner à droite" aria-label="Tourner à droite">
                  ⟳
                </button>
              </>
            )}
            <button type="button" onClick={() => zoomBy(1.25)} title="Zoomer (+)" aria-label="Zoomer">
              +
            </button>
            <button type="button" onClick={() => zoomBy(0.8)} title="Dézoomer (−)" aria-label="Dézoomer">
              −
            </button>
            <button type="button" onClick={fit} title="Cadrer le terrain" aria-label="Cadrer le terrain">
              <MaximizeIcon size={14} />
            </button>
            <button type="button" className={showRoofs ? "is-on" : undefined} aria-pressed={showRoofs} onClick={() => setRoofs(!showRoofs)} title="Afficher ou masquer les toitures (et ce qui est posé dessus), pour voir dedans">
              Toits
            </button>
          </div>

          {showInspector && selected && !drawing && (
            <div className="lq-planner__inspector" onPointerDown={(e) => e.stopPropagation()}>
              <strong>{PLANNER_LABEL[selected.kind]}</strong>
              {isLinear(selected) ? (
                <span>{(Math.hypot(selected.x1 - selected.x0, selected.y1 - selected.y0) * 2).toFixed(0)} m</span>
              ) : (
                <span>
                  {(sizeOf(selected).length * 2).toFixed(1)} × {(sizeOf(selected).width * 2).toFixed(1)} m
                </span>
              )}
              {TIERS[selected.kind].length > 1 && (
                <span className="lq-planner__tier" title="Niveau d'évolution">
                  <span className="lq-planner__tier-pips" aria-hidden>
                    {TIERS[selected.kind].map((_, i) => (
                      <i key={i} className={i < levelOf(selected) ? "is-on" : undefined} />
                    ))}
                  </span>
                  {tierLabel(selected)}
                </span>
              )}
              {!readOnly && levelOf(selected) < TIERS[selected.kind].length && (
                <button type="button" className="lq-planner__upgrade" onClick={() => evolve(1)} title={`Améliorer : ${tierLabel(selected, levelOf(selected) + 1)} (U)`}>
                  ▲ {tierLabel(selected, levelOf(selected) + 1)}
                </button>
              )}
              {!readOnly && allowDowngrade && levelOf(selected) > 1 && (
                <button type="button" onClick={() => evolve(-1)} title="Revenir au niveau précédent (Maj + U)" aria-label="Rétrograder">
                  ▼
                </button>
              )}
              <span className="lq-planner__angle">{Math.round(headingOf(selected))}°</span>
              <button type="button" onClick={() => turn(-1)} title="Quart de tour à gauche (Maj + R)" aria-label="Quart de tour à gauche">
                ⟲ 90°
              </button>
              <button type="button" onClick={() => turn(1)} title="Quart de tour à droite (R)" aria-label="Quart de tour à droite">
                ⟳ 90°
              </button>
              {isLinear(selected) && (
                <button type="button" onClick={reverse} title="Retourner (F)">
                  ⇅ Retourner
                </button>
              )}
              {(selected.kind === "palletRack" || selected.kind === "shelf") && (
                <>
                  <label className="lq-planner__option" title="Ce que l'élément peut recevoir">
                    Stockage
                    <select value={selected.storage ?? ""} onChange={(e) => setOption({ storage: (e.target.value || undefined) as StorageClass | undefined })}>
                      <option value="">—</option>
                      {STORAGE_CLASSES.map((c) => (
                        <option key={c} value={c}>
                          {STORAGE_LABEL[c]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="lq-planner__option" title="Un passage sous l'élément, pour les engins">
                    <input type="checkbox" checked={!!selected.passage} onChange={(e) => setOption({ passage: e.target.checked })} />
                    Passage dessous
                  </label>
                </>
              )}
              {isLinear(selected) && (selected.kind === "wall" || selected.kind === "dock") && (
                <button type="button" onClick={swapDock} title="Changer en mur de quai, ou en mur plein">
                  {selected.kind === "wall" ? "→ Quai" : "→ Mur plein"}
                </button>
              )}
              <button type="button" className="lq-planner__danger" onClick={remove} title="Supprimer (Suppr)">
                <TrashIcon size={13} /> Supprimer
              </button>
            </div>
          )}

          {hint ? <div className="lq-planner__hint">{hint}</div> : mode3d && !touchUi && <div className="lq-planner__hint">Clic molette + glisser : tourner et incliner · glisser le fond : se déplacer · molette : zoomer.</div>}
          {message && <div className="lq-planner__toast">{message}</div>}
          {bottom && renderBand()}
          {items.length === 0 && !tool && !entriesProp && <div className="lq-planner__empty">Choisissez « Mur » ou « Pièce » dans la palette, puis cliquez le point de départ sur le terrain pointillé.</div>}
        </div>

        {showStatus && <footer className="lq-planner__status">
          <span>
            Terrain <strong>{plot.shape}</strong> · {plot.width * 2} × {plot.depth * 2} m · {plotArea(plot) * 4} m² constructibles
          </span>
          <label className="lq-planner__seed">
            Graine
            <input type="number" min={1} value={seed} onChange={(e) => setSeed(Math.max(1, Number(e.target.value) || 1))} />
          </label>
          <button type="button" onClick={() => setSeed(1 + Math.floor(Math.random() * 9999))} title="Tirer un autre terrain">
            <RefreshIcon size={13} /> Nouveau terrain
          </button>
          <span className="lq-planner__count">
            {items.length} élément{items.length > 1 ? "s" : ""}
          </span>
        </footer>}
      </div>
    </div>
  );
}
