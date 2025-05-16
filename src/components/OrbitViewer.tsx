import React, { useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import { Vector3, Group } from 'three';
import type { Position, SimulationResult } from '../types';
import type { SatelliteInfo } from '../lib/tleService';

// Scale factor for visualization (real distance would be too large)
const SCALE_FACTOR = 0.001;
const EARTH_RADIUS = 6371 * SCALE_FACTOR;

interface OrbitViewerProps {
  result: SimulationResult | null;
  currentTime: number;
}

// Earth component
const Earth = () => {
  return (
    <mesh>
      <sphereGeometry args={[EARTH_RADIUS, 32, 32]} />
      <meshPhongMaterial color="#2233ff" opacity={0.8} transparent />
    </mesh>
  );
};

// Timestamp for position history
interface TimedPosition {
  position: Position;
  timestamp: number;
}

// Satellite component with trajectory trail
interface SatelliteProps {
  position: Position;
  color: string;
  name: string;
  showLabel?: boolean;
  trailLength?: number; // Trail length in seconds
  currentTime: number;
}

const Satellite = ({ position, color, name, showLabel = true, trailLength = 5, currentTime }: SatelliteProps) => {
  const satelliteRef = useRef<Group>(null);
  
  // Scale positions for visualization
  const scaledPosition = new Vector3(
    position.x * SCALE_FACTOR,
    position.z * SCALE_FACTOR, // Swap Y and Z for better visualization
    position.y * SCALE_FACTOR
  );
  
  return (
    <group ref={satelliteRef}>
      <mesh position={scaledPosition}>
        <sphereGeometry args={[EARTH_RADIUS * 0.05, 16, 16]} />
        <meshBasicMaterial color={color} />
        {showLabel && (
          <Html position={[0, EARTH_RADIUS * 0.1, 0]}>
            <div style={{ 
              color: 'white', 
              padding: '2px 5px', 
              backgroundColor: 'rgba(0,0,0,0.5)', 
              borderRadius: '3px',
              fontSize: '11px' 
            }}>
              {name}
            </div>
          </Html>
        )}
      </mesh>
    </group>
  );
};

// Connection line between satellites when in contact
interface ConnectionProps {
  start: Position;
  end: Position;
  isActive: boolean;
}

const Connection = ({ start, end, isActive }: ConnectionProps) => {
  // Skip rendering if not active (no handshake)
  if (!isActive) return null;
  
  // Calculate start and end points for the connection line
  const startVec: [number, number, number] = [
    start.x * SCALE_FACTOR,
    start.z * SCALE_FACTOR,
    start.y * SCALE_FACTOR
  ];
  
  const endVec: [number, number, number] = [
    end.x * SCALE_FACTOR,
    end.z * SCALE_FACTOR,
    end.y * SCALE_FACTOR
  ];
  
  const points: [number, number, number][] = [startVec, endVec];

  // Always render a bright yellow line for handshakes
  return (
    <Line 
      points={points}
      color="#ffff00"
      lineWidth={3} // Make it a bit thicker for visibility
      transparent
      opacity={0.9}
    />
  );
};

// Orbit path
interface OrbitPathProps {
  altitude: number;
  inclination: number;
  raan: number;
  color: string;
}

const OrbitPath = ({ altitude, inclination, raan, color }: OrbitPathProps) => {
  // Create orbit path with proper rotation
  const orbitRef = useRef<Group>(null);
  
  // Create points for the orbit path
  const segments = 64;
  const radius = (6371 + altitude) * SCALE_FACTOR;
  const points: [number, number, number][] = [];
  
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    points.push([
      radius * Math.cos(theta),
      0,
      radius * Math.sin(theta)
    ]);
  }
  
  // Apply rotations to the group
  useEffect(() => {
    if (orbitRef.current) {
      orbitRef.current.rotation.x = inclination;
      orbitRef.current.rotation.y = raan;
    }
  }, [inclination, raan]);

  return (
    <group ref={orbitRef}>
      <Line 
        points={points}
        color={color}
        opacity={0.5}
        transparent
      />
    </group>
  );
};

