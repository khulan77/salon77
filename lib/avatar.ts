// Stable soft colour and initials for people and services in lists and grids.
const tones = ["violet", "rose", "sage", "sky", "sand", "olive", "lilac"];
export function tone(id: string) {
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  return tones[Math.abs(hash) % tones.length];
}
// Colours handed out in list order, so the first seven items never share one.
export const toneAt = (index: number) => tones[index % tones.length];
export function initials(name: string) {
  const words = name.trim().split(/\s+/);
  return (
    words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)
  ).toUpperCase();
}
