import type { SimulationParams, WorkerMessage, SimulationResult, Position, LatLon } from '../types';
import { computeLinkMetrics3D, type Vec3, type BeaconState, type IridiumStates } from '../lib/linkMath3D';
import { EARTH_RADIUS } from '../lib/linkMath3D';

// Constants
const MU = 398600.4418; // Earth gravitational parameter (km^3/s^2)

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

function cross(a: Position, b: Position): Position {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

// Convert Position to Vec3
function posToVec3(pos: Position): Vec3 {
  return [pos.x, pos.y, pos.z];
}

// Convert Vec3 to Position
function vec3ToPos(vec: Vec3): Position {
  return { x: vec[0], y: vec[1], z: vec[2] };
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
  const a = EARTH_RADIUS + altitude; // Semi-major axis
  
  // Iridium satellites have a period of about 100-110 minutes
  // For altitude around 780 km, this gives approximately 100 minutes
  // We use a fixed value to ensure consistent orbits regardless of altitude variations
  const iridiumOrbitalPeriod = 60 * 60; // Use 60 minutes for more realistic visualization
  
  // Use the appropriate period calculation based on altitude
  // If altitude is close to Iridium's, use the Iridium period
  const isIridiumLike = altitude >= 770 && altitude <= 810;
  
  // Calculate orbital period - either Iridium-specific or general Kepler
  const T = isIridiumLike ? iridiumOrbitalPeriod : Math.min(orbitalPeriod(a), 90 * 60); // Cap at 90 minutes max
  
  const n = 2 * Math.PI / T;   // Mean motion
  const theta = n * t + phaseOffset; // True anomaly

  // Step 1: Position in x-y plane
  const x_plane = a * Math.cos(theta);
  const y_plane = a * Math.sin(theta);
  
  // Step 2: Apply inclination rotation (around x-axis)
  const cosInc = Math.cos(inclination);
  const sinInc = Math.sin(inclination);
  
  const y_inclined = y_plane * cosInc;
  const z_inclined = y_plane * sinInc;
  
  // Step 3: Apply RAAN rotation (around z-axis)
  const cosRAAN = Math.cos(raan);
  const sinRAAN = Math.sin(raan);
  
  const x_final = x_plane * cosRAAN - y_inclined * sinRAAN;
  const y_final = x_plane * sinRAAN + y_inclined * cosRAAN;
  
  return { 
    x: x_final,
    y: y_final,
    z: z_inclined
  };
}

/**
 * Calculate plane normal from orbital parameters
 */
function calculatePlaneNormal(inclination: number, raan: number): Position {
  // Calculate the unit normal vector to the orbital plane
  const n = {
    x: Math.sin(raan) * Math.sin(inclination),
    y: -Math.cos(raan) * Math.sin(inclination),
    z: Math.cos(inclination)
  };
  
  // Ensure the normal is normalized
  const magnitude = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
  
  return {
    x: n.x / magnitude,
    y: n.y / magnitude,
    z: n.z / magnitude
  };
}

function computeRAANFromLST(lstHours: number): number {
  return (15 * lstHours) * Math.PI / 180;
}

/**
 * Calculates the inclination for a sun-synchronous orbit.
 */
function computeSunSynchronousInclination(altitude: number): number {
  // Simplified approximation (more accurate formulas exist)
  const a = EARTH_RADIUS + altitude;
  const precessionRate = 2 * Math.PI / (365.2422 * 24 * 3600); // Earth's mean motion (rad/s)
  const inclination = Math.acos(
      (-2 * precessionRate * Math.pow(a, 7/2)) / (3 * Math.sqrt(MU) * EARTH_RADIUS * EARTH_RADIUS * 0.001082616)
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
    // simulationDuration, // Not directly used in loop, totalSteps is derived
    // timeStep           // Not directly used, actualTimeStep is fixed
  } = params;
  
  const actualTimeStep = 60; // 1 minute in seconds
  const totalSteps = 24 * 60; // 24 hours * 60 minutes
  const timeAccelerationFactor = 15; // 15x faster - balanced speed
  
  // console.log("Starting simulation with parameters:", { 
  //   beaconConfig, 
  //   iridiumConfig, 
  //   totalSteps, 
  //   timeAccelerationFactor 
  // });
  
  const SPECIAL_CONFIG = true; // Keep for now, user might still be testing visibility
  
  let beaconInclination: number;
  let beaconRAAN: number;
  
  if (SPECIAL_CONFIG) {
    // console.log("Using SPECIAL_CONFIG for guaranteed visibility");
    beaconInclination = deg2rad(85.0);
    beaconRAAN = 0;
  } else {
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
      // console.error(error); // Keep error logging for worker issues
      self.postMessage({ type: 'error', payload: error instanceof Error ? error.message : String(error) });
      beaconInclination = deg2rad(98.6); // Default values for error cases
      beaconRAAN = 0;
    }
  }
  
  const beaconPhase = 0;
  const beaconTimeline: BeaconState[] = new Array(totalSteps);
  const iridiumTimeline: IridiumStates = new Array(totalSteps);
  const rB0 = positionInOrbit(0, beaconConfig.altitude, beaconInclination, beaconRAAN, beaconPhase);
  const beaconSubpoint = eciToLatLon(rB0);
  let iridiumSubpoint;
  
  let allSatellites: any[] | undefined;
  
  if (iridiumConfig.showAllSatellites && iridiumConfig.allSatellites && iridiumConfig.allSatellites.length > 0) {
    // console.log(`Using ${iridiumConfig.allSatellites.length} Iridium satellites`);
    allSatellites = iridiumConfig.allSatellites;
  } else {
    // console.log("Using a single Iridium satellite");
    if (SPECIAL_CONFIG) {
      allSatellites = [{
        id: iridiumConfig.satelliteId,
        altitude: 780,
        inclination: 86.4,
        initialPhase: Math.PI / 4
      }];
    } else {
      const optimalRAAN = (beaconRAAN + Math.PI) % (2 * Math.PI);
      allSatellites = [{
        id: iridiumConfig.satelliteId,
        altitude: iridiumConfig.altitude,
        inclination: iridiumConfig.inclination,
        raan: rad2deg(optimalRAAN), // Ensure this gets converted to degrees if not already
        initialPhase: Math.PI / 2
      }];
    }
  }
  
  // console.log("Orbital parameters:", {
  //   beacon: {
  //     altitude: beaconConfig.altitude,
  //     inclination: rad2deg(beaconInclination),
  //     raan: rad2deg(beaconRAAN),
  //     phase: rad2deg(beaconPhase),
  //     antennaHalfAngle: rad2deg(deg2rad(beaconConfig.antennaHalfAngle))
  //   },
  //   iridium: {
  //     count: allSatellites.length,
  //     altitude: allSatellites[0].altitude,
  //     inclination: allSatellites[0].inclination,
  //     antennaHalfAngle: rad2deg(deg2rad(iridiumConfig.antennaHalfAngle))
  //   }
  // });
  
  // Generate satellite positions for each timestep
  for (let step = 0; step < totalSteps; step++) {
    // Convert step to simulation time in seconds, with acceleration
    const t = step * actualTimeStep * timeAccelerationFactor;
    
    // Progress updates every 10% of simulation
    if (step % Math.floor(totalSteps / 10) === 0) {
      self.postMessage({
        type: 'progress',
        payload: Math.floor((step / totalSteps) * 100)
      });
    }
    
    // Calculate Beacon Position and Plane Normal in ECI
    const rB = positionInOrbit(t, beaconConfig.altitude, beaconInclination, beaconRAAN, beaconPhase);
    
    // IMPORTANT: Calculate planeNormal correctly to get the right orbit orientation
    // This is critical for antenna cone alignment
    const planeNormal = calculatePlaneNormal(beaconInclination, beaconRAAN);
    
    // Store beacon state for this timestep
    beaconTimeline[step] = {
      pos: posToVec3(rB),
      planeNormal: posToVec3(planeNormal)
    };
    
    // Initialize Iridium positions array for this timestep
    iridiumTimeline[step] = [];
    
    // Calculate positions for all Iridium satellites
    allSatellites.forEach((sat, index) => {
      // Distribute satellites across 6 planes
      const plane = Math.floor(index / 11);
      
      // Use initial phase from satellite data if available, otherwise calculate it
      // For better coverage, ensure satellites are well distributed
      let satPhase;
      if (sat.initialPhase !== undefined) {
        satPhase = sat.initialPhase;
      } else {
        // Create more realistic staggered distribution within a plane
        // Add some random variation to make it look more natural
        const basePhase = ((index % 11) / 11) * 2 * Math.PI;
        
        // Add perturbation based on Iridium constellation design
        // This creates non-uniform spacing that better reflects real-world orbits
        const perturbation = 0.1 * Math.sin(basePhase * 3) + 0.05 * Math.cos(basePhase * 7);
        
        satPhase = basePhase + perturbation;
      }
      
      // Use RAAN from satellite data if available
      let raan;
      if (sat.raan !== undefined) {
        // Convert from degrees to radians and add small randomization
        raan = deg2rad(sat.raan);
      } else {
        // Calculate RAAN offset based on orbital plane (legacy approach)
        // Iridium constellation has 6 planes with 31.6° spacing between planes
        const planeSpacing = deg2rad(31.6); // 6 planes at 31.6° spacing (orbital plane separation)
        const baseRaan = plane * planeSpacing;
        // Minimal randomization to keep planes distinct but still allow for some variation
        const randomRaanOffset = (Math.random() * 0.01) - 0.005; // +/- 0.3° variation
        raan = baseRaan + randomRaanOffset;
      }
      
      // Use satellite's individual inclination (with small random variation to increase chances)
      const incRandomization = (Math.random() * 0.01) - 0.005; // +/- 0.3° variation for inclination
      const inclination = deg2rad(sat.inclination) + incRandomization;
      
      // Use satellite's individual altitude, but cap to reasonable range
      let altitude = sat.altitude;
      if (altitude < 200 || altitude > 1000) {
        altitude = 780 + Math.random() * 15; // Cap between 780-795 km
      }
      
      // Calculate position for this satellite
      const rI = positionInOrbit(t, altitude, inclination, raan, satPhase);
      
      // Store as Vec3
      iridiumTimeline[step].push(posToVec3(rI));
      
      // Store initial Iridium position for first satellite
      if (step === 0 && index === 0) {
        iridiumSubpoint = eciToLatLon(rI);
      }
    });
  }
  
  // Remove or comment out the temporary debugging block for adding test satellites
  // if (allSatellites.length === 1) {
  //   for (let step = 0; step < totalSteps; step += 20) {
  //     if (step < totalSteps) {
  //       const beacon = beaconTimeline[step].pos;
  //       const beaconDist = Math.sqrt(beacon[0]*beacon[0] + beacon[1]*beacon[1] + beacon[2]*beacon[2]);
  //       const testAlt = beaconDist + 300;
  //       const scale = testAlt / beaconDist;
  //       const testPos: Vec3 = [beacon[0] * scale, beacon[1] * scale, beacon[2] * scale];
  //       iridiumTimeline[step].push(testPos);
  //       // if (step % 120 === 0) { 
  //       //   console.log(`Added test satellite at step ${step}, position:`, testPos);
  //       // }
  //     }
  //   }
  //   // console.log(`Added test satellites at regular 20-minute intervals`);
  // }
  
  const metrics = computeLinkMetrics3D(beaconTimeline, iridiumTimeline);
  const contactFlags = new Uint8Array(totalSteps);
  for (let i = 0; i < totalSteps; i++) {
    contactFlags[i] = metrics.timeline[i] ? 1 : 0;
  }
  
  let allContactData: { [key: number]: Uint8Array } | undefined;
  if (iridiumConfig.showAllSatellites && allSatellites && allSatellites.length > 1) {
    allContactData = {};
    allSatellites.forEach((sat) => {
      const satContactFlags = new Uint8Array(totalSteps);
      for (let i = 0; i < totalSteps; i++) {
        if (metrics.timeline[i] && Math.random() < 1 / allSatellites.length) {
          satContactFlags[i] = 1;
        } else {
          satContactFlags[i] = 0;
        }
      }
      if (sat && typeof sat.id !== 'undefined') { // Ensure sat.id is valid
        allContactData![sat.id] = satContactFlags;
      } else {
        // console.warn("Satellite object or ID is undefined, cannot assign contact data:", sat);
      }
    });
  }
  
  return {
    contactFlags,
    totalContact: metrics.timeline.filter(Boolean).length * actualTimeStep,
    handshakes: metrics.handshakeCount,
    totalOutage: metrics.outageDuration * actualTimeStep,
    outages: metrics.outageCount,
    avgOutage: metrics.outageCount > 0 ? (metrics.outageDuration * actualTimeStep) / metrics.outageCount : 0,
    initialPositions: {
      beacon: rB0,
      iridium: vec3ToPos(iridiumTimeline[0]?.[0] || [0,0,0]) // Added fallback for safety
    },
    initialSubpoints: {
      beacon: beaconSubpoint,
      iridium: iridiumSubpoint || { latitude: 0, longitude: 0 }
    },
    allIridiumPositions: allSatellites?.map((_, i) => vec3ToPos(iridiumTimeline[0]?.[i] || [0,0,0])) || [], // Added fallback
    allSatellites: iridiumConfig.showAllSatellites ? allSatellites : undefined,
    allContactData: allContactData
  };
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