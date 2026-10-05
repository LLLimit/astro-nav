export interface GeoResult {
  country: string;
  region: string;
}

export interface GeoProvider {
  lookup(request: Request, ip?: string): Promise<GeoResult>;
}

const none: GeoProvider = {
  async lookup() {
    return { country: "Unknown", region: "Unknown" };
  },
};
const proxy: GeoProvider = {
  async lookup(request) {
    if (process.env.TRUST_PROXY !== "true") return none.lookup(request);
    const country = request.headers.get("x-geo-country") || "";
    const region = request.headers.get("x-geo-region") || "";
    return {
      country: /^[A-Z]{2}$/.test(country) ? country : "Unknown",
      region: /^[\p{L}\p{N} .-]{1,100}$/u.test(region) ? region : "Unknown",
    };
  },
};

const api: GeoProvider = {
  async lookup(_request, ip) {
    const template = process.env.GEOIP_API_URL;
    if (!ip || !template || !template.includes("{ip}"))
      return none.lookup(_request);
    const target = new URL(template.replace("{ip}", encodeURIComponent(ip)));
    if (target.protocol !== "https:") return none.lookup(_request);
    const headers: Record<string, string> = { Accept: "application/json" };
    if (process.env.GEOIP_API_KEY)
      headers.Authorization = `Bearer ${process.env.GEOIP_API_KEY}`;
    const response = await fetch(target, {
      headers,
      signal: AbortSignal.timeout(1500),
    });
    if (
      !response.ok ||
      Number(response.headers.get("content-length") || 0) > 10_000
    )
      return none.lookup(_request);
    const body = await response.text();
    if (body.length > 10_000) return none.lookup(_request);
    const data = JSON.parse(body) as { country?: unknown; region?: unknown };
    const country = typeof data.country === "string" ? data.country : "";
    const region = typeof data.region === "string" ? data.region : "";
    return {
      country: /^[\p{L}\p{N} .-]{1,100}$/u.test(country) ? country : "Unknown",
      region: /^[\p{L}\p{N} .-]{1,100}$/u.test(region) ? region : "Unknown",
    };
  },
};

export function geoProvider(): GeoProvider {
  return process.env.GEOIP_PROVIDER === "proxy"
    ? proxy
    : process.env.GEOIP_PROVIDER === "api"
      ? api
      : none;
}
