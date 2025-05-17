import React, { useState, useEffect } from 'react';
import type { BeaconMode, SimulationParams } from '../types';
import { fetchIridiumTLEs, processTLEs } from '../lib/tleService';
import type { SatelliteInfo } from '../lib/tleService';

interface OrbitFormProps {
  onSubmit: (params: SimulationParams) => void;
  isLoading: boolean;
}

const OrbitForm: React.FC<OrbitFormProps> = ({ onSubmit, isLoading }) => {
  const [beaconMode, setBeaconMode] = useState<BeaconMode>('sun-synchronous');
  const [beaconAltitude, setBeaconAltitude] = useState<number>(600);
  const [beaconInclination, setBeaconInclination] = useState<number>(97.5);
  const [beaconLST, setBeaconLST] = useState<number>(11);
  const [beaconAntennaHalfAngle, setBeaconAntennaHalfAngle] = useState<number>(60);
  
  const [iridiumSatelliteId, setIridiumSatelliteId] = useState<number>(1);
  const [iridiumAntennaHalfAngle, setIridiumAntennaHalfAngle] = useState<number>(31);
  const [showAllIridium, setShowAllIridium] = useState<boolean>(false);
  
  // State to store actual Iridium satellites fetched from TLEs
  const [iridiumSatellites, setIridiumSatellites] = useState<SatelliteInfo[]>([]);
  const [isLoadingTLEs, setIsLoadingTLEs] = useState<boolean>(false);
  const [tleError, setTleError] = useState<string | null>(null);
  
  // Fetch TLE data on component mount
  useEffect(() => {
    const loadTLEs = async () => {
      setIsLoadingTLEs(true);
      setTleError(null);
      
      try {
        const tles = await fetchIridiumTLEs();
        const satellites = processTLEs(tles);
        setIridiumSatellites(satellites);
        
        // If we have satellites, select the first one by default
        if (satellites.length > 0) {
          setIridiumSatelliteId(satellites[0].id);
        }
      } catch (error) {
        console.error('Failed to load Iridium TLEs:', error);
        setTleError('Failed to load satellite data. Using fallback data.');
        
        // Create fallback data with initialPhase property
        const fallbackSatellites: SatelliteInfo[] = Array.from({ length: 66 }, (_, i) => ({
          id: i + 1,
          name: `IRIDIUM ${i + 1}`,
          altitude: 781,
          inclination: 86.4,
          raan: (Math.ceil((i + 1) / 11) - 1) * 31.6, // Distribute RAAN based on plane
          satrec: null as any,
          tle: { name: '', line1: '', line2: '' },
          initialPhase: Math.random() * 2 * Math.PI  // Add a random phase between 0 and 2π
        }));
        
        setIridiumSatellites(fallbackSatellites);
      } finally {
        setIsLoadingTLEs(false);
      }
    };
    
    loadTLEs();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const selectedIridium = iridiumSatellites.find(sat => sat.id === iridiumSatelliteId) || 
                           (iridiumSatellites.length > 0 ? iridiumSatellites[0] : {
                             id: 1,
                             name: 'IRIDIUM 1',
                             altitude: 781,
                             inclination: 86.4,
                             raan: 0,
                             satrec: null as any,
                             tle: { name: '', line1: '', line2: '' },
                             initialPhase: 0
                           });
    
    const params: SimulationParams = {
      beaconMode,
      beaconConfig: {
        altitude: beaconAltitude,
        inclination: beaconInclination,
        localSolarTime: beaconLST,
        antennaHalfAngle: beaconAntennaHalfAngle
      },
      iridiumConfig: {
        satelliteId: selectedIridium.id,
        altitude: selectedIridium.altitude,
        inclination: selectedIridium.inclination,
        antennaHalfAngle: iridiumAntennaHalfAngle,
        showAllSatellites: showAllIridium,
        allSatellites: showAllIridium ? iridiumSatellites : []
      },
      simulationDuration: 24 * 3600, // 24 hours in seconds
      timeStep: 1 // 1 second step
    };
    
    onSubmit(params);
  };

  return (
    <div className="orbit-form">
      <h2>Satellite Configuration</h2>
      
      {tleError && (
        <div className="tle-error-message">
          <p>{tleError}</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <h3>Beacon Configuration</h3>
          
          <div className="form-group">
            <label htmlFor="beacon-mode">Beacon Mode:</label>
            <select 
              id="beacon-mode" 
              value={beaconMode}
              onChange={(e) => setBeaconMode(e.target.value as BeaconMode)}
            >
              <option value="sun-synchronous">Sun-synchronous</option>
              <option value="non-polar">Non-polar</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="beacon-altitude">Altitude (km):</label>
            <input 
              type="text" 
              id="beacon-altitude" 
              value={beaconAltitude === 0 ? '' : beaconAltitude.toString()}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '') {
                  setBeaconAltitude(0);
                } else {
                  const parsedValue = parseFloat(value);
                  if (!isNaN(parsedValue)) {
                    setBeaconAltitude(parsedValue);
                  }
                }
              }}
              min="200"
              max="2000"
              step="0.1"
            />
            <div className="focus-indicator"></div>
          </div>
          
          {beaconMode === 'sun-synchronous' && (
            <div className="form-group">
              <label htmlFor="beacon-lst">Local Solar Time (hours):</label>
              <input 
                type="text" 
                id="beacon-lst" 
                value={beaconLST === 0 ? '' : beaconLST.toString()}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setBeaconLST(0);
                  } else {
                    const parsedValue = parseFloat(value);
                    if (!isNaN(parsedValue)) {
                      setBeaconLST(parsedValue);
                    }
                  }
                }}
                min="0"
                max="24"
                step="0.1"
              />
            </div>
          )}
          
          {(beaconMode === 'non-polar' || beaconMode === 'custom') && (
            <div className="form-group">
              <label htmlFor="beacon-inclination">Inclination (degrees):</label>
              <input 
                type="text" 
                id="beacon-inclination" 
                value={beaconInclination === 0 ? '' : beaconInclination.toString()}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setBeaconInclination(0);
                  } else {
                    const parsedValue = parseFloat(value);
                    if (!isNaN(parsedValue)) {
                      setBeaconInclination(parsedValue);
                    }
                  }
                }}
                min="0"
                max="180"
                step="0.1"
              />
            </div>
          )}
          
          <div className="form-group">
            <label htmlFor="beacon-antenna">Antenna Half-Angle (degrees):</label>
            <input 
              type="text" 
              id="beacon-antenna" 
              value={beaconAntennaHalfAngle === 0 ? '' : beaconAntennaHalfAngle.toString()}
              onChange={(e) => {
                const value = e.target.value;
                // Allow empty input for better typing experience
                if (value === '') {
                  setBeaconAntennaHalfAngle(0);
                } else {
                  const parsedValue = parseFloat(value);
                  // Only update if it's a valid number
                  if (!isNaN(parsedValue)) {
                    setBeaconAntennaHalfAngle(parsedValue);
                  }
                }
              }}
              min="0"
              max="180"
              step="0.1"
            />
            <div className="focus-indicator"></div>
          </div>
        </div>
        
        <div className="form-section">
          <h3>Iridium Configuration</h3>
          
          <div className="form-group">
            <label htmlFor="iridium-satellite">Iridium Satellite:</label>
            <select 
              id="iridium-satellite" 
              value={iridiumSatelliteId}
              onChange={(e) => setIridiumSatelliteId(Number(e.target.value))}
              disabled={isLoadingTLEs || showAllIridium}
            >
              {isLoadingTLEs ? (
                <option>Loading satellites...</option>
              ) : (
                iridiumSatellites.map(sat => (
                  <option key={sat.id} value={sat.id}>
                    {sat.name} (Alt: {sat.altitude} km, Inc: {sat.inclination}°)
                  </option>
                ))
              )}
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="show-all-iridium">
              <input
                type="checkbox"
                id="show-all-iridium"
                checked={showAllIridium}
                onChange={(e) => setShowAllIridium(e.target.checked)}
                disabled={isLoadingTLEs}
              />
              <span style={{ marginLeft: '8px' }}>Show All Iridium Satellites</span>
            </label>
            <div className="info-text">
              {showAllIridium ? 
                "All Iridium satellites will be displayed in the visualization" : 
                "Only the selected satellite will be displayed"}
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="iridium-antenna">Antenna Half-Angle (degrees):</label>
            <input 
              type="text" 
              id="iridium-antenna" 
              value={iridiumAntennaHalfAngle === 0 ? '' : iridiumAntennaHalfAngle.toString()}
              onChange={(e) => {
                const value = e.target.value;
                // Allow empty input for better typing experience
                if (value === '') {
                  setIridiumAntennaHalfAngle(0);
                } else {
                  const parsedValue = parseFloat(value);
                  // Only update if it's a valid number
                  if (!isNaN(parsedValue)) {
                    setIridiumAntennaHalfAngle(parsedValue);
                  }
                }
              }}
              min="0"
              max="180"
              step="0.1"
            />
            <div className="focus-indicator"></div>
          </div>
          
          {/* Display selected satellite details */}
          {!isLoadingTLEs && iridiumSatellites.length > 0 && !showAllIridium && (
            <div className="selected-satellite-info">
              <h4>Selected Satellite Details</h4>
              {iridiumSatellites.find(sat => sat.id === iridiumSatelliteId) ? (
                <div className="satellite-details">
                  <p>
                    <strong>Name:</strong> {iridiumSatellites.find(sat => sat.id === iridiumSatelliteId)?.name}
                  </p>
                  <p>
                    <strong>Altitude:</strong> {iridiumSatellites.find(sat => sat.id === iridiumSatelliteId)?.altitude} km
                  </p>
                  <p>
                    <strong>Inclination:</strong> {iridiumSatellites.find(sat => sat.id === iridiumSatelliteId)?.inclination}°
                  </p>
                  <p>
                    <strong>RAAN:</strong> {iridiumSatellites.find(sat => sat.id === iridiumSatelliteId)?.raan}°
                  </p>
                </div>
              ) : (
                <p>Select a satellite to see details</p>
              )}
            </div>
          )}
          
          {!isLoadingTLEs && iridiumSatellites.length > 0 && showAllIridium && (
            <div className="all-satellites-info">
              <h4>Constellation Details</h4>
              <p>
                <strong>Total Satellites:</strong> {iridiumSatellites.length}
              </p>
              <p>
                <strong>Average Altitude:</strong> {(iridiumSatellites.reduce((sum, sat) => sum + sat.altitude, 0) / iridiumSatellites.length).toFixed(1)} km
              </p>
              <p>
                <strong>Average Inclination:</strong> {(iridiumSatellites.reduce((sum, sat) => sum + sat.inclination, 0) / iridiumSatellites.length).toFixed(1)}°
              </p>
            </div>
          )}
        </div>
        
        <button type="submit" disabled={isLoading || isLoadingTLEs}>
          {isLoading ? 'Simulating...' : 'Run Simulation'}
        </button>
      </form>
    </div>
  );
};

export default OrbitForm; 