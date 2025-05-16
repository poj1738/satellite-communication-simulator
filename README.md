# Satellite Communication Simulator

A 3D interactive web application that simulates 24-hour satellite communication between a user-configured Beacon and the Iridium satellite constellation.

## Features

- Configure a Beacon satellite with custom orbital parameters:
  - Sun-synchronous orbit
  - Non-polar orbit
  - Custom orbit with user-defined inclination and altitude
- Fetch live Two-Line Element (TLE) data for Iridium satellites from CelesTrak
- Simulate orbital mechanics and satellite communication over a 24-hour period
- Visualize handshakes between satellites with a yellow connection line
- View detailed simulation statistics including:
  - Total contact time
  - Number of handshakes
  - Outage statistics

## Technology Stack

- React + TypeScript
- Three.js with React Three Fiber for 3D visualization
- Web Workers for off-thread computation
- Satellite.js for orbital mechanics calculations

## Installation

1. Clone the repository:
   ```bash
   git clone [repository-url]
   cd satellite-communication-simulator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## How It Works

The simulator implements realistic orbital mechanics to calculate satellite positions and communication opportunities:

1. **Orbital Motion**: Satellites are placed in orbit based on TLE data or user configuration
2. **Handshake Detection**: Uses precise cone-angle test to determine when satellites can communicate
3. **Earth Blocking**: Considers line-of-sight obstruction by Earth
4. **Visualization**: Renders Earth, satellites, and communication links in 3D space

## Credits

- Orbital data provided by [CelesTrak](https://celestrak.org/)
- Orbital mechanics calculations powered by [Satellite.js](https://github.com/shashwatak/satellite-js)