// Helper functions for orbital calculations
function orbitalPeriod(a: number): number {
  const MU = 398600; // Earth gravitational parameter (km^3/s^2)
  return 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / MU);
}

function positionInOrbit(t: number, altitude: number, inclination: number, raan: number, phaseOffset: number): Position {
  const R_EARTH = 6371; // Earth radius (km)
  const a = R_EARTH + altitude; // Semi-major axis
  const T = orbitalPeriod(a);  // Orbital period
  const n = 2 * Math.PI / T;   // Mean motion
  const theta = n * t + phaseOffset; // True anomaly

  const cosRAAN = Math.cos(raan);
  const sinRAAN = Math.sin(raan);
  const cosInc = Math.cos(inclination);
  const sinInc = Math.sin(inclination);

  // Position in orbital plane
  const x_orbit = a * Math.cos(theta);
  const y_orbit = a * Math.sin(theta);
  
  // Rotate to ECI frame
  const x1 = cosRAAN * x_orbit - sinRAAN * y_orbit;
  const y1 = sinRAAN * x_orbit + cosRAAN * y_orbit;
  
  return {
    x: x1,
    y: y1 * cosInc,
    z: y1 * sinInc
  };
}

// Scene component that updates with time
interface SceneProps {
  result: SimulationResult;
  currentTime: number;
}

// Add a component to render multiple satellites
interface IridiumConstellationProps {
  satellites: SatelliteInfo[];
  referenceAltitude: number;
  referenceInclination: number;
  referenceRAAN: number;
  currentTime: number;
  contactData?: { [satelliteId: number]: Uint8Array };
  beaconPosition: Position;
}

