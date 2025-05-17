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
  raan: number;           // Add RAAN parameter (degrees)
  meanMotion?: number; // Mean motion in rad/s
  satrec: satellite.SatRec;
  tle: TLE;
  initialPhase: number; // Added for the new processTLEs function
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
    const text = await response.text();
    // console.log("Received TLE data from CelesTrak:", text.substring(0, 200) + "..."); // Keep for potential debugging if TLE fetching fails
    return parseTLEFile(text);
  } catch (error) {
    // console.error('Error fetching TLE data:', error); // Keep console.error for actual errors
    return getFallbackTLEs(); // Fallback is important
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
  
  // console.log(`Parsed ${tles.length} satellites from TLE data`);
  return tles;
}

/**
 * Process TLE data to extract orbital parameters for the simulation
 */
export function processTLEs(tles: TLE[]): SatelliteInfo[] {
  return tles.map((tle, index) => {
    try {
      // console.log(`Processing TLE for ${tle.name}:`, tle);
      const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
      
      if (!satrec) {
        throw new Error(`Failed to parse TLE for ${tle.name}`);
      }
      
      const nameMatch = tle.name.match(/IRIDIUM\s+(\d+)/i);
      const satNum = nameMatch ? parseInt(nameMatch[1]) : index + 1;
      
      const deg2rad = Math.PI / 180;
      
      // Earth's radius in km
      const earthRadius = 6371;
      
      // Calculate altitude from mean motion
      // Using the formula: a = (μ/(n²))^(1/3) where n is in radians/min
      // and μ is the Earth's gravitational parameter
      // For SGP4, we use XKE = sqrt(3.986004418e14 m³/s²) and Earth radius = 6378.135 km
      const xke = 0.0743669161; // SGP4 value (sqrt of Earth's GM)
      const semiMajorAxis = Math.pow(xke / satrec.no, 2/3) * 6378.135;
      let altitude = semiMajorAxis - earthRadius;
      
      // Cap altitude to reasonable range for Iridium (780-815 km)
      // This prevents unrealistic altitudes due to TLE parsing errors
      if (altitude < 200 || altitude > 1000) {
        // console.warn(`Capping unrealistic altitude value (${altitude.toFixed(1)} km) for ${tle.name}`);
        altitude = 780 + Math.random() * 15;
      }
      
      // Inclination (convert from radians to degrees)
      const inclination = satrec.inclo / deg2rad;
      
      // Extract RAAN (Right Ascension of the Ascending Node) from TLE data
      // and convert from radians to degrees
      const raan = satrec.nodeo / deg2rad;
      
      // Convert mean motion from rev/day to rad/s
      // 1 rev/day = 2π rad/day = 2π/86400 rad/s
      const meanMotion = satrec.no * 2 * Math.PI / 86400;
      
      return {
        id: satNum,
        name: tle.name.includes('IRIDIUM') ? tle.name : `IRIDIUM ${satNum}`,
        altitude: parseFloat(altitude.toFixed(1)),
        inclination: parseFloat(inclination.toFixed(2)),
        raan: parseFloat(raan.toFixed(2)),
        meanMotion,
        satrec,
        tle,
        initialPhase: 0 // Default initial phase
      };
    } catch (error) {
      // console.error(`Error processing TLE for satellite ${index}:`, error); // Keep for actual errors
      
      // Generate varying altitude between 780-795 km for fallback satellites
      const randomAltitude = 780 + Math.random() * 15;
      // Generate varying inclination between 86.2 and 86.6 degrees
      const randomInclination = 86.2 + Math.random() * 0.4;
      // Generate a random RAAN value for fallback satellites
      const randomRaan = Math.random() * 360; // Random RAAN between 0-360 degrees
      
      // Randomize the starting position within the orbital plane
      const randomMeanAnomaly = Math.random() * 360; // 0-360 degrees
      
      // Return a randomized satellite if parsing fails
      return {
        id: index + 1,
        name: tle.name || `IRIDIUM ${index + 1}`,
        altitude: parseFloat(randomAltitude.toFixed(1)), 
        inclination: parseFloat(randomInclination.toFixed(2)),
        raan: parseFloat(randomRaan.toFixed(2)),
        meanMotion: 2 * Math.PI / (100 * 60), // Default orbital period of 100 minutes
        satrec: null as any,
        tle,
        initialPhase: randomMeanAnomaly * (Math.PI / 180) // Convert to radians
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
    // console.error('Error calculating satellite position:', error); // Keep for actual errors
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
 * These are sample Iridium Next TLEs with varied parameters
 */
function getFallbackTLEs(): TLE[] {
  // Generate 66 fallback TLEs with varying parameters
  const fallbackTLEs: TLE[] = [];
  
  // Array of real Iridium orbital planes with proper RAAN spacing
  // Based on actual Iridium NEXT constellation measurements
  const planeRAANs = [0, 31.6, 63.2, 94.8, 126.4, 158.0];
  
  for (let i = 1; i <= 66; i++) {
    // Create 6 orbital planes with 11 satellites each
    const plane = Math.ceil(i / 11); // 1-indexed plane number
    const planeIndex = plane - 1;    // 0-indexed for array access
    
    // Satellites in same plane (0-10)
    const inPlaneIndex = (i - 1) % 11;
    
    // Generate variation in inclination (86.2-86.6 degrees)
    // Real Iridium NEXT inclination is close to 86.4°
    const incVariation = 86.4 + (Math.random() * 0.2 - 0.1); // ±0.1° variation
    
    // Use the RAAN for this plane with small variation
    const raan = planeRAANs[planeIndex] + (Math.random() * 0.5 - 0.25); // ±0.25° variation
    
    // Generate mean anomaly based on position within plane
    // For Iridium, satellites are spaced approx. 32.7° apart (360° / 11)
    // Add perturbation to make it realistic (satellites aren't perfectly spaced)
    const baseMA = inPlaneIndex * (360 / 11);
    const perturbation = Math.sin(baseMA * Math.PI/180) * 2.5; // ±2.5° sinusoidal variation
    const meanAnomaly = (baseMA + perturbation) % 360;
    
    // Format RAAN and inclination for TLE line 2
    // TLE format expects these values in fixed-width fields
    const raanStr = raan.toFixed(4).padStart(8, ' ');
    const incStr = incVariation.toFixed(4).padStart(8, ' ');
    const maStr = meanAnomaly.toFixed(4).padStart(8, ' ');
    
    // Generate a sample TLE with these parameters
    fallbackTLEs.push({
      name: `IRIDIUM ${i} (Plane ${plane})`,
      line1: `1 2500${i < 10 ? '0' + i : i}U 11999A   24120.00000000  .00000000  00000-0  00000-0 0  9999`,
      line2: `2 2500${i < 10 ? '0' + i : i}  ${incStr} ${raanStr} 0002000  00.0000 ${maStr} 14.34000000000000`
    });
  }
  
  return fallbackTLEs;
} 