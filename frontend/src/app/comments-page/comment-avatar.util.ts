const AVATAR_COLORS = [
  '#3b71ca',
  '#14a44d',
  '#e4a11b',
  '#dc4c64',
  '#54b4d3',
  '#6c757d',
  '#9d4edd',
];

export function getAuthorInitials(userName: string): string {
  const words = userName.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return '?';
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return (words[0][0] + words[1][0]).toUpperCase();
}

export function getAvatarColor(userName: string): string {
  let hash = 0;

  for (let i = 0; i < userName.length; i++) {
    hash = (hash * 31 + userName.charCodeAt(i)) >>> 0;
  }

  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
