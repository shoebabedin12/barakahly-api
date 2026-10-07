/** Category::getIconAttribute - first keyword found in the name wins. */
const KEYWORD_ICONS: [string, string][] = [
  ['toy', 'puzzle-piece'],
  ['educational', 'academic-cap'],
  ['book', 'book-open'],
  ['stationery', 'pencil-square'],
  ['appliance', 'home-modern'],
  ['furniture', 'home-modern'],
  ['kitchen', 'cake'],
  ['dining', 'cake'],
  ['grocery', 'cake'],
  ['food', 'cake'],
  ['gadget', 'device-phone-mobile'],
  ['electronics', 'cpu-chip'],
  ['mobile', 'device-phone-mobile'],
  ['phone', 'device-phone-mobile'],
  ['computer', 'computer-desktop'],
  ['laptop', 'computer-desktop'],
  ['camera', 'camera'],
  ['craft', 'paint-brush'],
  ['diy', 'wrench-screwdriver'],
  ['tool', 'wrench-screwdriver'],
  ['hardware', 'wrench-screwdriver'],
  ['office', 'briefcase'],
  ['comfort', 'home'],
  ['fashion', 'sparkles'],
  ['cloth', 'sparkles'],
  ['apparel', 'sparkles'],
  ['beauty', 'sparkles'],
  ['cosmetic', 'sparkles'],
  ['skin', 'sparkles'],
  ['hair', 'sparkles'],
  ['jewellery', 'gift'],
  ['jewelry', 'gift'],
  ['watch', 'gift'],
  ['accessor', 'gift'],
  ['sport', 'trophy'],
  ['fitness', 'trophy'],
  ['gym', 'trophy'],
  ['baby', 'face-smile'],
  ['kid', 'face-smile'],
  ['bag', 'shopping-bag'],
  ['luggage', 'shopping-bag'],
  ['health', 'shield-check'],
  ['medicine', 'shield-check'],
  ['car', 'truck'],
  ['auto', 'truck'],
  ['vehicle', 'truck'],
  ['music', 'musical-note'],
  ['home', 'home'],
];

export function categoryIcon(name: string): string {
  const needle = name.toLowerCase();
  return (
    KEYWORD_ICONS.find(([keyword]) => needle.includes(keyword))?.[1] ?? 'tag'
  );
}

/** Case-insensitive name order, like ORDER BY name under utf8mb4_unicode_ci. */
export function byName<T extends { name: string }>(a: T, b: T) {
  return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
}
