import * as satellite from 'satellite.js';

export interface TLE {
  name: string;
  line1: string;
  line2: string;
}

export interface SatelliteInfo {
  id: number;
  name: string;
  altitude: number;
  inclination: number;
  meanMotion?: number; // Mean motion in rad/s
  satrec: satellite.SatRec;
  tle: TLE;
}

// Updated CelesTrak URL for Iridium satellites using TLE format
const CELESTRAK_IRIDIUM_URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium-next&FORMAT=TLE';

/**
 * Fetch TLE data for Iridium satellites from CelesTrak
 */
export async function fetchIridiumTLEs(): Promise<TLE[]> {
  try {
    const response = await fetch(CELESTRAK_IRIDIUM_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch TLEs: ${response.statusText}`);
    }
    
    // With TLE format, we get a text response instead of JSON
    const text = await response.text();
    console.log("Received TLE data from CelesTrak:", text.substring(0, 200) + "...");
    
    // Parse the TLE format (3 lines per satellite)
    return parseTLEFile(text);
  } catch (error) {
    console.error('Error fetching TLE data:', error);
    // If anything goes wrong, fall back to stored TLEs
    return getFallbackTLEs();
  }
}

/**
 * Parse the TLE file format (3 lines per satellite)
 */
function parseTLEFile(fileContent: string): TLE[] {
  const lines = fileContent.split('\n').filter(line => line.trim() !== '');
  const tles: TLE[] = [];
  
  for (let i = 0; i < lines.length; i += 3) {
    if (i + 2 < lines.length) {
      tles.push({
        name: lines[i].trim(),
        line1: lines[i + 1].trim(),
        line2: lines[i + 2].trim()
      });
    }
  }
  
  console.log(`Parsed ${tles.length} satellites from TLE data`);
  return tles;
}

/**
 * Process TLE data to extract orbital parameters for the simulation
 */
export function processTLEs(tles: TLE[]): SatelliteInfo[] {
  return tles.map((tle, index) => {
    try {
      console.log(`Processing TLE for ${tle.name}:`, tle);
      
      // Parse TLE data using satellite.js
      const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
      
      if (!satrec) {
        throw new Error(`Failed to parse TLE for ${tle.name}`);
      }
      
      // Extract satellite name (Iridium number)
      const nameMatch = tle.name.match(/IRIDIUM\s+(\d+)/i);
      const satNum = nameMatch ? parseInt(nameMatch[1]) : index + 1;
      
      // Calculate altitude and inclination from TLE
      const deg2rad = Math.PI / 180;
      
      // Earth's radius in km
      const earthRadius = 6371;
      
      // Calculate altitude from mean motion
      // Using the formula: a = (μ/(n²))^(1/3) where n is in radians/min
      // and μ is the Earth's gravitational parameter
      // For SGP4, we use XKE = sqrt(3.986004418e14 m³/s²) and Earth radius = 6378.135 km
      const xke = 0.0743669161; // SGP4 value (sqrt of Earth's GM)
      const semiMajorAxis = Math.pow(xke / satrec.no, 2/3) * 6378.135;
      const altitude = semiMajorAxis - earthRadius;
      
      // Inclination (convert from radians to degrees)
      const inclination = satrec.inclo / deg2rad;
      
      // Convert mean motion from rev/day to rad/s
      // 1 rev/day = 2π rad/day = 2π/86400 rad/s
      const meanMotion = satrec.no * 2 * Math.PI / 86400;
      
      return {
        id: satNum,
        name: tle.name.includes('IRIDIUM') ? tle.name : `IRIDIUM ${satNum}`,
        altitude: parseFloat(altitude.toFixed(1)),
        inclination: parseFloat(inclination.toFixed(2)),
        meanMotion,
        satrec,
        tle
      };
    } catch (error) {
      console.error(`Error processing TLE for satellite ${index}:`, error);
      
      // Return a default satellite if parsing fails
      return {
        id: index + 1,
        name: tle.name || `IRIDIUM ${index + 1}`,
        altitude: 781, // Default Iridium altitude
        inclination: 86.4, // Default Iridium inclination
        meanMotion: 2 * Math.PI / (6000 * 60), // Default orbital period of ~100 minutes
        satrec: null as any,
        tle
      };
    }
  });
}

/**
 * Get the position of a satellite at a specific time
 */
export function getSatellitePosition(satrec: satellite.SatRec, date: Date): { position: satellite.EciVec3<number>; velocity: satellite.EciVec3<number> } | null {
  try {
    // Get position and velocity in Earth-Centered Inertial (ECI) coordinates
    const positionAndVelocity = satellite.propagate(satrec, date);
    
    // Return null if position is undefined or not valid
    if (!positionAndVelocity.position || !positionAndVelocity.velocity) {
      return null;
    }
    
    // Check if we got valid vectors (not boolean true as the type definition might suggest)
    if (typeof positionAndVelocity.position === 'boolean' || 
        typeof positionAndVelocity.velocity === 'boolean') {
      return null;
    }
    
    return {
      position: positionAndVelocity.position,
      velocity: positionAndVelocity.velocity
    };
  } catch (error) {
    console.error('Error calculating satellite position:', error);
    return null;
  }
}

/**
 * Calculate orbital period from semi-major axis using Kepler's Third Law
 * This is a fallback if TLE data isn't available
 */
export function calculateOrbitalPeriod(semiMajorAxis: number): number {
  const MU = 398600; // Earth gravitational parameter (km^3/s^2)
  return 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / MU);
}

/**
 * Convert rev/day to rad/s
 */
export function revPerDayToRadPerSec(revPerDay: number): number {
  // 1 rev/day = 2π rad/day = 2π/86400 rad/s
  return revPerDay * (2 * Math.PI) / 86400;
}

/**
 * Fallback TLE data if fetching fails
 * These are sample Iridium Next TLEs (may be outdated)
 */
function getFallbackTLEs(): TLE[] {
  return [
    {
      name: "IRIDIUM 106",
      line1: "1 42803U 17039A   24123.91521486  .00000079  00000+0  21043-4 0  9992",
      line2: "2 42803  86.3981 301.0999 0002014  81.8553 278.2848 14.34217653355834"
    },
    {
      name: "IRIDIUM 103",
      line1: "1 42804U 17039B   24124.02224769  .00000097  00000+0  27340-4 0  9995",
      line2: "2 42804  86.3976 300.9900 0002485  82.6050 277.5411 14.34217777355861"
    },
    {
      name: "IRIDIUM 109",
      line1: "1 42805U 17039C   24123.94054942  .00000087  00000+0  23821-4 0  9994",
      line2: "2 42805  86.3980 301.0118 0002264  86.7064 273.4376 14.34218211355842"
    },
    {
      name: "IRIDIUM 102",
      line1: "1 42806U 17039D   24124.12929127  .00000092  00000+0  25541-4 0  9996",
      line2: "2 42806  86.3979 300.9403 0002372  88.2842 271.8608 14.34217156355857"
    },
    {
      name: "IRIDIUM 105",
      line1: "1 42807U 17039E   24123.59764171  .00000078  00000+0  20893-4 0  9994",
      line2: "2 42807  86.3981 301.1631 0002325 100.1204 260.0234 14.34218107355795"
    },
    {
      name: "IRIDIUM 104",
      line1: "1 42808U 17039F   24123.71542474  .00000101  00000+0  28770-4 0  9997",
      line2: "2 42808  86.3979 301.1229 0002039  77.4747 282.6656 14.34217977355818"
    },
    {
      name: "IRIDIUM 114",
      line1: "1 42809U 17039G   24124.09126272  .00000070  00000+0  17815-4 0  9991",
      line2: "2 42809  86.3980 300.9741 0002084  91.2323 268.9089 14.34216976355869"
    },
    {
      name: "IRIDIUM 108",
      line1: "1 42810U 17039H   24124.03957499  .00000094  00000+0  26418-4 0  9995",
      line2: "2 42810  86.3947 269.3935 0001752  84.0683 276.0693 14.34218226357015"
    },
    {
      name: "IRIDIUM 112",
      line1: "1 42811U 17039J   24123.57232025  .00000085  00000+0  23356-4 0  9993",
      line2: "2 42811  86.3979 301.1724 0002222  78.1339 282.0094 14.34217669355800"
    },
    {
      name: "IRIDIUM 111",
      line1: "1 42812U 17039K   24123.48991442  .00000092  00000+0  25703-4 0  9994",
      line2: "2 42812  86.3980 301.2177 0002192  83.7992 276.3440 14.34218204355799"
    }
  ];
} 