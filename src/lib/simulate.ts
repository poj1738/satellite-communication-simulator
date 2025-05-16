import type { SimulationParams, SimulationResult, WorkerMessage } from '../types';

/**
 * A class to manage the satellite simulation using a Web Worker
 */
class SimulationEngine {
  private worker: Worker | null = null;
  private isRunning: boolean = false;
  
  /**
   * Initialize the simulation engine
   */
  constructor() {
    this.initWorker();
  }
  
  /**
   * Initialize or reinitialize the Web Worker
   */
  private initWorker() {
    if (this.worker) {
      this.worker.terminate();
    }
    
    // Create a new worker instance
    this.worker = new Worker(
      new URL('../workers/simulation.worker.ts', import.meta.url),
      { type: 'module' }
    );
  }
  
  /**
   * Run the satellite simulation with the given parameters
   * @param params The simulation parameters
   * @returns A promise that resolves with the simulation results
   */
  public runSimulation(params: SimulationParams): Promise<SimulationResult> {
    if (this.isRunning) {
      throw new Error('A simulation is already running');
    }
    
    this.isRunning = true;
    
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        this.initWorker();
      }
      
      if (!this.worker) {
        reject(new Error('Failed to initialize Web Worker'));
        this.isRunning = false;
        return;
      }
      
      // Set up message handler
      this.worker.onmessage = (e: MessageEvent) => {
        const message = e.data as WorkerMessage;
        
        switch (message.type) {
          case 'result':
            this.isRunning = false;
            resolve(message.payload as SimulationResult);
            break;
          
          case 'error':
            this.isRunning = false;
            reject(new Error(message.payload as string));
            // Reinitialize the worker after an error
            this.initWorker();
            break;
          
          case 'progress':
            console.log(`Simulation progress: ${message.payload}%`);
            break;
        }
      };
      
      // Handle worker errors
      this.worker.onerror = (error) => {
        this.isRunning = false;
        reject(new Error(`Worker error: ${error.message}`));
        // Reinitialize the worker after an error
        this.initWorker();
      };
      
      // Start the simulation
      const workerMessage: WorkerMessage = {
        type: 'start',
        payload: params
      };
      
      this.worker.postMessage(workerMessage);
    });
  }
  
  /**
   * Abort the current simulation
   */
  public abortSimulation() {
    if (!this.isRunning) {
      return;
    }
    
    // Terminate and reinitialize the worker
    this.initWorker();
    this.isRunning = false;
  }
  
  /**
   * Clean up resources when the simulation engine is no longer needed
   */
  public dispose() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isRunning = false;
  }
}

// Export a singleton instance
export const simulationEngine = new SimulationEngine();

// Also export the class for testing or if multiple instances are needed
export default SimulationEngine; 