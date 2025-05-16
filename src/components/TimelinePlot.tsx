import React, { useEffect, useRef } from 'react';

interface TimelinePlotProps {
  contactFlags: Uint8Array;
  currentTime?: number;
}

interface ContactWindow {
  start: number;
  end: number;
  duration: number;
}

const TimelinePlot: React.FC<TimelinePlotProps> = ({ contactFlags, currentTime = 0 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Convert contact flags to time segments for easier display
  const getContactWindows = () => {
    if (!contactFlags || contactFlags.length === 0) return [];
    
    const windows: ContactWindow[] = [];
    let startTime = -1;
    
    for (let i = 0; i < contactFlags.length; i++) {
      if (contactFlags[i] === 1 && startTime === -1) {
        startTime = i;
      } else if (contactFlags[i] === 0 && startTime !== -1) {
        windows.push({
          start: startTime,
          end: i - 1,
          duration: i - startTime
        });
        startTime = -1;
      }
    }
    
    // Handle case where contact continues until the end
    if (startTime !== -1) {
      windows.push({
        start: startTime,
        end: contactFlags.length - 1,
        duration: contactFlags.length - startTime
      });
    }
    
    return windows;
  };

  // Draw the timeline
  useEffect(() => {
    if (!canvasRef.current || !contactFlags || contactFlags.length === 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const totalTime = contactFlags.length;
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw timeline background
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, width, height);
    
    // Draw contact windows
    const windows = getContactWindows();
    ctx.fillStyle = '#4CAF50';
    
    windows.forEach(window => {
      const startX = (window.start / totalTime) * width;
      const endX = (window.end / totalTime) * width;
      ctx.fillRect(startX, 0, endX - startX, height);
    });
    
    // Draw hour markers
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    for (let hour = 0; hour <= 24; hour++) {
      const x = (hour * 3600 / totalTime) * width;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      
      // Add hour labels
      if (hour % 4 === 0) {
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.fillText(`${hour}h`, x + 2, 14);
      }
    }
    
    ctx.stroke();
    
    // Draw the tracker bar at current time
    if (currentTime >= 0 && currentTime < totalTime) {
      const trackerX = (currentTime / totalTime) * width;
      
      // Draw tracker line
      ctx.beginPath();
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.moveTo(trackerX, 0);
      ctx.lineTo(trackerX, height);
      ctx.stroke();
      
      // Draw tracker handle/indicator
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(trackerX, height - 5, 5, 0, Math.PI * 2);
      ctx.fill();
      
      // Show current time label
      const currentHour = (currentTime / 3600).toFixed(1);
      ctx.fillStyle = '#ff0000';
      ctx.font = 'bold 12px Arial';
      ctx.fillText(`${currentHour}h`, trackerX + 5, height - 10);
    }
    
  }, [contactFlags, currentTime]);

  return (
    <div className="timeline-plot">
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={80}
        style={{ width: '100%', height: '80px' }}
      />
      <div className="timeline-legend">
        <div className="legend-item">
          <div className="color-box contact"></div>
          <span>Contact</span>
        </div>
        <div className="legend-item">
          <div className="color-box no-contact"></div>
          <span>No Contact</span>
        </div>
        <div className="legend-item">
          <div className="color-box tracker" style={{ backgroundColor: '#ff0000' }}></div>
          <span>Current Time</span>
        </div>
      </div>
    </div>
  );
};

export default TimelinePlot; 