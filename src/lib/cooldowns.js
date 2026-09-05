// Helper de cooldown basé sur un timestamp (secondes) stocké en base.
export function checkCooldown(lastTs, cooldownSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const ready = lastTs + cooldownSeconds;
  if (now >= ready) return { ok: true, remaining: 0, readyAt: now };
  return { ok: false, remaining: ready - now, readyAt: ready };
}

export function nowSec() {
  return Math.floor(Date.now() / 1000);
}
