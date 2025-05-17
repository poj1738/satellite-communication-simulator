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
    
    // In our simulation, each array element represents 1 minute
    const totalMinutes = contactFlags.length;
    
    // Assuming a 24-hour (1440 minute) simulation
    const expectedTotalMinutes = 24 * 60;
    
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
      const startX = (window.start / totalMinutes) * width;
      const endX = (window.end / totalMinutes) * width;
      ctx.fillRect(startX, 0, endX - startX, height);
    });
    
    // Draw hour markers
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    // Calculate minutes per hour based on actual data length
    const minutesPerHour = totalMinutes / 24;
    
    for (let hour = 0; hour <= 24; hour++) {
      const x = (hour * minutesPerHour / totalMinutes) * width;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      
      // Add hour labels for every 2 hours to avoid crowding
      if (hour % 2 === 0 || hour === 24) {
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.fillText(`${hour}h`, x + 2, 14);
      }
    }
    
    ctx.stroke();
    
    // Draw the tracker bar at current time
    if (currentTime >= 0 && currentTime < totalMinutes) {
      const trackerX = (currentTime / totalMinutes) * width;
      
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
      
      // Format current time as hours:minutes
      const currentHour = Math.floor(currentTime / 60);
      const currentMinute = currentTime % 60;
      const timeLabel = `${currentHour}h:${currentMinute.toString().padStart(2, '0')}m`;
      
      ctx.fillStyle = '#ff0000';
      ctx.font = 'bold 12px Arial';
      ctx.fillText(timeLabel, trackerX + 5, height - 10);
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