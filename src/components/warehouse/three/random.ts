/** Un tirage stable : la même graine donne la même suite, d'un rendu à l'autre. Un arbre, un
 *  parking, un stock ne doivent pas changer d'allure à chaque image. */
export function rng(seed: number): () => number {
  let s = Math.floor(Math.abs(seed) * 2654435761) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