const IridiumConstellation: React.FC<IridiumConstellationProps> = ({
  satellites, 
  referenceAltitude, 
  referenceInclination, 
  referenceRAAN, 
  currentTime,
  contactData,
  beaconPosition
}) => {
  if (!satellites || satellites.length === 0) return null;
  
  console.log(`Rendering Iridium constellation with ${satellites.length} satellites`);
  
  return (
    <>
      {satellites.map((satellite, index) => {
        // Determine phase offset for each satellite to distribute them in the constellation
        // This is a simplified way to place satellites in orbit
        const phaseOffset = (index / satellites.length) * 2 * Math.PI;
        
        // Use the actual satellite's altitude and inclination if available
        const altitude = satellite.altitude || referenceAltitude;
        const inclination = Math.PI * satellite.inclination / 180.0 || referenceInclination;
        
        // Calculate RAAN staggered by satellite index
        const raan = referenceRAAN + (index % 6) * (Math.PI / 3);
        
        // Calculate position for this satellite
        const position = positionInOrbit(
          currentTime,
          altitude,
          inclination,
          raan,
          phaseOffset
        );
        
        // Check if this satellite is in contact with the beacon
        const isInContact = contactData && 
                            contactData[satellite.id] && 
                            currentTime < contactData[satellite.id].length && 
                            !!contactData[satellite.id][Math.floor(currentTime)];
        
        return (
          <React.Fragment key={satellite.id}>
            {/* Render the satellite */}
            <Satellite 
              position={position}
              color="#22ff22"
              name={satellite.name}
              showLabel={false} // Only show labels for a few satellites to avoid clutter
              currentTime={currentTime}
            />
            
            {/* Render yellow line only when there's a handshake */}
            {isInContact && (
              <Connection 
                start={beaconPosition}
                end={position}
                isActive={true}
              />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};

const Scene = ({ result, currentTime }: SceneProps) => {
  // Check for null or undefined initial positions
  if (!result.initialPositions || !result.initialPositions.beacon || !result.initialPositions.iridium) {
    // Return a default scene with Earth only if no initial positions
    return (
      <>
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <Earth />
        <OrbitControls />
      </>
    );
  }

  // Get actual parameters from the simulation results
  const beaconPosition = result.initialPositions.beacon;
  const iridiumPosition = result.initialPositions.iridium;
  
  // Calculate altitude from position vectors
  const beaconAltitude = Math.sqrt(
    Math.pow(beaconPosition.x, 2) + 
    Math.pow(beaconPosition.y, 2) + 
    Math.pow(beaconPosition.z, 2)
  ) - 6371;
  
  const iridiumAltitude = Math.sqrt(
    Math.pow(iridiumPosition.x, 2) + 
    Math.pow(iridiumPosition.y, 2) + 
    Math.pow(iridiumPosition.z, 2)
  ) - 6371;
  
  // Estimate inclination from initial position
  const beaconInclination = Math.asin(
    beaconPosition.z / 
    Math.sqrt(
      Math.pow(beaconPosition.x, 2) + 
      Math.pow(beaconPosition.y, 2) + 
      Math.pow(beaconPosition.z, 2)
    )
  );
  
  const iridiumInclination = Math.asin(
    iridiumPosition.z / 
    Math.sqrt(
      Math.pow(iridiumPosition.x, 2) + 
      Math.pow(iridiumPosition.y, 2) + 
      Math.pow(iridiumPosition.z, 2)
    )
  );
  
  // Estimate RAAN from initial position
  const beaconRAAN = Math.atan2(beaconPosition.y, beaconPosition.x);
  const iridiumRAAN = Math.atan2(iridiumPosition.y, iridiumPosition.x);
  
  // Calculate current positions based on orbital mechanics
  const currentBeaconPosition = positionInOrbit(
    currentTime, 
    beaconAltitude, 
    beaconInclination, 
    beaconRAAN, 
    0
  );
  
  const currentIridiumPosition = positionInOrbit(
    currentTime, 
    iridiumAltitude, 
    iridiumInclination, 
    iridiumRAAN, 
    Math.PI/3
  );
  
  // Check if satellites are in contact at the current time
  const isInContact = currentTime < result.contactFlags.length 
    ? !!result.contactFlags[Math.floor(currentTime)] 
    : false;
  
  // Check if we're showing all Iridium satellites
  const showingAllSatellites = result.allContactData !== undefined && result.allIridiumPositions !== undefined;

  // Debug log to verify positions
  console.log('Current Positions:', {
    time: currentTime,
    beacon: currentBeaconPosition,
    iridium: currentIridiumPosition,
    inContact: isInContact
  });

  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      
      <Earth />
      
      {/* Always render the Beacon satellite */}
      <Satellite 
        position={currentBeaconPosition} 
        color="#ff2222" 
        name="Beacon"
        currentTime={currentTime}
      />
      
      {/* Either show single Iridium satellite or the constellation */}
      {!showingAllSatellites ? (
        <>
          {/* Render Iridium satellite explicitly */}
          <Satellite 
            position={currentIridiumPosition} 
            color="#22ff22"
            name="Iridium"
            currentTime={currentTime}
          />
          
          {/* Yellow line shows connection when handshake occurs */}
          {isInContact && (
            <Connection 
              start={currentBeaconPosition}
              end={currentIridiumPosition}
              isActive={true}
            />
          )}
        </>
      ) : (
        /* Show all Iridium satellites if data is available */
        <IridiumConstellation 
          satellites={(result as any).allSatellites || []}
          referenceAltitude={iridiumAltitude}
          referenceInclination={iridiumInclination}
          referenceRAAN={iridiumRAAN}
          currentTime={currentTime}
          contactData={result.allContactData}
          beaconPosition={currentBeaconPosition}
        />
      )}
      
      <OrbitControls />
    </>
  );
};

const OrbitViewer: React.FC<OrbitViewerProps> = ({ result, currentTime }) => {
  if (!result) {
    return <div className="orbit-viewer-placeholder">Run simulation to view orbits</div>;
  }

  return (
    <div className="orbit-viewer">
      <Canvas camera={{ position: [0, 15, 15], fov: 50 }}>
        <Scene result={result} currentTime={currentTime} />
      </Canvas>
    </div>
  );
};

export default OrbitViewer; 