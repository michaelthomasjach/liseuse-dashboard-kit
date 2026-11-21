/**
 * Photos de démonstration (Unsplash, servies par leur CDN) pour les composants qui vivent d'images :
 * `CurvedCarousel`, `TriptychScroll`. Sujets vérifiés à l'œil sur une planche le 2026-11-21.
 * `photoUrl` demande le recadrage et la largeur voulus au CDN.
 */
export interface ShowcasePhoto {
  id: string;
  title: string;
  caption: string;
}

export const INTERIOR_PHOTOS: ShowcasePhoto[] = [
  { id: "1600210492486-724fe5c67fb0", title: "Loft lumineux", caption: "Paris 11e · 92 m²" },
  { id: "1493809842364-78817add7ffb", title: "Séjour bleu nuit", caption: "Lyon · 64 m²" },
  { id: "1600607687939-ce8a6c25118c", title: "Salon bois et béton", caption: "Annecy · 140 m²" },
  { id: "1586023492125-27b2c045efd7", title: "Coin lecture", caption: "Nantes · 48 m²" },
  { id: "1618221195710-dd6b41faaea6", title: "Pièce à vivre", caption: "Bordeaux · 110 m²" },
  { id: "1554995207-c18c203602cb", title: "Séjour ouvert", caption: "Lille · 86 m²" },
  { id: "1502672260266-1c1ef2d93688", title: "Atelier aux plantes", caption: "Marseille · 57 m²" },
  { id: "1484154218962-a197022b5858", title: "Cuisine blanche", caption: "Rennes · 72 m²" },
  { id: "1505691938895-1758d7feb511", title: "Salon aux grandes fenêtres", caption: "Tours · 81 m²" },
];

export const ARCHITECTURE_PHOTOS: ShowcasePhoto[] = [
  { id: "1600585154340-be6161a56a0c", title: "Maison aux baies vitrées", caption: "Livrée en 2025" },
  { id: "1512917774080-9991f1c4c750", title: "Villa et piscine", caption: "Livrée en 2024" },
  { id: "1497366216548-37526070297c", title: "Plateau de bureaux", caption: "Livré en 2026" },
];

export const LANDSCAPE_PHOTOS: ShowcasePhoto[] = [
  { id: "1506905925346-21bda4d32df4", title: "Mer de nuages", caption: "Alpes valaisannes" },
  { id: "1464822759023-fed622ff2c3b", title: "Vallée glaciaire", caption: "Yukon" },
  { id: "1501785888041-af3ef285b470", title: "Lac émeraude", caption: "Dolomites" },
  { id: "1470071459604-3b5ec3a7fe05", title: "Crête dans la brume", caption: "Écosse" },
  { id: "1441974231531-c6227db76b6e", title: "Sous-bois", caption: "Forêt de Fontainebleau" },
  { id: "1519681393784-d120267933ba", title: "Nuit étoilée", caption: "Haute montagne" },
  { id: "1500530855697-b586d89ba3ee", title: "Route des canyons", caption: "Nevada" },
  { id: "1469474968028-56623f02e42e", title: "Aube sur les pitons", caption: "Vallée de la Lune" },
];

export const photoUrl = (id: string, width = 900, height?: number) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}${height ? `&h=${height}` : ""}&q=75`;
