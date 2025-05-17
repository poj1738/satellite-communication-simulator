import React from 'react';
import TimelinePlot from './TimelinePlot';
import type { SimulationResult } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ResultsPanelProps {
  result: SimulationResult | null;
  currentTime?: number;
}

interface TimeSeriesDataPoint {
  time: string;
  minute: number;
  activeLinks: number;
  handshakes: number;
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

  // Convert seconds to minutes for display
  const totalContactMinutes = Math.round(totalContact / 60);
  const totalOutageMinutes = Math.round(totalOutage / 60);
  const avgOutageMinutes = Math.round(avgOutage / 60);
  const totalDurationMinutes = 24 * 60; // Total minutes in a day

  // Calculate percentage based on a full day
  const contactPercentage = (totalContactMinutes / totalDurationMinutes) * 100;
  
  // Prepare hourly statistics for the table
  const hourlyStats = Array.from({ length: 24 }, () => ({ 
    handshakes: 0, 
    activeLinkSeconds: 0, 
    activeLinks: 0, // For storing minutes for display
  }));

  // Prepare time-series data for the chart (cumulative)
  const timeSeriesData: TimeSeriesDataPoint[] = [];
  let cumulativeActiveLinkMinutes = 0;
  let cumulativeHandshakes = 0;
  
  for (let i = 0; i < contactFlags.length; i++) { // i is the minuteIndex (0-1439)
    const currentHourIndex = Math.floor(i / 60); // Correct hour index for hourlyStats table

    // --- Populate hourlyStats (for the table) --- 
    if (currentHourIndex >= 0 && currentHourIndex < 24) {
      if (contactFlags[i] === 1) { // If contact in this minute i
        hourlyStats[currentHourIndex].activeLinkSeconds += 60; // Add 60 seconds
      }
      if (i > 0 && contactFlags[i-1] === 0 && contactFlags[i] === 1) {
        hourlyStats[currentHourIndex].handshakes++;
      }
    }

    // --- Populate timeSeriesData (for the chart - per minute cumulative) ---
    if (contactFlags[i] === 1) {
      cumulativeActiveLinkMinutes++;
    }
    if (i > 0 && contactFlags[i - 1] === 0 && contactFlags[i] === 1) {
      cumulativeHandshakes++;
    }
    timeSeriesData.push({
      time: `${Math.floor(i / 60)}h${i % 60}m`,
      minute: i,
      activeLinks: cumulativeActiveLinkMinutes, // Cumulative minutes of active links
      handshakes: cumulativeHandshakes,       // Cumulative handshakes
    });
  }
  
  // Convert total activeLinkSeconds to activeLinks in minutes for the hourly table display
  hourlyStats.forEach(stats => {
    stats.activeLinks = Math.round(stats.activeLinkSeconds / 60);
  });

  return (
    <div className="results-panel">
      <h2>Simulation Results</h2>
      
      <div className="results-summary">
        <div className="result-item">
          <h3>Total Contact Time</h3>
          <div className="result-value">{totalContactMinutes} minutes</div>
          <div className="result-percentage">{contactPercentage.toFixed(2)}%</div>
        </div>
        
        <div className="result-item">
          <h3>Handshake Count</h3>
          <div className="result-value">{handshakes}</div>
        </div>
        
        <div className="result-item">
          <h3>Total Outage Time</h3>
          <div className="result-value">{totalOutageMinutes} minutes</div>
        </div>
        
        <div className="result-item">
          <h3>Outage Events</h3>
          <div className="result-value">{outages}</div>
        </div>
        
        <div className="result-item">
          <h3>Average Outage Duration</h3>
          <div className="result-value">{avgOutageMinutes} minutes</div>
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
      
      <div className="time-series-container">
        <h3>Communication Statistics Over Time</h3>
        <div className="chart-wrapper" style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="time" 
                tickFormatter={(value: string, index: number) => index % (4 * 60) === 0 ? value : ''} // Show label every 4 hours for per-minute data
              />
              <YAxis yAxisId="left" />
              <Tooltip />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="activeLinks" 
                name="Cumulative Active Link Minutes" 
                stroke="#4CAF50" 
                dot={false} 
              />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="handshakes" 
                name="Cumulative Handshakes" 
                stroke="#2196F3" 
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <div className="time-series-table">
        <h3>Hourly Summary</h3>
        <table className="summary-table">
          <thead>
            <tr>
              <th>Hour</th>
              <th>Handshakes</th>
              <th>Active Links (min)</th>
              <th>Coverage %</th>
            </tr>
          </thead>
          <tbody>
            {hourlyStats.map((stats, hour) => {
              const hourCoverage = (stats.activeLinkSeconds / 3600 * 100).toFixed(1);
              
              return (
                <tr key={hour}>
                  <td>{hour.toString().padStart(2, '0')}:00 - {(hour + 1).toString().padStart(2, '0')}:00</td>
                  <td>{stats.handshakes}</td>
                  <td>{stats.activeLinks}</td>
                  <td>{hourCoverage}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultsPanel; 