import React from 'react';
import TimelinePlot from './TimelinePlot';
import type { SimulationResult } from '../types';

interface ResultsPanelProps {
  result: SimulationResult | null;
  currentTime?: number;
}

const ResultsPanel: React.FC<ResultsPanelProps> = ({ result, currentTime = 0 }) => {
  if (!result) {
    return <div className="results-panel empty">Run a simulation to see results</div>;
  }

  const {
    totalContact,
    handshakes,
    totalOutage,
    outages,
    avgOutage,
    initialSubpoints,
    contactFlags
  } = result;

  const totalDuration = result.contactFlags.length;
  const contactPercentage = (totalContact / totalDuration) * 100;

  return (
    <div className="results-panel">
      <h2>Simulation Results</h2>
      
      <div className="results-summary">
        <div className="result-item">
          <h3>Total Contact Time</h3>
          <div className="result-value">{totalContact} seconds</div>
          <div className="result-percentage">{contactPercentage.toFixed(2)}%</div>
        </div>
        
        <div className="result-item">
          <h3>Handshake Count</h3>
          <div className="result-value">{handshakes}</div>
        </div>
        
        <div className="result-item">
          <h3>Total Outage Time</h3>
          <div className="result-value">{totalOutage} seconds</div>
        </div>
        
        <div className="result-item">
          <h3>Outage Events</h3>
          <div className="result-value">{outages}</div>
        </div>
        
        <div className="result-item">
          <h3>Average Outage Duration</h3>
          <div className="result-value">{avgOutage.toFixed(1)} seconds</div>
        </div>
      </div>
      
      <div className="initial-positions">
        <h3>Initial Positions (t=0)</h3>
        {initialSubpoints && initialSubpoints.beacon && initialSubpoints.iridium ? (
          <>
            <div className="position-item">
              <h4>Beacon</h4>
              <div>Latitude: {initialSubpoints.beacon.latitude.toFixed(2)}°</div>
              <div>Longitude: {initialSubpoints.beacon.longitude.toFixed(2)}°</div>
            </div>
            <div className="position-item">
              <h4>Iridium</h4>
              <div>Latitude: {initialSubpoints.iridium.latitude.toFixed(2)}°</div>
              <div>Longitude: {initialSubpoints.iridium.longitude.toFixed(2)}°</div>
            </div>
          </>
        ) : (
          <p>Initial position data not available</p>
        )}
      </div>
      
      <div className="timeline-container">
        <h3>Contact Timeline</h3>
        <TimelinePlot contactFlags={contactFlags} currentTime={currentTime} />
      </div>
    </div>
  );
};

export default ResultsPanel; 