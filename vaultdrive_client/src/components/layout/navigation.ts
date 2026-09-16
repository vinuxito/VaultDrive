export function isRouteActive(currentPath: string, targetPath: string): boolean {
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}
