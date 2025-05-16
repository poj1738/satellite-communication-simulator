import React, { useState, useEffect } from 'react';
import OrbitForm from '../components/OrbitForm';
import OrbitViewer from '../components/OrbitViewer';
import ResultsPanel from '../components/ResultsPanel';
import { simulationEngine } from '../lib/simulate';
import type { SimulationParams, SimulationResult } from '../types';
import '../styles/main.css';

const IndexPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [simulationTime, setSimulationTime] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  
  // Animation loop for the 3D view
  useEffect(() => {
    if (!result) return;
    
    let animationId: number;
    let startTime: number | null = null;
    const duration = result.contactFlags.length; // Use actual available data length
    const speed = 300; // Speed multiplier: 1 second realtime = 300 seconds simulation time
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      
      // Calculate the current simulation time (loop through duration)
      const simTime = Math.floor((elapsed / 1000) * speed) % duration;
      setSimulationTime(simTime);
      
      animationId = requestAnimationFrame(animate);
    };
    
    animationId = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [result]);
  
  // Cleanup simulation engine on unmount
  useEffect(() => {
    return () => {
      simulationEngine.dispose();
    };
  }, []);
  
  const handleSubmit = async (params: SimulationParams) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await simulationEngine.runSimulation(params);
      setResult(result);
    } catch (err) {
      setError((err as Error).message);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Satellite Communication Simulator</h1>
        <p>
          Simulate 24-hour satellite communication between a Beacon and the Iridium constellation
        </p>
      </header>
      
      <main className="app-content">
        <div className="left-panel">
          <OrbitForm onSubmit={handleSubmit} isLoading={isLoading} />
          
          {error && (
            <div className="error-message">
              <h3>Error</h3>
              <p>{error}</p>
            </div>
          )}
        </div>
        
        <div className="right-panel">
          <div className="viewer-container">
            <OrbitViewer result={result} currentTime={simulationTime} />
          </div>
          
          <div className="results-container">
            <ResultsPanel result={result} currentTime={simulationTime} />
          </div>
        </div>
      </main>
      
      <footer className="app-footer">
        <p>
          Created with React, TypeScript, and Three.js
        </p>
      </footer>
    </div>
  );
};

export default IndexPage; 