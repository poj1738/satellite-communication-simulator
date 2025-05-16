// Satellite simulation types
import type { SatelliteInfo } from '../lib/tleService';

export type BeaconMode = 'sun-synchronous' | 'non-polar' | 'custom';

export interface BeaconConfig {
  altitude: number;
  inclination: number;
  localSolarTime?: number;
  antennaHalfAngle: number;
}

export interface IridiumConfig {
  satelliteId: number;
  altitude: number;
  inclination: number;
  antennaHalfAngle: number;
  showAllSatellites?: boolean;
  allSatellites?: SatelliteInfo[];
}

export interface SimulationParams {
  beaconMode: BeaconMode;
  beaconConfig: BeaconConfig;
  iridiumConfig: IridiumConfig;
  simulationDuration: number; // seconds
  timeStep: number; // seconds
}

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Vector extends Position {}

export interface LatLon {
  latitude: number;
  longitude: number;
}

export interface SimulationResult {
  contactFlags: Uint8Array;
  totalContact: number;
  handshakes: number;
  totalOutage: number;
  outages: number;
  avgOutage: number;
  initialPositions: {
    beacon: Position;
    iridium: Position;
  };
  initialSubpoints: {
    beacon: LatLon;
    iridium: LatLon;
  };
  allIridiumPositions?: Position[]; // Optional array for all Iridium satellite positions
  allContactData?: { [satelliteId: number]: Uint8Array }; // Optional contact data per satellite
}

export interface WorkerMessage {
  type: 'start' | 'result' | 'error' | 'progress';
  payload?: SimulationParams | SimulationResult | string | number;
} 