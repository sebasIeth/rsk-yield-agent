import { fetchSovrynAPYs, SovrynAPYs } from "./sovryn";
import { fetchTropykusAPYs, TropykusAPYs } from "./tropykus";
import { fetchMOCAPYs, MOCAPYs } from "./moc";

export interface ProtocolAPYs {
  timestamp: string;
  sovryn: SovrynAPYs;
  tropykus: TropykusAPYs;
  moneyonchain: MOCAPYs;
}

export async function fetchAllAPYs(rpcUrl: string): Promise<ProtocolAPYs> {
  console.log(`[${new Date().toISOString()}] [Fetcher] Fetching APYs from all protocols...`);

  const [sovryn, tropykus, moneyonchain] = await Promise.all([
    fetchSovrynAPYs(rpcUrl),
    fetchTropykusAPYs(rpcUrl),
    fetchMOCAPYs(),
  ]);

  const result: ProtocolAPYs = {
    timestamp: new Date().toISOString(),
    sovryn,
    tropykus,
    moneyonchain,
  };

  console.log(`[${new Date().toISOString()}] [Fetcher] APYs fetched successfully`);
  return result;
}

export type { SovrynAPYs } from "./sovryn";
export type { TropykusAPYs } from "./tropykus";
export type { MOCAPYs } from "./moc";
