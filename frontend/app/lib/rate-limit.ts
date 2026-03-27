const requests = new Map<string, number[]>();

export function rateLimit(ip: string, limit: number = 60, windowMs: number = 60000): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;
  const userRequests = (requests.get(ip) || []).filter(t => t > windowStart);

  if (userRequests.length >= limit) {
    return false; // rate limited
  }

  userRequests.push(now);
  requests.set(ip, userRequests);
  return true; // allowed
}

// Clean up old entries periodically
setInterval(() => {
  const cutoff = Date.now() - 120000;
  requests.forEach((times, ip) => {
    const filtered = times.filter(t => t > cutoff);
    if (filtered.length === 0) requests.delete(ip);
    else requests.set(ip, filtered);
  });
}, 60000);
