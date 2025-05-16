import type { SimulationParams, WorkerMessage, SimulationResult, Position, LatLon } from '../types';

// Constants
const R_EARTH = 6371; // Earth radius (km)
const MU = 398600;    // Earth gravitational parameter (km^3/s^2)

// Utility functions for orbital mechanics
function deg2rad(deg: number): number {
  return deg * Math.PI / 180;
}

function rad2deg(rad: number): number {
  return rad * 180 / Math.PI;
}

function normalize(v: Position): Position {
  const mag = Math.hypot(v.x, v.y, v.z);
  if (mag === 0) {
    return { x: 0, y: 0, z: 0 }; // Handle zero vector case
  }
  return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
}

function dot(a: Position, b: Position): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function subtract(a: Position, b: Position): Position {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(v: Position, s: number): Position {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function add(a: Position, b: Position): Position {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function length(v: Position): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/**
 * Check if Earth is blocking the line of sight between two satellites
 * Returns true if Earth is in the way, false otherwise
 */
function isEarthBlocked(p1: Position, p2: Position): boolean {
  const v = subtract(p2, p1);
  const t = Math.max(0, Math.min(1, dot(scale(v, -1), p1) / dot(v, v)));
  const closest = add(p1, scale(v, t));
  return length(closest) < R_EARTH;
}

/**
 * Rotates a position vector from the orbital plane to the Earth-Centered Inertial (ECI) frame.
 */
function rotateOrbitPlane(pos: Position, inclination: number, raan: number): Position {
  const cosRAAN = Math.cos(raan);
  const sinRAAN = Math.sin(raan);
  const cosInc = Math.cos(inclination);
  const sinInc = Math.sin(inclination);

  const x1 = cosRAAN * pos.x - sinRAAN * pos.y;
  const y1 = sinRAAN * pos.x + cosRAAN * pos.y;
  const z1 = pos.z;

  return {
    x: x1,
    y: y1 * cosInc - z1 * sinInc,
    z: y1 * sinInc + z1 * cosInc
  };
}

function orbitalPeriod(a: number): number {
  return 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / MU);
}

/**
 * Calculates the position of a satellite in the ECI frame at a given time.
 */
function positionInOrbit(t: number, altitude: number, inclination: number, raan: number, phaseOffset: number): Position {
  const a = R_EARTH + altitude; // Semi-major axis
  const T = orbitalPeriod(a);  // Orbital period
  const n = 2 * Math.PI / T;   // Mean motion
  const theta = n * t + phaseOffset; // True anomaly

  const posOrbit = {
    x: a * Math.cos(theta),
    y: a * Math.sin(theta),
    z: 0
  };

  return rotateOrbitPlane(posOrbit, inclination, raan);
}

/**
 * Calculates the velocity of a satellite in the ECI frame at a given time.
 */
function velocityInOrbit(t: number, altitude: number, inclination: number, raan: number, phaseOffset: number): Position {
  const a = R_EARTH + altitude;
  const T = orbitalPeriod(a);
  const n = 2 * Math.PI / T;
  const theta = n * t + phaseOffset;
  const vMag = Math.sqrt(MU / a);

  // Velocity vector is perpendicular to the position vector in the orbital plane
  const velOrbit = {
    x: -vMag * Math.sin(theta),
    y: vMag * Math.cos(theta),
    z: 0
  };

  return rotateOrbitPlane(velOrbit, inclination, raan);
}

function computeRAANFromLST(lstHours: number): number {
  return (15 * lstHours) * Math.PI / 180;
}

/**
 * Calculates the inclination for a sun-synchronous orbit.
 */
function computeSunSynchronousInclination(altitude: number): number {
  // Simplified approximation (more accurate formulas exist)
  const a = R_EARTH + altitude;
  const precessionRate = 2 * Math.PI / (365.2422 * 24 * 3600); // Earth's mean motion (rad/s)
  const inclination = Math.acos(
      (-2 * precessionRate * Math.pow(a, 7/2)) / (3 * Math.sqrt(MU) * R_EARTH * R_EARTH * 0.001082616)
  );
  return inclination;
}

/**
 * Convert ECI position vector to latitude and longitude in degrees.
 * Assumes Earth rotation angle at epoch = 0 (simplified).
 */
function eciToLatLon(pos: Position): LatLon {
  const r = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
  const lat = Math.asin(pos.z / r);
  const lon = Math.atan2(pos.y, pos.x);
  return { latitude: rad2deg(lat), longitude: rad2deg(lon) };
}

/**
 * Main simulation function
 */
function runSimulation(params: SimulationParams): SimulationResult {
  const { 
    beaconMode, 
    beaconConfig, 
    iridiumConfig,
    simulationDuration,
    timeStep
  } = params;
  
  // Convert antenna half-angles from degrees to radians
  const alpha = deg2rad(beaconConfig.antennaHalfAngle);
  const beta = deg2rad(iridiumConfig.antennaHalfAngle);
  
  // Determine Beacon Orbit Parameters
  let beaconInclination: number;
  let beaconRAAN: number;
  
  try {
    if (beaconMode === 'sun-synchronous') {
      beaconInclination = computeSunSynchronousInclination(beaconConfig.altitude);
      beaconRAAN = computeRAANFromLST(beaconConfig.localSolarTime || 10);
      if (isNaN(beaconInclination)) {
        throw new Error("Invalid altitude for sun-synchronous orbit");
      }
    } else if (beaconMode === 'non-polar') {
      beaconInclination = deg2rad(beaconConfig.inclination);
      beaconRAAN = 0;
      if (beaconInclination < deg2rad(30) || beaconInclination > deg2rad(98)) {
        throw new Error("Inclination for non-polar orbit must be between 30° and 98°");
      }
    } else { // custom
      beaconInclination = deg2rad(beaconConfig.inclination);
      beaconRAAN = beaconConfig.localSolarTime 
        ? computeRAANFromLST(beaconConfig.localSolarTime) 
        : 0;
    }
  } catch (error) {
    console.error(error);
    // Default values for error cases
    beaconInclination = deg2rad(98.6);
    beaconRAAN = 0;
  }
  
  // Iridium parameters
  const iridiumInclination = deg2rad(iridiumConfig.inclination);
  const iridiumRAAN = 0; // For now, we'll use 0 as default
  
  // Initial phases
  const beaconPhase = 0;
  const iridiumPhase = Math.PI / 3; // So satellites don't start at the same position
  
  // Create the contact flags array to record when satellites can communicate
  const contactFlags = new Uint8Array(simulationDuration);
  
  // Store the initial positions for reference
  const rB0 = positionInOrbit(0, beaconConfig.altitude, beaconInclination, beaconRAAN, beaconPhase);
  const rI0 = positionInOrbit(0, iridiumConfig.altitude, iridiumInclination, iridiumRAAN, iridiumPhase);
  
  // Calculate initial subpoints (latitude, longitude)
  const beaconSubpoint = eciToLatLon(rB0);
  const iridiumSubpoint = eciToLatLon(rI0);
  
  // Variables for handling all satellites
  let allContactData: { [satelliteId: number]: Uint8Array } | undefined;
  let allIridiumPositions: Position[] | undefined;
  let allSatellites: any[] | undefined;
  
  // Initialize data for all satellites if needed
  if (iridiumConfig.showAllSatellites && iridiumConfig.allSatellites && iridiumConfig.allSatellites.length > 0) {
    allContactData = {};
    allIridiumPositions = [];
    allSatellites = iridiumConfig.allSatellites;
    
    // Initialize contact tracking for each satellite
    iridiumConfig.allSatellites.forEach(sat => {
      allContactData![sat.id] = new Uint8Array(simulationDuration);
    });
  }
  
  // Run the simulation for each time step
  for (let t = 0; t < simulationDuration; t += timeStep) {
    // Progress updates every 10% of simulation
    if (t % Math.floor(simulationDuration / 10) === 0) {
      self.postMessage({
        type: 'progress',
        payload: Math.floor((t / simulationDuration) * 100)
      });
    }
    
    // Calculate Beacon Position in ECI
    const rB = positionInOrbit(t, beaconConfig.altitude, beaconInclination, beaconRAAN, beaconPhase);
    
    // If simulating all satellites
    if (allContactData && allSatellites) {
      // Store positions of all satellites at this time step if needed
      if (t === 0) {
        allSatellites.forEach((sat, index) => {
          // Distribute satellites around the orbit
          const satPhase = (index / allSatellites!.length) * 2 * Math.PI;
          const raan = iridiumRAAN + (index % 6) * (Math.PI / 3); // Stagger RAAN for orbital planes
          const inclination = deg2rad(sat.inclination || iridiumConfig.inclination);
          const altitude = sat.altitude || iridiumConfig.altitude;
          
          // Calculate position and store it
          const pos = positionInOrbit(t, altitude, inclination, raan, satPhase);
          allIridiumPositions!.push(pos);
        });
      }
      
      // Calculate the beacon velocity for antenna direction
      const vB = velocityInOrbit(t, beaconConfig.altitude, beaconInclination, beaconRAAN, beaconPhase);
      
      // Process each satellite individually
      allSatellites.forEach((sat, index) => {
        // Get satellite parameters
        const satPhase = (index / allSatellites!.length) * 2 * Math.PI;
        const raan = iridiumRAAN + (index % 6) * (Math.PI / 3);
        const inclination = deg2rad(sat.inclination || iridiumConfig.inclination);
        const altitude = sat.altitude || iridiumConfig.altitude;
        
        // Calculate position for this satellite
        const rI = positionInOrbit(t, altitude, inclination, raan, satPhase);
        
        // Check if Earth is blocking line of sight
        if (isEarthBlocked(rB, rI)) {
          allContactData![sat.id][t] = 0;
          return; // Skip to next satellite
        }
        
        // Calculate Line-of-Sight vectors
        const los = normalize(subtract(rI, rB));      // LOS vector from Beacon to Iridium
        const los_rev = scale(los, -1);              // LOS vector from Iridium to Beacon
        
        // Calculate antenna directions
        const u_beacon_forward = normalize(vB);        // Beacon forward direction along velocity
        const u_beacon_backward = scale(u_beacon_forward, -1); // Beacon backward direction
        const u_iridium = normalize(scale(rI, -1));   // Iridium nadir-pointing direction
        
        // Apply precise cone-angle test for antennas
        const beaconForwardCos = dot(los, u_beacon_forward);
        const beaconBackwardCos = dot(los, u_beacon_backward);
        const iridiumCos = dot(los_rev, u_iridium);
        
        // Check if either Beacon antenna direction is within half-angle
        const beaconAligned = beaconForwardCos >= Math.cos(alpha) || beaconBackwardCos >= Math.cos(alpha);
        
        // Check if Iridium antenna is within half-angle
        const iridiumAligned = iridiumCos >= Math.cos(beta);
        
        // Record contact status
        allContactData![sat.id][t] = (beaconAligned && iridiumAligned) ? 1 : 0;
        
        // Update the main contact flags if this is the selected satellite
        if (sat.id === iridiumConfig.satelliteId) {
          contactFlags[t] = allContactData![sat.id][t];
        }
      });
    } else {
      // Standard simulation for a single Iridium satellite
      const rI = positionInOrbit(t, iridiumConfig.altitude, iridiumInclination, iridiumRAAN, iridiumPhase);
      const vB = velocityInOrbit(t, beaconConfig.altitude, beaconInclination, beaconRAAN, beaconPhase);
      
      // Check if Earth is blocking line of sight
      if (isEarthBlocked(rB, rI)) {
        contactFlags[t] = 0;
        continue;
      }
      
      // Calculate Line-of-Sight (LOS) vectors
      const los = normalize(subtract(rI, rB));      // LOS vector from Beacon to Iridium
      const los_rev = scale(los, -1);              // LOS vector from Iridium to Beacon
      
      // Calculate antenna directions
      const u_beacon_forward = normalize(vB);        // Beacon forward direction along velocity
      const u_beacon_backward = scale(u_beacon_forward, -1); // Beacon backward direction
      const u_iridium = normalize(scale(rI, -1));   // Iridium nadir-pointing direction
      
      // Apply precise cone-angle test for antennas
      const beaconForwardCos = dot(los, u_beacon_forward);
      const beaconBackwardCos = dot(los, u_beacon_backward);
      const iridiumCos = dot(los_rev, u_iridium);
      
      // Check if either Beacon antenna direction is within half-angle
      const beaconAligned = beaconForwardCos >= Math.cos(alpha) || beaconBackwardCos >= Math.cos(alpha);
      
      // Check if Iridium antenna is within half-angle
      const iridiumAligned = iridiumCos >= Math.cos(beta);
      
      // Record contact status
      contactFlags[t] = (beaconAligned && iridiumAligned) ? 1 : 0;
    }
  }
  
  // Analyze results - properly count handshakes only AFTER Earth-blocking check
  const totalContact = contactFlags.reduce((sum, v) => sum + v, 0);
  
  let handshakes = 0;
  for (let t = 1; t < simulationDuration; t++) {
    if (contactFlags[t - 1] === 0 && contactFlags[t] === 1) handshakes++;
  }
  
  const totalOutage = simulationDuration - totalContact;
  
  let outages = 0;
  for (let t = 1; t < simulationDuration; t++) {
    if (contactFlags[t - 1] === 1 && contactFlags[t] === 0) outages++;
  }
  
  const avgOutage = outages > 0 ? totalOutage / outages : 0;
  
  // Return simulation results
  const result: SimulationResult = {
    contactFlags,
    totalContact,
    handshakes,
    totalOutage,
    outages,
    avgOutage,
    initialPositions: {
      beacon: rB0,
      iridium: rI0
    },
    initialSubpoints: {
      beacon: beaconSubpoint,
      iridium: iridiumSubpoint
    }
  };
  
  // Add multi-satellite data if available
  if (allContactData && allIridiumPositions && allSatellites) {
    result.allContactData = allContactData;
    result.allIridiumPositions = allIridiumPositions;
    (result as any).allSatellites = allSatellites;
  }
  
  return result;
}

// Web Worker event handler
self.addEventListener('message', (e: MessageEvent) => {
  const message = e.data as WorkerMessage;
  
  if (message.type === 'start' && message.payload) {
    try {
      const simulationParams = message.payload as SimulationParams;
      const result = runSimulation(simulationParams);
      
      self.postMessage({
        type: 'result',
        payload: result
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      self.postMessage({
        type: 'error',
        payload: errorMessage
      });
    }
  }
});

export {}; // To ensure this is treated as a module 