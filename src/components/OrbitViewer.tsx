import React, { useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import { Vector3, Group } from 'three';
import type { Position, SimulationResult } from '../types';
import type { SatelliteInfo } from '../lib/tleService';

// Scale factor for visualization (real distance would be too large)
const SCALE_FACTOR = 0.001;
const EARTH_RADIUS = 6371 * SCALE_FACTOR;

// Utility function to convert radians to degrees
function rad2deg(rad: number): number {
  return rad * 180 / Math.PI;
}

interface OrbitViewerProps {
  result: SimulationResult | null;
  currentTime: number;
}

// Earth component
const Earth = () => {
  return (
    <mesh>
      <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
      <meshPhongMaterial 
        color="#2244aa" 
        emissive="#001133"
        opacity={0.9} 
        transparent 
        specular="#aaddff"
        shininess={10}
      />
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
  planeNumber?: number;
}

const Satellite = ({ position, color, name, showLabel = true, trailLength = 5, currentTime, planeNumber }: SatelliteProps) => {
  const satelliteRef = useRef<Group>(null);
  
  // Scale positions for visualization
  const scaledPosition = new Vector3(
    position.x * SCALE_FACTOR,
    position.y * SCALE_FACTOR, // Keep y as y for proper 3D positioning
    position.z * SCALE_FACTOR
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
              {planeNumber !== undefined ? `${name} (P${planeNumber})` : name}
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
    start.y * SCALE_FACTOR,
    start.z * SCALE_FACTOR
  ];
  
  const endVec: [number, number, number] = [
    end.x * SCALE_FACTOR,
    end.y * SCALE_FACTOR,
    end.z * SCALE_FACTOR
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
  // Create points for the orbit path
  const segments = 128; // Increase segments for smoother orbit
  const radius = (6371 + altitude) * SCALE_FACTOR;
  const points: [number, number, number][] = [];
  
  // Generate points with rotation applied directly to each point
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    
    // Step 1: Position in x-y plane
    const x_plane = radius * Math.cos(theta);
    const y_plane = radius * Math.sin(theta);
    
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
    
    points.push([x_final, y_final, z_inclined]);
  }

  return (
    <Line 
      points={points}
      color={color}
      lineWidth={1.5}
      opacity={0.7}
      transparent
    />
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
  
  // Speed up time moderately for the visualizer
  const timeMultiplier = 20; // 20x speed for visualization - visible but not overly fast
  
  // Use a smooth time value to avoid jerky animation when animation skips frames
  // Use fractional remainder to get smooth transitions when looping
  const smoothTime = (t * timeMultiplier) % (24 * 60 * 60);
  
  const T = orbitalPeriod(a);  // Orbital period
  const n = 2 * Math.PI / T;   // Mean motion
  const theta = n * smoothTime + phaseOffset; // True anomaly

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
  currentTime: number;
  contactData?: { [satelliteId: number]: Uint8Array };
  beaconPosition: Position;
}

const IridiumConstellation: React.FC<IridiumConstellationProps> = ({
  satellites, 
  referenceAltitude, 
  referenceInclination, 
  currentTime,
  contactData,
  beaconPosition
}) => {
  if (!satellites || satellites.length === 0) return null;
  
  // console.log(`Rendering Iridium constellation with ${satellites.length} satellites`);
  
  return (
    <>
      {/* First render all orbit paths to visualize the orbital planes */}
      {satellites.map((satellite, index) => {
        const altitude = satellite.altitude || referenceAltitude;
        const inclination = Math.PI * satellite.inclination / 180.0 || referenceInclination;
        const raan = Math.PI * satellite.raan / 180.0; // Use satellite's own RAAN
        
        const plane = Math.floor(index / 11);
        const planeColors = [
          "#00FF00", "#00AAFF", "#FF2222", 
          "#FFAA00", "#AA00FF", "#FFFF00"
        ];
        const planeColor = planeColors[plane % planeColors.length];
        
        return (
          <React.Fragment key={`orbit-${satellite.id}-${index}`}> {/* Added index for more unique key */}
            <OrbitPath
              altitude={altitude}
              inclination={inclination}
              raan={raan}
              color={planeColor}
            />
          </React.Fragment>
        );
      })}
      
      {/* Then render all satellites */}
      {satellites.map((satellite, index) => {
        const altitude = satellite.altitude || referenceAltitude;
        const inclination = Math.PI * satellite.inclination / 180.0 || referenceInclination;
        const raan = Math.PI * satellite.raan / 180.0; // Use satellite's own RAAN
        
        const plane = Math.floor(index / 11);
        const inPlanePosition = index % 11;
        const phaseSpacing = 2 * Math.PI / 11;
        const phaseOffset = satellite.initialPhase !== undefined ? satellite.initialPhase : (inPlanePosition * phaseSpacing);
        
        const position = positionInOrbit(
          currentTime,
          altitude,
          inclination,
          raan,
          phaseOffset
        );
        
        const planeColors = [
            "#00FF00", "#00AAFF", "#FF2222",
            "#FFAA00", "#AA00FF", "#FFFF00"
        ];
        const planeColor = planeColors[plane % planeColors.length];
        
        const isInContact = contactData && 
                          satellite.id !== undefined && // Check if satellite.id is defined
                          contactData[satellite.id] && 
                          currentTime < contactData[satellite.id].length && 
                          !!contactData[satellite.id][Math.floor(currentTime)];
        
        return (
          <React.Fragment key={`sat-${satellite.id}-${index}`}> {/* Added index for more unique key */}
            <Satellite 
              position={position}
              color={planeColor}
              name={satellite.name}
              showLabel={false}
              currentTime={currentTime}
              planeNumber={plane + 1}
            />
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
  if (!result.initialPositions || !result.initialPositions.beacon || !result.initialPositions.iridium) {
    return (
      <>
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <Earth />
        <OrbitControls />
      </>
    );
  }

  const beaconPosition = result.initialPositions.beacon;
  const iridiumPosition = result.initialPositions.iridium; // This is the first Iridium sat
  
  const beaconAltitude = Math.sqrt(beaconPosition.x**2 + beaconPosition.y**2 + beaconPosition.z**2) - 6371;
  const iridiumReferenceAltitude = Math.sqrt(iridiumPosition.x**2 + iridiumPosition.y**2 + iridiumPosition.z**2) - 6371;
  
  const beaconInclination = Math.asin(beaconPosition.z / Math.sqrt(beaconPosition.x**2 + beaconPosition.y**2 + beaconPosition.z**2));
  const iridiumReferenceInclination = Math.asin(iridiumPosition.z / Math.sqrt(iridiumPosition.x**2 + iridiumPosition.y**2 + iridiumPosition.z**2));
  
  const beaconRAAN = Math.atan2(beaconPosition.y, beaconPosition.x);
  const iridiumReferenceRAAN = Math.atan2(iridiumPosition.y, iridiumPosition.x);
  
  const currentBeaconPosition = positionInOrbit(currentTime, beaconAltitude, beaconInclination, beaconRAAN, 0);
  
  const showingAllSatellites = result.allSatellites && result.allSatellites.length > 0;

  // console.log('Current Positions:', { /* ... */ });
  // console.log('Satellites data:', { /* ... */ });

  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <directionalLight position={[5, 5, 5]} intensity={0.5} />
      <Earth />
      <Satellite 
        position={currentBeaconPosition} 
        color="#ff2222" 
        name="Beacon"
        currentTime={currentTime}
        showLabel={true}
      />
      {!showingAllSatellites ? (
        <>
          <OrbitPath altitude={beaconAltitude} inclination={beaconInclination} raan={beaconRAAN} color="#ff8888" />
          {/* For single Iridium satellite view, use its specific data if available, or reference if not */}
          <OrbitPath
            altitude={result.allSatellites?.[0]?.altitude || iridiumReferenceAltitude}
            inclination={Math.PI * (result.allSatellites?.[0]?.inclination || rad2deg(iridiumReferenceInclination)) / 180.0}
            raan={Math.PI * (result.allSatellites?.[0]?.raan || rad2deg(iridiumReferenceRAAN)) / 180.0}
            color="#88ff88"
          />
          <Satellite 
            position={positionInOrbit(
              currentTime, 
              result.allSatellites?.[0]?.altitude || iridiumReferenceAltitude, 
              Math.PI * (result.allSatellites?.[0]?.inclination || rad2deg(iridiumReferenceInclination)) / 180.0, 
              Math.PI * (result.allSatellites?.[0]?.raan || rad2deg(iridiumReferenceRAAN)) / 180.0, 
              result.allSatellites?.[0]?.initialPhase || Math.PI/3
            )} 
            color="#22ff22"
            name={result.allSatellites?.[0]?.name || "Iridium"}
            currentTime={currentTime}
          />
          {currentTime < result.contactFlags.length && !!result.contactFlags[Math.floor(currentTime)] && (
            <Connection 
              start={currentBeaconPosition}
              end={positionInOrbit(
                currentTime, 
                result.allSatellites?.[0]?.altitude || iridiumReferenceAltitude, 
                Math.PI * (result.allSatellites?.[0]?.inclination || rad2deg(iridiumReferenceInclination)) / 180.0, 
                Math.PI * (result.allSatellites?.[0]?.raan || rad2deg(iridiumReferenceRAAN)) / 180.0, 
                result.allSatellites?.[0]?.initialPhase || Math.PI/3
              )}
              isActive={true}
            />
          )}
        </>
      ) : (
        <>
          <OrbitPath altitude={beaconAltitude} inclination={beaconInclination} raan={beaconRAAN} color="#ff8888" />
          <IridiumConstellation 
            satellites={result.allSatellites || []}
            referenceAltitude={iridiumReferenceAltitude}      // Pass reference altitude
            referenceInclination={iridiumReferenceInclination} // Pass reference inclination
            currentTime={currentTime}
            contactData={result.allContactData}
            beaconPosition={currentBeaconPosition}
          />
        </>
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
      <Canvas camera={{ position: [40, 30, 40], fov: 30 }}>
        <color attach="background" args={['#000']} />
        <ambientLight intensity={0.3} />
        <Scene result={result} currentTime={currentTime} />
      </Canvas>
    </div>
  );
};

export default OrbitViewer; 