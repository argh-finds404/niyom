export function compareDeadlines(
  previousDateStr: string,
  currentDateStr: string
): "extended" | "shortened" | "unchanged" {
  const prevTime = Date.parse(previousDateStr.includes("T") ? previousDateStr : `${previousDateStr}T00:00:00Z`);
  const currTime = Date.parse(currentDateStr.includes("T") ? currentDateStr : `${currentDateStr}T00:00:00Z`);

  if (isNaN(prevTime) || isNaN(currTime)) {
    if (previousDateStr === currentDateStr) return "unchanged";
    return currentDateStr > previousDateStr ? "extended" : "shortened";
  }

  if (currTime > prevTime) {
    return "extended";
  }
  if (currTime < prevTime) {
    return "shortened";
  }
  return "unchanged";
}

